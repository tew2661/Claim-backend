import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Inject, forwardRef, NotAcceptableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { InspectionDetailEntity, ActiveStatus, SupplierEditStatus, PartStatus } from './entities/inspection-detail.entity';
import { InspectionItemEntity } from './entities/inspection-item.entity';
import { InspectionSpecialRequestEntity, SpecialRequestStatus } from './entities/inspection-special-request.entity';
import { SupplierService } from 'src/supplier/supplier.service';
import { UsersEntity } from 'src/users/entities/users.entity';
import { SdsLogService } from 'src/sample-data-sheet/sds-log.service';
import { SampleDataSheetService } from 'src/sample-data-sheet/sample-data-sheet.service';
import * as moment from 'moment';
import { join, normalize } from 'path';
import { readFileSync } from 'fs';
import { PDFDocument, rgb } from 'pdf-lib';
import * as fontkit from '@pdf-lib/fontkit';
import { SampleDataSheetResponse } from 'src/sample-data-sheet/interfaces/sample-data-sheet-response.interface';
import { configPath } from 'src/path-files-config';
import { EmailService } from 'src/email/email.service';

export interface CreateInspectionItemDto {
  no: number;
  measuringItem: string;
  specification: string;
  tolerancePlus: string;
  toleranceMinus: string;
  inspectionInstrument: string;
  rank: string;
}

export interface CreateInspectionDetailDto {
  supplierCode: string;
  supplierName: string;
  partNo: string;
  partName: string;
  model: string;
  aisFile?: string | null;
  sdrFile?: string | null;
  inspectionItems: CreateInspectionItemDto[];
  partStatus: string;
  supplierEditStatus: string;
}

export interface CreateSpecialRequestDto {
  inspectionDetailId: number;
  specialRequestItems: number[];
  qty: number;
  cpCpk: string;
  dueDate: Date;
  comments?: string;
  status?: SpecialRequestStatus;
}

export interface InspectionDetailFilterOptions {
  supplierCode?: string;
  partNo?: string;
  partName?: string;
  model?: string;
  partStatus?: string;
  supplierEditStatus?: string;
}

export interface InspectionDetailListOptions extends InspectionDetailFilterOptions {
  skip?: number;
  take?: number;
}

@Injectable()
export class InspectionDetailService {
  constructor(
    @InjectRepository(InspectionDetailEntity)
    private readonly inspectionDetailRepo: Repository<InspectionDetailEntity>,
    @InjectRepository(InspectionItemEntity)
    private readonly inspectionItemRepo: Repository<InspectionItemEntity>,
    @InjectRepository(InspectionSpecialRequestEntity)
    private readonly specialRequestRepo: Repository<InspectionSpecialRequestEntity>,
    private readonly supplierService: SupplierService,
    @Inject(forwardRef(() => SdsLogService))
    private readonly sdsLogService: SdsLogService,
    private readonly sampleDataSheetService: SampleDataSheetService,
    private readonly emailService: EmailService,
  ) { }

