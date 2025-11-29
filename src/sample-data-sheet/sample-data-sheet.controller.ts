import {
    BadRequestException,
    Controller,
    Post,
    Get,
    Query,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
    Body,
    Req,
    Param,
    Put,
    NotFoundException,
    Res,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import * as moment from 'moment';

import { configPath } from 'src/path-files-config';
import { JwtAuthGuard } from 'src/middlewares/jwt-auth.middleware';
import { SampleDataSheetService } from './sample-data-sheet.service';
import {
    CreateSampleDataSheetDto,
    CreateSampleDataSheetRowDto,
} from './dto/create-sample-data-sheet.dto';
import {
    ListInspectionDetailsQueryDto,
    InspectionDetailListResponse,
    DashboardStatsQuery,
} from './dto/list-inspection-details.dto';
import { SdsApprovalDto, SdsApprovalHistoryQueryDto } from './dto/sds-approval.dto';
import { UsersEntity } from 'src/users/entities/users.entity';
import { Response } from 'express';

const ensureUploadDir = (dir: string) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

const sampleDataStorage = diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = configPath.pathUploadInspectionDetail;
        ensureUploadDir(uploadPath);
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const extension = extname(file.originalname) || '.pdf';
        cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
    },
});

const allowedFileTypes: Record<string, string[]> = {
    aisFile: ['application/pdf'],
    sdrFile: ['application/pdf'],
    sdrReport: ['application/pdf', 'image/jpeg', 'image/png'],
};

@Controller('sample-data-sheet')
export class SampleDataSheetController {
    constructor(private readonly sampleDataSheetService: SampleDataSheetService) { }

    @Post()
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(
        FileFieldsInterceptor(
            [
                { name: 'aisFile', maxCount: 1 },
                { name: 'sdrFile', maxCount: 1 },
                { name: 'sdrReport', maxCount: 1 },
            ],
            {
                storage: sampleDataStorage,
                limits: { fileSize: 10 * 1024 * 1024 },
                fileFilter: (req, file, cb) => {
                    const allowed = allowedFileTypes[file.fieldname] || [];
                    if (!allowed.includes(file.mimetype)) {
                        return cb(new BadRequestException('Invalid file type'), false);
                    }
                    cb(null, true);
                },
            },
        ),
    )
    async create(
        @Body('payload') payload: string,
        @UploadedFiles()
        files: {
            aisFile?: Express.Multer.File[];
            sdrFile?: Express.Multer.File[];
            sdrReport?: Express.Multer.File[];
        },
        @Req() { headers: { actionBy } }: { headers: { actionBy: UsersEntity } },
    ) {
        if (!payload) {
            throw new BadRequestException('payload is required');
        }

        let parsed: CreateSampleDataSheetDto;
        try {
            parsed = JSON.parse(payload);
        } catch (error) {
            throw new BadRequestException('Invalid payload format');
        }

        parsed.inspectionDetailId = Number(parsed.inspectionDetailId);
        if (!parsed.inspectionDetailId || Number.isNaN(parsed.inspectionDetailId)) {
            throw new BadRequestException('inspectionDetailId is required');
        }

        if (!Array.isArray(parsed.sdrData) || !parsed.sdrData.length) {
            throw new BadRequestException('sdrData must be a non-empty array');
        }

        if (parsed.production08_2025 === 'Yes' && !files?.sdrReport?.length) {
            throw new BadRequestException('SDR report is required when production is Yes');
        }

        const result = await this.sampleDataSheetService.create(
            parsed,
            {
                aisFile: files?.aisFile?.[0]?.filename,
                sdrFile: files?.sdrFile?.[0]?.filename,
                sdrReportFile: files?.sdrReport?.[0]?.filename,
            },
            actionBy,
        );

        return {
            success: true,
            data: result,
        };
    }

