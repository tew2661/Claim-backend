import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository, IsNull, In } from 'typeorm';
import { SampleDataSheetEntity } from './entities/sample-data-sheet.entity';
import { SampleDataSheetRowEntity } from './entities/sample-data-sheet-row.entity';
import { SampleDataSheetRowSampleEntity } from './entities/sample-data-sheet-row-sample.entity';
import { SampleDataSheetApprovalEntity, SdsApprovalAction, SdsApprovalRole, SdsDocumentType } from './entities/sample-data-sheet-approval.entity';
import { SdsLogEntity } from './entities/sds-log.entity';
import { CreateSampleDataSheetDto, CreateSampleDataSheetRowDto } from './dto/create-sample-data-sheet.dto';
import {
    SampleDataSheetResponse,
    SampleDataSheetRowResponse,
    SampleDataSheetSampleResponse,
    SampleDataSheetApprovalResponse,
} from './interfaces/sample-data-sheet-response.interface';
import { InspectionDetailEntity } from 'src/inspection-detail/entities/inspection-detail.entity';
import { InspectionItemEntity } from 'src/inspection-detail/entities/inspection-item.entity';
import { InspectionSpecialRequestEntity } from 'src/inspection-detail/entities/inspection-special-request.entity';
import {
    InspectionDetailListItem,
    InspectionDetailListResponse,
    ListInspectionDetailsQueryDto,
    DashboardStatsQuery,
} from './dto/list-inspection-details.dto';
import { UsersEntity } from 'src/users/entities/users.entity';
import { SdsApprovalDto, SdsApprovalHistoryQueryDto } from './dto/sds-approval.dto';
import { join } from 'path';
import { readFileSync } from 'fs';
import { PDFDocument, PDFPage, degrees, rgb } from 'pdf-lib';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import * as fontkit from '@pdf-lib/fontkit';
import * as sharp from 'sharp';
import * as fs from 'fs';
import * as moment from 'moment';
import { EmailService } from 'src/email/email.service';
import { SupplierService } from 'src/supplier/supplier.service';
import { CronJobsService } from 'src/cron-jobs/cron-jobs.service';

interface SampleValue {
    no: number;
    value: string;
}

interface SampleRow {
    id?: number;
    sampleDataSheetId?: number;
    no?: number;
    measuringItem?: string;
    specification?: number;
    rank?: string;
    inspectionInstrument?: string;
    remark?: string;
    sampleQty?: number;
    samples: SampleValue[];
    judgement?: string;
    xBar?: string;
    r?: string;
    cp?: string;
    cpk?: string;
}

@Injectable()
export class SampleDataSheetService implements OnModuleInit {
    private emailService: EmailService;
    private supplierService: SupplierService;

    constructor(
        @InjectRepository(SampleDataSheetEntity)
        private readonly sheetRepo: Repository<SampleDataSheetEntity>,
        @InjectRepository(SampleDataSheetRowEntity)
        private readonly rowRepo: Repository<SampleDataSheetRowEntity>,
        @InjectRepository(SampleDataSheetRowSampleEntity)
        private readonly sampleRepo: Repository<SampleDataSheetRowSampleEntity>,
        @InjectRepository(SampleDataSheetApprovalEntity)
        private readonly approvalRepo: Repository<SampleDataSheetApprovalEntity>,
        @InjectRepository(InspectionDetailEntity)
        private readonly inspectionRepo: Repository<InspectionDetailEntity>,
        @InjectRepository(InspectionSpecialRequestEntity)
        private readonly specialRequestRepo: Repository<InspectionSpecialRequestEntity>,
        @InjectRepository(SdsLogEntity)
        private readonly sdsLogRepo: Repository<SdsLogEntity>,
        @InjectDataSource()
        private readonly dataSource: DataSource,
        private moduleRef: ModuleRef,
        private readonly cronJobsService: CronJobsService,
    ) { }

    onModuleInit() {
        this.emailService = this.moduleRef.get(EmailService, { strict: false });
        this.supplierService = this.moduleRef.get(SupplierService, { strict: false });
    }

    async create(
        dto: CreateSampleDataSheetDto,
        files: { aisFile?: string; sdrFile?: string; sdrReportFile?: string },
        currentUser?: UsersEntity,
    ): Promise<SampleDataSheetResponse> {
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

        await this.cronJobsService.updateSampleDataSheetDelayStatus();

        const inspectionItems = await this.dataSource.getRepository(InspectionItemEntity).find({
            where: { inspectionDetailId: dto.inspectionDetailId },
        });
        const itemsMap = new Map(inspectionItems.map(item => [item.no, item]));

        if (dto.sdrData && dto.sdrData.length) {
            for (let index = 0; index < dto.sdrData.length; index++) {
                const rowDto = dto.sdrData[index];
                const item = itemsMap.get(Number(rowDto.no ?? index + 1));
                const row = await this.createRow(rowDto, index, savedSheet.id, item);
            }
        }

        await this.inspectionRepo.update({ id: dto.inspectionDetailId }, { sdsCreated: true });

        // Create log for SDS creation
        const sdsMonthYear = moment(savedSheet.sdrDate).format('MM-YYYY');
        await this.sdsLogRepo.save({
            menu: 'Create SDS',
            sdsInspectionDetailId: dto.inspectionDetailId,
            sampleDataSheetId: savedSheet.id,
            partNo: savedSheet.partNo,
            sdsMonthYear,
            action: 'Submitted',
            actionRole: 'Supplier',
            actionBy: currentUser?.name || 'System',
            actionDate: new Date(),
            remark: dto.remark || null,
        });

        return this.mapSheet(savedSheet);
    }

    async update(
        id: number,
        dto: CreateSampleDataSheetDto,
        files: { aisFile?: string; sdrFile?: string; sdrReportFile?: string },
        currentUser?: UsersEntity,
    ): Promise<SampleDataSheetResponse> {
        const sheet = await this.sheetRepo.findOne({ where: { id, deletedAt: IsNull() } });
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
        sheet.sdrDate = moment(dto.sdrDate).toDate();
        sheet.inspectionDetailId = dto.inspectionDetailId;
        sheet.aisFile = inspectionDetail.aisFile ?? sheet.aisFile;
        sheet.sdrFile = inspectionDetail.sdrFile ?? sheet.sdrFile;
        sheet.loop += 1;
        const reportFile = files.sdrReportFile ?? sheet.sdrReportFile;
        if (dto.production08_2025 === 'Yes' && !reportFile) {
            throw new BadRequestException('SDR report is required when production is Yes');
        }
        sheet.sdrReportFile = reportFile;
        sheet.remark = dto.remark;

        const savedSheet = await this.sheetRepo.save(sheet);

        await this.cronJobsService.updateSampleDataSheetDelayStatus();

        const inspectionItems = await this.dataSource.getRepository(InspectionItemEntity).find({
            where: { inspectionDetailId: dto.inspectionDetailId },
        });
        const itemsMap = new Map(inspectionItems.map(item => [item.no, item]));

        await this.rowRepo.delete({ sampleDataSheetId: savedSheet.id });
        if (dto.sdrData && dto.sdrData.length) {
            for (let index = 0; index < dto.sdrData.length; index++) {
                const rowDto = dto.sdrData[index];
                const item = itemsMap.get(Number(rowDto.no ?? index + 1));
                const row = await this.createRow(rowDto, index, savedSheet.id, item);
            }
        }

        await this.inspectionRepo.update({ id: dto.inspectionDetailId }, { sdsCreated: true });

        // Create log for SDS update
        const sdsMonthYear = moment(savedSheet.sdrDate).format('MM-YYYY');
        await this.sdsLogRepo.save({
            menu: 'Create SDS',
            sdsInspectionDetailId: dto.inspectionDetailId,
            sampleDataSheetId: savedSheet.id,
            partNo: savedSheet.partNo,
            sdsMonthYear,
            action: 'Submitted',
            actionRole: 'Supplier',
            actionBy: currentUser?.name || 'System',
            actionDate: new Date(),
            remark: dto.remark || null,
        });

        return this.mapSheet(savedSheet);
    }