  async create(dto: CreateInspectionDetailDto, actionBy?: UsersEntity) {
    // ถ้า partStatus เป็น Active ให้บังคับ supplierEditStatus เป็น Locked
    let supplierEditStatus = dto.supplierEditStatus;
    if (dto.partStatus === 'Active') {
      supplierEditStatus = 'Locked';
    }

    // Calculate due date as 25th of current month
    const now = new Date();
    const dueDate = new Date(now.getFullYear(), now.getMonth(), 25);

    // สร้าง record หลัก
    const detail = this.inspectionDetailRepo.create({
      supplierCode: dto.supplierCode,
      supplierName: dto.supplierName,
      partNo: dto.partNo,
      partName: dto.partName,
      model: dto.model,
      aisFile: dto.aisFile ?? undefined,
      sdrFile: dto.sdrFile ?? undefined,
      partStatus: dto.partStatus as any,
      supplierEditStatus: supplierEditStatus as any,
      dueDate,
    });

    const savedDetail = await this.inspectionDetailRepo.save(detail);

    // สร้าง inspection items
    if (dto.inspectionItems && dto.inspectionItems.length) {
      const items = dto.inspectionItems.map((it) =>
        this.inspectionItemRepo.create({
          inspectionDetailId: savedDetail.id,
          no: it.no,
          measuringItem: it.measuringItem,
          specification: it.specification,
          tolerancePlus: it.tolerancePlus,
          toleranceMinus: it.toleranceMinus,
          inspectionInstrument: it.inspectionInstrument,
          rank: it.rank as any,
        }),
      );
      await this.inspectionItemRepo.save(items);
    }

     

    // Create log for inspection detail creation
    await this.sdsLogService.createLog({
      menu: 'Inspection Detail',
      sdsInspectionDetailId: savedDetail.id,
      partNo: savedDetail.partNo,
      sdsMonthYear: null,
      action: 'Create',
      actionRole: actionBy?.role || 'System',
      actionBy: actionBy?.name || 'System',
      actionDate: new Date(),
      remark: null,
    });

    // Notify JTEKT (Access Management Master) users upon creation when Part Status is INACTIVE and Edit Status is LOCKED
    try {
      if (actionBy?.role === 'Supplier' && savedDetail.partStatus === PartStatus.Inactive && savedDetail.supplierEditStatus === SupplierEditStatus.Locked) {
        const jtektUsers = await this.inspectionDetailRepo.manager.getRepository(UsersEntity).find({
          where: { accessMasterManagement: 'Y', active: 'Y' },
        });
        const to = jtektUsers.map(u => u.email).filter(Boolean).join(',');
        if (to) {
          const baseUrl = process.env.MAIL_LINK_WEBAPP_JTEKT_SDS ?? 'http://192.168.3.156:8000/';
          const subject = `New Edit Inspection Details Request: ${savedDetail.partNo}`;
          const html = `
            <div style="font-family: Arial, 'Noto Sans Thai', sans-serif; color: #222; line-height: 1.6;">
              <p style="margin:0 0 6px 0;">Dear JATH User,</p>
              <p style="margin:0 0 10px 0;">
                You have received <span style="font-weight:700;">New Edit Inspection Details Request</span>. Currently this Part No. Status is <span style="color:#e53935; font-weight:700;">INACTIVE</span> and Edit Status is <span style="color:#e53935; font-weight:700;">LOCKED</span>
              </p>

              <table style="margin:10px 0;">
                <tr><td style="padding-right:10px;">Part No. :</td><td><strong>${savedDetail.partNo}</strong></td></tr>
                <tr><td style="padding-right:10px;">Part Name :</td><td><strong>${savedDetail.partName}</strong></td></tr>
                <tr><td style="padding-right:10px;">Model :</td><td><strong>${savedDetail.model}</strong></td></tr>
              </table>

              <p style="margin:14px 0 6px 0;">To allow Supplier to Edit Inspection Details, Please change Setting in Menu : <strong>Inspection Detail</strong> following below;</p>
              <p style="margin:6px 0;">1. Change Part Status from <span style="color:#e53935; font-weight:700;">INACTIVE</span> to <span style="color:#2e7d32; font-weight:700;">ACTIVE</span></p>
              <p style="margin:6px 0;">2. Change Edit Status from <span style="color:#e53935; font-weight:700;">LOCKED</span> to <span style="color:#1e88e5; font-weight:700;">UNLOCKED</span></p>

              <p style="margin:6px 0;">Please access Sample Data Sheet (SDS) through below link;</p>
              <p style="margin:6px 0;"><a href="${baseUrl}" target="_blank" rel="noopener" style="color:#1e88e5;">${baseUrl}</a></p>

              <p style="margin:18px 0 6px 0;">Thank you and Best regards,</p>
              <p style="margin:0 0 18px 0;">Sample Data Sheet System</p>

              <p style="margin:0; padding:10px; border:1px dashed #999; background:#f7f7f7; font-size:12px;">
                THIS IS AN AUTOMATED MESSAGE - PLEASE DO NOT REPLY THIS EMAIL.
              </p>
            </div>
          `;
          this.emailService.sendEmail(to, subject, html);
        }
      } else if (actionBy?.accessMasterManagement === 'Y' && savedDetail.partStatus === PartStatus.Active) {
        // Notify Supplier when JTEKT activates a new Inspection Detail (Part Status ACTIVE)
        try {
          const supplier = await this.supplierService.findByCode(savedDetail.supplierCode);
          if (supplier && supplier.email && supplier.email.length > 0) {
            const baseUrl = process.env.MAIL_LINK_WEBAPP_SUPPLIER_SDS ?? 'http://192.168.3.156:8000/';
            const subject = `New Inspection Detail (ACTIVE): ${savedDetail.partNo}`;
            const html = `
              <div style="font-family: Arial, 'Noto Sans Thai', sans-serif; color: #222; line-height: 1.6;">
                <p style="margin:0 0 6px 0;">Dear ${savedDetail.supplierName || 'Supplier'}${savedDetail.supplierName ? '' : ' Name'},</p>
                <p style="margin:0 0 10px 0;">
                  You have received <span style="font-weight:700;">New Part No. Details</span>, this Inspection Detail Status is <span style="color:#2e7d32; font-weight:700;">"ACTIVE"</span>.
                </p>

                <table style="margin:10px 0;">
                  <tr><td style="padding-right:10px;">Part No. :</td><td><strong>${savedDetail.partNo}</strong></td></tr>
                  <tr><td style="padding-right:10px;">Part Name :</td><td><strong>${savedDetail.partName}</strong></td></tr>
                  <tr><td style="padding-right:10px;">Model :</td><td><strong>${savedDetail.model}</strong></td></tr>
                </table>

                <p style="margin:14px 0 6px 0;">Kindly Review Details in MENU : <strong>Inspection Detail</strong>.</p>

                <p style="margin:6px 0;">Please access Sample Data Sheet (SDS) through below link;</p>
                <p style="margin:6px 0;"><a href="${baseUrl}" target="_blank" rel="noopener" style="color:#1e88e5;">${baseUrl}</a></p>

                <p style="margin:18px 0 6px 0;">Thank you and Best regards,</p>
                <p style="margin:0 0 18px 0;">Sample Data Sheet System</p>

                <p style="margin:0; padding:10px; border:1px dashed #999; background:#f7f7f7; font-size:12px;">
                  THIS IS AN AUTOMATED MESSAGE - PLEASE DO NOT REPLY THIS EMAIL.
                </p>
              </div>
            `;
            this.emailService.sendEmail(supplier.email.join(','), subject, html);
          }
        } catch (err) {
          console.error('Failed to send ACTIVE notification to Supplier:', err);
        }
      }
    } catch (error) {
      console.error('Failed to send email to JTEKT users on create:', error);
    }

    return savedDetail;
  }

