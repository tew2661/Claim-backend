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
import { configPath } from 'src/path-files-config';
import { JwtAuthGuard } from 'src/middlewares/jwt-auth.middleware';
import { SampleDataSheetService } from './sample-data-sheet.service';
import { CreateSampleDataSheetDto } from './dto/create-sample-data-sheet.dto';
import { ListInspectionDetailsQueryDto } from './dto/list-inspection-details.dto';
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
    constructor(private readonly sampleDataSheetService: SampleDataSheetService) {}

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
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
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

    @Get('by-inspection/pdf/:inspectionDetailId')
    @UseGuards(JwtAuthGuard)
    async getByInspectionDetailPdf(
        @Param('inspectionDetailId') inspectionDetailId: string,
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
        @Res() res: Response
    ) {
        const id = Number(inspectionDetailId);
        if (!id || Number.isNaN(id)) {
            throw new BadRequestException('Invalid inspection detail id');
        }

        const sheet = await this.sampleDataSheetService.findByInspectionDetailId(id);
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

    @Get('by-inspection/:inspectionDetailId')
    @UseGuards(JwtAuthGuard)
    async getByInspectionDetail(@Param('inspectionDetailId') inspectionDetailId: string) {
        const id = Number(inspectionDetailId);
        if (!id || Number.isNaN(id)) {
            throw new BadRequestException('Invalid inspection detail id');
        }

        const sheet = await this.sampleDataSheetService.findByInspectionDetailId(id);
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
         @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
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
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
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

    @Get('inspection-details-delay')
    @UseGuards(JwtAuthGuard)
    async listInspectionDetailsDelay(
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
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

    @Post('sds-approval')
    @UseGuards(JwtAuthGuard)
    async submitSdsApproval(
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
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
