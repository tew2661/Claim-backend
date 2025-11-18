import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SampleDataSheetEntity } from './entities/sample-data-sheet.entity';
import { SampleDataSheetRowEntity } from './entities/sample-data-sheet-row.entity';
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
        @InjectRepository(InspectionDetailEntity)
        private readonly inspectionRepo: Repository<InspectionDetailEntity>,
        @InjectRepository(InspectionSpecialRequestEntity)
        private readonly specialRequestRepo: Repository<InspectionSpecialRequestEntity>,
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
        if (filters.supplierCode && filters.supplierCode.toLowerCase() !== 'all') {
            query.andWhere('detail.supplier_code = :supplierCode', { supplierCode: filters.supplierCode });
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
                supplierCode: detail.supplierCode,
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
        const statusFilter = filters.status?.toLowerCase();
        const filtered = rows.filter((row) => {
            const matchMonth = !monthFilter || monthFilter === 'all' || monthFilter === row.monthYear;
            const matchType = !typeFilter || typeFilter === 'all' || row.sdsType.toLowerCase() === typeFilter;
            const matchStatus = !statusFilter || statusFilter === 'all' || row.supplierStatus.toLowerCase() === statusFilter;
            return matchMonth && matchType && matchStatus;
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

        pageOld.drawText(`${sheet.sdrDate ? moment(sheet.sdrDate).format('DD'): ''}`, {
            x: 300,
            y: oldHeight - 50,
            size: fontSize,
            font: oldfont,
            color: rgb(0, 0, 0),
        });

        pageOld.drawText(`${sheet.sdrDate ? moment(sheet.sdrDate).format('MM'): ''}`, {
            x: 340,
            y: oldHeight - 50,
            size: fontSize,
            font: oldfont,
            color: rgb(0, 0, 0),
        });

        pageOld.drawText(`${sheet.sdrDate ? moment(sheet.sdrDate).format('YYYY'): ''}`, {
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
}
