import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SampleDataSheetEntity } from './entities/sample-data-sheet.entity';
import { SampleDataSheetRowEntity } from './entities/sample-data-sheet-row.entity';
import { CreateSampleDataSheetDto, CreateSampleDataSheetRowDto } from './dto/create-sample-data-sheet.dto';
import { InspectionDetailEntity, ActiveStatus } from 'src/inspection-detail/entities/inspection-detail.entity';
import { InspectionSpecialRequestEntity, SpecialRequestStatus } from 'src/inspection-detail/entities/inspection-special-request.entity';
import {
    InspectionDetailListItem,
    InspectionDetailListResponse,
    ListInspectionDetailsQueryDto,
} from './dto/list-inspection-details.dto';

@Injectable()
export class SampleDataSheetService {
    constructor(
        @InjectRepository(SampleDataSheetEntity)
        private readonly sheetRepo: Repository<SampleDataSheetEntity>,
        @InjectRepository(SampleDataSheetRowEntity)
        private readonly rowRepo: Repository<SampleDataSheetRowEntity>,
        @InjectRepository(InspectionDetailEntity)
        private readonly inspectionRepo: Repository<InspectionDetailEntity>,
        @InjectRepository(InspectionSpecialRequestEntity)
        private readonly specialRequestRepo: Repository<InspectionSpecialRequestEntity>,
    ) {}

    async create(
        dto: CreateSampleDataSheetDto,
        files: { aisFile?: string; sdrFile?: string; sdrReportFile?: string },
    ) {
        const inspectionDetail = await this.inspectionRepo.findOne({ where: { id: dto.inspectionDetailId } });
        if (!inspectionDetail) {
            throw new NotFoundException('Inspection Detail not found');
        }

        const sheet = this.sheetRepo.create({
            supplier: dto.supplier,
            partNo: dto.partNo,
            partName: dto.partName,
            model: dto.model,
            production082025: dto.production08_2025,
            sdrDate: new Date(dto.sdrDate),
            inspectionDetailId: dto.inspectionDetailId,
            aisFile: inspectionDetail.aisFile ?? files.aisFile ?? null,
            sdrFile: inspectionDetail.sdrFile ?? files.sdrFile ?? null,
            sdrReportFile: files.sdrReportFile ?? null,
            remark: dto.remark,
        });

        const savedSheet = await this.sheetRepo.save(sheet);

        if (dto.sdrData && dto.sdrData.length) {
            const rows = dto.sdrData.map((row, index) => this.createRow(row, index, savedSheet.id));
            await this.rowRepo.save(rows);
        }

        await this.inspectionRepo.update({ id: dto.inspectionDetailId }, { sdsCreated: true });

        return this.mapSheet(savedSheet);
    }

    async update(
        id: number,
        dto: CreateSampleDataSheetDto,
        files: { aisFile?: string; sdrFile?: string; sdrReportFile?: string },
    ) {
        const sheet = await this.sheetRepo.findOne({ where: { id } });
        if (!sheet) {
            throw new NotFoundException('Sample Data Sheet not found');
        }

        const inspectionDetail = await this.inspectionRepo.findOne({ where: { id: dto.inspectionDetailId } });
        if (!inspectionDetail) {
            throw new NotFoundException('Inspection Detail not found');
        }

        sheet.supplier = dto.supplier;
        sheet.partNo = dto.partNo;
        sheet.partName = dto.partName;
        sheet.model = dto.model;
        sheet.production082025 = dto.production08_2025;
        sheet.sdrDate = new Date(dto.sdrDate);
        sheet.inspectionDetailId = dto.inspectionDetailId;
        sheet.aisFile = inspectionDetail.aisFile ?? sheet.aisFile;
        sheet.sdrFile = inspectionDetail.sdrFile ?? sheet.sdrFile;
        const reportFile = files.sdrReportFile ?? sheet.sdrReportFile;
        if (dto.production08_2025 === 'Yes' && !reportFile) {
            throw new BadRequestException('SDR report is required when production is Yes');
        }
        sheet.sdrReportFile = reportFile;
        sheet.remark = dto.remark;

        const savedSheet = await this.sheetRepo.save(sheet);

        await this.rowRepo.delete({ sampleDataSheetId: savedSheet.id });
        if (dto.sdrData && dto.sdrData.length) {
            const rows = dto.sdrData.map((row, index) => this.createRow(row, index, savedSheet.id));
            await this.rowRepo.save(rows);
        }

        await this.inspectionRepo.update({ id: dto.inspectionDetailId }, { sdsCreated: true });

        return this.mapSheet(savedSheet);
    }

