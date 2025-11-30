import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Inject, forwardRef, NotAcceptableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { InspectionDetailEntity, ActiveStatus, SupplierEditStatus, PartStatus } from './entities/inspection-detail.entity';
import { InspectionItemEntity } from './entities/inspection-item.entity';
import { InspectionSpecialRequestEntity, SpecialRequestStatus } from './entities/inspection-special-request.entity';
import { SupplierService } from 'src/supplier/supplier.service';
import { UsersEntity } from 'src/users/entities/users.entity';
import { SdsLogService } from 'src/sample-data-sheet/sds-log.service';
import { SampleDataSheetEntity } from 'src/sample-data-sheet/entities/sample-data-sheet.entity';
import { SampleDataSheetService } from 'src/sample-data-sheet/sample-data-sheet.service';
import { CreateSampleDataSheetDto, CreateSampleDataSheetRowDto } from 'src/sample-data-sheet/dto/create-sample-data-sheet.dto';
import * as moment from 'moment';
import { join, normalize } from 'path';
import { readFileSync } from 'fs';
import { PDFDocument, PDFPage, degrees, rgb } from 'pdf-lib';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import * as fontkit from '@pdf-lib/fontkit';
import { SampleDataSheetResponse } from 'src/sample-data-sheet/interfaces/sample-data-sheet-response.interface';
import { configPath } from 'src/path-files-config';

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
    existing.sdsCreated = false;

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
}
