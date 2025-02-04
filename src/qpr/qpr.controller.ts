// src/qpr/qpr.controller.ts
import { Body, Controller, Get, Post, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { CreateQprDto } from './dto/create-qpr.dto';
import { QprService } from './qpr.service';
import { JwtAuthGuard } from 'src/middlewares/jwt-auth.middleware';
import { UsersEntity } from 'src/users/entities/users.entity';
import { GetQprDto } from './dto/get-qpr.dto';

@Controller('qpr')
export class QprController {
    constructor(private readonly qprService: QprService) { }

    @Post()
    @UseGuards(JwtAuthGuard)
    async createQpr(
        @UploadedFiles()
        @Body() createQprDto: CreateQprDto,
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
    ) {
        // เรียกใช้ service เพื่อจัดการการสร้าง QPR
        return await this.qprService.create(createQprDto, actionBy);
    }

    @Get()
    @UseGuards(JwtAuthGuard)
    async findAll(@Query() Query : GetQprDto) {
        const qpr = await this.qprService.findAll(Query);
        const count = await this.qprService.count(Query);
        return {
            statusCode: 200,
            data: qpr,
            total: count
        }
    }
}
