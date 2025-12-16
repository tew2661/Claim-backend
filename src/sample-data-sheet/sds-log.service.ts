import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { SdsLogEntity } from './entities/sds-log.entity';
import { CreateSdsLogDto } from './dto/create-sds-log.dto';
import { FilterSdsLogDto } from './dto/filter-sds-log.dto';
import { SampleDataSheetEntity } from './entities/sample-data-sheet.entity';
import { UsersEntity } from 'src/users/entities/users.entity';
import { SupplierEntity } from 'src/supplier/entities/supplier.entity';

@Injectable()
export class SdsLogService {
    constructor(
        @InjectRepository(SdsLogEntity)
        private sdsLogRepository: Repository<SdsLogEntity>,
        @InjectRepository(SampleDataSheetEntity)
        private sdsInspectionDetailRepository: Repository<SampleDataSheetEntity>,
        @InjectRepository(UsersEntity)
        private usersRepository: Repository<UsersEntity>,
        @InjectRepository(SupplierEntity)
        private supplierRepository: Repository<SupplierEntity>,
    ) { }

    async createLog(createSdsLogDto: CreateSdsLogDto): Promise<SdsLogEntity> {
        const log = this.sdsLogRepository.create(createSdsLogDto);
        return await this.sdsLogRepository.save(log);
    }

    async findAll(filterDto: FilterSdsLogDto): Promise<{ data: SdsLogEntity[]; total: number }> {
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
            query.andWhere('log.actionBy = :actionBy', {
                actionBy: `${filterDto.actionBy}`,
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

        // Get total count before pagination
        const total = await query.getCount();

        // Apply pagination
        const limit = filterDto.limit ? Number(filterDto.limit) : 10;
        const offset = filterDto.offset ? Number(filterDto.offset) : 0;
        query.skip(offset).take(limit);

        const data = await query.getMany();

        return { data, total };
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

    async getActionByOptions(actionRole?: string): Promise<string[]> {
        // If actionRole is Supplier, return supplier names only
        if (actionRole === 'Supplier') {
            const suppliers = await this.supplierRepository.find({
                where: { activeRow: 'Y' },
                order: { supplierName: 'ASC' },
            });
            return suppliers.map(s => s.supplierName);
        }

        // If actionRole is All or not specified, return both suppliers and JTEKT users
        if (!actionRole || actionRole === 'All') {
            // Get all suppliers
            const suppliers = await this.supplierRepository.find({
                where: { activeRow: 'Y' },
            });
            const supplierNames = suppliers.map(s => s.supplierName);

            // Get all JTEKT users (non-supplier)
            const users = await this.usersRepository.find({
                where: { activeRow: 'Y' },
            });
            const userNames = users
                .filter(u => u.role !== 'Supplier')
                .map(u => u.name);

            // Combine and sort
            const allNames = [...supplierNames, ...userNames];
            return allNames.sort((a, b) => a.localeCompare(b));
        }

        // Otherwise, return JTEKT users filtered by sampleDataSheetRole
        const roleMapping: Record<string, string> = {
            'Checker 1': 'Manager',
            'Checker 2': 'Engineer / Supervision / Assistant Manager',
            'Approver': 'Leader',
        };
        const sdsRole = roleMapping[actionRole];

        const query = this.usersRepository.createQueryBuilder('user')
            .where('user.activeRow = :activeRow', { activeRow: 'Y' })
            .andWhere('user.role != :supplierRole', { supplierRole: 'Supplier' });

        if (sdsRole) {
            query.andWhere('user.sampleDataSheetRole = :sdsRole', { sdsRole });
        }

        query.orderBy('user.name', 'ASC');

        const users = await query.getMany();
        return users.map(u => u.name);
    }
}