  async update(id: number, dto: CreateInspectionDetailDto, actionBy?: UsersEntity) {
    const existing = await this.inspectionDetailRepo.findOne({
      where: { id, activeRow: ActiveStatus.YES },
    });

    const clone = { ...existing }

    if (!existing) {
      throw new NotFoundException('Inspection detail not found');
    }

    if (actionBy?.role === 'Supplier' && existing.supplierEditStatus === SupplierEditStatus.Locked) {
      throw new ForbiddenException('This inspection detail is locked for supplier edits');
    }

    if (!Array.isArray(dto.inspectionItems) || !dto.inspectionItems.length) {
      throw new BadRequestException('inspectionItems must be a non-empty array');
    }

    existing.supplierCode = dto.supplierCode;
    existing.supplierName = dto.supplierName;
    existing.partNo = dto.partNo;
    existing.partName = dto.partName;
    existing.model = dto.model;

    if (Object.prototype.hasOwnProperty.call(dto, 'aisFile')) {
      existing.aisFile = dto.aisFile ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'sdrFile')) {
      existing.sdrFile = dto.sdrFile ?? null;
    }

    existing.partStatus = dto.partStatus as any;

    // ถ้า partStatus เป็น Active ให้บังคับ supplierEditStatus เป็น Locked
    if (dto.partStatus === 'Active') {
      existing.supplierEditStatus = SupplierEditStatus.Locked;
    } else {
      existing.supplierEditStatus = dto.supplierEditStatus as any;
    }

    // Set due date to 25th of current month
    const now = new Date();
    existing.dueDate = new Date(now.getFullYear(), now.getMonth(), 25);

    existing.updatedBy = actionBy?.id;

    if (actionBy?.role === 'Supplier') {
      existing.sdsCreated = false;
    }

    await this.inspectionDetailRepo.save(existing);

    await this.inspectionItemRepo.delete({ inspectionDetailId: id });
    const items = dto.inspectionItems.map((item, index) =>
      this.inspectionItemRepo.create({
        inspectionDetailId: id,
        no: Number(item.no ?? index + 1),
        measuringItem: item.measuringItem,
        specification: item.specification,
        tolerancePlus: item.tolerancePlus,
        toleranceMinus: item.toleranceMinus,
        inspectionInstrument: item.inspectionInstrument,
        rank: item.rank as any,
      }),
    );
    if (items.length) {
      await this.inspectionItemRepo.save(items);
    }

    // Create log for inspection detail update
    await this.sdsLogService.createLog({
      menu: 'Inspection Detail',
      sdsInspectionDetailId: id,
      partNo: existing.partNo,
      sdsMonthYear: null,
      action: 'Edit',
      actionRole: actionBy?.role || 'System',
      actionBy: actionBy?.name || 'System',
      actionDate: new Date(),
      remark: null,
    });

    // Only log status changes if not a Supplier
    if (actionBy?.role !== 'Supplier') {
      if (dto.supplierEditStatus !== clone.supplierEditStatus) {
        await this.sdsLogService.createLog({
          menu: 'Inspection Detail',
          sdsInspectionDetailId: id,
          partNo: existing.partNo,
          sdsMonthYear: null,
          action: dto.supplierEditStatus,
          actionRole: actionBy?.role || 'System',
          actionBy: actionBy?.name || 'System',
          actionDate: new Date(),
          remark: null,
        });
      }

      if (dto.partStatus !== clone.partStatus) {
        await this.sdsLogService.createLog({
          menu: 'Inspection Detail',
          sdsInspectionDetailId: id,
          partNo: existing.partNo,
          sdsMonthYear: null,
          action: dto.partStatus,
          actionRole: actionBy?.role || 'System',
          actionBy: actionBy?.name || 'System',
          actionDate: new Date(),
          remark: null,
        });
      }
    }

