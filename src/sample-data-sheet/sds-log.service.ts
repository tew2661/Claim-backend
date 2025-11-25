import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { SdsLogEntity } from './entities/sds-log.entity';
import { CreateSdsLogDto } from './dto/create-sds-log.dto';
import { FilterSdsLogDto } from './dto/filter-sds-log.dto';
import { SampleDataSheetEntity } from './entities/sample-data-sheet.entity';

@Injectable()
export class SdsLogService {
    constructor(
        @InjectRepository(SdsLogEntity)
        private sdsLogRepository: Repository<SdsLogEntity>,
        @InjectRepository(SampleDataSheetEntity)
        private sdsInspectionDetailRepository: Repository<SampleDataSheetEntity>,
    ) { }

    async createLog(createSdsLogDto: CreateSdsLogDto): Promise<SdsLogEntity> {
        const log = this.sdsLogRepository.create(createSdsLogDto);
        return await this.sdsLogRepository.save(log);
    }

    async findAll(filterDto: FilterSdsLogDto): Promise<SdsLogEntity[]> {
        const query = this.sdsLogRepository.createQueryBuilder('log');

        if (filterDto.menu) {
            query.andWhere('log.menu = :menu', { menu: filterDto.menu });
        }

        if (filterDto.sdsInspectionDetailId) {
            query.andWhere('log.sdsInspectionDetailId = :sdsInspectionDetailId', {
                sdsInspectionDetailId: filterDto.sdsInspectionDetailId
            });
        }

        if (filterDto.partNo) {
            query.andWhere('log.partNo = :partNo', { partNo: filterDto.partNo });
        }

        if (filterDto.sdsMonthYear) {
            query.andWhere('log.sdsMonthYear = :sdsMonthYear', {
                sdsMonthYear: filterDto.sdsMonthYear,
            });
        }

        if (filterDto.action) {
            query.andWhere('log.action = :action', { action: filterDto.action });
        }

        if (filterDto.actionRole) {
            query.andWhere('log.actionRole = :actionRole', {
                actionRole: filterDto.actionRole,
            });
        }

        if (filterDto.actionBy) {
            query.andWhere('log.actionBy LIKE :actionBy', {
                actionBy: `%${filterDto.actionBy}%`,
            });
        }

        if (filterDto.actionDateFrom) {
            query.andWhere('log.actionDate >= :actionDateFrom', {
                actionDateFrom: filterDto.actionDateFrom,
            });
        }

        if (filterDto.actionDateTo) {
            query.andWhere('log.actionDate <= :actionDateTo', {
                actionDateTo: filterDto.actionDateTo,
            });
        }

        query.orderBy('log.actionDate', 'DESC');

        return await query.getMany();
    }

    async findByPartNo(partNo: string, actionRole?: string): Promise<SdsLogEntity[]> {
        const where: any = { partNo };

        if (actionRole) {
            where.actionRole = actionRole;
        }

        return await this.sdsLogRepository.find({
            where,
            order: { actionDate: 'DESC' },
        });
    }

    async findByInspectionDetailId(sdsId: number, inspectionDetailId: number, actionRole?: string): Promise<SdsLogEntity[]> {
        const where: any = [];
        let sheet = undefined;
        if (sdsId) {
            sheet = await this.sdsInspectionDetailRepository.findOne({
                where: { id: sdsId },
            });
            where.push({
                sampleDataSheetId: sdsId,
                ...actionRole ? { actionRole } : {},
            });
            if (sheet) {
                where.push({
                    sdsInspectionDetailId: sheet.inspectionDetailId,
                    sampleDataSheetId: IsNull(),
                    ...actionRole ? { actionRole } : {},
                });
            }
        }

        if (inspectionDetailId && sheet?.inspectionDetailId !== inspectionDetailId) {
            where.push({
                sdsInspectionDetailId: inspectionDetailId,
                sampleDataSheetId: IsNull(),
                ...actionRole ? { actionRole } : {},
            });
        }

        return await this.sdsLogRepository.find({
            where,
            order: { actionDate: 'DESC' },
        });
    }
}
