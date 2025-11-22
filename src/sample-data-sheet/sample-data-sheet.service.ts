import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SampleDataSheetEntity } from './entities/sample-data-sheet.entity';
import { SampleDataSheetRowEntity } from './entities/sample-data-sheet-row.entity';
import { SampleDataSheetApprovalEntity, SdsApprovalAction, SdsApprovalRole, SdsDocumentType } from './entities/sample-data-sheet-approval.entity';
import { CreateSampleDataSheetDto, CreateSampleDataSheetRowDto } from './dto/create-sample-data-sheet.dto';
import {
    SampleDataSheetResponse,
    SampleDataSheetRowResponse,
    SampleDataSheetSampleResponse,
} from './interfaces/sample-data-sheet-response.interface';
import { InspectionDetailEntity, ActiveStatus } from 'src/inspection-detail/entities/inspection-detail.entity';
import { InspectionSpecialRequestEntity, SpecialRequestStatus } from 'src/inspection-detail/entities/inspection-special-request.entity';
import {
    InspectionDetailListItem,
    InspectionDetailListResponse,
    ListInspectionDetailsQueryDto,
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

interface SampleValue {
    no: number;
    value: string;
}

interface SampleRow {
    id?: number;
    sampleDataSheetId?: number;
    no?: number;
    measuringItem?: string;
    specification?: string;
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
export class SampleDataSheetService {
    constructor(
        @InjectRepository(SampleDataSheetEntity)
        private readonly sheetRepo: Repository<SampleDataSheetEntity>,
        @InjectRepository(SampleDataSheetRowEntity)
        private readonly rowRepo: Repository<SampleDataSheetRowEntity>,
        @InjectRepository(SampleDataSheetApprovalEntity)
        private readonly approvalRepo: Repository<SampleDataSheetApprovalEntity>,
        @InjectRepository(InspectionDetailEntity)
        private readonly inspectionRepo: Repository<InspectionDetailEntity>,
        @InjectRepository(InspectionSpecialRequestEntity)
        private readonly specialRequestRepo: Repository<InspectionSpecialRequestEntity>,
        @InjectDataSource()
        private readonly dataSource: DataSource,
    ) { }

    async create(
        dto: CreateSampleDataSheetDto,
        files: { aisFile?: string; sdrFile?: string; sdrReportFile?: string },
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
    ): Promise<SampleDataSheetResponse> {
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
        sheet.loop += 1;
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

        const checkerLevel = filters.checkerLevel;

        // Build optimized query with subqueries
        let query = `
            SELECT
                detail.*,
                sheet.id as sheet_id,
                sheet.loop as sheet_loop,
                (
                    SELECT TOP(1) sample_data_sheet_approvals.re_submit_date
                    FROM sample_data_sheet_approvals 
                    WHERE sample_data_sheet_approvals.sample_data_sheet_id = sheet.id
                    AND sample_data_sheet_approvals.loop = sheet.loop
                    --AND sample_data_sheet_approvals.document_type = 'SDR'
                    --AND sample_data_sheet_approvals.role = 'Checker 1'
                    AND sample_data_sheet_approvals.action = 'Rejected'
                    AND sample_data_sheet_approvals.re_submit_date IS NOT NULL
                    ORDER BY sample_data_sheet_approvals.id DESC
                ) as due_date,
                (
                    SELECT TOP(1) sds_inspection_special_request.due_date
                    FROM sds_inspection_special_request 
                    WHERE sds_inspection_special_request.inspection_detail_id = sheet.inspection_detail_id
                    ORDER BY sds_inspection_special_request.id DESC
                ) as due_date_special,
                (
                    SELECT TOP(1) sr.id
                    FROM dbo.sds_inspection_special_request sr
                    WHERE sr.inspection_detail_id = sheet.inspection_detail_id
                    ORDER BY sr.id DESC
                ) as special_id,
                (
                    SELECT TOP(1) app.action
                    FROM dbo.sample_data_sheet_approvals app
                    WHERE app.sample_data_sheet_id = sheet.id
                    AND app.loop = sheet.loop
                    AND app.document_type = 'SDR'
                    AND app.role = 'Checker 1'
                    ORDER BY app.id DESC
                ) as checker1ApprovedSdr,
                (
                    SELECT TOP(1) app.action
                    FROM dbo.sample_data_sheet_approvals app
                    WHERE app.sample_data_sheet_id = sheet.id
                    AND app.loop = sheet.loop
                    AND app.document_type = 'SDS'
                    AND app.role = 'Checker 1'
                    ORDER BY app.id DESC
                ) as checker1ApprovedSds,
                (
                    SELECT TOP(1) app.action
                    FROM dbo.sample_data_sheet_approvals app
                    WHERE app.sample_data_sheet_id = sheet.id
                    AND app.loop = sheet.loop
                    AND app.document_type = 'SDR'
                    AND app.role = 'Checker 2'
                    ORDER BY app.id DESC
                ) as checker2ApprovedSdr,
                (
                    SELECT TOP(1) app.action
                    FROM dbo.sample_data_sheet_approvals app
                    WHERE app.sample_data_sheet_id = sheet.id
                    AND app.loop = sheet.loop
                    AND app.document_type = 'SDS'
                    AND app.role = 'Checker 2'
                    ORDER BY app.id DESC
                ) as checker2ApprovedSds,
                (
                    SELECT TOP(1) app.action
                    FROM dbo.sample_data_sheet_approvals app
                    WHERE app.sample_data_sheet_id = sheet.id
                    AND app.loop = sheet.loop
                    AND app.document_type = 'SDR'
                    AND app.role = 'Approver'
                    ORDER BY app.id DESC
                ) as checker3ApprovedSdr,
                (
                    SELECT TOP(1) app.action
                    FROM dbo.sample_data_sheet_approvals app
                    WHERE app.sample_data_sheet_id = sheet.id
                    AND app.loop = sheet.loop
                    AND app.document_type = 'SDS'
                    AND app.role = 'Approver'
                    ORDER BY app.id DESC
                ) as checker3ApprovedSds
            FROM dbo.sds_inspection_detail detail
            INNER JOIN dbo.sample_data_sheets sheet ON sheet.inspection_detail_id = detail.id
            WHERE detail.active_row = 'Y'
            AND detail.sds_created = 1
        `;

        const filterParams: any[] = [];
        let paramIndex = 0;
        let querys = '';

        if (supplierCode) {
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
            querys += ` AND MONTH(sheet.sdr_date) = @${paramIndex} AND YEAR(sheet.sdr_date) = @${paramIndex + 1}`;
            filterParams.push(month, year);
            paramIndex += 2;
        }

        if (filters.sdsType && filters.sdsType.toLowerCase() !== 'all') {
            if (filters.sdsType.toLowerCase() === 'special') {
                querys += ` AND EXISTS (
                    SELECT 1
                    FROM dbo.sds_inspection_special_request sr_filter
                    WHERE sr_filter.inspection_detail_id = sheet.inspection_detail_id
                    -- ORDER BY sr_filter.id DESC
                )`;
            } else if (filters.sdsType.toLowerCase() === 'normal') {
                querys += ` AND NOT EXISTS (
                    SELECT 1
                    FROM dbo.sds_inspection_special_request sr_filter
                    WHERE sr_filter.inspection_detail_id = sheet.inspection_detail_id
                    -- ORDER BY sr_filter.id DESC
                )`;
            }
        }

        query += querys;
        query += ` ORDER BY detail.created_at DESC`;
        query += ` OFFSET ${skip} ROWS FETCH NEXT ${limit} ROWS ONLY`;
        const queryParams = [...filterParams];

        // Get total count
        let countQuery = `
            SELECT COUNT(*) as total
            FROM dbo.sds_inspection_detail detail
            INNER JOIN dbo.sample_data_sheets sheet ON sheet.inspection_detail_id = detail.id
            WHERE detail.active_row = 'Y'
            AND detail.sds_created = 1
        `;

        const rawResults = await this.dataSource.query(query, queryParams);
        const countResult = await this.dataSource.query(countQuery + querys, filterParams);

        const total = countResult && countResult.length > 0 ? countResult[0].total : 0;

        if (total === 0) {
            return { total: 0, items: [] };
        }

        const now = this.startOfDay(new Date());
        // Process results
        const rows: InspectionDetailListItem[] = rawResults.map((row, index) => {

            const checker1Approved = row.checker1ApprovedSdr === 'Approved' && row.checker1ApprovedSds === 'Approved';
            const checker1Rejected = row.checker1ApprovedSdr === 'Rejected' || row.checker1ApprovedSds === 'Rejected';
            const checker2Approved = row.checker2ApprovedSdr === 'Approved' && row.checker2ApprovedSds === 'Approved';
            const checker2Rejected = row.checker2ApprovedSdr === 'Rejected' || row.checker2ApprovedSds === 'Rejected';
            const checker3Approved = row.checker3ApprovedSdr === 'Approved' && row.checker3ApprovedSds === 'Approved';
            const checker3Rejected = row.checker3ApprovedSdr === 'Rejected' || row.checker3ApprovedSds === 'Rejected';
            let supplierStatus = 'Pending';
            if ((row.checker1ApprovedSdr === 'Approved' && row.checker1ApprovedSds === 'Approved') &&
                (row.checker2ApprovedSdr === 'Approved' && row.checker2ApprovedSds === 'Approved') &&
                (row.checker3ApprovedSdr === 'Approved' && row.checker3ApprovedSds === 'Approved')
            ) {
                supplierStatus = 'Approved';
            } else if ((row.checker1ApprovedSdr === 'Rejected' || row.checker1ApprovedSds === 'Rejected') ||
                (row.checker2ApprovedSdr === 'Rejected' || row.checker2ApprovedSds === 'Rejected') ||
                (row.checker3ApprovedSdr === 'Rejected' || row.checker3ApprovedSds === 'Rejected')
            ) {
                supplierStatus = 'Rejected';
            } else {
                supplierStatus = 'Wait for JATH Approve';
            }

            let checker1Status = 'Pending';
            if (row.checker1ApprovedSdr === 'Approved' && row.checker1ApprovedSds === 'Approved') {
                checker1Status = 'Approved';
            } else if (row.checker1ApprovedSdr === 'Rejected' || row.checker1ApprovedSds === 'Rejected') {
                checker1Status = 'Rejected';
            }

            let checker2Status = 'Pending';
            if (row.checker2ApprovedSdr === 'Approved' && row.checker2ApprovedSds === 'Approved') {
                checker2Status = 'Approved';
            } else if (row.checker2ApprovedSdr === 'Rejected' || row.checker2ApprovedSds === 'Rejected') {
                checker2Status = 'Rejected';
            } else if (checker1Status === 'Pending') {
                checker2Status = 'Wait for Checker 1 Approve';
            } else if (checker1Status === 'Rejected') {
                checker2Status = 'Rejected';
            }

            let checker3Status = 'Pending';
            if (row.checker3ApprovedSdr === 'Approved' && row.checker3ApprovedSds === 'Approved') {
                checker3Status = 'Approved';
            } else if (row.checker3ApprovedSdr === 'Rejected' || row.checker3ApprovedSds === 'Rejected') {
                checker3Status = 'Rejected';
            } else if (checker2Status === 'Pending') {
                checker3Status = 'Wait for Checker 2 Approve';
            } else if (checker2Status === 'Rejected') {
                checker3Status = 'Rejected';
            }

            const hasAnyRejection = checker1Rejected || checker2Rejected || checker3Rejected;

            const dueDate = row.due_date ? new Date(row.due_date) : (row.due_date_special ? new Date(row.due_date_special) : null);
            const monthYear = dueDate
                ? this.formatMonthYear(dueDate)
                : this.formatMonthYear(new Date(row.created_at));
            const sdsType: 'Special' | 'Normal' = row.special_id ? 'Special' : 'Normal';
            const hasDelay = dueDate ? this.startOfDay(dueDate).getTime() < now.getTime() : false;

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
                hasDelay,
                sdsCreated: row.sds_created,
                checker1Approved,
                checker1Rejected,
                checker2Approved,
                checker2Rejected,
                checker3Approved,
                checker3Rejected,
                hasAnyRejection,
            }
        })

        return {
            total: total,
            items: rows,
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

    private mapSheet(sheet: SampleDataSheetEntity): SampleDataSheetResponse {
        const rows: SampleDataSheetRowResponse[] = (sheet.rows || []).map((row) => {
            const samples = JSON.parse(row.samples || '[]') as SampleDataSheetSampleResponse[];
            return {
                id: row.id,
                sampleDataSheetId: row.sampleDataSheetId,
                no: row.no,
                measuringItem: row.measuringItem,
                specification: row.specification,
                rank: row.rank,
                inspectionInstrument: row.inspectionInstrument,
                remark: row.remark ?? null,
                sampleQty: row.sampleQty,
                samples,
                judgement: row.judgement ?? null,
                xBar: row.xBar ?? null,
                r: row.r ?? null,
                cp: row.cp ?? null,
                cpk: row.cpk ?? null,
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
            sdrData: rows,
        };
    }

    async findById(id: number): Promise<SampleDataSheetResponse | null> {
        const sheet = await this.sheetRepo.findOne({
            where: { id },
            relations: ['rows'],
        });

        if (!sheet) {
            return null;
        }

        return this.mapSheet(sheet);
    }

    async findByInspectionDetailId(inspectionDetailId: number): Promise<SampleDataSheetResponse | null> {
        const sheet = await this.sheetRepo.findOne({
            where: { inspectionDetailId },
            relations: ['rows'],
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
        const fontSize = 8;

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
            const rowHeight = 16;

            for (let rowIndex = 0; rowIndex < sampleRows.length; rowIndex++) {
                const row = sampleRows[rowIndex];
                const samples = row.samples;

                page.drawText(`${row.no ?? ''}`, {
                    x: 45 - (font.widthOfTextAtSize(`${row.no ?? ''}`, fontSize) / 2),
                    y: startY,
                    size: fontSize,
                    font,
                    color: rgb(0, 0, 0),
                });

                page.drawText(`${row.measuringItem ?? ''}`, {
                    x: 55,
                    y: startY,
                    size: fontSize,
                    font,
                    color: rgb(0, 0, 0),
                });

                page.drawText(`${row.specification ?? ''}`, {
                    x: 130,
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
                    x: 220,
                    y: startY,
                    size: fontSize,
                    font,
                    color: rgb(0, 0, 0),
                });

                page.drawText(`${row.xBar ?? ''}`, {
                    x: 655 - (font.widthOfTextAtSize(`${row.xBar ?? ''}`, fontSize) / 2),
                    y: startY,
                    size: fontSize,
                    font,
                    color: rgb(0, 0, 0),
                });

                page.drawText(`${row.r ?? ''}`, {
                    x: 680 - (font.widthOfTextAtSize(`${row.r ?? ''}`, fontSize) / 2),
                    y: startY,
                    size: fontSize,
                    font,
                    color: rgb(0, 0, 0),
                });

                page.drawText(`${row.cp ?? ''}`, {
                    x: 705 - (font.widthOfTextAtSize(`${row.cp ?? ''}`, fontSize) / 2),
                    y: startY,
                    size: fontSize,
                    font,
                    color: rgb(0, 0, 0),
                });

                page.drawText(`${row.cpk ?? ''}`, {
                    x: 730 - (font.widthOfTextAtSize(`${row.cpk ?? ''}`, fontSize) / 2),
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
                    const simpleValue = (sample.value || '');
                    const textWidth = font.widthOfTextAtSize(simpleValue, fontSize);
                    page.drawText(simpleValue, {
                        x: sampleX - (textWidth / 2),
                        y: startY,
                        size: fontSize,
                        font,
                        color: rgb(0, 0, 0),
                    });

                }

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
        const sheet = await this.sheetRepo.findOne({ where: { id: dto.id } });
        if (!sheet) {
            throw new NotFoundException('Sample Data Sheet not found');
        }

        const reSubmitDate = dto.reSubmitDate ? new Date(dto.reSubmitDate) : null;

        // Get month-year from SDR date (e.g., "08-2025")
        const sdsMonthYear = moment(sheet.sdrDate).format('MM-YYYY');

        // Determine user role from approveRole parameter
        let role: SdsApprovalRole = SdsApprovalRole.SUPPLIER;
        if (dto.approveRole === 'checker1') {
            role = SdsApprovalRole.CHECKER1;
        } else if (dto.approveRole === 'checker2') {
            role = SdsApprovalRole.CHECKER2;
        } else if (dto.approveRole === 'approver') {
            role = SdsApprovalRole.APPROVER;
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
                reSubmitDate: reSubmitDate,
                partNo: sheet.partNo,
                sdsMonthYear: sdsMonthYear,
            });

            await this.approvalRepo.save(sdrApproval);
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

            await this.approvalRepo.save(sdsApproval);
        }
    }

    async getApprovalHistory(query: SdsApprovalHistoryQueryDto) {
        const qb = this.approvalRepo
            .createQueryBuilder('approval')
            .leftJoinAndSelect('approval.actionByUser', 'user')
            .leftJoinAndSelect('approval.sampleDataSheet', 'sheet')
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
}