    async listInspectionDetails(
        filters: ListInspectionDetailsQueryDto,
        supplierCode?: string,
    ): Promise<InspectionDetailListResponse> {
        const skip = Number.isNaN(Number(filters.skip)) ? 0 : Number(filters.skip);
        const limit = Number.isNaN(Number(filters.limit)) ? 10 : Number(filters.limit);

        const checkerLevel = filters.checkerLevel;

        // Build optimized query using CTEs to capture latest rejection and approval states
        let query = `
            WITH rej AS (
                SELECT
                    a.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY a.sample_data_sheet_id
                        ORDER BY a.id DESC
                    ) AS rn
                FROM sample_data_sheet_approvals a
                WHERE a.action = 'Rejected'
                  AND a.re_submit_date IS NOT NULL
                  AND a.deleted_at IS NULL
            ),
            latest AS (
                SELECT
                    a.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY 
                            a.sample_data_sheet_id,
                            a.loop,
                            a.document_type,
                            a.role
                        ORDER BY a.id DESC
                    ) AS rn
                FROM sample_data_sheet_approvals a
                WHERE a.deleted_at IS NULL
            ),
            latest_approved AS (
                SELECT
                    a.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY 
                            a.sample_data_sheet_id,
                            a.loop,
                            a.document_type,
                            a.role
                        ORDER BY a.id DESC
                    ) AS rn
                FROM sample_data_sheet_approvals a
                WHERE a.action = 'Approved'
                  AND a.deleted_at IS NULL
            ),
            latest_submitted AS (
                SELECT
                    sds_app.sample_data_sheet_id,
                    sds_app.loop,
                    CASE 
                        WHEN sds_app.action_date > sdr_app.action_date THEN sds_app.action_date
                        ELSE sdr_app.action_date
                    END as action_date,
                    ROW_NUMBER() OVER (
                        PARTITION BY 
                            sds_app.sample_data_sheet_id,
                            sds_app.loop
                        ORDER BY sds_app.id DESC
                    ) AS rn
                FROM sample_data_sheet_approvals sds_app
                INNER JOIN sample_data_sheet_approvals sdr_app
                    ON sdr_app.sample_data_sheet_id = sds_app.sample_data_sheet_id
                   AND sdr_app.loop = sds_app.loop
                   AND sdr_app.document_type = 'SDR'
                   AND sdr_app.role = 'Approver'
                   AND sdr_app.action = 'Approved'
                   AND sdr_app.deleted_at IS NULL
                WHERE sds_app.document_type = 'SDS'
                  AND sds_app.role = 'Approver'
                  AND sds_app.action = 'Approved'
                  AND sds_app.deleted_at IS NULL
            )
            SELECT
                detail.id,
                detail.supplier_code,
                detail.supplier_name,
                detail.part_no,
                detail.part_name,
                detail.model,
                detail.ais_file,
                detail.sdr_file,
                detail.part_status,
                detail.supplier_edit_status,
                detail.sds_created,
                detail.active_row,
                detail.created_at,
                detail.updated_at,
                detail.deleted_at,
                detail.created_by,
                detail.updated_by,
                sheet.id as sheet_id,
                sheet.loop as sheet_loop,
                sheet.production_08_2025,
                ISNULL(sheet.sdr_date, detail.due_date) AS due_date,
                sp.due_date AS due_date_special,
                sp.id AS special_id,
                l1_sdr.action AS checker1ApprovedSdr,
                l1_sds.action AS checker1ApprovedSds,
                l2_sdr.action AS checker2ApprovedSdr,
                l2_sds.action AS checker2ApprovedSds,
                l3_sdr.action AS checker3ApprovedSdr,
                l3_sds.action AS checker3ApprovedSds,
                ls.action_date AS submitted,
                sheet.has_delay,
                sheet.delay_days
            FROM dbo.sds_inspection_detail detail
            LEFT JOIN dbo.sample_data_sheets sheet ON sheet.inspection_detail_id = detail.id AND sheet.deleted_at IS NULL
            LEFT JOIN rej r ON r.sample_data_sheet_id = sheet.id AND r.rn = 1
            LEFT JOIN dbo.sds_inspection_special_request sp
                ON sp.inspection_detail_id = detail.id
               AND sp.id = (
                    SELECT MAX(id)
                    FROM dbo.sds_inspection_special_request
                    WHERE inspection_detail_id = detail.id
                      AND deleted_at IS NULL
                )
               AND sp.deleted_at IS NULL
            LEFT JOIN latest l1_sdr
                ON l1_sdr.sample_data_sheet_id = sheet.id
               AND l1_sdr.loop = sheet.loop
               AND l1_sdr.document_type = 'SDR'
               AND l1_sdr.role = 'Checker 1'
               AND l1_sdr.rn = 1
            LEFT JOIN latest l1_sds
                ON l1_sds.sample_data_sheet_id = sheet.id
               AND l1_sds.loop = sheet.loop
               AND l1_sds.document_type = 'SDS'
               AND l1_sds.role = 'Checker 1'
               AND l1_sds.rn = 1
            LEFT JOIN latest l2_sdr
                ON l2_sdr.sample_data_sheet_id = sheet.id
               AND l2_sdr.loop = sheet.loop
               AND l2_sdr.document_type = 'SDR'
               AND l2_sdr.role = 'Checker 2'
               AND l2_sdr.rn = 1
            LEFT JOIN latest l2_sds
                ON l2_sds.sample_data_sheet_id = sheet.id
               AND l2_sds.loop = sheet.loop
               AND l2_sds.document_type = 'SDS'
               AND l2_sds.role = 'Checker 2'
               AND l2_sds.rn = 1
            LEFT JOIN latest l3_sdr
                ON l3_sdr.sample_data_sheet_id = sheet.id
               AND l3_sdr.loop = sheet.loop
               AND l3_sdr.document_type = 'SDR'
               AND l3_sdr.role = 'Approver'
               AND l3_sdr.rn = 1
            LEFT JOIN latest l3_sds
                ON l3_sds.sample_data_sheet_id = sheet.id
               AND l3_sds.loop = sheet.loop
               AND l3_sds.document_type = 'SDS'
               AND l3_sds.role = 'Approver'
               AND l3_sds.rn = 1
            LEFT JOIN latest_approved la_sds
                ON la_sds.sample_data_sheet_id = sheet.id
               AND la_sds.loop = sheet.loop
               AND la_sds.document_type = 'SDS'
               AND la_sds.role = 'Approver'
               AND la_sds.rn = 1
            LEFT JOIN latest_submitted ls
                ON ls.sample_data_sheet_id = sheet.id
               AND ls.loop = sheet.loop
               AND ls.rn = 1
            WHERE detail.active_row = 'Y' AND detail.deleted_at IS NULL
            
        `;

        const filterParams: any[] = [];
        let paramIndex = 0;
        let querys = '';

        if (supplierCode) {
            if (filters.pageCreatedSds) {
                querys += ` AND detail.part_status = 'Active' AND supplier_edit_status = 'Locked'`;
            }

            querys += ` AND detail.supplier_code = @${paramIndex}`;
            filterParams.push(supplierCode);
            paramIndex++;
        }

        if (filters.partNo && filters.partNo.toLowerCase() !== 'all') {
            querys += ` AND detail.part_no = @${paramIndex}`;
            filterParams.push(filters.partNo);
            paramIndex++;
        }

        if (filters.partName && filters.partName.toLowerCase() !== 'all') {
            querys += ` AND detail.part_name = @${paramIndex}`;
            filterParams.push(filters.partName);
            paramIndex++;
        }

        if (filters.model && filters.model.toLowerCase() !== 'all') {
            querys += ` AND detail.model = @${paramIndex}`;
            filterParams.push(filters.model);
            paramIndex++;
        }

        if (filters.supplierCode && filters.supplierCode.toLowerCase() !== 'all') {
            querys += ` AND detail.supplier_code = @${paramIndex}`;
            filterParams.push(filters.supplierCode);
            paramIndex++;
        }

        if (filters.monthYear && filters.monthYear.toLowerCase() !== 'all') {
            const monthYear = filters.monthYear.split('-');
            const month = parseInt(monthYear[0], 10);
            const year = parseInt(monthYear[1], 10);
            querys += ` AND (MONTH(sheet.sdr_date) = @${paramIndex} AND YEAR(sheet.sdr_date) = @${paramIndex + 1} OR sheet.sdr_date IS NULL)`;
            filterParams.push(month, year);
            paramIndex += 2;
        }

        if (filters.sdsType && filters.sdsType.toLowerCase() !== 'all') {
            if (filters.sdsType.toLowerCase() === 'special') {
                querys += ` AND EXISTS (
                    SELECT 1
                    FROM dbo.sds_inspection_special_request sr_filter
                    WHERE sr_filter.inspection_detail_id = sheet.inspection_detail_id
                      AND sr_filter.deleted_at IS NULL
                    -- ORDER BY sr_filter.id DESC
                )`;
            } else if (filters.sdsType.toLowerCase() === 'normal') {
                querys += ` AND NOT EXISTS (
                    SELECT 1
                    FROM dbo.sds_inspection_special_request sr_filter
                    WHERE sr_filter.inspection_detail_id = sheet.inspection_detail_id
                      AND sr_filter.deleted_at IS NULL
                    -- ORDER BY sr_filter.id DESC
                )`;
            }
        }

        if (filters.hasDelay) {
            querys += ` AND sheet.has_delay = 1`;
            querys += ` AND la_sds.action_date IS NULL`;
        }

        query += querys;
        query += ` ORDER BY detail.created_at DESC`;
        query += ` OFFSET ${skip} ROWS FETCH NEXT ${limit} ROWS ONLY`;
        const queryParams = [...filterParams];

        // Get total count
        let countQuery = `
            WITH rej AS (
                SELECT
                    a.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY a.sample_data_sheet_id
                        ORDER BY a.id DESC
                    ) AS rn
                FROM sample_data_sheet_approvals a
                WHERE a.action = 'Rejected'
                  AND a.re_submit_date IS NOT NULL
                  AND a.deleted_at IS NULL
            ),
            latest AS (
                SELECT
                    a.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY 
                            a.sample_data_sheet_id,
                            a.loop,
                            a.document_type,
                            a.role
                        ORDER BY a.id DESC
                    ) AS rn
                FROM sample_data_sheet_approvals a
                WHERE a.deleted_at IS NULL
            ),
            latest_approved AS (
                SELECT
                    a.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY 
                            a.sample_data_sheet_id,
                            a.loop,
                            a.document_type,
                            a.role
                        ORDER BY a.id DESC
                    ) AS rn
                FROM sample_data_sheet_approvals a
                WHERE a.action = 'Approved'
                  AND a.deleted_at IS NULL
            ),
            latest_submitted AS (
                SELECT
                    sds_app.sample_data_sheet_id,
                    sds_app.loop,
                    CASE 
                        WHEN sds_app.action_date > sdr_app.action_date THEN sds_app.action_date
                        ELSE sdr_app.action_date
                    END as action_date,
                    ROW_NUMBER() OVER (
                        PARTITION BY 
                            sds_app.sample_data_sheet_id,
                            sds_app.loop
                        ORDER BY sds_app.id DESC
                    ) AS rn
                FROM sample_data_sheet_approvals sds_app
                INNER JOIN sample_data_sheet_approvals sdr_app
                    ON sdr_app.sample_data_sheet_id = sds_app.sample_data_sheet_id
                   AND sdr_app.loop = sds_app.loop
                   AND sdr_app.document_type = 'SDR'
                   AND sdr_app.role = 'Approver'
                   AND sdr_app.action = 'Approved'
                   AND sdr_app.deleted_at IS NULL
                WHERE sds_app.document_type = 'SDS'
                  AND sds_app.role = 'Approver'
                  AND sds_app.action = 'Approved'
                  AND sds_app.deleted_at IS NULL
            )
            SELECT
                COUNT(*) AS total
            FROM dbo.sds_inspection_detail detail
            LEFT JOIN dbo.sample_data_sheets sheet ON sheet.inspection_detail_id = detail.id AND sheet.deleted_at IS NULL
            LEFT JOIN rej r ON r.sample_data_sheet_id = sheet.id AND r.rn = 1
            LEFT JOIN dbo.sds_inspection_special_request sp
                ON sp.inspection_detail_id = detail.id
               AND sp.id = (
                    SELECT MAX(id)
                    FROM dbo.sds_inspection_special_request
                    WHERE inspection_detail_id = detail.id
                      AND deleted_at IS NULL
                )
               AND sp.deleted_at IS NULL
            LEFT JOIN latest l1_sdr
                ON l1_sdr.sample_data_sheet_id = sheet.id
               AND l1_sdr.loop = sheet.loop
               AND l1_sdr.document_type = 'SDR'
               AND l1_sdr.role = 'Checker 1'
               AND l1_sdr.rn = 1
            LEFT JOIN latest l1_sds
                ON l1_sds.sample_data_sheet_id = sheet.id
               AND l1_sds.loop = sheet.loop
               AND l1_sds.document_type = 'SDS'
               AND l1_sds.role = 'Checker 1'
               AND l1_sds.rn = 1
            LEFT JOIN latest l2_sdr
                ON l2_sdr.sample_data_sheet_id = sheet.id
               AND l2_sdr.loop = sheet.loop
               AND l2_sdr.document_type = 'SDR'
               AND l2_sdr.role = 'Checker 2'
               AND l2_sdr.rn = 1
            LEFT JOIN latest l2_sds
                ON l2_sds.sample_data_sheet_id = sheet.id
               AND l2_sds.loop = sheet.loop
               AND l2_sds.document_type = 'SDS'
               AND l2_sds.role = 'Checker 2'
               AND l2_sds.rn = 1
            LEFT JOIN latest l3_sdr
                ON l3_sdr.sample_data_sheet_id = sheet.id
               AND l3_sdr.loop = sheet.loop
               AND l3_sdr.document_type = 'SDR'
               AND l3_sdr.role = 'Approver'
               AND l3_sdr.rn = 1
            LEFT JOIN latest l3_sds
                ON l3_sds.sample_data_sheet_id = sheet.id
               AND l3_sds.loop = sheet.loop
               AND l3_sds.document_type = 'SDS'
               AND l3_sds.role = 'Approver'
               AND l3_sds.rn = 1
            LEFT JOIN latest_approved la_sds
                ON la_sds.sample_data_sheet_id = sheet.id
               AND la_sds.loop = sheet.loop
               AND la_sds.document_type = 'SDS'
               AND la_sds.role = 'Approver'
               AND la_sds.rn = 1
            LEFT JOIN latest_submitted ls
                ON ls.sample_data_sheet_id = sheet.id
               AND ls.loop = sheet.loop
               AND ls.rn = 1
            WHERE detail.active_row = 'Y' AND detail.deleted_at IS NULL
        `;

        const rawResults = await this.dataSource.query(query, queryParams);
        const countResult = await this.dataSource.query(countQuery + querys, filterParams);

        const total = countResult && countResult.length > 0 ? countResult[0].total : 0;

        // if (total === 0) {
        //     return { total: 0, items: [] };
        // }


        const rows: InspectionDetailListItem[] = rawResults.map((row, index) => {

            const checker1Approved = row.checker1ApprovedSdr === 'Approved' && row.checker1ApprovedSds === 'Approved';
            const checker1Rejected = row.checker1ApprovedSdr === 'Rejected' || row.checker1ApprovedSds === 'Rejected';
            const checker2Approved = row.checker2ApprovedSdr === 'Approved' && row.checker2ApprovedSds === 'Approved';
            const checker2Rejected = row.checker2ApprovedSdr === 'Rejected' || row.checker2ApprovedSds === 'Rejected';
            const checker3Approved = row.checker3ApprovedSdr === 'Approved' && row.checker3ApprovedSds === 'Approved';
            const checker3Rejected = row.checker3ApprovedSdr === 'Rejected' || row.checker3ApprovedSds === 'Rejected';
            let supplierStatus = 'Pending';
            if (row.part_status !== 'Active' && !checker1Approved && !checker1Rejected) {
                supplierStatus = 'Wait for JATH Active Part';
            } else if (!row.sds_created && !checker1Approved && !checker1Rejected) {
                supplierStatus = 'Pending';
            } else if ((row.checker1ApprovedSdr === 'Approved' && row.checker1ApprovedSds === 'Approved') &&
                (row.checker2ApprovedSdr === 'Approved' && row.checker2ApprovedSds === 'Approved') &&
                (row.checker3ApprovedSdr === 'Approved' && row.checker3ApprovedSds === 'Approved')
            ) {
                supplierStatus = 'Submitted';
            } else if ((row.checker1ApprovedSdr === 'Rejected' || row.checker1ApprovedSds === 'Rejected') ||
                (row.checker2ApprovedSdr === 'Rejected' || row.checker2ApprovedSds === 'Rejected') ||
                (row.checker3ApprovedSdr === 'Rejected' || row.checker3ApprovedSds === 'Rejected')
            ) {
                supplierStatus = 'Rejected';
            } else {
                supplierStatus = 'Wait for JATH Approve';
            }

            let checker1Status = 'Pending';
            if (row.production_08_2025 === 'No' && checker3Approved) {
                checker1Status = 'Completed';
            } else if (row.production_08_2025 === 'No' && checker3Rejected) {
                checker1Status = 'Rejected';
            } else if ((supplierStatus == 'Pending' && !checker1Approved && !checker1Rejected) || supplierStatus == 'Wait for JATH Active Part') {
                checker1Status = 'Supplier Pending';
            } else if ((row.checker1ApprovedSdr === 'Approved' && row.checker1ApprovedSds === 'Approved') &&
                (row.checker2ApprovedSdr === 'Approved' && row.checker2ApprovedSds === 'Approved') &&
                (row.checker3ApprovedSdr === 'Approved' && row.checker3ApprovedSds === 'Approved')
            ) {
                checker1Status = 'Completed';
            } else if (row.checker1ApprovedSdr === 'Approved' && row.checker1ApprovedSds === 'Approved') {
                checker1Status = 'Approved';
            } else if (row.checker1ApprovedSdr === 'Rejected' || row.checker1ApprovedSds === 'Rejected') {
                checker1Status = 'Rejected';
            }

            let checker2Status = 'Pending';
            if (checker1Status === 'Completed') {
                checker2Status = 'Completed';
            } else if (checker1Status === 'Rejected') {
                checker2Status = 'Rejected';
            } else if ((supplierStatus == 'Pending' && !checker1Approved && !checker1Rejected) || supplierStatus == 'Wait for JATH Active Part') {
                checker2Status = 'Supplier Pending';
            } else if (checker1Status === 'Pending') {
                checker2Status = 'Wait for Checker 1 Approve';
            } else if (checker1Status === 'Rejected') {
                checker2Status = 'Rejected';
            } else if (row.checker2ApprovedSdr === 'Approved' && row.checker2ApprovedSds === 'Approved') {
                checker2Status = 'Approved';
            } else if (row.checker2ApprovedSdr === 'Rejected' || row.checker2ApprovedSds === 'Rejected') {
                checker2Status = 'Rejected';
            }

            let checker3Status = 'Pending';
            if (checker2Status === 'Completed') {
                checker3Status = 'Completed';
            } else if (checker2Status === 'Rejected') {
                checker3Status = 'Rejected';
            } else if ((supplierStatus == 'Pending' && !checker1Approved && !checker1Rejected) || supplierStatus == 'Wait for JATH Active Part') {
                checker3Status = 'Supplier Pending';
            } else if (checker2Status === 'Wait for Checker 1 Approve') {
                checker3Status = 'Wait for Checker 1 Approve';
            } else if (checker2Status === 'Pending') {
                checker3Status = 'Wait for Checker 2 Approve';
            } else if (checker2Status === 'Rejected') {
                checker3Status = 'Rejected';
            } else if (row.checker3ApprovedSdr === 'Approved' && row.checker3ApprovedSds === 'Approved') {
                checker3Status = 'Approved';
            } else if (row.checker3ApprovedSdr === 'Rejected' || row.checker3ApprovedSds === 'Rejected') {
                checker3Status = 'Rejected';
            }

            const hasAnyRejection = checker1Rejected || checker2Rejected || checker3Rejected;
            const dueDate = row.due_date ? row.due_date : (row.due_date_special ? row.due_date_special : null);
            const monthYear = dueDate
                ? this.formatMonthYear(dueDate)
                : this.formatMonthYear(new Date(row.created_at));
            const sdsType: 'Special' | 'Normal' = row.special_id ? 'Special' : 'Normal';

            return {
                ...row,
                supplierCode: row.supplier_code,
                id: row.id,
                no: index + 1 + skip,
                supplierName: row.supplier_name,
                partNo: row.part_no,
                partName: row.part_name,
                model: row.model,
                monthYear,
                sdsType,
                supplierStatus,
                checker1Status,
                checker2Status,
                checker3Status,
                dueDate: dueDate ? this.formatDayMonthYear(dueDate) : null,
                hasDelay: !!row.has_delay,
                delayDays: row.delay_days ?? undefined,
                sdsCreated: row.sds_created,
                adsStatus: checker3Status,
                checker1Approved,
                checker1Rejected,
                checker2Approved,
                checker2Rejected,
                checker3Approved,
                checker3Rejected,
                hasAnyRejection,
                submittedAt: row.Submitted,
                canCreateSds: row.part_status === 'Active' && row.supplier_edit_status === 'Locked',
            }
        })

        return {
            total: total,
            items: rows,
        };
    }

