import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InspectionDetailEntity } from './entities/inspection-detail.entity';
import { InspectionItemEntity } from './entities/inspection-item.entity';
import { SupplierService } from 'src/supplier/supplier.service';
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

@Injectable()
export class InspectionDetailService {
  constructor(
    @InjectRepository(InspectionDetailEntity)
    private readonly inspectionDetailRepo: Repository<InspectionDetailEntity>,
    @InjectRepository(InspectionItemEntity)
    private readonly inspectionItemRepo: Repository<InspectionItemEntity>,
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

  async findAll(params: {
    skip?: number;
    take?: number;
    supplierCode?: string;
    partNo?: string;
    partName?: string;
    model?: string;
    partStatus?: string;
    supplierEditStatus?: string;
  }) {
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

    const qb = this.inspectionDetailRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.inspectionItems', 'items')
      .where('d.activeRow = :active', { active: 'Y' });

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

  async listSupplierDropdown() {
    const suppliers = await this.supplierService.findAllForDropdown();
    return suppliers.map((supplier) => ({
      supplierCode: supplier.supplierCode,
      supplierName: supplier.supplierName,
    }));
  }
}