    @Get('by-inspection/pdf/:sdsId')
    @UseGuards(JwtAuthGuard)
    async getByInspectionDetailPdf(
        @Param('sdsId') sdsId: string,
        @Req() { headers: { actionBy } }: { headers: { actionBy: UsersEntity } },
        @Res() res: Response
    ) {
        const id = Number(sdsId);
        if (!id || Number.isNaN(id)) {
            throw new BadRequestException('Invalid inspection detail id');
        }

        const sheet = await this.sampleDataSheetService.findByInspectionDetailForSdsId(id);
        if (!sheet) {
            throw new NotFoundException('Sample Data Sheet not found');
        }

        const pdfBytes1 = await this.sampleDataSheetService.PdfView(sheet, actionBy, true);
        const rawFileName = `${sheet.partNo}-${sheet.partName}`;
        const sanitizedFileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const encodedFileName = encodeURIComponent(rawFileName);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=${sanitizedFileName}.pdf`);
        res.setHeader('Access-Control-Expose-Headers', 'File-Name, Content-Disposition');
        res.setHeader('File-Name', `${encodedFileName}.pdf`);
        res.send(Buffer.from(pdfBytes1));
    }

    @Get('by-inspection/:id')
    @UseGuards(JwtAuthGuard)
    async getByInspectionDetail(@Param('id') idSds: string) {
        const id = Number(idSds);
        if (!id || Number.isNaN(id)) {
            throw new BadRequestException('Invalid inspection detail id');
        }

        const sheet = await this.sampleDataSheetService.findByInspectionDetailForSdsId(id);
        if (!sheet) {
            throw new NotFoundException('Sample Data Sheet not found');
        }

        return {
            success: true,
            data: sheet,
        };
    }

    @Put(':id')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(
        FileFieldsInterceptor(
            [
                { name: 'aisFile', maxCount: 1 },
                { name: 'sdrFile', maxCount: 1 },
                { name: 'sdrReport', maxCount: 1 },
            ],
            {
                storage: sampleDataStorage,
                limits: { fileSize: 10 * 1024 * 1024 },
                fileFilter: (req, file, cb) => {
                    const allowed = allowedFileTypes[file.fieldname] || [];
                    if (!allowed.includes(file.mimetype)) {
                        return cb(new BadRequestException('Invalid file type'), false);
                    }
                    cb(null, true);
                },
            },
        ),
    )
    async update(
        @Param('id') id: string,
        @Body('payload') payload: string,
        @UploadedFiles()
        files: {
            aisFile?: Express.Multer.File[];
            sdrFile?: Express.Multer.File[];
            sdrReport?: Express.Multer.File[];
        },
        @Req() { headers: { actionBy } }: { headers: { actionBy: UsersEntity } },
    ) {
        if (!payload) {
            throw new BadRequestException('payload is required');
        }

        let parsed: CreateSampleDataSheetDto;
        try {
            parsed = JSON.parse(payload);
        } catch (error) {
            throw new BadRequestException('Invalid payload format');
        }

        parsed.inspectionDetailId = Number(parsed.inspectionDetailId);
        if (!parsed.inspectionDetailId || Number.isNaN(parsed.inspectionDetailId)) {
            throw new BadRequestException('inspectionDetailId is required');
        }

        if (!Array.isArray(parsed.sdrData) || !parsed.sdrData.length) {
            throw new BadRequestException('sdrData must be a non-empty array');
        }

        const numericId = Number(id);
        if (!numericId || Number.isNaN(numericId)) {
            throw new BadRequestException('Invalid sample data sheet id');
        }

        const result = await this.sampleDataSheetService.update(
            numericId,
            parsed,
            {
                aisFile: files?.aisFile?.[0]?.filename,
                sdrFile: files?.sdrFile?.[0]?.filename,
                sdrReportFile: files?.sdrReport?.[0]?.filename,
            },
            actionBy,
        );

        return {
            success: true,
            data: result,
        };
    }

    @Get('inspection-details')
    @UseGuards(JwtAuthGuard)
    async listInspectionDetails(
        @Req() { headers: { actionBy } }: { headers: { actionBy: UsersEntity } },
        @Query() query: ListInspectionDetailsQueryDto,
    ) {
        const supplierCode = actionBy?.role === 'Supplier'
            ? actionBy?.supplier?.supplierCode
            : undefined;
        const result = await this.sampleDataSheetService.listInspectionDetails(query, supplierCode);
        return {
            success: true,
            data: result,
        };
    }

    @Get('sds-approval')
    @UseGuards(JwtAuthGuard)
    async sdsApproval(
        @Req() { headers: { actionBy } }: { headers: { actionBy: UsersEntity } },
        @Query() query: ListInspectionDetailsQueryDto,
    ) {
        const supplierCode = actionBy?.role === 'Supplier'
            ? actionBy?.supplier?.supplierCode
            : undefined;
        const result = await this.sampleDataSheetService.listSampleDataSheets(query, supplierCode);
        return {
            success: true,
            data: result,
        };
    }

    @Get('summary-report')
    @UseGuards(JwtAuthGuard)
    async summaryReport(
        @Req() { headers: { actionBy } }: { headers: { actionBy: UsersEntity } },
        @Query() query: ListInspectionDetailsQueryDto,
    ) {
        const supplierCode = actionBy?.role === 'Supplier'
            ? actionBy?.supplier?.supplierCode
            : undefined;
        const result = await this.sampleDataSheetService.listSummaryReport(query, supplierCode);
        return {
            success: true,
            data: result,
        };
    }


    @Get('inspection-details-page-created-sds')
    @UseGuards(JwtAuthGuard)
    async listInspectionDetailsPageCreatedSds(
        @Req() { headers: { actionBy } }: { headers: { actionBy: UsersEntity } },
        @Query() query: ListInspectionDetailsQueryDto,
    ) {
        const supplierCode = actionBy?.role === 'Supplier'
            ? actionBy?.supplier?.supplierCode
            : undefined;
        const result = await this.sampleDataSheetService.listSummaryReport({ ...query, pageCreatedSds: true }, supplierCode);
        return {
            success: true,
            data: result,
        };
    }

    @Get('inspection-details-delay')
    @UseGuards(JwtAuthGuard)
    async listInspectionDetailsDelay(
        @Req() { headers: { actionBy } }: { headers: { actionBy: UsersEntity } },
        @Query() query: ListInspectionDetailsQueryDto,
    ) {
        const supplierCode = actionBy?.role === 'Supplier'
            ? actionBy?.supplier?.supplierCode
            : undefined;
        // Force hasDelay filter to true
        const delayQuery = { ...query, hasDelay: true };
        const result = await this.sampleDataSheetService.listInspectionDetails(delayQuery, supplierCode);
        return {
            success: true,
            data: result,
        };
    }

    @Get('dashboard-stats')
    async getDashboardStats(
        @Query() query: ListInspectionDetailsQueryDto,
    ) {

        // Get delay data (has_delay > 0)
        const delayResult = await this.sampleDataSheetService.listSummaryReport({ ...query, monthYear: moment().format('MM-YYYY') });
        const forMonthly = {
            delayResult: delayResult.items.filter(item => item.hasDelay),
            allResult: delayResult.items,
            totalCount: delayResult.total,
        };

        const delayResultYearly = await this.sampleDataSheetService.listSummaryReport({ ...query, monthYear: undefined, year: moment().format('YYYY') });
        const forYearly = {
            delayResult: delayResultYearly.items.filter(item => item.hasDelay),
            allResult: delayResultYearly.items,
            totalCount: delayResultYearly.total,
        };

        // Get inspection result data
        const inspectionResult = await this.sampleDataSheetService.getInspectionDashboardData(query);

        // Calculate statistics
        const totalCount = forMonthly.totalCount;
        const delayCount = forMonthly.delayResult.length;
        const onProcessCompleteCount = totalCount - delayCount;

        const totalCountYearly = forYearly.totalCount;
        const delayCountYearly = forYearly.delayResult.length;
        const onProcessCompleteCountYearly = totalCountYearly - delayCountYearly;
        return {
            success: true,
            data: {
                monthly: {
                    delayPercentage: totalCount > 0 ? Math.round((delayCount / totalCount) * 100) : 0,
                    delayCount,
                    onProcessCompletePercentage: totalCount > 0 ? Math.round((onProcessCompleteCount / totalCount) * 100) : 0,
                    onProcessCompleteCount,
                    delayData: forMonthly.allResult.map((item, index) => ({
                        no: index + 1,
                        id: item.id,
                        sheetId: item.sheetId,
                        supplier: item.supplierCode,
                        partName: item.partName,
                        partNumber: item.partNo,
                        delay: item.hasDelay,
                    })),
                },
                yearly: {
                    delayPercentage: totalCountYearly > 0 ? Math.round((delayCountYearly / totalCountYearly) * 100) : 0,
                    delayCount: delayCountYearly,
                    onProcessCompletePercentage: totalCountYearly > 0 ? Math.round((onProcessCompleteCountYearly / totalCountYearly) * 100) : 0,
                    onProcessCompleteCount: onProcessCompleteCountYearly,
                    delayData: forYearly.allResult.map((item, index) => ({
                        no: index + 1,
                        id: item.id,
                        sheetId: item.sheetId,
                        supplier: item.supplierCode,
                        partName: item.partName,
                        partNumber: item.partNo,
                        delay: item.hasDelay,
                    })),
                },
                inspection: {
                    okCount: inspectionResult.totalSds - inspectionResult.ngCount,
                    ngCount: inspectionResult.ngCount,
                    okPercentage: inspectionResult.totalSds > 0 ? Math.round(((inspectionResult.totalSds - inspectionResult.ngCount) / inspectionResult.totalSds) * 100) : 0,
                    ngPercentage: inspectionResult.totalSds > 0 ? Math.round((inspectionResult.ngCount / inspectionResult.totalSds) * 100) : 0,
                    inspectionData: inspectionResult.items.map((item, index) => {
                        const checker1Approved = item.checker1ApprovedSdr === 'Approved' && item.checker1ApprovedSds === 'Approved';
                        const checker1Rejected = item.checker1ApprovedSdr === 'Rejected' || item.checker1ApprovedSds === 'Rejected';
                        const checker2Approved = item.checker2ApprovedSdr === 'Approved' && item.checker2ApprovedSds === 'Approved';
                        const checker2Rejected = item.checker2ApprovedSdr === 'Rejected' || item.checker2ApprovedSds === 'Rejected';
                        const checker3Approved = item.checker3ApprovedSdr === 'Approved' && item.checker3ApprovedSds === 'Approved';
                        const checker3Rejected = item.checker3ApprovedSdr === 'Rejected' || item.checker3ApprovedSds === 'Rejected';

                        let sdsStatus = 'Pending';
                        if (item.part_status !== 'Active' && !checker1Approved && !checker1Rejected) {
                            sdsStatus = 'Wait for JATH Active Part';
                        } else if (!item.sds_created && !checker1Approved && !checker1Rejected) {
                            sdsStatus = 'Pending';
                        } else if (checker1Approved && checker2Approved && checker3Approved) {
                            sdsStatus = 'Completed';
                        } else if (checker1Rejected || checker2Rejected || checker3Rejected) {
                            sdsStatus = 'Rejected';
                        } else {
                            sdsStatus = 'Submitted';
                        }

                        return {
                            no: index + 1,
                            id: item.id,
                            sheetId: item.sheet_id,
                            supplier: item.supplier,
                            partName: item.part_name,
                            partNo: item.part_no,
                            ngType: item.ng_count,
                            sdsStatus,
                            dueToInspectionDept: item.sdr_date ? moment(item.sdr_date).format('DD-MM-YYYY') : '',
                        };
                    }),
                },
            },
        };
    }

    @Post('sds-approval')
    @UseGuards(JwtAuthGuard)
    async submitSdsApproval(
        @Req() { headers: { actionBy } }: { headers: { actionBy: UsersEntity } },
        @Body('payload') payload: SdsApprovalDto,
    ) {
        if (!payload) {
            throw new BadRequestException('payload is required');
        }

        await this.sampleDataSheetService.submitApproval(payload, actionBy);

        return {
            success: true,
            message: 'Approval submitted successfully',
        };
    }

    @Get('approval-history')
    @UseGuards(JwtAuthGuard)
    async getApprovalHistory(@Query() query: SdsApprovalHistoryQueryDto) {
        const result = await this.sampleDataSheetService.getApprovalHistory(query);
        return {
            success: true,
            data: result,
        };
    }
}