    async listSampleDataSheets(
        filters: ListInspectionDetailsQueryDto,
        supplierCode?: string,
    ): Promise<InspectionDetailListResponse> {
        const skip = Number.isNaN(Number(filters.skip)) ? 0 : Number(filters.skip);
        const limit = Number.isNaN(Number(filters.limit)) ? 10 : Number(filters.limit);

        const checkerLevel = filters.checkerLevel;

        // Build query using sample_data_sheets as primary table
        let query = `
            WITH rej AS (
                SELECT
                    a.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY a.sample_data_sheet_id
                        ORDER BY a.id DESC
                    ) AS rn
                FROM sample_data_sheet_approvals a
                WHERE a.action = 'Rejected'
                  AND a.re_submit_date IS NOT NULL
                  AND a.deleted_at IS NULL
            ),
            latest AS (
                SELECT
                    a.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY 
                            a.sample_data_sheet_id,
                            a.loop,
                            a.document_type,
                            a.role
                        ORDER BY a.id DESC
                    ) AS rn
                FROM sample_data_sheet_approvals a
                WHERE a.deleted_at IS NULL
            ),
            latest_approved AS (
                SELECT
                    a.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY 
                            a.sample_data_sheet_id,
                            a.loop,
                            a.document_type,
                            a.role
                        ORDER BY a.id DESC
                    ) AS rn
                FROM sample_data_sheet_approvals a
                WHERE a.action = 'Approved'
                  AND a.deleted_at IS NULL
            ),
            latest_submitted AS (
                SELECT
                    sds_app.sample_data_sheet_id,
                    sds_app.loop,
                    CASE 
                        WHEN sds_app.action_date > sdr_app.action_date THEN sds_app.action_date
                        ELSE sdr_app.action_date
                    END as action_date,
                    ROW_NUMBER() OVER (
                        PARTITION BY 
                            sds_app.sample_data_sheet_id,
                            sds_app.loop
                        ORDER BY sds_app.id DESC
                    ) AS rn
                FROM sample_data_sheet_approvals sds_app
                INNER JOIN sample_data_sheet_approvals sdr_app
                    ON sdr_app.sample_data_sheet_id = sds_app.sample_data_sheet_id
                   AND sdr_app.loop = sds_app.loop
                   AND sdr_app.document_type = 'SDR'
                   AND sdr_app.role = 'Approver'
                   AND sdr_app.action = 'Approved'
                   AND sdr_app.deleted_at IS NULL
                WHERE sds_app.document_type = 'SDS'
                  AND sds_app.role = 'Approver'
                  AND sds_app.action = 'Approved'
                  AND sds_app.deleted_at IS NULL
            )
            SELECT
                sheet.id,
                sheet.supplier,
                sheet.part_no,
                sheet.part_name,
                sheet.model,
                sheet.inspection_detail_id,
                sheet.production_08_2025,
                sheet.sdr_date,
                sheet.ais_file,
                sheet.sdr_file,
                sheet.sdr_report_file,
                sheet.created_at,
                sheet.updated_at,
                sheet.loop,
                sheet.remark,
                detail.part_status,
                detail.supplier_edit_status,
                detail.sds_created,
                detail.supplier_code,
                detail.supplier_name,
                ISNULL(sheet.sdr_date, detail.due_date) AS due_date,
                l1_sdr.action AS checker1ApprovedSdr,
                l1_sds.action AS checker1ApprovedSds,
                l2_sdr.action AS checker2ApprovedSdr,
                l2_sds.action AS checker2ApprovedSds,
                l3_sdr.action AS checker3ApprovedSdr,
                l3_sds.action AS checker3ApprovedSds,
                ls.action_date AS submitted,
                sp.id AS special_id,
                sheet.has_delay,
                sheet.delay_days
            FROM dbo.sample_data_sheets sheet
            LEFT JOIN dbo.sds_inspection_detail detail ON detail.id = sheet.inspection_detail_id AND detail.deleted_at IS NULL
            LEFT JOIN rej r ON r.sample_data_sheet_id = sheet.id AND r.rn = 1
            LEFT JOIN dbo.sds_inspection_special_request sp
                ON sp.inspection_detail_id = detail.id
               AND sp.id = (
                    SELECT MAX(id)
                    FROM dbo.sds_inspection_special_request
                    WHERE inspection_detail_id = detail.id
                      AND deleted_at IS NULL
                )
               AND sp.deleted_at IS NULL
            LEFT JOIN latest l1_sdr
                ON l1_sdr.sample_data_sheet_id = sheet.id
               AND l1_sdr.loop = sheet.loop
               AND l1_sdr.document_type = 'SDR'
               AND l1_sdr.role = 'Checker 1'
               AND l1_sdr.rn = 1
            LEFT JOIN latest l1_sds
                ON l1_sds.sample_data_sheet_id = sheet.id
               AND l1_sds.loop = sheet.loop
               AND l1_sds.document_type = 'SDS'
               AND l1_sds.role = 'Checker 1'
               AND l1_sds.rn = 1
            LEFT JOIN latest l2_sdr
                ON l2_sdr.sample_data_sheet_id = sheet.id
               AND l2_sdr.loop = sheet.loop
               AND l2_sdr.document_type = 'SDR'
               AND l2_sdr.role = 'Checker 2'
               AND l2_sdr.rn = 1
            LEFT JOIN latest l2_sds
                ON l2_sds.sample_data_sheet_id = sheet.id
               AND l2_sds.loop = sheet.loop
               AND l2_sds.document_type = 'SDS'
               AND l2_sds.role = 'Checker 2'
               AND l2_sds.rn = 1
            LEFT JOIN latest l3_sdr
                ON l3_sdr.sample_data_sheet_id = sheet.id
               AND l3_sdr.loop = sheet.loop
               AND l3_sdr.document_type = 'SDR'
               AND l3_sdr.role = 'Approver'
               AND l3_sdr.rn = 1
            LEFT JOIN latest l3_sds
                ON l3_sds.sample_data_sheet_id = sheet.id
               AND l3_sds.loop = sheet.loop
               AND l3_sds.document_type = 'SDS'
               AND l3_sds.role = 'Approver'
               AND l3_sds.rn = 1
            LEFT JOIN latest_approved la_sds
                ON la_sds.sample_data_sheet_id = sheet.id
               AND la_sds.loop = sheet.loop
               AND la_sds.document_type = 'SDS'
               AND la_sds.role = 'Approver'
               AND la_sds.rn = 1
            LEFT JOIN latest_submitted ls
                ON ls.sample_data_sheet_id = sheet.id
               AND ls.loop = sheet.loop
               AND ls.rn = 1
            WHERE 1=1 AND sheet.deleted_at IS NULL
        `;

        const filterParams: any[] = [];
        let paramIndex = 0;
        let querys = '';

        if (supplierCode) {
            querys += ` AND detail.supplier_code = @${paramIndex}`;
            filterParams.push(supplierCode);
            paramIndex++;
        } else if (filters.supplierCode && filters.supplierCode.toLowerCase() !== 'all') {
            querys += ` AND detail.supplier_code = @${paramIndex}`;
            filterParams.push(filters.supplierCode);
            paramIndex++;
        }

        if (filters.partNo && filters.partNo.toLowerCase() !== 'all') {
            querys += ` AND LOWER(sheet.part_no) LIKE LOWER(@${paramIndex})`;
            filterParams.push(`%${filters.partNo}%`);
            paramIndex++;
        }

        if (filters.partName && filters.partName.toLowerCase() !== 'all') {
            querys += ` AND LOWER(sheet.part_name) LIKE LOWER(@${paramIndex})`;
            filterParams.push(`%${filters.partName}%`);
            paramIndex++;
        }

        if (filters.model && filters.model.toLowerCase() !== 'all') {
            querys += ` AND LOWER(sheet.model) LIKE LOWER(@${paramIndex})`;
            filterParams.push(`%${filters.model}%`);
            paramIndex++;
        }

        if (filters.monthYear && filters.monthYear.toLowerCase() !== 'all') {
            querys += ` AND (sheet.sdr_date BETWEEN @${paramIndex} AND @${paramIndex + 1})`;
            filterParams.push(moment(`${moment(filters.monthYear, 'MM-YYYY').format('YYYY-MM')}-01 00:00:00`, 'YYYY-MM-DD HH:mm:ss').format('YYYY-MM-DD HH:mm:ss'));
            filterParams.push(moment(`${moment(filters.monthYear, 'MM-YYYY').format('YYYY-MM')}-${moment(filters.monthYear, 'MM-YYYY').endOf('month').format('DD')} 23:59:59`, 'YYYY-MM-DD HH:mm:ss').format('YYYY-MM-DD HH:mm:ss'));
            paramIndex += 2;
        }

        if (filters.sdsType && filters.sdsType.toLowerCase() !== 'all') {
            if (filters.sdsType.toLowerCase() === 'special') {
                querys += ` AND EXISTS (
                    SELECT 1
                    FROM dbo.sds_inspection_special_request sr_filter
                    WHERE sr_filter.inspection_detail_id = sheet.inspection_detail_id
                      AND sr_filter.deleted_at IS NULL
                    -- ORDER BY sr_filter.id DESC
                )`;
            } else if (filters.sdsType.toLowerCase() === 'normal') {
                querys += ` AND NOT EXISTS (
                    SELECT 1
                    FROM dbo.sds_inspection_special_request sr_filter
                    WHERE sr_filter.inspection_detail_id = sheet.inspection_detail_id
                      AND sr_filter.deleted_at IS NULL
                    -- ORDER BY sr_filter.id DESC
                )`;
            }
        }

        query += querys;
        query += ` ORDER BY sheet.created_at DESC`;
        query += ` OFFSET ${skip} ROWS FETCH NEXT ${limit} ROWS ONLY`;
        const queryParams = [...filterParams];

        // Get total count
        let countQuery = `
            SELECT COUNT(*) as total
            FROM dbo.sample_data_sheets sheet
            LEFT JOIN dbo.sds_inspection_detail detail ON detail.id = sheet.inspection_detail_id AND detail.deleted_at IS NULL
            WHERE sheet.deleted_at IS NULL
        `;

        const rawResults = await this.dataSource.query(query, queryParams);
        const countResult = await this.dataSource.query(countQuery + querys, filterParams);

        const total = countResult && countResult.length > 0 ? countResult[0].total : 0;

        const rows: InspectionDetailListItem[] = rawResults.map((row, index) => {
            const checker1Approved = row.checker1ApprovedSdr === 'Approved' && row.checker1ApprovedSds === 'Approved';
            const checker1Rejected = row.checker1ApprovedSdr === 'Rejected' || row.checker1ApprovedSds === 'Rejected';
            const checker2Approved = row.checker2ApprovedSdr === 'Approved' && row.checker2ApprovedSds === 'Approved';
            const checker2Rejected = row.checker2ApprovedSdr === 'Rejected' || row.checker2ApprovedSds === 'Rejected';
            const checker3Approved = row.checker3ApprovedSdr === 'Approved' && row.checker3ApprovedSds === 'Approved';
            const checker3Rejected = row.checker3ApprovedSdr === 'Rejected' || row.checker3ApprovedSds === 'Rejected';

            let supplierStatus = 'Pending';
            if (row.part_status !== 'Active' && !checker1Approved && !checker1Rejected) {
                supplierStatus = 'Wait for JATH Active Part';
            } else if (!row.sds_created && !checker1Approved && !checker1Rejected) {
                supplierStatus = 'Pending';
            } else if (checker1Approved && checker2Approved && checker3Approved) {
                supplierStatus = 'Completed';
            } else if (checker1Rejected || checker2Rejected || checker3Rejected) {
                supplierStatus = 'Rejected';
            } else {
                supplierStatus = 'Submitted';
            }

            let checker1Status = 'Pending';
            if (row.production_08_2025 === 'No' && checker3Approved) {
                checker1Status = 'Completed';
            } else if (row.production_08_2025 === 'No' && checker3Rejected) {
                checker1Status = 'Rejected';
            } else if ((supplierStatus == 'Pending' && !checker1Approved && !checker1Rejected) || supplierStatus == 'Wait for JATH Active Part') {
                checker1Status = 'Supplier Pending';
            } else if (checker1Approved && checker2Approved && checker3Approved) {
                checker1Status = 'Completed';
            } else if (checker1Rejected) {
                checker1Status = 'Rejected';
            } else if (checker1Approved) {
                checker1Status = 'Approved';
            }

            let checker2Status = 'Pending';
            if (checker1Status === 'Completed') {
                checker2Status = 'Completed';
            } else if (checker1Status === 'Rejected') {
                checker2Status = 'Rejected';
            } else if ((supplierStatus == 'Pending' && !checker1Approved && !checker1Rejected) || supplierStatus == 'Wait for JATH Active Part') {
                checker2Status = 'Supplier Pending';
            } else if (checker1Status === 'Pending') {
                checker2Status = 'Wait for Checker 1 Approve';
            } else if (checker2Rejected) {
                checker2Status = 'Rejected';
            } else if (checker2Approved) {
                checker2Status = 'Approved';
            }

            let checker3Status = 'Pending';
            if (checker2Status === 'Completed') {
                checker3Status = 'Completed';
            } else if (checker2Status === 'Rejected') {
                checker3Status = 'Rejected';
            } else if ((supplierStatus == 'Pending' && !checker1Approved && !checker1Rejected) || supplierStatus == 'Wait for JATH Active Part') {
                checker3Status = 'Supplier Pending';
            } else if (checker2Status === 'Wait for Checker 1 Approve') {
                checker3Status = 'Wait for Checker 1 Approve';
            } else if (checker2Status === 'Pending') {
                checker3Status = 'Wait for Checker 2 Approve';
            } else if (checker3Rejected) {
                checker3Status = 'Rejected';
            } else if (checker3Approved) {
                checker3Status = 'Approved';
            }

            const hasAnyRejection = checker1Rejected || checker2Rejected || checker3Rejected;
            const dueDate = row.due_date;
            const monthYear = dueDate
                ? this.formatMonthYear(dueDate)
                : this.formatMonthYear(new Date(row.created_at));
            const sdsType: 'Special' | 'Normal' = row.special_id ? 'Special' : 'Normal';

            return {
                ...row,
                supplierCode: row.supplier_code,
                no: index + 1 + skip,
                supplierName: row.supplier_name || row.supplier,
                partNo: row.part_no,
                partName: row.part_name,
                model: row.model,
                monthYear,
                sdsType,
                dueDate: dueDate ? this.formatDayMonthYear(dueDate) : null,
                supplierStatus,
                checker1Status,
                checker2Status,
                checker3Status,
                checker1Approved,
                checker1Rejected,
                checker2Approved,
                checker2Rejected,
                checker3Approved,
                checker3Rejected,
                hasAnyRejection,
                submittedAt: row.submitted,
                canCreateSds: row.part_status === 'Active' && row.supplier_edit_status === 'Locked',
                sdsCreated: row.sds_created || false,
                hasDelay: !!row.has_delay,
                delayDays: row.delay_days ?? undefined,
                adsStatus: checker3Status,
            }
        });

        return {
            total: total,
            items: rows,
        };
    }