    async listInspectionDetails(
        filters: ListInspectionDetailsQueryDto,
        supplierCode?: string,
    ): Promise<InspectionDetailListResponse> {
        const skip = Number.isNaN(Number(filters.skip)) ? 0 : Number(filters.skip);
        const limit = Number.isNaN(Number(filters.limit)) ? 10 : Number(filters.limit);

        const query = this.inspectionRepo.createQueryBuilder('detail')
            .where('detail.activeRow = :active', { active: ActiveStatus.YES })
            .orderBy('detail.createdAt', 'DESC');

        if (supplierCode) {
            query.andWhere('detail.supplierCode = :supplierCode', { supplierCode });
        }

        if (filters.partNo && filters.partNo.toLowerCase() !== 'all') {
            query.andWhere('detail.partNo = :partNo', { partNo: filters.partNo });
        }
        if (filters.partName && filters.partName.toLowerCase() !== 'all') {
            query.andWhere('detail.partName = :partName', { partName: filters.partName });
        }
        if (filters.model && filters.model.toLowerCase() !== 'all') {
            query.andWhere('detail.model = :model', { model: filters.model });
        }

        const details = await query.getMany();
        const detailIds = details.map(detail => detail.id);

        const specialRequests = detailIds.length
            ? await this.specialRequestRepo.createQueryBuilder('sr')
                  .where('sr.inspectionDetailId IN (:...ids)', { ids: detailIds })
                  .andWhere('sr.activeRow = :active', { active: ActiveStatus.YES })
                  .orderBy('sr.createdAt', 'DESC')
                  .getMany()
            : [];

        const latestSpecialMap = new Map<number, InspectionSpecialRequestEntity>();
        specialRequests.forEach((request) => {
            if (!latestSpecialMap.has(request.inspectionDetailId)) {
                latestSpecialMap.set(request.inspectionDetailId, request);
            }
        });

        const now = this.startOfDay(new Date());
        const rows = details.map((detail) => {
            const special = latestSpecialMap.get(detail.id);
            const dueDate = special?.dueDate ?? null;
            const monthYear = dueDate
                ? this.formatMonthYear(dueDate)
                : this.formatMonthYear(detail.createdAt);
            const sdsType: 'Special' | 'Normal' = special ? 'Special' : 'Normal';
            const supplierStatus = special?.status ?? SpecialRequestStatus.Pending;
            const hasDelay = dueDate
                ? special?.status === SpecialRequestStatus.Pending && this.startOfDay(dueDate).getTime() < now.getTime()
                : false;

            return {
                id: detail.id,
                no: 0,
                supplierName: detail.supplierName,
                partNo: detail.partNo,
                partName: detail.partName,
                model: detail.model,
                monthYear,
                sdsType,
                supplierStatus,
                dueDate: dueDate ? this.formatDayMonthYear(dueDate) : null,
                hasDelay,
                sdsCreated: detail.sdsCreated,
            } as InspectionDetailListItem;
        });

        const monthFilter = filters.monthYear?.toLowerCase();
        const typeFilter = filters.sdsType?.toLowerCase();
        const filtered = rows.filter((row) => {
            const matchMonth = !monthFilter || monthFilter === 'all' || monthFilter === row.monthYear;
            const matchType = !typeFilter || typeFilter === 'all' || row.sdsType.toLowerCase() === typeFilter;
            return matchMonth && matchType;
        });

        const paginated = filtered.slice(skip, skip + limit);
        const items = paginated.map((row, index) => ({
            ...row,
            no: skip + index + 1,
        }));

        return {
            total: filtered.length,
            items,
        };
    }

    private formatMonthYear(value: Date): string {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        return `${month}-${year}`;
    }

    private formatDayMonthYear(value: Date): string {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        return `${day}-${month}-${year}`;
    }

    private startOfDay(value: Date): Date {
        const clone = new Date(value);
        clone.setHours(0, 0, 0, 0);
        return clone;
    }

    private createRow(row: CreateSampleDataSheetRowDto, index: number, sheetId: number) {
        return this.rowRepo.create({
            sampleDataSheetId: sheetId,
            no: Number(row.no ?? index + 1),
            measuringItem: row.measuringItem,
            specification: row.specification,
            rank: row.rank,
            inspectionInstrument: row.inspectionInstrument,
            remark: row.remark ?? null,
            sampleQty: row.sampleQty,
            samples: JSON.stringify(row.samples ?? []),
            judgement: row.judgement ?? null,
            xBar: row.xBar ?? null,
            r: row.r ?? null,
            cp: row.cp ?? null,
            cpk: row.cpk ?? null,
        });
    }

    private mapSheet(sheet: SampleDataSheetEntity) {
        return {
            id: sheet.id,
            supplier: sheet.supplier,
            partNo: sheet.partNo,
            partName: sheet.partName,
            model: sheet.model,
            production08_2025: sheet.production082025,
            sdrDate: sheet.sdrDate,
            aisFile: sheet.aisFile,
            sdrFile: sheet.sdrFile,
            sdrReportFile: sheet.sdrReportFile,
            inspectionDetailId: sheet.inspectionDetailId,
            createdAt: sheet.createdAt,
            updatedAt: sheet.updatedAt,
            remark: sheet.remark,
            sdrData: (sheet.rows || []).map((row) => ({
                id: row.id,
                sampleDataSheetId: row.sampleDataSheetId,
                no: row.no,
                measuringItem: row.measuringItem,
                specification: row.specification,
                rank: row.rank,
                inspectionInstrument: row.inspectionInstrument,
                remark: row.remark,
                sampleQty: row.sampleQty,
                samples: JSON.parse(row.samples || '[]'),
                judgement: row.judgement,
                xBar: row.xBar,
                r: row.r,
                cp: row.cp,
                cpk: row.cpk,
            })),
        };
    }

    async findById(id: number) {
        const sheet = await this.sheetRepo.findOne({
            where: { id },
            relations: ['rows'],
        });

        if (!sheet) {
            return null;
        }

        return this.mapSheet(sheet);
    }

    async findByInspectionDetailId(inspectionDetailId: number) {
        const sheet = await this.sheetRepo.findOne({
            where: { inspectionDetailId },
            relations: ['rows'],
        });

        if (!sheet) {
            return null;
        }

        return this.mapSheet(sheet);
    }
}
