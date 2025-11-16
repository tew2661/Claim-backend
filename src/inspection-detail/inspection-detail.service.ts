import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { InspectionDetailEntity, ActiveStatus, SupplierEditStatus } from './entities/inspection-detail.entity';
import { InspectionItemEntity } from './entities/inspection-item.entity';
import { InspectionSpecialRequestEntity, SpecialRequestStatus } from './entities/inspection-special-request.entity';
import { SupplierService } from 'src/supplier/supplier.service';
import { UsersEntity } from 'src/users/entities/users.entity';

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
  specialRequestItems: string[];
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
  ) {}

  async create(dto: CreateInspectionDetailDto) {
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
      supplierEditStatus: dto.supplierEditStatus as any,
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

    return savedDetail;
  }

  async update(id: number, dto: CreateInspectionDetailDto, actionBy?: UsersEntity) {
    const existing = await this.inspectionDetailRepo.findOne({
      where: { id, activeRow: ActiveStatus.YES },
    });

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
    existing.supplierEditStatus = dto.supplierEditStatus as any;
    existing.updatedBy = actionBy?.id;

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
      .where('d.activeRow = :active', { active: 'Y' });

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
    };
  }

  async createSpecialRequest(dto: CreateSpecialRequestDto, actionById?: number) {
    const entity = this.specialRequestRepo.create({
      inspectionDetailId: dto.inspectionDetailId,
      specialRequestItems: JSON.stringify(dto.specialRequestItems || []),
      qty: dto.qty,
      cpCpk: dto.cpCpk,
      dueDate: dto.dueDate,
      comments: dto.comments,
      status: dto.status ?? SpecialRequestStatus.Pending,
      activeRow: ActiveStatus.YES,
      createdBy: actionById,
      updatedBy: actionById,
    });

    return this.specialRequestRepo.save(entity);
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

  async listSupplierDropdown() {
    const suppliers = await this.supplierService.findAllForDropdown();
    return suppliers.map((supplier) => ({
      supplierCode: supplier.supplierCode,
      supplierName: supplier.supplierName,
    }));
  }
}