    async listSummaryReport(
        filters: ListInspectionDetailsQueryDto,
        supplierCode?: string,
    ): Promise<InspectionDetailListResponse> {
        const skip = Number.isNaN(Number(filters.skip)) ? 0 : Number(filters.skip);
        const limit = Number.isNaN(Number(filters.limit)) ? 10 : Number(filters.limit);

        // Build UNION query combining sample_data_sheets and sds_inspection_detail (sds_created = 0)
        let query = `
            WITH rej AS (
                SELECT
                    a.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY a.sample_data_sheet_id
                        ORDER BY a.id DESC
                    ) AS rn
                FROM sample_data_sheet_approvals a
                WHERE a.action = 'Rejected'
                  AND a.re_submit_date IS NOT NULL
                  AND a.deleted_at IS NULL
            ),
            latest AS (
                SELECT
                    a.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY 
                            a.sample_data_sheet_id,
                            a.loop,
                            a.document_type,
                            a.role
                        ORDER BY a.id DESC
                    ) AS rn
                FROM sample_data_sheet_approvals a
                WHERE a.deleted_at IS NULL
            ),
            latest_approved AS (
                SELECT
                    a.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY 
                            a.sample_data_sheet_id,
                            a.loop,
                            a.document_type,
                            a.role
                        ORDER BY a.id DESC
                    ) AS rn
                FROM sample_data_sheet_approvals a
                WHERE a.action = 'Approved'
                  AND a.deleted_at IS NULL
            ),
            latest_submitted AS (
                SELECT
                    sds_app.sample_data_sheet_id,
                    sds_app.loop,
                    CASE 
                        WHEN sds_app.action_date > sdr_app.action_date THEN sds_app.action_date
                        ELSE sdr_app.action_date
                    END as action_date,
                    ROW_NUMBER() OVER (
                        PARTITION BY 
                            sds_app.sample_data_sheet_id,
                            sds_app.loop
                        ORDER BY sds_app.id DESC
                    ) AS rn
                FROM sample_data_sheet_approvals sds_app
                INNER JOIN sample_data_sheet_approvals sdr_app
                    ON sdr_app.sample_data_sheet_id = sds_app.sample_data_sheet_id
                   AND sdr_app.loop = sds_app.loop
                   AND sdr_app.document_type = 'SDR'
                   AND sdr_app.role = 'Approver'
                   AND sdr_app.action = 'Approved'
                   AND sdr_app.deleted_at IS NULL
                WHERE sds_app.document_type = 'SDS'
                  AND sds_app.role = 'Approver'
                  AND sds_app.action = 'Approved'
                  AND sds_app.deleted_at IS NULL
            ),
            combined_data AS (
                -- Part 1: Records from sample_data_sheets
                SELECT
                    sheet.id as sheet_id,
                    detail.id as detail_id,
                    sheet.supplier,
                    sheet.part_no,
                    sheet.part_name,
                    sheet.model,
                    sheet.inspection_detail_id,
                    sheet.production_08_2025,
                    sheet.sdr_date,
                    detail.part_status,
                    detail.supplier_edit_status,
                    detail.sds_created,
                    detail.supplier_code,
                    detail.supplier_name,
                    sheet.sdr_date AS due_date,
                    sheet.created_at,
                    sheet.loop,
                    1 as has_sheet,
                    sheet.has_delay,
                    sheet.delay_days
                FROM dbo.sample_data_sheets sheet
                LEFT JOIN dbo.sds_inspection_detail detail ON detail.id = sheet.inspection_detail_id 
                    AND detail.deleted_at IS NULL
                WHERE sheet.deleted_at IS NULL
                
                UNION ALL
                
                -- Part 2: Records from sds_inspection_detail where sds_created = 0
                SELECT
                    NULL as sheet_id,
                    detail.id as detail_id,
                    detail.supplier_name as supplier,
                    detail.part_no,
                    detail.part_name,
                    detail.model,
                    detail.id as inspection_detail_id,
                    NULL as production_08_2025,
                    NULL as sdr_date,
                    detail.part_status,
                    detail.supplier_edit_status,
                    detail.sds_created,
                    detail.supplier_code,
                    detail.supplier_name,
                    detail.due_date,
                    detail.created_at,
                    1 as loop,
                    0 as has_sheet,
                    detail.has_delay,
                    detail.delay_days
                FROM dbo.sds_inspection_detail detail
                WHERE detail.sds_created = 0 AND detail.deleted_at IS NULL 
                  ${filters.pageCreatedSds ? `AND detail.part_status = 'Active' AND detail.supplier_edit_status = 'Locked'` : ''}
                  AND detail.active_row = 'Y'
            )
            SELECT
                cd.sheet_id,
                cd.detail_id,
                cd.supplier,
                cd.part_no,
                cd.part_name,
                cd.model,
                cd.inspection_detail_id,
                cd.production_08_2025,
                cd.sdr_date,
                cd.part_status,
                cd.supplier_edit_status,
                cd.sds_created,
                cd.supplier_code,
                cd.supplier_name,
                cd.due_date,
                cd.created_at,
                cd.loop,
                cd.has_sheet,
                cd.has_delay,
                cd.delay_days,
                sp.id AS special_id,
                l1_sdr.action AS checker1ApprovedSdr,
                l1_sds.action AS checker1ApprovedSds,
                l2_sdr.action AS checker2ApprovedSdr,
                l2_sds.action AS checker2ApprovedSds,
                l3_sdr.action AS checker3ApprovedSdr,
                l3_sds.action AS checker3ApprovedSds,
                ls.action_date AS submitted
            FROM combined_data cd
            LEFT JOIN dbo.sds_inspection_special_request sp
                ON sp.inspection_detail_id = cd.inspection_detail_id
               AND sp.id = (
                    SELECT MAX(id)
                    FROM dbo.sds_inspection_special_request
                    WHERE inspection_detail_id = cd.inspection_detail_id
                      AND deleted_at IS NULL
                )
               AND sp.deleted_at IS NULL
            LEFT JOIN latest l1_sdr
                ON l1_sdr.sample_data_sheet_id = cd.sheet_id
               AND l1_sdr.loop = cd.loop
               AND l1_sdr.document_type = 'SDR'
               AND l1_sdr.role = 'Checker 1'
               AND l1_sdr.rn = 1
            LEFT JOIN latest l1_sds
                ON l1_sds.sample_data_sheet_id = cd.sheet_id
               AND l1_sds.loop = cd.loop
               AND l1_sds.document_type = 'SDS'
               AND l1_sds.role = 'Checker 1'
               AND l1_sds.rn = 1
            LEFT JOIN latest l2_sdr
                ON l2_sdr.sample_data_sheet_id = cd.sheet_id
               AND l2_sdr.loop = cd.loop
               AND l2_sdr.document_type = 'SDR'
               AND l2_sdr.role = 'Checker 2'
               AND l2_sdr.rn = 1
            LEFT JOIN latest l2_sds
                ON l2_sds.sample_data_sheet_id = cd.sheet_id
               AND l2_sds.loop = cd.loop
               AND l2_sds.document_type = 'SDS'
               AND l2_sds.role = 'Checker 2'
               AND l2_sds.rn = 1
            LEFT JOIN latest l3_sdr
                ON l3_sdr.sample_data_sheet_id = cd.sheet_id
               AND l3_sdr.loop = cd.loop
               AND l3_sdr.document_type = 'SDR'
               AND l3_sdr.role = 'Approver'
               AND l3_sdr.rn = 1
            LEFT JOIN latest l3_sds
                ON l3_sds.sample_data_sheet_id = cd.sheet_id
               AND l3_sds.loop = cd.loop
               AND l3_sds.document_type = 'SDS'
               AND l3_sds.role = 'Approver'
               AND l3_sds.rn = 1
            LEFT JOIN latest_approved la_sds
                ON la_sds.sample_data_sheet_id = cd.sheet_id
               AND la_sds.loop = cd.loop
               AND la_sds.document_type = 'SDS'
               AND la_sds.role = 'Approver'
               AND la_sds.rn = 1
            LEFT JOIN latest_submitted ls
                ON ls.sample_data_sheet_id = cd.sheet_id
               AND ls.loop = cd.loop
               AND ls.rn = 1
            WHERE 1=1
        `;

        const filterParams: any[] = [];
        let paramIndex = 0;
        let querys = '';

        if (supplierCode) {
            querys += ` AND cd.supplier_code = @${paramIndex}`;
            filterParams.push(supplierCode);
            paramIndex++;
        } else if (filters.supplierCode && filters.supplierCode.toLowerCase() !== 'all') {
            querys += ` AND cd.supplier_code = @${paramIndex}`;
            filterParams.push(filters.supplierCode);
            paramIndex++;
        }

        if (filters.partNo && filters.partNo.toLowerCase() !== 'all') {
            querys += ` AND LOWER(cd.part_no) LIKE LOWER(@${paramIndex})`;
            filterParams.push(`%${filters.partNo}%`);
            paramIndex++;
        }

        if (filters.partName && filters.partName.toLowerCase() !== 'all') {
            querys += ` AND LOWER(cd.part_name) LIKE LOWER(@${paramIndex})`;
            filterParams.push(`%${filters.partName}%`);
            paramIndex++;
        }

        if (filters.model && filters.model.toLowerCase() !== 'all') {
            querys += ` AND LOWER(cd.model) LIKE LOWER(@${paramIndex})`;
            filterParams.push(`%${filters.model}%`);
            paramIndex++;
        }

        if (filters.monthYear && filters.monthYear.toLowerCase() !== 'all') {
            querys += ` AND cd.due_date BETWEEN @${paramIndex} AND @${paramIndex + 1}`;
            filterParams.push(moment(`${moment(filters.monthYear, 'MM-YYYY').format('YYYY-MM')}-01 00:00:00`, 'YYYY-MM-DD HH:mm:ss').format('YYYY-MM-DD HH:mm:ss'));
            filterParams.push(moment(`${moment(filters.monthYear, 'MM-YYYY').format('YYYY-MM')}-${moment(filters.monthYear, 'MM-YYYY').endOf('month').format('DD')} 23:59:59`, 'YYYY-MM-DD HH:mm:ss').format('YYYY-MM-DD HH:mm:ss'));
            paramIndex += 2;
        }

        if (filters.year && filters.year.toLowerCase() !== 'all') {
            querys += ` AND cd.due_date BETWEEN @${paramIndex} AND @${paramIndex + 1}`;
            filterParams.push(moment(`${filters.year}-04-01 00:00:00`, 'YYYY-MM-DD HH:mm:ss').format('YYYY-MM-DD HH:mm:ss'));
            filterParams.push(moment(`${filters.year}-03-31 23:59:59`, 'YYYY-MM-DD HH:mm:ss').add(1, 'year').format('YYYY-MM-DD HH:mm:ss'));
            paramIndex += 2;
        }

        if (filters.sdsType && filters.sdsType.toLowerCase() !== 'all') {
            if (filters.sdsType.toLowerCase() === 'special') {
                querys += ` AND sp.id IS NOT NULL`;
            } else if (filters.sdsType.toLowerCase() === 'normal') {
                querys += ` AND sp.id IS NULL`;
            }
        }

        if (filters.notCompleted) {
            querys += ` AND ls.action_date IS NULL`;
        }

        let queryCount = `${querys}`;
        if (filters.hasDelay) {
            querys += ` AND cd.has_delay = 1 AND cd.sheet_id IS NULL`;
        } else if (filters.notHasDelay) {
            querys += ` AND cd.has_delay = 0`;
        }

        query += querys;
        query += ` ORDER BY cd.created_at DESC`;
        query += ` OFFSET ${skip} ROWS FETCH NEXT ${limit} ROWS ONLY`;
        const queryParams = [...filterParams];


        // Get total count
        let countQuery = `
            WITH latest_approved AS (
                SELECT
                    a.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY 
                            a.sample_data_sheet_id,
                            a.loop,
                            a.document_type,
                            a.role
                        ORDER BY a.id DESC
                    ) AS rn
                FROM sample_data_sheet_approvals a
                WHERE a.action = 'Approved'
                  AND a.deleted_at IS NULL
            ),
            latest_submitted AS (
                SELECT
                    sds_app.sample_data_sheet_id,
                    sds_app.loop,
                    CASE 
                        WHEN sds_app.action_date > sdr_app.action_date THEN sds_app.action_date
                        ELSE sdr_app.action_date
                    END as action_date,
                    ROW_NUMBER() OVER (
                        PARTITION BY 
                            sds_app.sample_data_sheet_id,
                            sds_app.loop
                        ORDER BY sds_app.id DESC
                    ) AS rn
                FROM sample_data_sheet_approvals sds_app
                INNER JOIN sample_data_sheet_approvals sdr_app
                    ON sdr_app.sample_data_sheet_id = sds_app.sample_data_sheet_id
                   AND sdr_app.loop = sds_app.loop
                   AND sdr_app.document_type = 'SDR'
                   AND sdr_app.role = 'Approver'
                   AND sdr_app.action = 'Approved'
                   AND sdr_app.deleted_at IS NULL
                WHERE sds_app.document_type = 'SDS'
                  AND sds_app.role = 'Approver'
                  AND sds_app.action = 'Approved'
                  AND sds_app.deleted_at IS NULL
            ),
            combined_data AS (
                SELECT 
                    detail.id,
                    sheet.id as sheet_id,
                    detail.supplier_code,
                    sheet.part_no,
                    sheet.part_name,
                    sheet.model,
                    sheet.sdr_date,
                    sheet.sdr_date as due_date,
                    sheet.inspection_detail_id,
                    sheet.loop,
                    1 as has_sheet,
                    sheet.has_delay,
                    sheet.delay_days
                FROM dbo.sample_data_sheets sheet
                LEFT JOIN dbo.sds_inspection_detail detail ON detail.id = sheet.inspection_detail_id 
                AND detail.deleted_at IS NULL
                AND sheet.deleted_at IS NULL
                
                UNION ALL
                
                SELECT 
                    detail.id,
                    NULL as sheet_id,
                    detail.supplier_code,
                    detail.part_no,
                    detail.part_name,
                    detail.model,
                    NULL as sdr_date,
                    detail.due_date,
                    detail.id as inspection_detail_id,
                    1 as loop,
                    0 as has_sheet,
                    detail.has_delay,
                    detail.delay_days
                FROM dbo.sds_inspection_detail detail
                WHERE detail.sds_created = 0
                  AND detail.active_row = 'Y'
                  AND detail.deleted_at IS NULL
                  ${filters.pageCreatedSds ? `AND detail.part_status = 'Active' AND detail.supplier_edit_status = 'Locked'` : ''} 
            )
            SELECT COUNT(*) as total
            FROM combined_data cd
            LEFT JOIN dbo.sds_inspection_special_request sp
                ON sp.inspection_detail_id = cd.inspection_detail_id
               AND sp.id = (
                    SELECT MAX(id)
                    FROM dbo.sds_inspection_special_request
                    WHERE inspection_detail_id = cd.inspection_detail_id
                      AND deleted_at IS NULL
                )
               AND sp.deleted_at IS NULL
            LEFT JOIN latest_approved la_sds
                ON la_sds.sample_data_sheet_id = cd.sheet_id
               AND la_sds.loop = cd.loop
               AND la_sds.document_type = 'SDS'
               AND la_sds.role = 'Approver'
               AND la_sds.rn = 1
            LEFT JOIN latest_submitted ls
                ON ls.sample_data_sheet_id = cd.sheet_id
               AND ls.loop = cd.loop
               AND ls.rn = 1
            WHERE 1=1
        `;

        const rawResults = await this.dataSource.query(query, queryParams);
        const countResult = await this.dataSource.query(countQuery + (filters.dashboard ? queryCount : querys).replace(/cd\./g, 'cd.'), filterParams);

        const total = countResult && countResult.length > 0 ? countResult[0].total : 0;

        const rows: InspectionDetailListItem[] = rawResults.map((row, index) => {
            const checker1Approved = row.checker1ApprovedSdr === 'Approved' && row.checker1ApprovedSds === 'Approved';
            const checker1Rejected = row.checker1ApprovedSdr === 'Rejected' || row.checker1ApprovedSds === 'Rejected';
            const checker2Approved = row.checker2ApprovedSdr === 'Approved' && row.checker2ApprovedSds === 'Approved';
            const checker2Rejected = row.checker2ApprovedSdr === 'Rejected' || row.checker2ApprovedSds === 'Rejected';
            const checker3Approved = row.checker3ApprovedSdr === 'Approved' && row.checker3ApprovedSds === 'Approved';
            const checker3Rejected = row.checker3ApprovedSdr === 'Rejected' || row.checker3ApprovedSds === 'Rejected';

            let supplierStatus = 'Pending';
            if (row.part_status !== 'Active' && !checker1Approved && !checker1Rejected) {
                supplierStatus = 'Wait for JATH Active Part';
            } else if (!row.sds_created && !checker1Approved && !checker1Rejected) {
                supplierStatus = 'Pending';
            } else if (checker1Approved && checker2Approved && checker3Approved) {
                supplierStatus = 'Completed';
            } else if (checker1Rejected || checker2Rejected || checker3Rejected) {
                supplierStatus = 'Rejected';
            } else {
                supplierStatus = 'Submitted';
            }

            let checker1Status = 'Pending';
            if (row.production_08_2025 === 'No' && checker3Approved) {
                checker1Status = 'Completed';
            } else if (row.production_08_2025 === 'No' && checker3Rejected) {
                checker1Status = 'Rejected';
            } else if ((supplierStatus == 'Pending' && !checker1Approved && !checker1Rejected) || supplierStatus == 'Wait for JATH Active Part') {
                checker1Status = 'Supplier Pending';
            } else if (checker1Approved && checker2Approved && checker3Approved) {
                checker1Status = 'Completed';
            } else if (checker1Rejected) {
                checker1Status = 'Rejected';
            } else if (checker1Approved) {
                checker1Status = 'Approved';
            }

            let checker2Status = 'Pending';
            if (checker1Status === 'Completed') {
                checker2Status = 'Completed';
            } else if (checker1Status === 'Rejected') {
                checker2Status = 'Rejected';
            } else if ((supplierStatus == 'Pending' && !checker1Approved && !checker1Rejected) || supplierStatus == 'Wait for JATH Active Part') {
                checker2Status = 'Supplier Pending';
            } else if (checker1Status === 'Pending') {
                checker2Status = 'Wait for Checker 1 Approve';
            } else if (checker2Rejected) {
                checker2Status = 'Rejected';
            } else if (checker2Approved) {
                checker2Status = 'Approved';
            }

            let checker3Status = 'Pending';
            if (checker2Status === 'Completed') {
                checker3Status = 'Completed';
            } else if (checker2Status === 'Rejected') {
                checker3Status = 'Rejected';
            } else if ((supplierStatus == 'Pending' && !checker1Approved && !checker1Rejected) || supplierStatus == 'Wait for JATH Active Part') {
                checker3Status = 'Supplier Pending';
            } else if (checker2Status === 'Wait for Checker 1 Approve') {
                checker3Status = 'Wait for Checker 1 Approve';
            } else if (checker2Status === 'Pending') {
                checker3Status = 'Wait for Checker 2 Approve';
            } else if (checker3Rejected) {
                checker3Status = 'Rejected';
            } else if (checker3Approved) {
                checker3Status = 'Approved';
            }

            const hasAnyRejection = checker1Rejected || checker2Rejected || checker3Rejected;
            const dueDate = row.due_date;
            const monthYear = dueDate
                ? this.formatMonthYear(dueDate)
                : this.formatMonthYear(new Date(row.created_at));
            const sdsType: 'Special' | 'Normal' = row.special_id ? 'Special' : 'Normal';

            return {
                ...row,
                supplierCode: row.supplier_code,
                id: row.detail_id,
                sheetId: row.sheet_id,
                no: index + 1 + skip,
                supplierName: row.supplier_name || row.supplier,
                partNo: row.part_no,
                partName: row.part_name,
                model: row.model,
                monthYear,
                sdsType,
                dueDate: dueDate ? this.formatDayMonthYear(dueDate) : null,
                supplierStatus,
                checker1Status,
                checker2Status,
                checker3Status,
                checker1Approved,
                checker1Rejected,
                checker2Approved,
                checker2Rejected,
                checker3Approved,
                checker3Rejected,
                hasAnyRejection,
                submittedAt: row.submitted,
                canCreateSds: row.part_status === 'Active' && row.supplier_edit_status === 'Locked',
                sdsCreated: row.sds_created || false,
                hasDelay: !!row.has_delay,
                delayDays: row.delay_days ?? undefined,
                adsStatus: checker3Status,
            }
        });

        return {
            total: total,
            items: rows,
        };
    }

