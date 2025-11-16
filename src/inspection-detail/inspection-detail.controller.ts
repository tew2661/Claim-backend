import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  NotFoundException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import { extname, join, normalize } from 'path';
import { InspectionDetailService, CreateInspectionDetailDto } from './inspection-detail.service';
import { JwtAuthGuard } from 'src/middlewares/jwt-auth.middleware';
import { configPath } from 'src/path-files-config';
import { Response } from 'express';

const ensureUploadDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const inspectionStorage = diskStorage({
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

const allowedFileTypes = ['application/pdf'];

@Controller('inspection-detail')
export class InspectionDetailController {
  constructor(private readonly inspectionDetailService: InspectionDetailService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'aisFile', maxCount: 1 },
        { name: 'sdrFile', maxCount: 1 },
      ],
      {
        storage: inspectionStorage,
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
          if (!allowedFileTypes.includes(file.mimetype)) {
            return cb(new BadRequestException('Only PDF files are allowed'), false);
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
    },
  ) {
    if (!payload) {
      throw new BadRequestException('payload is required');
    }

    let parsedBody: CreateInspectionDetailDto;
    try {
      parsedBody = JSON.parse(payload);
    } catch (error) {
      throw new BadRequestException('Invalid payload format');
    }

    if (!Array.isArray(parsedBody.inspectionItems) || !parsedBody.inspectionItems.length) {
      throw new BadRequestException('inspectionItems must be a non-empty array');
    }

    parsedBody.inspectionItems = parsedBody.inspectionItems.map((item, index) => ({
      ...item,
      no: Number(item.no ?? index + 1),
    }));

    parsedBody.aisFile = files?.aisFile?.[0]?.filename ?? null;
    parsedBody.sdrFile = files?.sdrFile?.[0]?.filename ?? null;

    if (!parsedBody.aisFile || !parsedBody.sdrFile) {
      throw new BadRequestException('AIS file and SDR file are required');
    }

    const result = await this.inspectionDetailService.create(parsedBody);
    return {
      success: true,
      data: result,
    };
  }

  @Get('files/:filename')
  @UseGuards(JwtAuthGuard)
  async downloadFile(@Param('filename') filename: string, @Res() res: Response) {
    if (!filename) {
      throw new BadRequestException('filename is required');
    }

    const baseDir = join(process.cwd(), configPath.pathUploadInspectionDetail);
    const targetPath = normalize(join(baseDir, filename));

    if (!targetPath.startsWith(baseDir)) {
      throw new BadRequestException('Invalid filename');
    }

    if (!fs.existsSync(targetPath)) {
      throw new NotFoundException('File not found');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    const stream = fs.createReadStream(targetPath);
    stream.pipe(res);
  }

  @Get('suppliers')
  @UseGuards(JwtAuthGuard)
  async getSuppliersDropdown() {
    const list = await this.inspectionDetailService.listSupplierDropdown();
    return {
      success: true,
      data: list,
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('supplierCode') supplierCode?: string,
    @Query('partNo') partNo?: string,
    @Query('partName') partName?: string,
    @Query('model') model?: string,
    @Query('partStatus') partStatus?: string,
    @Query('supplierEditStatus') supplierEditStatus?: string,
  ) {
    const pageNum = parseInt(page as string, 10) || 1;
    const take = parseInt(limit as string, 10) || 10;
    const skip = (pageNum - 1) * take;

    const { items, total } = await this.inspectionDetailService.findAll({
      skip,
      take,
      supplierCode,
      partNo,
      partName,
      model,
      partStatus,
      supplierEditStatus,
    });

    return {
      success: true,
      data: items,
      total,
      page: pageNum,
      limit: take,
    };
  }


}
