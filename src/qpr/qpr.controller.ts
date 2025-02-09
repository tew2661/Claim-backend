// src/qpr/qpr.controller.ts
import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { CreateQprDto } from './dto/create-qpr.dto';
import { QprService } from './qpr.service';
import { JwtAuthGuard } from 'src/middlewares/jwt-auth.middleware';
import { UsersEntity } from 'src/users/entities/users.entity';
import { GetQprDto } from './dto/get-qpr.dto';
import { SaveChecker1, SaveChecker2, SaveChecker3, SaveObjectQPR } from './dto/action-supplier.dto';

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

    @Get(':id')
    @UseGuards(JwtAuthGuard)
    async findIdAll(
        @Param('id' , ParseIntPipe) id: number,
    ) {
        return await this.qprService.findId(id);
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

    @Put('qpr-report/draft/:id')
    @UseGuards(JwtAuthGuard)
    async QprReportDraft(
        @Body() saveObjectQPR : SaveObjectQPR[],
        @Param('id' , ParseIntPipe) id: number,
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
    ) {
        return this.qprService.SaveDraftObjectQPR(id, saveObjectQPR, actionBy);
    }

    @Put('qpr-report/completed/:id')
    @UseGuards(JwtAuthGuard)
    async QprReportCompleted(
        @Body() saveObjectQPR : SaveObjectQPR[],
        @Param('id' , ParseIntPipe) id: number,
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
    ) {
        return this.qprService.SaveCompletedObjectQPR(id, saveObjectQPR, actionBy);
    }

    @Put('qpr-report/checker1/:id')
    @UseGuards(JwtAuthGuard)
    async QprReportChecker1(
        @Body() saveChecker1 : SaveChecker1,
        @Param('id' , ParseIntPipe) id: number,
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
    ) {
        return this.qprService.SaveChecker1(id, saveChecker1, actionBy);
    }

    @Put('qpr-report/checker2/:id')
    @UseGuards(JwtAuthGuard)
    async QprReportChecker2(
        @Body() saveChecker2 : SaveChecker2,
        @Param('id' , ParseIntPipe) id: number,
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
    ) {
        return this.qprService.SaveChecker2(id, saveChecker2, actionBy);
    }

    @Put('qpr-report/checker3/:id')
    @UseGuards(JwtAuthGuard)
    async QprReportChecker3(
        @Body() saveChecker3 : SaveChecker3,
        @Param('id' , ParseIntPipe) id: number,
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
    ) {
        return this.qprService.SaveChecker3(id, saveChecker3, actionBy);
    }
}