    async countSummaryReport(
        filters: ListInspectionDetailsQueryDto,
        supplierCode?: string,
    ): Promise<{ hasDelay: number; notHasDelay: number }> {
        // Build count query
        let countQuery = `
            WITH latest_approved AS (
                SELECT
                    a.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY 
                            a.sample_data_sheet_id,
                            a.loop,
                            a.document_type,
                            a.role
                        ORDER BY a.id DESC
                    ) AS rn
                FROM sample_data_sheet_approvals a
                WHERE a.action = 'Approved'
                  AND a.deleted_at IS NULL
            ),
            combined_data AS (
                SELECT 
                    detail.id,
                    sheet.id as sheet_id,
                    detail.supplier_code,
                    sheet.part_no,
                    sheet.part_name,
                    sheet.model,
                    sheet.sdr_date,
                    sheet.sdr_date as due_date,
                    sheet.inspection_detail_id,
                    sheet.loop,
                    1 as has_sheet,
                    sheet.has_delay,
                    sheet.delay_days
                FROM dbo.sample_data_sheets sheet
                LEFT JOIN dbo.sds_inspection_detail detail ON detail.id = sheet.inspection_detail_id 
                AND detail.deleted_at IS NULL
                AND sheet.deleted_at IS NULL
                
                UNION ALL
                
                SELECT 
                    detail.id,
                    NULL as sheet_id,
                    detail.supplier_code,
                    detail.part_no,
                    detail.part_name,
                    detail.model,
                    NULL as sdr_date,
                    detail.due_date,
                    detail.id as inspection_detail_id,
                    1 as loop,
                    0 as has_sheet,
                    detail.has_delay,
                    detail.delay_days
                FROM dbo.sds_inspection_detail detail
                WHERE detail.sds_created = 0
                  AND detail.active_row = 'Y'
                  AND detail.deleted_at IS NULL
                  ${filters.pageCreatedSds ? `AND detail.part_status = 'Active' AND detail.supplier_edit_status = 'Locked'` : ''} 
            )
            SELECT 
                SUM(CASE WHEN cd.has_delay = 1 THEN 1 ELSE 0 END) as hasDelay,
                SUM(CASE WHEN cd.has_delay = 0 THEN 1 ELSE 0 END) as notHasDelay
            FROM combined_data cd
            LEFT JOIN dbo.sds_inspection_special_request sp
                ON sp.inspection_detail_id = cd.inspection_detail_id
               AND sp.id = (
                    SELECT MAX(id)
                    FROM dbo.sds_inspection_special_request
                    WHERE inspection_detail_id = cd.inspection_detail_id
                      AND deleted_at IS NULL
                )
               AND sp.deleted_at IS NULL
            LEFT JOIN latest_approved la_sds
                ON la_sds.sample_data_sheet_id = cd.sheet_id
               AND la_sds.loop = cd.loop
               AND la_sds.document_type = 'SDS'
               AND la_sds.role = 'Approver'
               AND la_sds.rn = 1
            WHERE 1=1
        `;

        const filterParams: any[] = [];
        let paramIndex = 0;
        let querys = '';

        if (supplierCode) {
            querys += ` AND cd.supplier_code = @${paramIndex}`;
            filterParams.push(supplierCode);
            paramIndex++;
        } else if (filters.supplierCode && filters.supplierCode.toLowerCase() !== 'all') {
            querys += ` AND cd.supplier_code = @${paramIndex}`;
            filterParams.push(filters.supplierCode);
            paramIndex++;
        }

        if (filters.partNo && filters.partNo.toLowerCase() !== 'all') {
            querys += ` AND LOWER(cd.part_no) LIKE LOWER(@${paramIndex})`;
            filterParams.push(`%${filters.partNo}%`);
            paramIndex++;
        }

        if (filters.partName && filters.partName.toLowerCase() !== 'all') {
            querys += ` AND LOWER(cd.part_name) LIKE LOWER(@${paramIndex})`;
            filterParams.push(`%${filters.partName}%`);
            paramIndex++;
        }

        if (filters.model && filters.model.toLowerCase() !== 'all') {
            querys += ` AND LOWER(cd.model) LIKE LOWER(@${paramIndex})`;
            filterParams.push(`%${filters.model}%`);
            paramIndex++;
        }

        if (filters.monthYear && filters.monthYear.toLowerCase() !== 'all') {
            querys += ` AND cd.due_date BETWEEN @${paramIndex} AND @${paramIndex + 1}`;
            filterParams.push(moment(`${moment(filters.monthYear, 'MM-YYYY').format('YYYY-MM')}-01 00:00:00`, 'YYYY-MM-DD HH:mm:ss').format('YYYY-MM-DD HH:mm:ss'));
            filterParams.push(moment(`${moment(filters.monthYear, 'MM-YYYY').format('YYYY-MM')}-${moment(filters.monthYear, 'MM-YYYY').endOf('month').format('DD')} 23:59:59`, 'YYYY-MM-DD HH:mm:ss').format('YYYY-MM-DD HH:mm:ss'));
            paramIndex += 2;
        }

        if (filters.year && filters.year.toLowerCase() !== 'all') {
            querys += ` AND cd.due_date BETWEEN @${paramIndex} AND @${paramIndex + 1}`;
            filterParams.push(moment(`${filters.year}-04-01 00:00:00`, 'YYYY-MM-DD HH:mm:ss').format('YYYY-MM-DD HH:mm:ss'));
            filterParams.push(moment(`${filters.year}-03-31 23:59:59`, 'YYYY-MM-DD HH:mm:ss').add(1, 'year').format('YYYY-MM-DD HH:mm:ss'));
            paramIndex += 2;
        }

        if (filters.sdsType && filters.sdsType.toLowerCase() !== 'all') {
            if (filters.sdsType.toLowerCase() === 'special') {
                querys += ` AND sp.id IS NOT NULL`;
            } else if (filters.sdsType.toLowerCase() === 'normal') {
                querys += ` AND sp.id IS NULL`;
            }
        }

        const result = await this.dataSource.query(countQuery + querys, filterParams);

        return {
            hasDelay: result && result.length > 0 ? (result[0].hasDelay || 0) : 0,
            notHasDelay: result && result.length > 0 ? (result[0].notHasDelay || 0) : 0,
        };
    }