    // Notify JTEKT (Access Management Master) users when part remains INACTIVE after edit
    try {
      if (actionBy?.role === 'Supplier' && existing.partStatus === PartStatus.Inactive) {
        const jtektUsers = await this.inspectionDetailRepo.manager.getRepository(UsersEntity).find({
          where: { accessMasterManagement: 'Y', active: 'Y' },
        });
        if (jtektUsers && jtektUsers.length > 0) {
          const baseUrl = process.env.MAIL_LINK_WEBAPP_JTEKT_SDS ?? 'http://192.168.3.156:8000/';
          const subject = `New Edited Inspection Details (INACTIVE): ${existing.partNo}`;
          const html = `
            <div style="font-family: Arial, 'Noto Sans Thai', sans-serif; color: #222; line-height: 1.6;">
              <p style="margin:0 0 6px 0;">Dear JATH User,</p>
              <p style="margin:0 0 10px 0;">
                You have received <span style="font-weight:700;">New Edited Inspection Details</span> ., Currently this Part No. Status is remaining <span style="color:#e53935; font-weight:700;">INACTIVE</span>.
              </p>

              <table style="margin:10px 0;">
                <tr><td style="padding-right:10px;">Part No. :</td><td><strong>${existing.partNo}</strong></td></tr>
                <tr><td style="padding-right:10px;">Part Name :</td><td><strong>${existing.partName}</strong></td></tr>
                <tr><td style="padding-right:10px;">Model :</td><td><strong>${existing.model}</strong></td></tr>
              </table>

              <p style="margin:14px 0 6px 0;">To Active this Part No., Please change Setting in Menu : <strong>Inspection Detail</strong> following below;</p>
              <p style="margin:6px 0;">1. Change Part Status from <span style="color:#e53935; font-weight:700;">INACTIVE</span> to <span style="color:#2e7d32; font-weight:700;">ACTIVE</span></p>

              <p style="margin:6px 0;">Please access Sample Data Sheet (SDS) through below link;</p>
              <p style="margin:6px 0;"><a href="${baseUrl}" target="_blank" rel="noopener" style="color:#1e88e5;">${baseUrl}</a></p>

              <p style="margin:18px 0 6px 0;">Thank you and Best regards,</p>
              <p style="margin:0 0 18px 0;">Sample Data Sheet System</p>

              <p style="margin:0; padding:10px; border:1px dashed #999; background:#f7f7f7; font-size:12px;">
                THIS IS AN AUTOMATED MESSAGE - PLEASE DO NOT REPLY THIS EMAIL.
              </p>
            </div>
          `;
          const to = jtektUsers.map(u => u.email).filter(Boolean).join(',');
          if (to) {
            this.emailService.sendEmail(to, subject, html);
          }
        }
      }
      // Notify Supplier when JTEKT sets Part Status to ACTIVE on update
      if (actionBy?.accessMasterManagement === 'Y' && existing.partStatus === PartStatus.Active) {
        try {
          const supplier = await this.supplierService.findByCode(existing.supplierCode);
          if (supplier && supplier.email && supplier.email.length > 0) {
            const baseUrl = process.env.MAIL_LINK_WEBAPP_SUPPLIER_SDS ?? 'http://192.168.3.156:8000/';
            const subject = `New Inspection Detail (ACTIVE): ${existing.partNo}`;
            const html = `
              <div style="font-family: Arial, 'Noto Sans Thai', sans-serif; color: #222; line-height: 1.6;">
                <p style="margin:0 0 6px 0;">Dear ${existing.supplierName || 'Supplier'}${existing.supplierName ? '' : ' Name'},</p>
                <p style="margin:0 0 10px 0;">
                  You have received <span style="font-weight:700;">New Part No. Details</span>, this Inspection Detail Status is <span style="color:#2e7d32; font-weight:700;">"ACTIVE"</span>.
                </p>

                <table style="margin:10px 0;">
                  <tr><td style="padding-right:10px;">Part No. :</td><td><strong>${existing.partNo}</strong></td></tr>
                  <tr><td style="padding-right:10px;">Part Name :</td><td><strong>${existing.partName}</strong></td></tr>
                  <tr><td style="padding-right:10px;">Model :</td><td><strong>${existing.model}</strong></td></tr>
                </table>

                <p style="margin:14px 0 6px 0;">Kindly Review Details in MENU : <strong>Inspection Detail</strong>.</p>

                <p style="margin:6px 0;">Please access Sample Data Sheet (SDS) through below link;</p>
                <p style="margin:6px 0;"><a href="${baseUrl}" target="_blank" rel="noopener" style="color:#1e88e5;">${baseUrl}</a></p>

                <p style="margin:18px 0 6px 0;">Thank you and Best regards,</p>
                <p style="margin:0 0 18px 0;">Sample Data Sheet System</p>

                <p style="margin:0; padding:10px; border:1px dashed #999; background:#f7f7f7; font-size:12px;">
                  THIS IS AN AUTOMATED MESSAGE - PLEASE DO NOT REPLY THIS EMAIL.
                </p>
              </div>
            `;
            this.emailService.sendEmail(supplier.email.join(','), subject, html);
          }
        } catch (err) {
          console.error('Failed to send ACTIVE notification to Supplier (update):', err);
        }
      }
    } catch (error) {
      console.error('Failed to send email to JTEKT users for INACTIVE part:', error);
    }

