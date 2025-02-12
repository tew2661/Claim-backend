// src/qpr/qpr.controller.ts
import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, Req, Res, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { CreateQprDto } from './dto/create-qpr.dto';
import { QprService } from './qpr.service';
import { JwtAuthGuard } from 'src/middlewares/jwt-auth.middleware';
import { UsersEntity } from 'src/users/entities/users.entity';
import { GetQprDto } from './dto/get-qpr.dto';
import { Object8DReportDto, Save8DChecker1, Save8DChecker2, Save8DChecker3, SaveChecker1, SaveChecker2, SaveChecker3, SaveObjectQPR } from './dto/action-supplier.dto';
import { Response } from 'express';
import * as moment from 'moment';

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

    @Get('pdf/view-8d/:id')
    @UseGuards(JwtAuthGuard)
    async ViewFile8D(
        @Res() res: Response,
        @Param('id' , ParseIntPipe) id: number,
    ) {
        const data = await this.qprService.findId(id);
        const pdfBytes1 = await this.qprService.ViewFile8D(id);

        res.setHeader('Content-Type', `'application/pdf'`);
        res.setHeader('Content-Disposition', `inline; filename=${data.qprIssueNo}.pdf`);
        res.setHeader('Access-Control-Expose-Headers', 'File-Name, Content-Disposition');
        res.setHeader('File-Name', `${data.qprIssueNo}.pdf`);
        // Send the PDF content to the client for viewing
        res.send(Buffer.from(pdfBytes1));
    }

    @Get('pdf/view/:id')
    @UseGuards(JwtAuthGuard)
    async ViewPdf(
        @Res() res: Response,
        @Param('id' , ParseIntPipe) id: number,
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
    ) {
        const data = await this.qprService.findId(id);
        const pdfBytes1 = await this.qprService.PdfView(data, actionBy, true);

        res.setHeader('Content-Type', `'application/pdf'`);
        res.setHeader('Content-Disposition', `inline; filename=${data.qprIssueNo}.pdf`);
        res.setHeader('Access-Control-Expose-Headers', 'File-Name, Content-Disposition');
        res.setHeader('File-Name', `${data.qprIssueNo}.pdf`);
        // Send the PDF content to the client for viewing
        res.send(Buffer.from(pdfBytes1));
    }

    @Get('pdf/download/:id')
    @UseGuards(JwtAuthGuard)
    async DownloadPdf(
        @Res() res: Response,
        @Param('id' , ParseIntPipe) id: number,
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
    ) {
        const data = await this.qprService.findId(id);
        const pdfBytes1 = await this.qprService.PdfView(data, actionBy);

        res.setHeader('Content-Type', `'application/pdf'`);
        res.setHeader('Content-Disposition', `inline; filename=${data.qprIssueNo}.pdf`);
        res.setHeader('Access-Control-Expose-Headers', 'File-Name, Content-Disposition');
        res.setHeader('File-Name', `${data.qprIssueNo}.pdf`);
        // Send the PDF content to the client for viewing
        res.send(Buffer.from(pdfBytes1));
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

    @Put('8d-report/draft/:id')
    @UseGuards(JwtAuthGuard)
    async eDReportDraft(
        @Body() object8DReportDto : Object8DReportDto[],
        @Param('id' , ParseIntPipe) id: number,
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
    ) {
        return this.qprService.SaveDraftObject8DReport(id, object8DReportDto, actionBy);
    }

    @Put('8d-report/completed/:id')
    @UseGuards(JwtAuthGuard)
    async eDReportCompleted(
        @Body() object8DReportDto : Object8DReportDto[],
        @Param('id' , ParseIntPipe) id: number,
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
    ) {
        return this.qprService.SaveCompletedObject8DReport(id, object8DReportDto, actionBy);
    }

    @Put('8d-report/checker1/:id')
    @UseGuards(JwtAuthGuard)
    async eDReportChecker1(
        @Body() save8DChecker1 : Save8DChecker1,
        @Param('id' , ParseIntPipe) id: number,
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
    ) {
        return this.qprService.Save8DChecker1(id, save8DChecker1, actionBy);
    }

    @Put('8d-report/checker2/:id')
    @UseGuards(JwtAuthGuard)
    async eDReportChecker2(
        @Body() save8DChecker2 : Save8DChecker2,
        @Param('id' , ParseIntPipe) id: number,
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
    ) {
        return this.qprService.Save8DChecker2(id, save8DChecker2, actionBy);
    }

    @Put('8d-report/checker3/:id')
    @UseGuards(JwtAuthGuard)
    async eDReportChecker3(
        @Body() save8DChecker3 : Save8DChecker3,
        @Param('id' , ParseIntPipe) id: number,
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
    ) {
        return this.qprService.Save8DChecker3(id, save8DChecker3, actionBy);
    }

    @Put('8d-report/checker3-completed/:id')
    @UseGuards(JwtAuthGuard)
    async eDReportChecker3Completed(
        @Body() save8DChecker3 : Save8DChecker3,
        @Param('id' , ParseIntPipe) id: number,
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
    ) {
        return this.qprService.Save8DChecker3(id, save8DChecker3, actionBy, true);
    }

    
}