    private formatMonthYear(value: Date): string {
        return moment(value).format('MM-YYYY');
    }

    private formatDayMonthYear(value: Date): string {
        return moment(value).format('DD-MM-YYYY');
    }

    private async createRow(row: CreateSampleDataSheetRowDto, index: number, sheetId: number, item?: InspectionItemEntity) {
        const savedRow = await this.rowRepo.save({
            sampleDataSheetId: sheetId,
            no: Number(row.no ?? index + 1),
            measuringItem: String(row.measuringItem),
            specification: Number(row.specification),
            rank: String(row.rank),
            inspectionInstrument: String(row.inspectionInstrument),
            remark: row.remark ? String(row.remark) : null,
            sampleQty: Number(row.sampleQty),
            judgement: row.judgement ? String(row.judgement) : null,
            xBar: row.xBar ? String(row.xBar) : null,
            r: row.r ? String(row.r) : null,
            cp: row.cp ? String(row.cp) : null,
            cpk: row.cpk ? String(row.cpk) : null,
            tolerancePlus: item?.tolerancePlus !== null && item?.tolerancePlus !== undefined ? item.tolerancePlus : null,
            toleranceMinus: item?.toleranceMinus !== null && item?.toleranceMinus !== undefined ? item.toleranceMinus : null,
        });

        // Save samples to separate table
        if (row.samples && row.samples.length > 0) {
            const sampleEntities = row.samples.filter(sample => sample.value !== null && sample.value !== undefined)
                .map(sample => this.sampleRepo.create({
                    sampleDataSheetRowId: savedRow.id,
                    no: sample.no,
                    value: parseFloat(sample.value),
                }));
            await this.sampleRepo.save(sampleEntities);
        }

        return savedRow;
    }

    async getInspectionDashboardData(query: DashboardStatsQuery) {
        const limit = query.limit || 10;
        const skip = query.skip || 0;
        const monthYear = query.monthYear;

        let dateFilter = '';
        const params: any[] = [];

        // if (monthYear) {
        //     const [month, year] = monthYear.split('-');
        //     // SQL Server DATEPART
        //     dateFilter = `AND DATEPART(month, sds.sdr_date) = @0 AND DATEPART(year, sds.sdr_date) = @1`;
        //     params.push(month, year);
        // }

        const currentYear = moment().year();
        const fiscalYearStartDate = moment().year(currentYear).month(3).date(1).startOf('month'); // April 1st of current year
        const fiscalYearEndDate = moment().year(currentYear + 1).month(2).date(28).endOf('month'); // March 31st of next year

        dateFilter = `AND sds.sdr_date >= @0 AND sds.sdr_date <= @1`;
        params.push(fiscalYearStartDate.format('YYYY-MM-DD HH:mm:ss'), fiscalYearEndDate.format('YYYY-MM-DD HH:mm:ss'));

        const sql = `
            WITH rej AS (
                SELECT
                    a.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY a.sample_data_sheet_id
                        ORDER BY a.id DESC
                    ) AS rn
                FROM sample_data_sheet_approvals a
                WHERE a.action = 'Rejected'
                  AND a.re_submit_date IS NOT NULL
            ),
            latest AS (
                SELECT
                    a.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY 
                            a.sample_data_sheet_id,
                            a.loop,
                            a.document_type,
                            a.role
                        ORDER BY a.id DESC
                    ) AS rn
                FROM sample_data_sheet_approvals a
            ),
            latest_approved AS (
                SELECT
                    a.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY 
                            a.sample_data_sheet_id,
                            a.loop,
                            a.document_type,
                            a.role
                        ORDER BY a.id DESC
                    ) AS rn
                FROM sample_data_sheet_approvals a
                WHERE a.action = 'Approved'
            )
            SELECT
                sum_sds.id AS sum_id,
                sum_sds.ng_count,
                sds.*,
                detail.part_status,
                detail.sds_created,
                l1_sdr.action AS checker1ApprovedSdr,
                l1_sds.action AS checker1ApprovedSds,
                l2_sdr.action AS checker2ApprovedSdr,
                l2_sds.action AS checker2ApprovedSds,
                l3_sdr.action AS checker3ApprovedSdr,
                l3_sds.action AS checker3ApprovedSds,
                first_oot.sa_status AS saStatus,
                first_oot.due_to_implement AS dueToImplement
            FROM (
                SELECT
                    sds.id,
                    COUNT(*) AS ng_count
                FROM sample_data_sheets AS sds
                JOIN sample_data_sheet_rows AS r ON r.sample_data_sheet_id = sds.id
                JOIN sample_data_sheet_row_samples AS sm ON sm.sample_data_sheet_row_id = r.id
                WHERE sds.deleted_at IS NULL
                AND (
                    TRY_CAST(sm.value AS FLOAT) > TRY_CAST(r.specification AS FLOAT) + r.tolerance_plus
                    OR TRY_CAST(sm.value AS FLOAT) < TRY_CAST(r.specification AS FLOAT) - r.tolerance_minus
                )
                ${dateFilter}
                GROUP BY sds.id
                ORDER BY ng_count DESC
                OFFSET ${skip} ROWS FETCH NEXT ${limit} ROWS ONLY
            ) AS sum_sds
            JOIN sample_data_sheets AS sds ON sds.id = sum_sds.id AND sds.deleted_at IS NULL
            LEFT JOIN sds_inspection_detail AS detail ON detail.id = sds.inspection_detail_id AND detail.deleted_at IS NULL
            LEFT JOIN latest l1_sdr ON l1_sdr.sample_data_sheet_id = sds.id AND l1_sdr.loop = sds.loop AND l1_sdr.document_type = 'SDR' AND l1_sdr.role = 'Checker 1' AND l1_sdr.rn = 1
            LEFT JOIN latest l1_sds ON l1_sds.sample_data_sheet_id = sds.id AND l1_sds.loop = sds.loop AND l1_sds.document_type = 'SDS' AND l1_sds.role = 'Checker 1' AND l1_sds.rn = 1
            LEFT JOIN latest l2_sdr ON l2_sdr.sample_data_sheet_id = sds.id AND l2_sdr.loop = sds.loop AND l2_sdr.document_type = 'SDR' AND l2_sdr.role = 'Checker 2' AND l2_sdr.rn = 1
            LEFT JOIN latest l2_sds ON l2_sds.sample_data_sheet_id = sds.id AND l2_sds.loop = sds.loop AND l2_sds.document_type = 'SDS' AND l2_sds.role = 'Checker 2' AND l2_sds.rn = 1
            LEFT JOIN latest l3_sdr ON l3_sdr.sample_data_sheet_id = sds.id AND l3_sdr.loop = sds.loop AND l3_sdr.document_type = 'SDR' AND l3_sdr.role = 'Approver' AND l3_sdr.rn = 1
            LEFT JOIN latest l3_sds ON l3_sds.sample_data_sheet_id = sds.id AND l3_sds.loop = sds.loop AND l3_sds.document_type = 'SDS' AND l3_sds.role = 'Approver' AND l3_sds.rn = 1
            OUTER APPLY (
                SELECT TOP 1 r.sa_status, r.due_to_implement
                FROM sample_data_sheet_rows r
                WHERE r.sample_data_sheet_id = sds.id
                AND r.sa_status IS NOT NULL
                ORDER BY r.id
            ) AS first_oot
        `;

        const results = await this.dataSource.query(sql, params);

        // Get total count for pagination/percentage
        const countSql = `
            SELECT COUNT(DISTINCT sds.id) as total
            FROM sample_data_sheets AS sds
            JOIN sample_data_sheet_rows AS r ON r.sample_data_sheet_id = sds.id
            JOIN sample_data_sheet_row_samples AS sm ON sm.sample_data_sheet_row_id = r.id
            WHERE sds.deleted_at IS NULL
            AND (
                TRY_CAST(sm.value AS FLOAT) > TRY_CAST(r.specification AS FLOAT) + r.tolerance_plus
                OR TRY_CAST(sm.value AS FLOAT) < TRY_CAST(r.specification AS FLOAT) - r.tolerance_minus
            )
            ${dateFilter}
        `;
        const countResult = await this.dataSource.query(countSql, params);
        const ngCount = countResult[0]?.total || 0;

        // Get total SDS count for the period to calculate percentage
        const totalSdsSql = `
            SELECT COUNT(*) as total 
            FROM sample_data_sheets sds 
            WHERE sds.deleted_at IS NULL ${dateFilter}
        `;
        const totalSdsResult = await this.dataSource.query(totalSdsSql, params);
        const totalSds = totalSdsResult[0]?.total || 0;

        return {
            items: results,
            ngCount,
            totalSds
        };
    }

    private mapSheet(sheet: SampleDataSheetEntity): SampleDataSheetResponse {
        const rows: SampleDataSheetRowResponse[] = (sheet.rows || []).map((row) => {
            const samples: SampleDataSheetSampleResponse[] = (row.samples || []).map(sample => ({
                no: sample.no,
                value: sample.value !== null ? String(sample.value) : '',
            }));
            return {
                id: row.id,
                sampleDataSheetId: row.sampleDataSheetId,
                no: row.no,
                measuringItem: String(row.measuringItem || ''),
                specification: Number(row.specification || 0),
                tolerancePlus: row.tolerancePlus !== null && row.tolerancePlus !== undefined ? row.tolerancePlus : null,
                toleranceMinus: row.toleranceMinus !== null && row.toleranceMinus !== undefined ? row.toleranceMinus : null,
                rank: String(row.rank || ''),
                inspectionInstrument: String(row.inspectionInstrument || ''),
                remark: row.remark ? String(row.remark) : null,
                sampleQty: row.sampleQty,
                samples,
                judgement: row.judgement ? String(row.judgement) : null,
                xBar: row.xBar ? String(row.xBar) : null,
                r: row.r ? String(row.r) : null,
                cp: row.cp ? String(row.cp) : null,
                cpk: row.cpk ? String(row.cpk) : null,
                saStatus: row.saStatus || null,
                dueToImplement: row.dueToImplement || null,
            };
        });

        return {
            id: sheet.id,
            supplier: sheet.supplier,
            partNo: sheet.partNo,
            partName: sheet.partName,
            model: sheet.model,
            production08_2025: sheet.production082025,
            sdrDate: sheet.sdrDate,
            aisFile: sheet.aisFile ?? null,
            sdrFile: sheet.sdrFile ?? null,
            sdrReportFile: sheet.sdrReportFile ?? null,
            inspectionDetailId: sheet.inspectionDetailId ?? null,
            createdAt: sheet.createdAt,
            updatedAt: sheet.updatedAt,
            remark: sheet.remark ?? null,
            loop: sheet.loop,
            sdrData: rows,
            inspectionDetail: sheet.inspectionDetail ? sheet.inspectionDetail : undefined,
            approvals: (sheet.approvals || []).map(approval => ({
                id: approval.id,
                actionByUser: approval.actionByUser,
                action: approval.action,
                role: approval.role,
                loop: approval.loop,
                documentType: approval.documentType,
                remark: approval.remark,
                actionDate: approval.actionDate,
                reSubmitDate: approval.reSubmitDate,
            })),
        };
    }

    async findById(id: number): Promise<SampleDataSheetResponse | null> {
        const sheet = await this.sheetRepo.findOne({
            where: { id, deletedAt: IsNull() },
            relations: ['rows', 'rows.samples'],
        });

        if (!sheet) {
            return null;
        }

        return this.mapSheet(sheet);
    }

    async findByInspectionDetailForSdsId(id: number): Promise<SampleDataSheetResponse | null> {
        const sheet = await this.sheetRepo.findOne({
            where: { id, deletedAt: IsNull() },
            relations: ['rows', 'rows.samples', 'approvals', 'approvals.actionByUser', 'inspectionDetail', 'inspectionDetail.specialRequest'],
        });

        if (!sheet) {
            return null;
        }

        return this.mapSheet(sheet);
    }

    async findInspectionDetailsBySdsId(id: number): Promise<SampleDataSheetEntity[]> {
        const sheets = await this.sheetRepo.find({
            where: { id, deletedAt: IsNull() },
            relations: ['rows', 'rows.samples', 'approvals', 'approvals.actionByUser', 'inspectionDetail', 'inspectionDetail.specialRequest'],
        });

        return sheets;
    }