    return this.findById(id);
  }

  private applyFiltersToQuery(
    qb: SelectQueryBuilder<InspectionDetailEntity>,
    filters: InspectionDetailFilterOptions,
  ) {
    const { supplierCode, partNo, partName, model, partStatus, supplierEditStatus } = filters;

    if (supplierCode && supplierCode !== 'All') {
      qb.andWhere('d.supplierCode = :supplierCode', { supplierCode });
    }
    if (partNo && partNo.trim().length) {
      qb.andWhere('LOWER(d.partNo) LIKE LOWER(:partNo)', { partNo: `%${partNo.trim()}%` });
    }
    if (partName && partName.trim().length) {
      qb.andWhere('LOWER(d.partName) LIKE LOWER(:partName)', { partName: `%${partName.trim()}%` });
    }
    if (model && model.trim().length) {
      qb.andWhere('LOWER(d.model) LIKE LOWER(:model)', { model: `%${model.trim()}%` });
    }
    if (partStatus && partStatus !== 'All') {
      qb.andWhere('d.partStatus = :partStatus', { partStatus });
    }
    if (supplierEditStatus && supplierEditStatus !== 'All') {
      qb.andWhere('d.supplierEditStatus = :supplierEditStatus', { supplierEditStatus });
    }
  }

  private buildInspectionDetailQuery(filters: InspectionDetailFilterOptions) {
    const qb = this.inspectionDetailRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.inspectionItems', 'items')
      .where('d.activeRow = :active', { active: 'Y' })
      .andWhere('d.copyId IS NULL');

    this.applyFiltersToQuery(qb, filters);
    return qb;
  }

  async findAll(params: InspectionDetailListOptions) {
    const {
      skip = 0,
      take = 10,
      supplierCode,
      partNo,
      partName,
      model,
      partStatus,
      supplierEditStatus,
    } = params;

    const qb = this.buildInspectionDetailQuery({ supplierCode, partNo, partName, model, partStatus, supplierEditStatus });

    qb.skip(skip).take(take).orderBy('d.createdAt', 'DESC');

    const [itemsList, total] = await qb.getManyAndCount();

    const result = itemsList.map((d) => ({
      id: d.id,
      supplierName: d.supplierName,
      partNo: d.partNo,
      partName: d.partName,
      model: d.model,
      docAisUrl: d.aisFile ? d.aisFile : null,
      docSdrUrl: d.sdrFile ? d.sdrFile : null,
      inspectionPoints: d.inspectionItems?.length || 0,
      partStatus: d.partStatus,
      supplierEditStatus: d.supplierEditStatus,
    }));

    return { items: result, total };
  }

  async findAllForExport(filters: InspectionDetailFilterOptions) {
    const qb = this.buildInspectionDetailQuery(filters);
    qb.orderBy('d.createdAt', 'DESC');
    const itemsList = await qb.getMany();

    return itemsList.map((d) => ({
      id: d.id,
      supplierName: d.supplierName,
      partNo: d.partNo,
      partName: d.partName,
      model: d.model,
      docAisUrl: d.aisFile ? d.aisFile : null,
      docSdrUrl: d.sdrFile ? d.sdrFile : null,
      inspectionPoints: d.inspectionItems?.length || 0,
      partStatus: d.partStatus,
      supplierEditStatus: d.supplierEditStatus,
    }));
  }

  async findById(id: number) {
    const entity = await this.inspectionDetailRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.inspectionItems', 'items')
      .leftJoinAndSelect('d.specialRequest', 'special')
      .where('d.id = :id', { id })
      .andWhere('d.activeRow = :active', { active: 'Y' })
      .getOne();

    if (!entity) {
      return null;
    }

    return {
      id: entity.id,
      supplierCode: entity.supplierCode,
      supplierName: entity.supplierName,
      partNo: entity.partNo,
      partName: entity.partName,
      model: entity.model,
      aisFile: entity.aisFile || null,
      sdrFile: entity.sdrFile || null,
      partStatus: entity.partStatus,
      supplierEditStatus: entity.supplierEditStatus,
      inspectionItems: (entity.inspectionItems || []).map((item) => ({
        id: item.id,
        inspectionDetailId: item.inspectionDetailId,
        no: item.no,
        measuringItem: item.measuringItem,
        specification: item.specification,
        tolerancePlus: item.tolerancePlus,
        toleranceMinus: item.toleranceMinus,
        inspectionInstrument: item.inspectionInstrument,
        rank: item.rank,
      })),
      specialRequest: (entity.specialRequest || []).map((s) => ({
        id: s.id,
        inspectionDetailId: s.inspectionDetailId,
        specialRequestItems: JSON.parse(s.specialRequestItems || '[]'),
        qty: s.qty,
        cpCpk: s.cpCpk,
        dueDate: s.dueDate,
        status: s.status,
        comments: s.comments,
        createdAt: s.createdAt,
      })),
      dueDate: entity.dueDate,
      createdAt: entity.createdAt,
    };
  }

  async createSpecialRequest(dto: CreateSpecialRequestDto, actionBy?: UsersEntity) {
    const stringSpecialRequestItems = JSON.stringify(dto.specialRequestItems || [])

    const inspectionDetail = await this.inspectionDetailRepo.findOne({
      where: { id: dto.inspectionDetailId },
    });

    if (!inspectionDetail) {
      throw new NotFoundException('Inspection detail not found');
    }

    if (inspectionDetail.partStatus == PartStatus.Inactive) {
      throw new BadRequestException('Cannot create special request because the part status is not active');
    }

    if (inspectionDetail.supplierEditStatus == SupplierEditStatus.Unlocked) {
      throw new BadRequestException('Cannot create special request because the status is not yet locked');
    }

    const inspectionItems = await this.inspectionItemRepo.find({
      where: { inspectionDetailId: dto.inspectionDetailId },
    });

    const copyInspectionDetail = this.inspectionDetailRepo.create({
      ...inspectionDetail,
      id: null,
      dueDate: dto.dueDate,
      sdsCreated: false,
      supplierEditStatus: SupplierEditStatus.Locked,
      partStatus: PartStatus.Active,
      copyId: inspectionDetail.id,
    });

    const savedCopyInspectionDetail = await this.inspectionDetailRepo.save(copyInspectionDetail);


    const copyInspectionItems = inspectionItems
      .filter((item) => (dto.specialRequestItems || []).find((s) => s === item.id))
      .map((item) => ({
        ...item,
        id: null,
        inspectionDetailId: savedCopyInspectionDetail.id,
      }));

    await this.inspectionItemRepo.save(copyInspectionItems);

    const entity = this.specialRequestRepo.create({
      inspectionDetailId: savedCopyInspectionDetail.id,
      specialRequestItems: stringSpecialRequestItems,
      qty: dto.qty,
      cpCpk: dto.cpCpk,
      dueDate: dto.dueDate,
      comments: dto.comments,
      status: dto.status ?? SpecialRequestStatus.Pending,
      activeRow: ActiveStatus.YES,
      createdBy: actionBy?.id,
      updatedBy: actionBy?.id,
    });

    const savedRequest = await this.specialRequestRepo.save(entity);

    if (inspectionDetail) {
      // Create log for special request
      await this.sdsLogService.createLog({
        menu: 'Inspection Detail',
        sdsInspectionDetailId: savedCopyInspectionDetail.id,
        partNo: inspectionDetail.partNo,
        sdsMonthYear: null,
        action: 'Special Request',
        actionRole: actionBy?.role || 'System',
        actionBy: actionBy?.name || 'System',
        actionDate: new Date(),
        remark: dto.comments || null,
      });

      // Send Email to Supplier for Special Request
      try {
        const supplier = await this.supplierService.findByCode(inspectionDetail.supplierCode);
        if (supplier && supplier.email && supplier.email.length > 0) {
          const monthLabel = moment(dto.dueDate ?? new Date()).format('MM-YYYY');
          const dueDateLabel = moment(dto.dueDate ?? new Date()).format('DD-MM-YYYY');
          const baseUrl = process.env.MAIL_LINK_WEBAPP_SUPPLIER_SDS ?? 'http://192.168.3.156:8000/';

          const subject = `SDS Special Request: ${inspectionDetail.partNo}`;
          const html = `
            <div style="font-family: Arial, 'Noto Sans Thai', sans-serif; color: #222; line-height: 1.6;">
              <p style="margin:0 0 6px 0;">Dear ${inspectionDetail.supplierName || 'Supplier'},</p>
              <p style="margin:0 0 10px 0;">
                You have received, <span style="color:#e53935; font-weight:700;">SDS Special Request</span> on <span style="color:#1e88e5; font-weight:700;">${monthLabel}</span>
              </p>
              <p style="margin:0 0 10px 0;">Please input and Submit SDS Special Request by <span style="color:#1e88e5; font-weight:700;">${dueDateLabel}</span></p>

              <table style="margin:10px 0;">
                <tr><td style="padding-right:10px;">Part No. :</td><td><strong>${inspectionDetail.partNo}</strong></td></tr>
                <tr><td style="padding-right:10px;">Part Name :</td><td><strong>${inspectionDetail.partName}</strong></td></tr>
                <tr><td style="padding-right:10px;">Model :</td><td><strong>${inspectionDetail.model}</strong></td></tr>
              </table>

              <p style="margin:14px 0 6px 0;">To Submit SDS Monthly Request., Please access in MENU : <strong>Create SDS</strong></p>
              <p style="margin:6px 0;">Please access Sample Data Sheet (SDS) to review through below link;</p>
              <p style="margin:6px 0;"><a href="${baseUrl}" target="_blank" rel="noopener" style="color:#1e88e5;">${baseUrl}</a></p>

              <p style="margin:18px 0 6px 0;">Thank you and Best regards,</p>
              <p style="margin:0 0 18px 0;">Sample Data Sheet System</p>

              <p style="margin:0; padding:10px; border:1px dashed #999; background:#f7f7f7; font-size:12px;">
                THIS IS AN AUTOMATED MESSAGE - PLEASE DO NOT REPLY THIS EMAIL.
              </p>
            </div>
          `;
          // Send to all emails in the array
          this.emailService.sendEmail(supplier.email.join(','), subject, html);
        }
      } catch (error) {
        console.error('Failed to send email for special request:', error);
      }
    }

    return savedRequest;
  }

  async listSpecialRequests(inspectionDetailId: number) {
    const records = await this.specialRequestRepo.find({
      where: {
        inspectionDetailId,
        activeRow: ActiveStatus.YES,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return records.map((record) => ({
      id: record.id,
      inspectionDetailId: record.inspectionDetailId,
      specialRequestItems: JSON.parse(record.specialRequestItems || '[]'),
      qty: record.qty,
      cpCpk: record.cpCpk,
      dueDate: record.dueDate,
      status: record.status,
      comments: record.comments,
      createdAt: record.createdAt,
    }));
  }

  async listInspectionItems(inspectionDetailId: number) {
    const records = await this.inspectionItemRepo.find({
      where: {
        inspectionDetailId,
      },
      order: {
        id: 'ASC',
      },
    });

    return records.map((record) => ({
      id: record.id,
      inspectionDetailId: record.inspectionDetailId,
      no: record.no,
      measuringItem: record.measuringItem,
      specification: record.specification,
      tolerancePlus: record.tolerancePlus,
      toleranceMinus: record.toleranceMinus,
      inspectionInstrument: record.inspectionInstrument,
      rank: record.rank,
    }));
  }

  async listSupplierDropdown() {
    const suppliers = await this.supplierService.findAllForDropdown();
    return suppliers.map((supplier) => ({
      supplierCode: supplier.supplierCode,
      supplierName: supplier.supplierName,
    }));
  }

  async stamptSignature(sheet: SampleDataSheetResponse, actionBy: UsersEntity) {
    const baseDir = join(process.cwd(), configPath.pathUploadInspectionDetail);
    const targetPath = normalize(join(baseDir, sheet.sdrReportFile));
    const pdfBytes = readFileSync(targetPath);
    const oldPdfDoc = await PDFDocument.load(pdfBytes);

    const fontBytes = readFileSync(join(__dirname, '..', '..', '/files-templates/fonts/NotoSansThai-Medium.ttf'));
    oldPdfDoc.registerFontkit(fontkit);

    // add file png
    const pngBytes = readFileSync(join(__dirname, '..', '..', '/files-templates/sds-pdf/approved.png'));
    const pngImage = await oldPdfDoc.embedPng(pngBytes);

    const oldfont = await oldPdfDoc.embedFont(fontBytes);

    if (sheet.id) {
      const approval1 = sheet.approvals.find((approval) => approval.action == 'Approved' && approval.role == 'Checker 1' && sheet.loop == approval.loop);
      const approval2 = sheet.approvals.find((approval) => approval.action == 'Approved' && approval.role == 'Checker 2' && sheet.loop == approval.loop);
      const approval3 = sheet.approvals.find((approval) => approval.action == 'Approved' && approval.role == 'Approver' && sheet.loop == approval.loop);
      for (let pageIndex = 0; pageIndex < oldPdfDoc.getPageCount(); pageIndex++) {
        const { width, height } = oldPdfDoc.getPage(pageIndex).getSize();
        const page = oldPdfDoc.getPage(pageIndex);
        page.drawImage(pngImage, {
          x: width - 220,
          y: height - 340,
          width: 200,
          height: 100,
        });

        if (approval3) {
          const drawWrappedText = (text: string, x: number, y: number) => {
            const maxWidth = 60;
            const fontSize = 9;
            if (oldfont.widthOfTextAtSize(text, fontSize) <= maxWidth) {
              page.drawText(text, { x, y, size: fontSize, font: oldfont, color: rgb(0, 0.6, 0.35) });
            } else {
              const words = text.split(' ');
              let line1 = '';
              let line2 = '';
              for (const word of words) {
                if (oldfont.widthOfTextAtSize((line1 + word).trim(), fontSize) < maxWidth) {
                  line1 += (line1 ? ' ' : '') + word;
                } else {
                  line2 += (line2 ? ' ' : '') + word;
                }
              }
              page.drawText(line1, { x, y: y + 3, size: fontSize, font: oldfont, color: rgb(0, 0.6, 0.35) });
              page.drawText(line2, { x, y: y - 7, size: fontSize, font: oldfont, color: rgb(0, 0.6, 0.35) });
            }
          };

          drawWrappedText(approval1?.actionByUser?.name || '', width - 215, height - 320);
          drawWrappedText(approval2?.actionByUser?.name || '', width - 145, height - 320);
          drawWrappedText(approval3?.actionByUser?.name || '', width - 80, height - 320);

          page.drawText(approval1.actionDate ? moment(approval1.actionDate).format('DD      MM      YYYY') : '', {
            x: width - 180,
            y: height - 275,
            size: 11,
            font: oldfont,
            color: rgb(0, 0.6, 0.35)
          });
        }

      }
    }


    oldPdfDoc.setTitle(`sdrReportFile-${sheet.partNo} -${sheet.partName} `);
    oldPdfDoc.setAuthor(`${[...new Set(['System'])].join(',')} `);
    oldPdfDoc.setSubject('Sample Data Sheet');
    oldPdfDoc.setKeywords(['Sample Data Sheet']);
    oldPdfDoc.setProducer(`Sample Data Sheet`);
    oldPdfDoc.setCreationDate(new Date());

    const pdfBytesFinal = await oldPdfDoc.save();
    // const savetemp = join(__dirname, '..', '..', `/ files - templates / sds - pdf / temp - ${ sheet.partNo } -${ sheet.partName } -${ new Date().toISOString() }.pdf`);
    // fs.writeFileSync(savetemp, pdfBytesFinal);

    return pdfBytesFinal;
  }

  async findMonthlyDelayedItems() {
    const now = moment();
    // Check if today is 26th or later
    if (now.format('DD') !== '26') {
      return [];
    }

    return this.inspectionDetailRepo.createQueryBuilder('d')
      .where('d.activeRow = :active', { active: 'Y' })
      .andWhere('d.partStatus = :status', { status: 'Active' })
      .andWhere('d.sdsCreated = :sdsCreated', { sdsCreated: false })
      .andWhere('d.dueDate BETWEEN :start AND :end', { 
        start: now.format('YYYY-MM-01 00:00:00'), 
        end: now.add(1,'m').format('YYYY-MM-01 23:59:59')
      })
      .getMany();
  }

  async findSpecialRequestDelayedItems() {
    const now = moment();

    // Find special requests that are pending and due date is passed
    return this.inspectionDetailRepo.createQueryBuilder('d')
      .innerJoinAndSelect('d.specialRequest', 's') // Join to get supplier info later
      .where('s.activeRow = :active', { active: 'Y' })
      .andWhere('s.partStatus = :status', { status: 'Active' })
      .andWhere('d.sdsCreated = :sdsCreated', { sdsCreated: false })
      .andWhere('s.dueDate < :now', { 
        now: now.format('YYYY-MM-DD 23:59:59') 
      })
      .getMany();
  }

  async findActiveInspectionDetails() {
    const now = moment();

    return this.inspectionDetailRepo.createQueryBuilder('d')
      .leftJoinAndSelect('d.specialRequest', 's') // Join to check if it's NOT a special request
      .where('d.activeRow = :active', { active: 'Y' })
      .andWhere('d.partStatus = :status', { status: 'Active' })
      .andWhere('d.sdsCreated = :sdsCreated', { sdsCreated: false })
      .andWhere('s.id IS NULL')
      .andWhere('d.dueDate BETWEEN :start AND :end', { 
        start: now.format('YYYY-MM-01 00:00:00'), 
        end: now.add(1,'m').format('YYYY-MM-01 23:59:59')
      })
      .getMany();
  }
}