    async findSdsByInspectionId(inspectionId: number): Promise<SampleDataSheetResponse | null> {
        // First verify that the inspection detail exists and has sds_created = 1
        const inspectionDetail = await this.inspectionRepo.findOne({
            where: { id: inspectionId, sdsCreated: true },
        });

        if (!inspectionDetail) {
            return null;
        }

        // Find the sample data sheet for this inspection detail
        const sheet = await this.sheetRepo.findOne({
            where: { inspectionDetailId: inspectionId, deletedAt: IsNull() },
            relations: ['rows', 'rows.samples', 'approvals', 'approvals.actionByUser'],
        });

        if (!sheet) {
            return null;
        }

        return this.mapSheet(sheet);
    }

    async PdfView(sheet: SampleDataSheetResponse, actionBy: UsersEntity, View: boolean = false) {


        const templatePath = join(__dirname, '..', '..', '/files-templates/sds-pdf/inspection_data_req.pdf');
        const pdfBytes = readFileSync(templatePath);

        const oldPdfDoc = await PDFDocument.load(pdfBytes);
        const pdfDoc = await PDFDocument.create();
        const pageOld = oldPdfDoc.getPage(0);

        const rowsWithMaxNine = this.splitSampleRows(sheet.sdrData);
        const pagedSamples = this.chunkArray(rowsWithMaxNine, 24);

        const fontBytes = readFileSync(join(__dirname, '..', '..', '/files-templates/fonts/NotoSansThai-Medium.ttf'));
        oldPdfDoc.registerFontkit(fontkit);
        pdfDoc.registerFontkit(fontkit);

        const font = await pdfDoc.embedFont(fontBytes);
        const oldfont = await oldPdfDoc.embedFont(fontBytes);

        const { width: oldWidth, height: oldHeight } = pageOld.getSize();
        const fontSize = 6;

        pageOld.drawText(`${sheet.partNo}`, {
            x: 310,
            y: oldHeight - 37,
            size: fontSize,
            font: oldfont,
            color: rgb(0, 0, 0),
        });

        pageOld.drawText(`${sheet.partName}`, {
            x: 440,
            y: oldHeight - 37,
            size: fontSize,
            font: oldfont,
            color: rgb(0, 0, 0),
        });

        pageOld.drawText(`${sheet.supplier}`, {
            x: 630,
            y: oldHeight - 37,
            size: fontSize,
            font: oldfont,
            color: rgb(0, 0, 0),
        });

        pageOld.drawText(`${sheet.model}`, {
            x: 240,
            y: oldHeight - 50,
            size: fontSize,
            font: oldfont,
            color: rgb(0, 0, 0),
        });

        pageOld.drawText(`${sheet.sdrDate ? moment(sheet.sdrDate).format('DD') : ''}`, {
            x: 300,
            y: oldHeight - 50,
            size: fontSize,
            font: oldfont,
            color: rgb(0, 0, 0),
        });

        pageOld.drawText(`${sheet.sdrDate ? moment(sheet.sdrDate).format('MM') : ''}`, {
            x: 340,
            y: oldHeight - 50,
            size: fontSize,
            font: oldfont,
            color: rgb(0, 0, 0),
        });

        pageOld.drawText(`${sheet.sdrDate ? moment(sheet.sdrDate).format('YYYY') : ''}`, {
            x: 370,
            y: oldHeight - 50,
            size: fontSize,
            font: oldfont,
            color: rgb(0, 0, 0),
        });

        pageOld.drawText(`${pagedSamples.length}`, {
            x: 780,
            y: oldHeight - 37,
            size: fontSize,
            font: oldfont,
            color: rgb(0, 0, 0),
        });

        for (let pageIndex = 0; pageIndex < pagedSamples.length; pageIndex++) {
            const [newTemplatePage] = await pdfDoc.copyPages(oldPdfDoc, [0]);
            pdfDoc.addPage(newTemplatePage);
        }

        const pages = pdfDoc.getPages();
        for (let pageIndex = 0; pageIndex < pagedSamples.length; pageIndex++) {
            const page = pages[pageIndex];
            const { width, height } = page.getSize();
            let startY = height - 85;

            page.drawText(`${pageIndex + 1}`, {
                x: 745,
                y: height - 37,
                size: fontSize,
                font,
                color: rgb(0, 0, 0),
            });

            const sampleRows = pagedSamples[pageIndex];
            const rowHeight = 16.7;

            for (let rowIndex = 0; rowIndex < sampleRows.length; rowIndex++) {
                const row = sampleRows[rowIndex];
                const samples = row.samples.filter(s => s.value);

                page.drawText(`${row.no ?? ''}`, {
                    x: 45 - (font.widthOfTextAtSize(`${row.no ?? ''}`, fontSize) / 2),
                    y: startY,
                    size: fontSize,
                    font,
                    color: rgb(0, 0, 0),
                });

                // Draw measuring item with auto-shrink font size to fit column width
                const maxMeasuringTextWidth = 80; // adjust if column width changes
                let measuringText = `${row.measuringItem ?? ''}`.trim();

                if (measuringText) {
                    let displayText = measuringText;
                    let currentFontSize = fontSize;
                    let textWidth = font.widthOfTextAtSize(displayText, currentFontSize);

                    // shrink font size until text fits or we reach a minimum size
                    const minFontSize = 5;
                    while (textWidth > maxMeasuringTextWidth && currentFontSize > minFontSize) {
                        currentFontSize -= 0.5;
                        textWidth = font.widthOfTextAtSize(displayText, currentFontSize);
                    }

                    page.drawText(displayText, {
                        x: 55,
                        y: startY,
                        size: currentFontSize,
                        font,
                        color: rgb(0, 0, 0),
                    });
                }

                page.drawText(`${row.specification ?? ''}`, {
                    x: 175 - font.widthOfTextAtSize(`${row.specification ?? ''}`, fontSize),
                    y: startY,
                    size: fontSize,
                    font,
                    color: rgb(0, 0, 0),
                });

                page.drawText(`${row.rank ?? ''}`, {
                    x: 195 - (font.widthOfTextAtSize(`${row.rank ?? ''}`, fontSize) / 2),
                    y: startY,
                    size: fontSize,
                    font,
                    color: rgb(0, 0, 0),
                });

                page.drawText(`${row.inspectionInstrument ?? ''}`, {
                    x: 217,
                    y: startY,
                    size: fontSize,
                    font,
                    color: rgb(0, 0, 0),
                });

                page.drawText(`${row.xBar ?? ''}`, {
                    x: 658 - (font.widthOfTextAtSize(`${row.xBar ?? ''}`, fontSize) / 2),
                    y: startY,
                    size: fontSize,
                    font,
                    color: rgb(0, 0, 0),
                });

                page.drawText(`${row.r ?? ''}`, {
                    x: 682 - (font.widthOfTextAtSize(`${row.r ?? ''}`, fontSize) / 2),
                    y: startY,
                    size: fontSize,
                    font,
                    color: rgb(0, 0, 0),
                });

                page.drawText(`${row.cp ?? ''}`, {
                    x: 707 - (font.widthOfTextAtSize(`${row.cp ?? ''}`, fontSize) / 2),
                    y: startY,
                    size: fontSize,
                    font,
                    color: rgb(0, 0, 0),
                });

                page.drawText(`${row.cpk ?? ''}`, {
                    x: 732 - (font.widthOfTextAtSize(`${row.cpk ?? ''}`, fontSize) / 2),
                    y: startY,
                    size: fontSize,
                    font,
                    color: rgb(0, 0, 0),
                });

                // Draw sample values
                let indexSample = 0
                for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex++) {
                    const sample = samples[sampleIndex];
                    const sampleX = (284 + sampleIndex * 25) + (indexSample * 49);
                    if ((sampleIndex + 1) % 3 === 0 && sampleIndex !== 0) {
                        indexSample += 1;
                    }
                    const simpleValue = String(sample.value || '');
                    const textWidth = font.widthOfTextAtSize(simpleValue, fontSize);
                    page.drawText(simpleValue, {
                        x: sampleX - (textWidth / 2),
                        y: startY,
                        size: fontSize,
                        font,
                        color: rgb(0, 0, 0),
                    });
                }

                let result = [];
                for (let i = 0; i < samples.length; i += 3) {
                    result.push([row.judgement ?? '', row.remark ?? '']);
                }

                for (let index = 0; index < result.length; index++) {
                    const res = result[index];
                    const sampleX = (284 + 75) + (index * 125);
                    page.drawText(`${res[0]}`, {
                        x: sampleX - (font.widthOfTextAtSize(`${res[0]}`, fontSize) / 2),
                        y: startY,
                        size: fontSize,
                        font,
                        color: rgb(0, 0, 0),
                    });
                    // page.drawText(`${res[1]}`, {
                    //     x: (remarkX + 25) - (font.widthOfTextAtSize(`${res[1]}`, fontSize) / 2),
                    //     y: startY,
                    //     size: fontSize,
                    //     font,
                    //     color: rgb(0, 0, 0),
                    // });
                }

                page.drawText(`${row.remark || ''}`, {
                    x: 755,
                    y: startY,
                    size: fontSize,
                    font,
                    color: rgb(0, 0, 0),
                });

                startY -= rowHeight;
            }
        }

        pdfDoc.setTitle(`Inspection-Data-${sheet.partNo}-${sheet.partName}`);
        pdfDoc.setAuthor(`${[...new Set(['System'])].join(',')}`);
        pdfDoc.setSubject('Inspection Data Request');
        pdfDoc.setKeywords(['Sample Data Sheet']);
        pdfDoc.setProducer(`Sample Data Sheet`);
        pdfDoc.setCreationDate(new Date());
        pdfDoc.registerFontkit(fontkit);

        const pdfBytesFinal = await pdfDoc.save();
        // const savetemp = join(__dirname, '..', '..', `/files-templates/sds-pdf/temp-${sheet.partNo}-${sheet.partName}-${new Date().toISOString()}.pdf`);
        // fs.writeFileSync(savetemp, pdfBytesFinal);

        return pdfBytesFinal;
    }

    splitSampleRows(rows: SampleRow[]): SampleRow[] {
        const MAX_SAMPLE_PER_ROW = 9;
        const result: SampleRow[] = [];

        for (const row of rows) {
            const { samples } = row;
            if (samples.length <= MAX_SAMPLE_PER_ROW) {
                result.push(row);
                continue;
            }

            result.push({ ...row, samples: samples.slice(0, MAX_SAMPLE_PER_ROW) });

            const leftovers = samples.slice(MAX_SAMPLE_PER_ROW);
            let start = MAX_SAMPLE_PER_ROW;

            while (leftovers.length > 0) {
                const chunk = leftovers.splice(0, MAX_SAMPLE_PER_ROW);
                result.push({ samples: chunk });
                start += chunk.length;
            }
        }

        return result;
    }

    chunkArray = <T>(items: T[], maxSize: number): T[][] => {
        const batches: T[][] = [];
        for (let i = 0; i < items.length; i += maxSize) {
            batches.push(items.slice(i, i + maxSize));
        }
        return batches.length ? batches : [[]];
    };

    async submitApproval(dto: SdsApprovalDto, actionByUser: UsersEntity): Promise<void> {
        const sheet = await this.sheetRepo.findOne({ where: { id: dto.id, deletedAt: IsNull() }, relations: ['inspectionDetail'] });
        if (!sheet) {
            throw new NotFoundException('Sample Data Sheet not found');
        }

        const now = new Date();
        const reSubmitDateRaw = dto.reSubmitDate ? new Date(dto.reSubmitDate) : null;
        const reSubmitDate = reSubmitDateRaw && !Number.isNaN(reSubmitDateRaw.getTime()) ? reSubmitDateRaw : null;

        // Get month-year from SDR date (e.g., "08-2025")
        const sdsMonthYear = moment(sheet.sdrDate).format('MM-YYYY');

        // Determine user role from approveRole parameter
        let role: SdsApprovalRole = SdsApprovalRole.SUPPLIER;
        const whereConditions: FindOptionsWhere<SampleDataSheetApprovalEntity>[] = [{
            sampleDataSheetId: sheet.id,
            role: SdsApprovalRole.CHECKER1,
            documentType: SdsDocumentType.SDS,
            action: SdsApprovalAction.APPROVED,
            loop: sheet.loop
        }, {
            sampleDataSheetId: sheet.id,
            role: SdsApprovalRole.CHECKER1,
            documentType: SdsDocumentType.SDR,
            action: SdsApprovalAction.APPROVED,
            loop: sheet.loop
        }, {
            sampleDataSheetId: sheet.id,
            role: SdsApprovalRole.CHECKER1,
            documentType: SdsDocumentType.SDS,
            action: SdsApprovalAction.REJECTED,
            loop: sheet.loop
        }, {
            sampleDataSheetId: sheet.id,
            role: SdsApprovalRole.CHECKER1,
            documentType: SdsDocumentType.SDR,
            action: SdsApprovalAction.REJECTED,
            loop: sheet.loop
        }];

        if (dto.approveRole === 'checker1') {
            if (sheet.production082025 == 'Yes') {
                role = SdsApprovalRole.CHECKER1;
                const checker1 = await this.approvalRepo.findOne({ where: whereConditions });
                if (checker1) {
                    throw new BadRequestException('Checker1 has already approved/rejected');
                }
            } else {
                role = SdsApprovalRole.APPROVER;
            }
        } else if (dto.approveRole === 'checker2') {
            if (sheet.production082025 == 'Yes') {
                role = SdsApprovalRole.CHECKER2;
                const checker2 = await this.approvalRepo.findOne({
                    where: whereConditions.map((x: SampleDataSheetApprovalEntity) => {
                        return {
                            ...x,
                            role: SdsApprovalRole.CHECKER2,
                        }
                    })
                });
                if (checker2) {
                    throw new BadRequestException('Checker2 has already approved/rejected');
                }
            } else {
                throw new BadRequestException('Checker2 approval is not allowed');
            }
        } else if (dto.approveRole === 'approver') {
            if (sheet.production082025 == 'Yes') {
                role = SdsApprovalRole.APPROVER;
                const checker3 = await this.approvalRepo.findOne({
                    where: whereConditions.map((x: SampleDataSheetApprovalEntity) => {
                        return {
                            ...x,
                            role: SdsApprovalRole.APPROVER,
                        }
                    })
                });
                if (checker3) {
                    throw new BadRequestException('Approver has already approved/rejected');
                }
            } else {
                throw new BadRequestException('Approver approval is not allowed');
            }
        } else if (dto.approveRole === 'supplier') {
            role = SdsApprovalRole.SUPPLIER;
        }

        // Save SDR approval log
        if (dto.actionSdrApproval && dto.actionSdrApproval !== '') {
            const sdrAction = dto.actionSdrApproval === 'approve'
                ? SdsApprovalAction.APPROVED
                : SdsApprovalAction.REJECTED;

            const sdrApproval = this.approvalRepo.create({
                sampleDataSheetId: sheet.id,
                action: sdrAction,
                role: role,
                loop: sheet.loop,
                documentType: SdsDocumentType.SDR,
                actionByUserId: actionByUser.id,
                remark: dto.remark || null,
                reSubmitDate,
                partNo: sheet.partNo,
                sdsMonthYear: sdsMonthYear,
            });

            if (sdrAction === SdsApprovalAction.REJECTED) {
                sheet.sdrDate = reSubmitDate ?? sheet.sdrDate;
                await this.sheetRepo.save(sheet);
                await this.cronJobsService.updateSampleDataSheetDelayStatus();
            }

            await this.approvalRepo.save(sdrApproval);
            if (sheet.production082025 == 'Yes') {
                // Create log for SDR approval
                const actionText = sdrAction === SdsApprovalAction.APPROVED ? 'Approved' : 'Rejected';
                const roleText = role.charAt(0).toUpperCase() + role.slice(1);
                await this.sdsLogRepo.save({
                    menu: 'SDS Approval',
                    sdsInspectionDetailId: sheet.inspectionDetailId,
                    sampleDataSheetId: sheet.id,
                    partNo: sheet.partNo,
                    sdsMonthYear,
                    action: actionText,
                    actionRole: roleText,
                    actionBy: actionByUser.name || 'Unknown',
                    actionDate: new Date(),
                    remark: ((dto.remark || '') + (`\n#${SdsDocumentType.SDR}`)).trim(),
                });
            }

        }

        // Save SDS approval log
        if (dto.actionSdsApproval && dto.actionSdsApproval !== '') {
            const sdsAction = dto.actionSdsApproval === 'approve'
                ? SdsApprovalAction.APPROVED
                : SdsApprovalAction.REJECTED;

            const sdsApproval = this.approvalRepo.create({
                sampleDataSheetId: sheet.id,
                action: sdsAction,
                role: role,
                loop: sheet.loop,
                documentType: SdsDocumentType.SDS,
                actionByUserId: actionByUser.id,
                remark: dto.remark || null,
                reSubmitDate: reSubmitDate,
                partNo: sheet.partNo,
                sdsMonthYear: sdsMonthYear,
            });

            if (sdsAction === SdsApprovalAction.REJECTED) {
                sheet.sdrDate = reSubmitDate ?? sheet.sdrDate;
                await this.sheetRepo.save(sheet);
                await this.cronJobsService.updateSampleDataSheetDelayStatus();
            }

            await this.approvalRepo.save(sdsApproval);

            // Create log for SDS approval
            const actionText = sdsAction === SdsApprovalAction.APPROVED ? 'Approved' : 'Rejected';
            const roleText = role.charAt(0).toUpperCase() + role.slice(1);
            await this.sdsLogRepo.save({
                menu: 'SDS Approval',
                sdsInspectionDetailId: sheet.inspectionDetailId,
                sampleDataSheetId: sheet.id,
                partNo: sheet.partNo,
                sdsMonthYear,
                action: actionText,
                actionRole: roleText,
                actionBy: actionByUser.name || 'Unknown',
                actionDate: new Date(),
                remark: ((dto.remark || '') + (`\n#${SdsDocumentType.SDS}`)).trim(),
            });
        }

        const sdsAction = dto.actionSdsApproval === 'approve' && dto.actionSdrApproval === 'approve' ?
            SdsApprovalAction.APPROVED :
            SdsApprovalAction.REJECTED;

        // Send Email to Supplier if Checker 1 approves/rejects and Production is No, or Approver acts
        if ((dto.approveRole === 'checker1' && sheet.production082025 === 'No') || dto.approveRole === 'approver') {
            try {
                if (!(sheet?.inspectionDetail?.supplierCode)) {
                    return;
                }
                const supplier = await this.supplierService.findByCode(sheet.inspectionDetail.supplierCode); // Assuming sheet.supplier stores supplier code
                if (supplier && supplier.email && supplier.email.length > 0) {
                    const baseUrl = process.env.MAIL_LINK_WEBAPP_SUPPLIER_SDS ?? 'http://192.168.3.156:8000/';
                    const monthLabel = moment(sheet.sdrDate ?? new Date()).format('MM-YYYY');
                    const dueDateLabel = moment(sdsAction === SdsApprovalAction.REJECTED ? (dto.reSubmitDate ?? sheet.sdrDate ?? new Date()) : (sheet.sdrDate ?? new Date())).format('DD-MM-YYYY');

                    if (sdsAction === SdsApprovalAction.REJECTED) {
                        // Reject template
                        const subject = `SDS Approval Status: REJECTED - ${sheet.partNo}`;
                        const html = `
                                                            <div style="font-family: Arial, 'Noto Sans Thai', sans-serif; color: #222; line-height: 1.6;">
                                                                <p style="margin:0 0 6px 0;">Dear ${sheet?.inspectionDetail.supplierName || 'Supplier'},</p>
                                                                <p style="margin:0 0 10px 0;">
                                                                    You have received, SDS Approval Status is <span style="color:#e53935; font-weight:700;">REJECTED</span> on <span style="font-weight:700;">${monthLabel}</span>
                                                                </p>
                                                                <p style="margin:0 0 10px 0;">Please input and Re-submit SDS by <span style="color:#1e88e5; font-weight:700;">${dueDateLabel}</span></p>

                                                                <table style="margin:10px 0;">
                                                                    <tr><td style="padding-right:10px;">Part No. :</td><td><strong>${sheet.partNo}</strong></td></tr>
                                                                    <tr><td style="padding-right:10px;">Part Name :</td><td><strong>${sheet.partName}</strong></td></tr>
                                                                    <tr><td style="padding-right:10px;">Model :</td><td><strong>${sheet.model}</strong></td></tr>
                                                                    <tr><td style="padding-right:10px;">Requested By :</td><td><strong>${actionByUser?.supplier?.supplierName || actionByUser?.name || '-'}</strong></td></tr>
                                                                    <tr><td style="padding-right:10px;">Request Date :</td><td><strong>${moment(now).format('DD-MM-YYYY HH:mm')}</strong></td></tr>
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
                        this.emailService.sendEmail(supplier.email.join(','), subject, html);
                    } else if (sdsAction === SdsApprovalAction.APPROVED) {
                        // Completed template (and Approved similar to Completed)
                        const subject = `Monthly SDS / Special Request Status: COMPLETED - ${sheet.partNo}`;
                        const html = `
                                                            <div style="font-family: Arial, 'Noto Sans Thai', sans-serif; color: #222; line-height: 1.6;">
                                                                <p style="margin:0 0 6px 0;">Dear ${sheet?.inspectionDetail?.supplierName || 'Supplier'},</p>
                                                                <p style="margin:0 0 10px 0;">
                                                                    You have received, <span style="font-weight:700;">Monthly SDS / Special Request</span> Status is <span style="color:#2e7d32; font-weight:700;">COMPLETED</span> on <span style="font-weight:700;">${monthLabel}</span>
                                                                </p>

                                                                <table style="margin:10px 0;">
                                                                    <tr><td style="padding-right:10px;">Part No. :</td><td><strong>${sheet.partNo}</strong></td></tr>
                                                                    <tr><td style="padding-right:10px;">Part Name :</td><td><strong>${sheet.partName}</strong></td></tr>
                                                                    <tr><td style="padding-right:10px;">Model :</td><td><strong>${sheet.model}</strong></td></tr>
                                                                    <tr><td style="padding-right:10px;">Requested By :</td><td><strong>${actionByUser?.supplier?.supplierName || actionByUser?.name || '-'}</strong></td></tr>
                                                                    <tr><td style="padding-right:10px;">Request Date :</td><td><strong>${moment(now).format('DD-MM-YYYY HH:mm')}</strong></td></tr>
                                                                </table>

                                                                <p style="margin:14px 0 6px 0;">Kindly Review Details in MENU : <strong>Summary Report</strong></p>
                                                                <p style="margin:6px 0;">Please access Sample Data Sheet (SDS) to review through below link;</p>
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
                }
            } catch (error) {
                console.error('Failed to send email to supplier:', error);
            }
        } else if (dto.approveRole === 'checker1') {
            // ส่งให้ checker2
            try {
                const checker2 = await this.dataSource.getRepository(UsersEntity).find({
                    where: { sampleDataSheetRole: 'Engineer / Supervision / Assistant Manager', active: 'Y' },
                });
                if (checker2 && checker2.filter((user) => user.email).length > 0) {
                    const status = sdsAction === SdsApprovalAction.APPROVED ? 'Approved' : 'Rejected';
                    const subject = `SDS Submission ${status}: ${sheet.partNo}`;
                    const html = `
                            <p>Dear Engineer / Supervision / Assistant Manager,</p>
                            <p>A new SDS submission for Part No: <strong>${sheet.partNo}</strong> has been submitted by ${status == 'Approved' ? 'Checker 1' : 'JTEKT'}.</p>
                            <p>Please log in to the system to review the details.</p>
                            <br>
                            <p>Best regards,</p>
                            <p>Sample Data Sheet System</p>
                        `;
                    this.emailService.sendEmail(checker2.map((user) => user.email).join(','), subject, html);
                }
            } catch (error) {
                console.error('Failed to send email to Engineer / Supervision / Assistant Manager:', error);
            }
        } else if (dto.approveRole === 'checker2') {
            // ส่งให้ production
            try {
                const production = await this.dataSource.getRepository(UsersEntity).find({
                    where: { sampleDataSheetRole: 'Manager', active: 'Y' },
                });
                if (production && production.filter((user) => user.email).length > 0) {
                    const status = sdsAction === SdsApprovalAction.APPROVED ? 'Approved' : 'Rejected';
                    const subject = `SDS Submission ${status}: ${sheet.partNo}`;
                    const html = `
                            <p>Dear Manager,</p>
                            <p>A new SDS submission for Part No: <strong>${sheet.partNo}</strong> has been submitted by ${status == 'Approved' ? 'Checker 2' : 'JTEKT'}.</p>
                            <p>Please log in to the system to review the details.</p>
                            <br>
                            <p>Best regards,</p>
                            <p>Sample Data Sheet System</p>
                        `;
                    this.emailService.sendEmail(production.map((user) => user.email).join(','), subject, html);
                }
            } catch (error) {
                console.error('Failed to send email to Manager:', error);
            }
        }

        // Save sa_status and due_to_implement for out-of-tolerance rows
        if (dto.outOfToleranceRows && dto.outOfToleranceRows.length > 0) {
            for (const rowData of dto.outOfToleranceRows) {
                if (rowData.rowId) {
                    await this.rowRepo.update(
                        { id: rowData.rowId },
                        {
                            saStatus: rowData.saStatus || null,
                            dueToImplement: rowData.dueToImplement ? new Date(rowData.dueToImplement) : null,
                        }
                    );
                }
            }
        }

    }

    async getApprovalHistory(query: SdsApprovalHistoryQueryDto) {
        const qb = this.approvalRepo
            .createQueryBuilder('approval')
            .leftJoinAndSelect('approval.actionByUser', 'user')
            .leftJoinAndSelect('approval.sampleDataSheet', 'sheet')
            .where('approval.deletedAt IS NULL')
            .orderBy('approval.actionDate', 'DESC');

        if (query.partNo) {
            qb.andWhere('approval.partNo LIKE :partNo', { partNo: `%${query.partNo}%` });
        }

        if (query.sdsMonthYear) {
            qb.andWhere('approval.sdsMonthYear = :sdsMonthYear', { sdsMonthYear: query.sdsMonthYear });
        }

        if (query.action) {
            qb.andWhere('approval.action = :action', { action: query.action });
        }

        if (query.role) {
            qb.andWhere('approval.role = :role', { role: query.role });
        }

        if (query.actionDate) {
            const startDate = new Date(query.actionDate);
            const endDate = new Date(query.actionDate);
            endDate.setDate(endDate.getDate() + 1);
            qb.andWhere('approval.actionDate >= :startDate AND approval.actionDate < :endDate', {
                startDate,
                endDate,
            });
        }

        if (query.actionBy) {
            qb.andWhere('user.name LIKE :actionBy OR user.email LIKE :actionBy', {
                actionBy: `%${query.actionBy}%`,
            });
        }

        const approvals = await qb.getMany();

        return approvals.map(approval => ({
            id: approval.id,
            menu: 'SDS Approval',
            partNo: approval.partNo,
            sdsMonthYear: approval.sdsMonthYear,
            action: approval.action,
            actionRole: approval.role,
            actionBy: approval.actionByUser?.name || approval.actionByUser?.email || '',
            actionDate: approval.actionDate,
            remark: approval.remark || '',
        }));
    }

    async removeSampleDataSheetByInspectionId(id: number[]): Promise<void> {
        const sheet = await this.sheetRepo.findOne({ where: { inspectionDetailId: In(id), deletedAt: IsNull() } });
        if (!sheet) {
            throw new NotFoundException('Sample Data Sheet not found');
        }

        await this.sheetRepo.softDelete({ id: sheet.id });
    }
}
