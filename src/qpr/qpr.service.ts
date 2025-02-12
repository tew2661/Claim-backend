import { ActiveStatus } from './../users/entities/users.entity';
// src/qpr/qpr.service.ts
import { BadGatewayException, BadRequestException, Injectable, NotAcceptableException, NotFoundException } from '@nestjs/common';
import { CreateQprDto } from './dto/create-qpr.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Like, Repository } from 'typeorm';
import { QprEntity, ReportStatus } from './entities/qpr.entity';
import { UsersEntity } from 'src/users/entities/users.entity';
import { configPath } from 'src/path-files-config';
import { saveBase64File } from 'src/convert-base64-img';
import { GetQprDto } from './dto/get-qpr.dto';
import { SupplierEntity } from 'src/supplier/entities/supplier.entity';
import { MyGatewayGateway } from 'src/my-gateway/my-gateway.gateway';
import * as moment from 'moment';
import { Object8DReportDto, Save8DChecker1, Save8DChecker2, Save8DChecker3, SaveChecker1, SaveChecker2, SaveChecker3, SaveObjectQPR, Sketch, UploadSectionDto } from './dto/action-supplier.dto';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { extname, join } from 'node:path';
import { PDFDocument, PDFPage, degrees, rgb } from 'pdf-lib';
import * as fontkit from '@pdf-lib/fontkit';
import * as sharp from 'sharp';
import * as fs from 'fs';

@Injectable()
export class QprService {
    constructor(
        @InjectRepository(QprEntity)
        private readonly qprRepository: Repository<QprEntity>,
        @InjectRepository(SupplierEntity)
        private readonly supplierRepository: Repository<SupplierEntity>,
        private readonly myGatewayGateway: MyGatewayGateway
    ) { }
    async create(createQprDto: CreateQprDto, actionBy: UsersEntity): Promise<QprEntity> {
        const haveNo = await this.qprRepository.findOne({ where: { qprIssueNo: createQprDto.qprIssueNo, activeRow: ActiveStatus.YES } });
        if (haveNo) {
            throw new BadGatewayException(`เลข QPR Issue No : ${createQprDto.qprIssueNo} มีอยู่แล้ว`);
        }

        const haveSupplier = await this.supplierRepository.findOne({ where: { supplierCode: createQprDto.supplierCode, activeRow: ActiveStatus.YES } })
        if (!haveSupplier) {
            throw new BadGatewayException(`ไม่พบ SupplierCode : ${createQprDto.supplierCode} , หรือถูกปิดใช้งาน user นี้ `);
        }

        const figures = createQprDto.figures;
        const basePath = configPath.pathUploadQpr;
        if (createQprDto.figures) {
            if (figures.img1 && figures.img1.imageUrl && figures.img1.imageUrl.startsWith('data:')) {
                figures.img1.imageUrl = await saveBase64File(figures.img1.imageUrl, basePath, 'img1');
                // ไม่ส่ง file objectไปด้วย
                figures.img1.file = null;
            }
            if (figures.img2 && figures.img2.imageUrl && figures.img2.imageUrl.startsWith('data:')) {
                figures.img2.imageUrl = await saveBase64File(figures.img2.imageUrl, basePath, 'img2');
                figures.img2.file = null;
            }
            if (figures.img3 && figures.img3.imageUrl && figures.img3.imageUrl.startsWith('data:')) {
                figures.img3.imageUrl = await saveBase64File(figures.img3.imageUrl, basePath, 'img3');
                figures.img3.file = null;
            }
            if (figures.img4 && figures.img4.imageUrl && figures.img4.imageUrl.startsWith('data:')) {
                figures.img4.imageUrl = await saveBase64File(figures.img4.imageUrl, basePath, 'img4');
                figures.img4.file = null;
            }
        }
        const newQpr = this.qprRepository.create({
            ...createQprDto,
            supplier: haveSupplier,
            figures: {
                img1: figures.img1 && figures.img1.imageUrl ? figures.img1.imageUrl : null,
                img2: figures.img2 && figures.img2.imageUrl ? figures.img2.imageUrl : null,
                img3: figures.img3 && figures.img3.imageUrl ? figures.img3.imageUrl : null,
                img4: figures.img4 && figures.img4.imageUrl ? figures.img4.imageUrl : null,
            },
            createdBy: actionBy,
            updatedBy: actionBy,
            activeRow: ActiveStatus.YES
        });
        // บันทึกข้อมูลลงในฐานข้อมูลและคืนค่า entity ที่ถูกบันทึก
        const newValue = await this.qprRepository.save(newQpr);
        this.myGatewayGateway.sendMessage('create-qpr', newValue);
        return
    }

    async findId(id: number): Promise<QprEntity> {
        const data = await this.qprRepository.findOne({ 
            relations: ['supplier', 'createdBy'],
            where: { id , activeRow: ActiveStatus.YES } 
        });
        if (!data) {
            throw new NotAcceptableException(`ไม่พบเอกสาร id: ${id} อยู่ในระบบ`);
        }
        return data;
    }

    count(query: GetQprDto): Promise<number> {
        return this.qprRepository.count({
            where: {
                ...query.date ? {
                    dateReported: Between(
                        moment(moment(query.date).format('YYYY-MM-DD 00:00:00')).toDate(),
                        moment(moment(query.date).format('YYYY-MM-DD 23:59:59')).toDate(),
                    )
                } : {},
                ...query.qprNo ? { qprIssueNo: Like(`%${query.qprNo}%`) } : {},
                ...query.severity ? { importanceLevel: query.severity } : {},
                ...query.status && query.status == 'approved-quick-report' ? { quickReportStatus: ReportStatus.Approved } : {},
                ...query.status && query.status == 'wait-for-supplier-quick-report' ? { quickReportStatus: ReportStatus.WaitForSupplier } : {},
                ...query.status && query.status == 'rejected-quick-report' ? { quickReportStatus: ReportStatus.Rejected } : {},
                ...query.status && query.status == 'approved-8d-report' ? { eightDReportStatus: ReportStatus.Approved } : {},
                ...query.status && query.status == 'wait-for-supplier-8d-report' ? { eightDReportStatus: ReportStatus.WaitForSupplier } : {},
                ...query.status && query.status == 'rejected-8d-report' ? { eightDReportStatus: ReportStatus.Rejected } : {},
                ...query.page && query.page == '8d-report' ? { quickReportStatus: ReportStatus.Approved } : {},
                ...query.page && query.page == '8d-report' ? { delayDocument: "8D Report" } : {},
                ...query.page && query.page == 'qpr-report' ? { delayDocument: "Quick Report" } : {},
                ...query.supplier ? { supplier: { supplierCode: query.supplier } } : {},
                ...query.reportType && query.reportType == 'quick-report' ? { delayDocument: "Quick Report" } : {},
                ...query.reportType && query.reportType == '8d-report' ? { delayDocument: "8D Report" } : {},
                activeRow: ActiveStatus.YES,
            },
        });
    }

    findAll(query: GetQprDto): Promise<QprEntity[]> {
        return this.qprRepository.find({
            relations: ['supplier'],
            skip: query.offset,
            take: query.limit,
            where: {
                ...query.date ? {
                    dateReported: Between(
                        moment(moment(query.date).format('YYYY-MM-DD 00:00:00')).toDate(),
                        moment(moment(query.date).format('YYYY-MM-DD 23:59:59')).toDate(),
                    )
                } : {},
                ...query.qprNo ? { qprIssueNo: Like(`%${query.qprNo}%`) } : {},
                ...query.severity ? { importanceLevel: query.severity } : {},
                ...query.status && query.status == 'approved-quick-report' ? { quickReportStatus: ReportStatus.Approved } : {},
                ...query.status && query.status == 'wait-for-supplier-quick-report' ? { quickReportStatus: ReportStatus.WaitForSupplier } : {},
                ...query.status && query.status == 'rejected-quick-report' ? { quickReportStatus: ReportStatus.Rejected } : {},
                ...query.status && query.status == 'approved-8d-report' ? { eightDReportStatus: ReportStatus.Approved } : {},
                ...query.status && query.status == 'wait-for-supplier-8d-report' ? { eightDReportStatus: ReportStatus.WaitForSupplier } : {},
                ...query.status && query.status == 'rejected-8d-report' ? { eightDReportStatus: ReportStatus.Rejected } : {},
                ...query.page && query.page == '8d-report' ? { quickReportStatus: ReportStatus.Approved } : {},
                ...query.page && query.page == '8d-report' ? { delayDocument: "8D Report" } : {},
                ...query.page && query.page == 'qpr-report' ? { delayDocument: "Quick Report" } : {},
                ...query.supplier ? { supplier: { supplierCode: query.supplier } } : {},
                ...query.reportType && query.reportType == 'quick-report' ? { delayDocument: "Quick Report" } : {},
                ...query.reportType && query.reportType == '8d-report' ? { delayDocument: "8D Report" } : {},
                activeRow: ActiveStatus.YES,
            },
            order: {
                createdAt: 'DESC'
            }
        });
    }

    async SaveDraftObjectQPR(id: number, query: SaveObjectQPR[], actionBy: UsersEntity) {
        console.log('query', query);

        const check = await this.qprRepository.findOne({ where: { id, activeRow: ActiveStatus.YES } });

        if (!check) {
            throw new NotAcceptableException(`ไม่พบเอกสาร id: ${id} อยู่ในระบบ`);
        }

        const objectQPRSupplier = check.objectQPRSupplier || [];
        const existingDraft = objectQPRSupplier.find((item) => item.status === 'draft');

        // เช็คสถานะของ Quick Report
        if (check.quickReportStatus === ReportStatus.Approved) {
            throw new NotAcceptableException(`เอกสารนี้ถูก Approved แล้วโดย ${existingDraft?.actionBy}`);
        } else if (check.quickReportStatus === ReportStatus.Completed) {
            throw new NotAcceptableException(`เอกสารนี้ถูก Completed แล้วโดย ${existingDraft?.actionBy}`);
        } else if (check.quickReportStatus === ReportStatus.Rejected) {
            throw new NotAcceptableException(`เอกสารนี้ถูก Rejected แล้วโดย ${existingDraft?.actionBy}`);
        }

        // คำนวณ index ของ objectQPR ล่าสุด
        const arrObject = query.length - 1;
        const newSketches: Sketch[] = [];

        // อัปเดต sketches หากมีข้อมูลใหม่
        if (query[arrObject]?.objectQPR?.sketches?.length) {
            const basePath = configPath.pathUploadSupplierQpr;

            for (const fileObj of query[arrObject].objectQPR.sketches) {
                if (fileObj.file?.new && !fileObj.file?.delete) {
                    fileObj.file.file = await saveBase64File(fileObj.file.file, basePath, fileObj.file.name);
                    fileObj.file.new = false;
                    fileObj.file.edit = false;
                    newSketches.push(fileObj);
                } else if (fileObj.file?.edit && !fileObj.file?.delete) {
                    fileObj.file.file = await saveBase64File(fileObj.file.file, basePath, fileObj.file.name);
                    fileObj.file.new = false;
                    fileObj.file.edit = false;
                    newSketches.push(fileObj);
                } else if (!fileObj.file?.delete) {
                    newSketches.push(fileObj);
                }
            }
            query[arrObject].objectQPR.sketches = newSketches;
        }

        // ถ้ามี Draft อยู่แล้ว → อัปเดตข้อมูลตัวเดิม
        if (existingDraft) {
            Object.assign(existingDraft, query[arrObject], { actionBy: actionBy.name });
        } else {
            // ถ้าไม่มี → เพิ่มใหม่เข้าไป
            objectQPRSupplier.push({ ...query[arrObject], actionBy: actionBy.name, status: 'draft' });
        }

        // อัปเดตใน Database
        await this.qprRepository.update(id, {
            objectQPRSupplier: objectQPRSupplier,
            quickReportSupplierStatus: ReportStatus.Save,
            quickReportSupplierDate: new Date(),
            quickReportStatusChecker1: null,
            quickReportStatusChecker2: null,
            quickReportStatusChecker3: null,
            quickReportDateChecker1: null,
            quickReportDateChecker2: null,
            quickReportDateChecker3: null,
            eightDDateChecker1: null,
            eightDDateChecker2: null,
            eightDDateChecker3: null,
            eightDReportApprover: null,
            eightDReportDate: null,
            eightDReportStatus: null,
            eightDReportSupplierDate: null,
            eightDReportSupplierStatus: null,
            eightDStatusChecker1: null,
            eightDStatusChecker2: null,
            eightDStatusChecker3: null,
            updatedBy: actionBy,
        });
    }


    async SaveCompletedObjectQPR(id: number, query: SaveObjectQPR[], actionBy: UsersEntity) {
        const check = await this.qprRepository.findOne({ where: { id, activeRow: ActiveStatus.YES } });

        if (!check) {
            throw new NotAcceptableException(`ไม่พบเอกสาร id: ${id} อยู่ในระบบ`);
        }

        const objectQPRSupplier = check.objectQPRSupplier || [];
        const existingDraft = objectQPRSupplier.find((item) => item.status === 'draft');

        // ตรวจสอบสถานะของ Quick Report
        if (check.quickReportStatus === ReportStatus.Approved) {
            throw new NotAcceptableException(`เอกสารนี้ถูก Approved แล้วโดย ${existingDraft?.actionBy}`);
        } else if (check.quickReportStatus === ReportStatus.Completed) {
            throw new NotAcceptableException(`เอกสารนี้ถูก Completed แล้วโดย ${existingDraft?.actionBy}`);
        } else if (check.quickReportStatus === ReportStatus.Rejected) {
            throw new NotAcceptableException(`เอกสารนี้ถูก Rejected แล้วโดย ${existingDraft?.actionBy}`);
        }

        // คำนวณ index ของ objectQPR ล่าสุด
        const arrObject = query.length - 1;
        const newSketches: Sketch[] = [];

        // อัปเดต sketches หากมีข้อมูลใหม่
        if (query[arrObject]?.objectQPR?.sketches?.length) {
            const basePath = configPath.pathUploadSupplierQpr;

            for (const fileObj of query[arrObject].objectQPR.sketches) {
                if (fileObj.file?.new && !fileObj.file?.delete) {
                    fileObj.file.file = await saveBase64File(fileObj.file.file, basePath, fileObj.file.name);
                    fileObj.file.new = false;
                    fileObj.file.edit = false;
                    newSketches.push(fileObj);
                } else if (fileObj.file?.edit && !fileObj.file?.delete) {
                    fileObj.file.file = await saveBase64File(fileObj.file.file, basePath, fileObj.file.name);
                    fileObj.file.new = false;
                    fileObj.file.edit = false;
                    newSketches.push(fileObj);
                } else if (!fileObj.file?.delete) {
                    newSketches.push(fileObj);
                }
            }
            query[arrObject].objectQPR.sketches = newSketches;
        }

        // ถ้ามี Draft อยู่แล้ว → อัปเดตข้อมูลตัวเดิมและเปลี่ยนเป็น 'approve'
        if (existingDraft) {
            Object.assign(existingDraft, query[arrObject], { actionBy: actionBy.name, status: 'approve' });
        } else {
            // ถ้าไม่มี → เพิ่มใหม่เข้าไป
            objectQPRSupplier.push({ ...query[arrObject], actionBy: actionBy.name, status: 'approve' });
        }

        // อัปเดตข้อมูลใน Database
        await this.qprRepository.update(id, {
            objectQPRSupplier: objectQPRSupplier,
            status: ReportStatus.Inprocess,
            quickReportStatus: ReportStatus.Pending,
            quickReportDate: new Date(),
            quickReportSupplierStatus: ReportStatus.Approved,
            quickReportSupplierDate: new Date(),
            quickReportStatusChecker1: null,
            quickReportStatusChecker2: null,
            quickReportStatusChecker3: null,
            quickReportDateChecker1: null,
            quickReportDateChecker2: null,
            quickReportDateChecker3: null,
            eightDDateChecker1: null,
            eightDDateChecker2: null,
            eightDDateChecker3: null,
            eightDReportApprover: null,
            eightDReportDate: null,
            eightDReportStatus: null,
            eightDReportSupplierDate: null,
            eightDReportSupplierStatus: null,
            eightDStatusChecker1: null,
            eightDStatusChecker2: null,
            eightDStatusChecker3: null,
            updatedBy: actionBy,
        });
    }

    async SaveChecker1(id: number, body: SaveChecker1, actionBy: UsersEntity) {
        const check = await this.qprRepository.findOne({ where: { id, activeRow: ActiveStatus.YES } });

        if (!check.objectQPRSupplier || check.objectQPRSupplier.length == 0) {
            throw new NotAcceptableException(`ไม่พบข้อมูล id: ${id} อยู่ในระบบ`);
        }

        const arrObject = check.objectQPRSupplier.length - 1;

        await this.qprRepository.update(id, {
            objectQPRSupplier: check.objectQPRSupplier.map((arr: SaveObjectQPR, index) => {
                if (index == arrObject) return { ...arr, objectQPR: { ...arr.objectQPR , remark: body.remark } , checker1: { ...body, updatedBy: actionBy.name, updatedAt: moment().format('YYYY-MM-DD HH:mm:ss') } }
                else return arr
            }),
            status: ReportStatus.Inprocess,
            // quickReportStatus: ReportStatus.Pending,
            // quickReportDate: new Date(),
            ...body.approve == "reject" ? {
                quickReportSupplierStatus: ReportStatus.Rejected,
                quickReportSupplierDate: new Date(),
            } : {},
            quickReportStatusChecker1: body.approve == "approve" ? ReportStatus.Approved : ReportStatus.Rejected,
            quickReportDateChecker1: new Date(),
            updatedBy: actionBy
        })

    }

    async SaveChecker2(id: number, body: SaveChecker2, actionBy: UsersEntity) {
        const check = await this.qprRepository.findOne({ where: { id, activeRow: ActiveStatus.YES } });

        if (!check.objectQPRSupplier || check.objectQPRSupplier.length == 0) {
            throw new NotAcceptableException(`ไม่พบข้อมูล id: ${id} อยู่ในระบบ`);
        }

        const arrObject = check.objectQPRSupplier.length - 1;

        await this.qprRepository.update(id, {
            objectQPRSupplier: check.objectQPRSupplier.map((arr: SaveObjectQPR, index) => {
                if (index == arrObject) return { ...arr, objectQPR: { ...arr.objectQPR , remark: body.remark }, checker2: { ...body, updatedBy: actionBy.name, updatedAt: moment().format('YYYY-MM-DD HH:mm:ss') } }
                else return arr
            }),
            status: ReportStatus.Inprocess,
            // quickReportStatus: ReportStatus.Approved,
            // quickReportDate: new Date(),
            ...body.approve == "reject" ? {
                quickReportSupplierStatus: ReportStatus.Rejected,
                quickReportSupplierDate: new Date(),
            } : {},
            quickReportStatusChecker2: body.approve == "approve" ? ReportStatus.Approved : ReportStatus.Rejected,
            quickReportDateChecker2: new Date(),
            eightDReportApprover: body.eightDReportApprover,
            updatedBy: actionBy
        })

    }

    async SaveChecker3(id: number, body: SaveChecker3, actionBy: UsersEntity) {
        const check = await this.qprRepository.findOne({ where: { id, activeRow: ActiveStatus.YES } });

        if (!check.objectQPRSupplier || check.objectQPRSupplier.length == 0) {
            throw new NotAcceptableException(`ไม่พบข้อมูล id: ${id} อยู่ในระบบ`);
        }

        const arrObject = check.objectQPRSupplier.length - 1;

        await this.qprRepository.update(id, {
            objectQPRSupplier: check.objectQPRSupplier.map((arr: SaveObjectQPR, index) => {
                if (index == arrObject) return { ...arr, objectQPR: { ...arr.objectQPR , remark: body.remark }, checker3: { ...body, updatedBy: actionBy.name, updatedAt: moment().format('YYYY-MM-DD HH:mm:ss') } }
                else return arr
            }),
            status: ReportStatus.WaitForSupplier,
            
            // quickReportStatus: ReportStatus.Pending,
            // quickReportDate: new Date(),
            ...body.approve == "reject" ? {
                quickReportSupplierStatus: ReportStatus.Rejected,
                quickReportSupplierDate: new Date(),
                delayDocument: "Quick Report",
                quickReportStatus: ReportStatus.WaitForSupplier,
            } : {
                delayDocument: "8D Report",
                quickReportStatus: ReportStatus.Approved,
                quickReportDate: new Date(),
            },
            quickReportStatusChecker3: body.approve == "approve" ? ReportStatus.Approved : ReportStatus.Rejected,
            quickReportDateChecker3: new Date(),
            // eightDReportApprover: body.eightDReportApprover,

            eightDReportSupplierStatus: ReportStatus.Pending,
            eightDReportSupplierDate: new Date(),
            updatedBy: actionBy
        })

    }

    async SaveDraftObject8DReport(id: number, query: Object8DReportDto[], actionBy: UsersEntity) {
        const check = await this.qprRepository.findOne({ where: { id, activeRow: ActiveStatus.YES } });

        if (!check) {
            throw new NotAcceptableException(`ไม่พบเอกสาร id: ${id} อยู่ในระบบ`);
        }

        // คำนวณ index ของ objectQPR ล่าสุด
        const arrObject = query.length - 1;
        const newSketches: UploadSectionDto[] = [];

        const object8DReportDto = check.object8DReportDto || [];
        const existingDraft = object8DReportDto.find((item) => item.status === 'draft');
        const basePath = configPath.pathUploadSupplier8d;

         // เช็คสถานะของ Quick Report
        if (check.eightDReportStatus === ReportStatus.Approved) {
            throw new NotAcceptableException(`เอกสารนี้ถูก Approved แล้วโดย ${existingDraft?.actionBy}`);
        } else if (check.eightDReportStatus === ReportStatus.Completed) {
            throw new NotAcceptableException(`เอกสารนี้ถูก Completed แล้วโดย ${existingDraft?.actionBy}`);
        } else if (check.eightDReportStatus === ReportStatus.Rejected) {
            throw new NotAcceptableException(`เอกสารนี้ถูก Rejected แล้วโดย ${existingDraft?.actionBy}`);
        }

        // อัปเดต sketches หากมีข้อมูลใหม่
        if (query[arrObject]?.object8D.uploadSections.length) {
            for (const fileObj of query[arrObject].object8D.uploadSections) {
                console.log('fileObj.name' , fileObj.name)
                if ((fileObj?.new || fileObj?.edit) && !fileObj?.delete) {
                    fileObj.file = await saveBase64File(fileObj.file, basePath, fileObj.name);
                    fileObj.new = false;
                    fileObj.edit = false;
                    newSketches.push(fileObj);
                } else if (fileObj?.edit && !fileObj?.delete) {
                    fileObj.file = await saveBase64File(fileObj.file, basePath, fileObj.name);
                    fileObj.new = false;
                    fileObj.edit = false;
                    newSketches.push(fileObj);
                } else if (!fileObj?.delete) {
                    newSketches.push(fileObj);
                }
            }
            query[arrObject].object8D.uploadSections = newSketches;
        }

        if (query[arrObject].object8D.upload8DReport) {
            const currentFile = query[arrObject].object8D.upload8DReport.file;
            const _currentFile = check.object8DReportDto && 
                check.object8DReportDto.length && 
                check.object8DReportDto[arrObject].object8D && 
                check.object8DReportDto[arrObject].object8D.upload8DReport ? check.object8DReportDto[arrObject].object8D.upload8DReport.file : '' ; // ไฟล์ใหม่
            const currentFileName = query[arrObject].object8D.upload8DReport.name; // ชื่อไฟล์ใหม่
            const existingFilePath = join(__dirname, '..','..', ..._currentFile.split('/'));
            console.log(existingFilePath)
            // ตรวจสอบว่าไฟล์เดิมมีอยู่หรือไม่
            if (existsSync(_currentFile && existingFilePath)) {
                // ลบไฟล์เดิม
                unlinkSync(existingFilePath);
            }
        
            // บันทึกไฟล์ใหม่
            query[arrObject].object8D.upload8DReport = {
                ...query[arrObject].object8D.upload8DReport,
                file: await saveBase64File(currentFile, basePath, currentFileName),
            };
        }
        

        // ถ้ามี Draft อยู่แล้ว → อัปเดตข้อมูลตัวเดิม
        if (existingDraft) {
            Object.assign(existingDraft, query[arrObject], { actionBy: actionBy.name });
        } else {
            // ถ้าไม่มี → เพิ่มใหม่เข้าไป
            object8DReportDto.push({ ...query[arrObject], status: 'draft', actionBy: actionBy.name});
        }

        // อัปเดตใน Database
        await this.qprRepository.update(id, {
            object8DReportDto: object8DReportDto,
            eightDDateChecker1: null,
            eightDDateChecker2: null,
            eightDDateChecker3: null,
            eightDReportApprover: null,
            eightDReportDate: null,
            eightDReportStatus: null,
            eightDReportSupplierStatus: ReportStatus.Save,
            eightDReportSupplierDate: new Date(),
            eightDStatusChecker1: null,
            eightDStatusChecker2: null,
            eightDStatusChecker3: null,
            updatedBy: actionBy,
        });
    }

    async SaveCompletedObject8DReport(id: number, query: Object8DReportDto[], actionBy: UsersEntity) {
        const check = await this.qprRepository.findOne({ where: { id, activeRow: ActiveStatus.YES } });

        if (!check) {
            throw new NotAcceptableException(`ไม่พบเอกสาร id: ${id} อยู่ในระบบ`);
        }

        // คำนวณ index ของ objectQPR ล่าสุด
        const arrObject = query.length - 1;
        const newSketches: UploadSectionDto[] = [];

        const object8DReportDto = check.object8DReportDto || [];
        const existingDraft = object8DReportDto.find((item) => item.status === 'draft');
        const basePath = configPath.pathUploadSupplier8d;

         // เช็คสถานะของ Quick Report
        if (check.eightDReportStatus === ReportStatus.Approved) {
            throw new NotAcceptableException(`เอกสารนี้ถูก Approved แล้วโดย ${existingDraft?.actionBy}`);
        } else if (check.eightDReportStatus === ReportStatus.Completed) {
            throw new NotAcceptableException(`เอกสารนี้ถูก Completed แล้วโดย ${existingDraft?.actionBy}`);
        } else if (check.eightDReportStatus === ReportStatus.Rejected) {
            throw new NotAcceptableException(`เอกสารนี้ถูก Rejected แล้วโดย ${existingDraft?.actionBy}`);
        }

        // อัปเดต sketches หากมีข้อมูลใหม่
        if (query[arrObject]?.object8D.uploadSections.length) {
            for (const fileObj of query[arrObject].object8D.uploadSections) {
                if (fileObj?.new && !fileObj?.delete) {
                    fileObj.file = await saveBase64File(fileObj.file, basePath, fileObj.name);
                    fileObj.new = false;
                    fileObj.edit = false;
                    newSketches.push(fileObj);
                } else if (fileObj?.edit && !fileObj?.delete) {
                    fileObj.file = await saveBase64File(fileObj.file, basePath, fileObj.name);
                    fileObj.new = false;
                    fileObj.edit = false;
                    newSketches.push(fileObj);
                } else if (!fileObj?.delete) {
                    newSketches.push(fileObj);
                }
            }
            query[arrObject].object8D.uploadSections = newSketches;
        }

        if (query[arrObject].object8D.upload8DReport) {
            query[arrObject].object8D.upload8DReport = {
                ...query[arrObject].object8D.upload8DReport,
                file: await saveBase64File(query[arrObject].object8D.upload8DReport.file, basePath, query[arrObject].object8D.upload8DReport.name),
            }
        }

        // ถ้ามี Draft อยู่แล้ว → อัปเดตข้อมูลตัวเดิม
        if (existingDraft) {
            Object.assign(existingDraft, query[arrObject], { actionBy: actionBy.name , status: 'approve' });
        } else {
            // ถ้าไม่มี → เพิ่มใหม่เข้าไป
            object8DReportDto.push({ ...query[arrObject], actionBy: actionBy.name, status: 'approve' });
        }

        // อัปเดตใน Database
        await this.qprRepository.update(id, {
            object8DReportDto: object8DReportDto,
            eightDDateChecker1: null,
            eightDDateChecker2: null,
            eightDDateChecker3: null,
            eightDReportApprover: null,
            eightDReportDate: new Date(),
            eightDReportStatus: ReportStatus.Pending,
            eightDReportSupplierStatus: ReportStatus.Approved,
            eightDReportSupplierDate: new Date(),
            eightDStatusChecker1: null,
            eightDStatusChecker2: null,
            eightDStatusChecker3: null,
            status: ReportStatus.Inprocess,
            updatedBy: actionBy,
        });
    }

    async Save8DChecker1(id: number, body: Save8DChecker1, actionBy: UsersEntity) {
        const check = await this.qprRepository.findOne({ where: { id, activeRow: ActiveStatus.YES } });

        if (!check.object8DReportDto || check.object8DReportDto.length == 0) {
            throw new NotAcceptableException(`ไม่พบข้อมูล id: ${id} อยู่ในระบบ`);
        }

        const arrObject = check.object8DReportDto.length - 1;

        let _status = 'approve';
        if (body.documentOther.filter((x) => x.approve == 'reject').length > 0) {
            console.log(1)
            _status = 'reject';
        } else if (body.approve == 'reject') {
            console.log(2)
            _status = 'reject';
        } else if (body.reqDocumentOther) {
            console.log(3)
            _status = 'reject';
        } else if (body.dueDateReqDocumentOther) {
            console.log(4)
            _status = 'reject';
        }

        console.log('_status , checker 1 , 8d' , _status , body)

        await this.qprRepository.update(id, {
            object8DReportDto: check.object8DReportDto.map((arr: Object8DReportDto, index) => {
                if (index == arrObject) return { 
                    ...arr, 
                    object8D: { ...arr.object8D , remark: body.remark } , 
                    checker1: { ...body, updatedBy: actionBy.name, updatedAt: moment().format('YYYY-MM-DD HH:mm:ss') } 
                }
                else return arr
            }),
            status: ReportStatus.Inprocess,
            // quickReportStatus: ReportStatus.Pending,
            // quickReportDate: new Date(),
            ..._status == "reject" ? {
                eightDReportSupplierStatus: ReportStatus.Rejected,
                eightDReportSupplierDate: new Date(),
            } : {},
            eightDStatusChecker1: _status == "approve" ? ReportStatus.Approved : ReportStatus.Rejected,
            eightDDateChecker1: new Date(),
            updatedBy: actionBy
        })

    }

    async Save8DChecker2(id: number, body: Save8DChecker2, actionBy: UsersEntity) {
        const check = await this.qprRepository.findOne({ where: { id, activeRow: ActiveStatus.YES } });

        if (!check.object8DReportDto || check.object8DReportDto.length == 0) {
            throw new NotAcceptableException(`ไม่พบข้อมูล id: ${id} อยู่ในระบบ`);
        }

        const arrObject = check.object8DReportDto.length - 1;

        let _status = 'approve';
        if (body.documentOther.filter((x) => x.approve == 'reject').length > 0) {
            _status = 'reject';
        } else if (body.approve == 'reject') {
            _status = 'reject';
        } else if (body.reqDocumentOther) {
            _status = 'reject';
        } else if (body.dueDateReqDocumentOther) {
            _status = 'reject';
        }

        await this.qprRepository.update(id, {
            object8DReportDto: check.object8DReportDto.map((arr: Object8DReportDto, index) => {
                if (index == arrObject) return { 
                    ...arr, 
                    object8D: { 
                        ...arr.object8D , 
                        remark: body.remark 
                    }, 
                    checker2: { 
                        ...body, 
                        updatedBy: actionBy.name, 
                        updatedAt: moment().format('YYYY-MM-DD HH:mm:ss') 
                    } 
                }
                else return arr
            }),
            status: ReportStatus.Inprocess,
            // quickReportStatus: ReportStatus.Approved,
            // quickReportDate: new Date(),
            ..._status == "reject" ? {
                eightDReportSupplierStatus: ReportStatus.Rejected,
                eightDReportSupplierDate: new Date(),
            } : {},
            eightDStatusChecker2: _status == "approve" ? ReportStatus.Approved : ReportStatus.Rejected,
            eightDDateChecker2: new Date(),
            updatedBy: actionBy
        })

    }

    async Save8DChecker3(id: number, body: Save8DChecker3, actionBy: UsersEntity, completed: boolean = false) {
        const check = await this.qprRepository.findOne({ where: { id, activeRow: ActiveStatus.YES } });

        if (!check.object8DReportDto || check.object8DReportDto.length == 0) {
            throw new NotAcceptableException(`ไม่พบข้อมูล id: ${id} อยู่ในระบบ`);
        }

        const arrObject = check.object8DReportDto.length - 1;

        let _status = 'approve';
        if (body.documentOther.filter((x) => x.approve == 'reject').length > 0) {
            _status = 'reject';
        } else if (body.approve == 'reject') {
            _status = 'reject';
        } else if (body.reqDocumentOther) {
            _status = 'reject';
        } else if (body.dueDateReqDocumentOther) {
            _status = 'reject';
        }

        await this.qprRepository.update(id, {
            object8DReportDto: check.object8DReportDto.map((arr: Object8DReportDto, index) => {
                if (index == arrObject) return { 
                    ...arr, 
                    object8D: { 
                        ...arr.object8D , 
                        remark: body.remark 
                    }, 
                    checker3: { 
                        ...body, 
                        updatedBy: actionBy.name, 
                        updatedAt: moment().format('YYYY-MM-DD HH:mm:ss') 
                    } 
                }
                else return arr
            }),
            
            // quickReportStatus: ReportStatus.Pending,
            // quickReportDate: new Date(),
            ..._status == "reject" ? {
                status: ReportStatus.WaitForSupplier,
                eightDReportSupplierStatus: ReportStatus.Rejected,
                eightDReportSupplierDate: new Date(),
                delayDocument: "8D Report",
                eightDReportStatus: ReportStatus.Pending,
                eightDStatusChecker3: ReportStatus.Pending,
                eightDDateChecker3: new Date(),
            } : {
                delayDocument: "8D Report",
                eightDReportStatus: completed ? ReportStatus.Completed : ReportStatus.Approved,
                eightDReportDate: new Date(),
                status: completed ? ReportStatus.Completed : ReportStatus.Approved,

                eightDStatusChecker3: completed ? ReportStatus.Completed : ReportStatus.Approved,
                eightDDateChecker3: new Date(),
            },
            
            updatedBy: actionBy
        })

    }

    async PdfView(data: QprEntity, actionBy: UsersEntity, View: boolean = false) {
        const templatePath = join(__dirname, '..', '..', '/files-templates/qpr-12-020-68.pdf');
        const pdfBytes = readFileSync(templatePath);

        const oldPdfDoc = await PDFDocument.load(pdfBytes);
        const pdfDoc = await PDFDocument.create();

        const [newTemplatePage] = await pdfDoc.copyPages(oldPdfDoc, [0]);
        pdfDoc.addPage(newTemplatePage);

        pdfDoc.setTitle(`${data.qprIssueNo || '-'}`);      // Set the title of the PDF
        pdfDoc.setAuthor(`${[...new Set([data.createdBy && data.createdBy.name ? data.createdBy.name : ''])].join(',')}`);               // Optionally set the author
        pdfDoc.setSubject('Claim System Specifications');     // Optionally set the subject
        pdfDoc.setKeywords(['QPR', 'Claim System']); // Optionally set keywords
        pdfDoc.setProducer(`Claim System [ ${data.createdBy && data.createdBy.name ? data.createdBy.name : ''} ]`);               // Optionally set the producer
        pdfDoc.setCreationDate(new Date());          // Optionally set the creation date
        pdfDoc.registerFontkit(fontkit);

        const fontBytes = readFileSync(join(__dirname, '..', '..', '/files-templates/fonts/NotoSansThai-Medium.ttf'));
        const font = await pdfDoc.embedFont(fontBytes);

        const iconBytes = readFileSync(join(__dirname, '..', '..', '/files-templates/icon/check-mark.png'));  // Path to your PNG file
        const iconImage = await pdfDoc.embedPng(iconBytes);         // Embed the PNG image

        const page = pdfDoc.getPage(0);

       

        page.drawText(data.qprIssueNo, {
            x: 485,
            y: 777,
            size: 7,
            font,
            color: rgb(0, 0, 0),
        });

        page.drawText(data.occurrenceDate ? moment(data.occurrenceDate).format('DD MMMM YYYY'): '', {
            x: 485,
            y: 760,
            size: 7,
            font,
            color: rgb(0, 0, 0),
        });

        page.drawText(data.dateReported ? moment(data.dateReported).format('DD MMMM YYYY'): '', {
            x: 485,
            y: 745,
            size: 7,
            font,
            color: rgb(0, 0, 0),
        });

        page.drawText(data.replyQuickAction ? moment(data.replyQuickAction).format('DD MMMM YYYY'): '', {
            x: 485,
            y: 730,
            size: 7,
            font,
            color: rgb(0, 0, 0),
        });

        page.drawText(data.replyReport ? moment(data.replyReport).format('DD MMMM YYYY'): '', {
            x: 485,
            y: 715,
            size: 7,
            font,
            color: rgb(0, 0, 0),
        });

        page.drawText(data.partName ? data.partName: '', {
            x: 125,
            y: 745,
            size: 7,
            font,
            color: rgb(0, 0, 0),
        });

        page.drawText(data.partNo ? data.partNo: '', {
            x: 125,
            y: 730,
            size: 7,
            font,
            color: rgb(0, 0, 0),
        });

        page.drawText(data.when ? data.when: '', {
            x: 125,
            y: 715,
            size: 7,
            font,
            color: rgb(0, 0, 0),
        });

        page.drawText(data.supplier && data.supplier.supplierName ? data.supplier.supplierName : '', {
            x: 300,
            y: 745,
            size: 7,
            font,
            color: rgb(0, 0, 0),
        });

        page.drawText(data.model ? data.model : '', {
            x: 300,
            y: 730,
            size: 7,
            font,
            color: rgb(0, 0, 0),
        });

        page.drawText(data.who ? data.who : '', {
            x: 300,
            y: 715,
            size: 7,
            font,
            color: rgb(0, 0, 0),
        });

        if (data.whereFound && data.whereFound.receiving) {
            page.drawImage(iconImage, {
                x: 110,   // X-coordinate for the image
                y: 702,  // Y-coordinate for the image
                width: 10,  // Scale the icon width
                height: 10, // Scale the icon height
            });

            page.drawText(data.whereFound && data.whereFound.receivingDetails ? data.whereFound.receivingDetails : '', {
                x: 170,
                y: 702,
                size: 7,
                font,
                color: rgb(0, 0, 0),
            });
        }

        if (data.whereFound && data.whereFound.fg) {
            page.drawImage(iconImage, {
                x: 255,   // X-coordinate for the image
                y: 702,  // Y-coordinate for the image
                width: 10,  // Scale the icon width
                height: 10, // Scale the icon height
            });

            page.drawText(data.whereFound && data.whereFound.fgDetails ? data.whereFound.fgDetails : '', {
                x: 300,
                y: 702,
                size: 7,
                font,
                color: rgb(0, 0, 0),
            });
        }

        if (data.whereFound && data.whereFound.wh) {
            page.drawImage(iconImage, {
                x: 255,   // X-coordinate for the image
                y: 688,  // Y-coordinate for the image
                width: 10,  // Scale the icon width
                height: 10, // Scale the icon height
            });

            page.drawText(data.whereFound && data.whereFound.whDetails ? data.whereFound.whDetails : '', {
                x: 300,
                y: 688,
                size: 7,
                font,
                color: rgb(0, 0, 0),
            });
        }

        if (data.whereFound && data.whereFound.warrantyClaim) {
            page.drawImage(iconImage, {
                x: 255,   // X-coordinate for the image
                y: 674,  // Y-coordinate for the image
                width: 10,  // Scale the icon width
                height: 10, // Scale the icon height
            });

            page.drawText(data.whereFound && data.whereFound.warrantyClaimDetails ? data.whereFound.warrantyClaimDetails : '', {
                x: 350,
                y: 674,
                size: 7,
                font,
                color: rgb(0, 0, 0),
            });
        }

        if (data.whereFound && data.whereFound.inprocess) {
            page.drawImage(iconImage, {
                x: 46,   // X-coordinate for the image
                y: 688,  // Y-coordinate for the image
                width: 10,  // Scale the icon width
                height: 10, // Scale the icon height
            });

            page.drawText(data.whereFound && data.whereFound.inprocessDetails ? data.whereFound.inprocessDetails : '', {
                x: 110,
                y: 688,
                size: 7,
                font,
                color: rgb(0, 0, 0),
            });
        }

        if (data.whereFound && data.whereFound.customerClaim) {
            page.drawImage(iconImage, {
                x: 46,   // X-coordinate for the image
                y: 674,  // Y-coordinate for the image
                width: 10,  // Scale the icon width
                height: 10, // Scale the icon height
            });

            page.drawText(data.whereFound && data.whereFound.customerClaimDetails ? data.whereFound.customerClaimDetails : '', {
                x: 190,
                y: 674,
                size: 7,
                font,
                color: rgb(0, 0, 0),
            });
        }

        if (data.whereFound && data.whereFound.other) {
            page.drawImage(iconImage, {
                x: 46,   // X-coordinate for the image
                y: 660,  // Y-coordinate for the image
                width: 10,  // Scale the icon width
                height: 10, // Scale the icon height
            });

            page.drawText(data.whereFound && data.whereFound.otherDetails ? data.whereFound.otherDetails : '', {
                x: 90,
                y: 660,
                size: 7,
                font,
                color: rgb(0, 0, 0),
            });
        }

        if (data.importanceLevel == 'SP') {
            page.drawImage(iconImage, {
                x: 435,   // X-coordinate for the image
                y: 688,  // Y-coordinate for the image
                width: 10,  // Scale the icon width
                height: 10, // Scale the icon height
            });
        }

        if (data.importanceLevel == 'A') {
            page.drawImage(iconImage, {
                x: 464,   // X-coordinate for the image
                y: 688,  // Y-coordinate for the image
                width: 10,  // Scale the icon width
                height: 10, // Scale the icon height
            });
        }

        if (data.importanceLevel == 'B') {
            page.drawImage(iconImage, {
                x: 485,   // X-coordinate for the image
                y: 688,  // Y-coordinate for the image
                width: 10,  // Scale the icon width
                height: 10, // Scale the icon height
            });
        }

        if (data.importanceLevel == 'C') {
            page.drawImage(iconImage, {
                x: 504,   // X-coordinate for the image
                y: 688,  // Y-coordinate for the image
                width: 10,  // Scale the icon width
                height: 10, // Scale the icon height
            });
        }

        if (data.urgent) {
            page.drawImage(iconImage, {
                x: 524,   // X-coordinate for the image
                y: 688,  // Y-coordinate for the image
                width: 10,  // Scale the icon width
                height: 10, // Scale the icon height
            });
        }

        if (data.frequency && data.frequency.firstDefective) {
            page.drawImage(iconImage, {
                x: 534,   // X-coordinate for the image
                y: 642,  // Y-coordinate for the image
                width: 10,  // Scale the icon width
                height: 10, // Scale the icon height
            });
        }

        if (data.frequency && data.frequency.reoccurrence) {
            page.drawImage(iconImage, {
                x: 534,   // X-coordinate for the image
                y: 630,  // Y-coordinate for the image
                width: 10,  // Scale the icon width
                height: 10, // Scale the icon height
            });
        }

        if (data.frequency && data.frequency.chronicDisease) {
            page.drawImage(iconImage, {
                x: 534,   // X-coordinate for the image
                y: 615,  // Y-coordinate for the image
                width: 10,  // Scale the icon width
                height: 10, // Scale the icon height
            });
        }

        if (data.defect && data.defect.dimension) {
            page.drawImage(iconImage, {
                x: 83,   // X-coordinate for the image
                y: 642,  // Y-coordinate for the image
                width: 10,  // Scale the icon width
                height: 10, // Scale the icon height
            });
        }

        if (data.defect && data.defect.material) {
            page.drawImage(iconImage, {
                x: 137,   // X-coordinate for the image
                y: 642,  // Y-coordinate for the image
                width: 10,  // Scale the icon width
                height: 10, // Scale the icon height
            });
        }

        if (data.defect && data.defect.appearance) {
            page.drawImage(iconImage, {
                x: 187,   // X-coordinate for the image
                y: 642,  // Y-coordinate for the image
                width: 10,  // Scale the icon width
                height: 10, // Scale the icon height
            });
        }

        if (data.defect && data.defect.characteristics) {
            page.drawImage(iconImage, {
                x: 250,   // X-coordinate for the image
                y: 642,  // Y-coordinate for the image
                width: 10,  // Scale the icon width
                height: 10, // Scale the icon height
            });
        }

        if (data.defect && data.defect.other) {
            page.drawImage(iconImage, {
                x: 330,   // X-coordinate for the image
                y: 642,  // Y-coordinate for the image
                width: 10,  // Scale the icon width
                height: 10, // Scale the icon height
            });

            page.drawText(data.defect && data.defect.otherDetails ? data.defect.otherDetails : '', {
                x: 370,
                y: 647,
                size: 7,
                font,
                color: rgb(0, 0, 0),
            });
        }

        if (data.state == 'New Model') { // Mass Production  Service
            page.drawImage(iconImage, {
                x: 46,   // X-coordinate for the image
                y: 615,  // Y-coordinate for the image
                width: 10,  // Scale the icon width
                height: 10, // Scale the icon height
            });
        }

        if (data.state == 'Mass Production') { // Mass Production  Service
            page.drawImage(iconImage, {
                x: 160,   // X-coordinate for the image
                y: 615,  // Y-coordinate for the image
                width: 10,  // Scale the icon width
                height: 10, // Scale the icon height
            });
        }

        if (data.state == 'Service') { // Mass Production  Service
            page.drawImage(iconImage, {
                x: 290,   // X-coordinate for the image
                y: 615,  // Y-coordinate for the image
                width: 10,  // Scale the icon width
                height: 10, // Scale the icon height
            });
        }

        if (data.defectiveContents && data.defectiveContents.problemCase) { // Mass Production  Service
            page.drawText(data.defectiveContents && data.defectiveContents.problemCase ? data.defectiveContents.problemCase : '', {
                x: 175,
                y: 567,
                size: 7,
                font,
                color: rgb(0, 0, 0),
            });
        }

        if (data.defectiveContents && data.defectiveContents.specification) { // Mass Production  Service
            page.drawText(data.defectiveContents && data.defectiveContents.specification ? data.defectiveContents.specification : '', {
                x: 175,
                y: 550,
                size: 7,
                font,
                color: rgb(0, 0, 0),
            });
        }

        if (data.defectiveContents && data.defectiveContents.action) { // Mass Production  Service
            page.drawText(data.defectiveContents && data.defectiveContents.action ? data.defectiveContents.action : '', {
                x: 175,
                y: 533,
                size: 7,
                font,
                color: rgb(0, 0, 0),
            });
        }

        if (data.defectiveContents && data.defectiveContents.ngEffective) { // Mass Production  Service
            page.drawText(data.defectiveContents && data.defectiveContents.ngEffective ? data.defectiveContents.ngEffective : '', {
                x: 175,
                y: 516,
                size: 7,
                font,
                color: rgb(0, 0, 0),
            });
        }

        if (data.defectiveContents && data.defectiveContents.lot) { // Mass Production  Service
            page.drawText(data.defectiveContents && data.defectiveContents.lot ? data.defectiveContents.lot : '', {
                x: 175,
                y: 499,
                size: 7,
                font,
                color: rgb(0, 0, 0),
            });
        }

        if (data.figures && data.figures.img2) {
            const pathFigures = join(__dirname, '..', '..', ...`${data.figures.img2}`.split('/'))
            if (existsSync(pathFigures)) {
                const iconBytes: Buffer = await this.ConvertImageToJPG(pathFigures)
                const iconImage = await pdfDoc.embedJpg(iconBytes);   
                page.drawImage(iconImage, {
                    x: 90,   // X-coordinate for the image
                    y: 320,  // Y-coordinate for the image
                    width: 120,  // Scale the icon width
                    height: 120, // Scale the icon height
                });
            } 
        }

        if (data.figures && data.figures.img3) {
            const pathFigures = join(__dirname, '..', '..', ...`${data.figures.img3}`.split('/'))
            if (existsSync(pathFigures)) {
                const iconBytes: Buffer = await this.ConvertImageToJPG(pathFigures)
                const iconImage = await pdfDoc.embedJpg(iconBytes);   
                page.drawImage(iconImage, {
                    x: 90 + 160,   // X-coordinate for the image
                    y: 320,  // Y-coordinate for the image
                    width: 120,  // Scale the icon width
                    height: 120, // Scale the icon height
                });
            } 
        }

        if (data.figures && data.figures.img4) {
            const pathFigures = join(__dirname, '..', '..', ...`${data.figures.img4}`.split('/'))
            if (existsSync(pathFigures)) {
                const iconBytes: Buffer = await this.ConvertImageToJPG(pathFigures)
                const iconImage = await pdfDoc.embedJpg(iconBytes);   
                page.drawImage(iconImage, {
                    x: 90 + 160 + 160,   // X-coordinate for the image
                    y: 340,  // Y-coordinate for the image
                    width: 120,  // Scale the icon width
                    height: 120, // Scale the icon height
                });
            } 
        }

        if (data.figures && data.figures.img1) {
            const pathFigures = join(__dirname, '..', '..', ...`${data.figures.img1}`.split('/'))
            if (existsSync(pathFigures)) {
                const iconBytes: Buffer = await this.ConvertImageToJPG(pathFigures)
                const iconImage = await pdfDoc.embedJpg(iconBytes);   
                page.drawImage(iconImage, {
                    x: 90 + 160 + 160,   // X-coordinate for the image
                    y: 450,  // Y-coordinate for the image
                    width: 120,  // Scale the icon width
                    height: 120, // Scale the icon height
                    opacity: 0.8, 
                });
            } 
        }

        if (data.createdBy && data.createdBy.name) { // Mass Production  Service
            const createdBy = data.createdBy.name ? data.createdBy.name : ''

            this.DrawTextWithWrapping({
                page,
                text: `${createdBy || ''}`,
                x: 340,
                y: 555,
                size: 7,
                font,
                color: rgb(0, 0, 0),
                maxWidth: 60,
                lineHeight: 10
            });
        }

        // objectQPRSupplier actionDetail

        if (data.objectQPRSupplier && data.objectQPRSupplier.length > 0) {
            const objectQPRSupplierNow = data.objectQPRSupplier[data.objectQPRSupplier.length - 1];
            const objectQPR = objectQPRSupplierNow && objectQPRSupplierNow.objectQPR ? objectQPRSupplierNow.objectQPR : undefined;
            const checker1 = objectQPRSupplierNow && objectQPRSupplierNow.checker1 ? objectQPRSupplierNow.checker1 : undefined
            const checker2 = objectQPRSupplierNow && objectQPRSupplierNow.checker2 ? objectQPRSupplierNow.checker2 : undefined
            const checker3 = objectQPRSupplierNow && objectQPRSupplierNow.checker3 ? objectQPRSupplierNow.checker3 : undefined

            if (objectQPR?.actionDetail) { // Mass Production  Service
                const actionDetail = objectQPR.actionDetail
    
                this.DrawTextWithWrapping({
                    page,
                    text: `${actionDetail}`,
                    x: 50,
                    y: 263,
                    size: 7,
                    font,
                    color: rgb(0, 0, 0),
                    maxWidth: 250,
                    lineHeight: 16
                });
            }

            if (objectQPR?.date) { // Mass Production  Service
                page.drawText(objectQPR.date ? moment(objectQPR.date).format('DD MMMM YYYY') : '', {
                    x: 70,
                    y: 191,
                    size: 7,
                    font,
                    color: rgb(0, 0, 0),
                });
            }

            if (objectQPR?.time) { // Mass Production  Service
                page.drawText(objectQPR.time ? objectQPR.time : '', {
                    x: 70,
                    y: 177,
                    size: 7,
                    font,
                    color: rgb(0, 0, 0),
                });
            }

            if (objectQPR?.quantity) { // Mass Production  Service
                page.drawText(`${objectQPR.quantity ? objectQPR.quantity : ''}`, {
                    x: 70,
                    y: 163,
                    size: 7,
                    font,
                    color: rgb(0, 0, 0),
                });
            }

            if (objectQPR?.contactPerson) { // Mass Production  Service
                this.DrawTextWithWrapping({
                    page,
                    text: `${objectQPR.contactPerson || ''}`,
                    x: 505,
                    y: 268,
                    size: 7,
                    font,
                    color: rgb(0, 0, 0),
                    maxWidth: 60,
                    lineHeight: 8
                });
            }

            if (objectQPR?.sketches && objectQPR.sketches.length) {
                if (objectQPR.sketches[0] && objectQPR.sketches[0].file && objectQPR.sketches[0].file.file) {
                    const pathFigures = join(__dirname, '..', '..', ...`${objectQPR.sketches[0].file.file}`.split('/'))
                    if (existsSync(pathFigures)) {
                        const iconBytes: Buffer = await this.ConvertImageToJPG(pathFigures)
                        const iconImage = await pdfDoc.embedJpg(iconBytes);   
                        page.drawImage(iconImage, {
                            x: 320,   // X-coordinate for the image
                            y: 170,  // Y-coordinate for the image
                            width: 70,  // Scale the icon width
                            height: 70, // Scale the icon height
                            opacity: 0.8, 
                        });
                    } 
                }

                if (objectQPR.sketches[1] && objectQPR.sketches[1].file && objectQPR.sketches[1].file.file) {
                    const pathFigures = join(__dirname, '..', '..', ...`${objectQPR.sketches[1].file.file}`.split('/'))
                    if (existsSync(pathFigures)) {
                        const iconBytes: Buffer = await this.ConvertImageToJPG(pathFigures)
                        const iconImage = await pdfDoc.embedJpg(iconBytes);   
                        page.drawImage(iconImage, {
                            x: 320 + 80,   // X-coordinate for the image
                            y: 170,  // Y-coordinate for the image
                            width: 70,  // Scale the icon width
                            height: 70, // Scale the icon height
                            opacity: 0.8, 
                        });
                    } 
                }

                if (objectQPR.sketches[2] && objectQPR.sketches[2].file && objectQPR.sketches[2].file.file) {
                    const pathFigures = join(__dirname, '..', '..', ...`${objectQPR.sketches[2].file.file}`.split('/'))
                    if (existsSync(pathFigures)) {
                        const iconBytes: Buffer = await this.ConvertImageToJPG(pathFigures)
                        const iconImage = await pdfDoc.embedJpg(iconBytes);   
                        page.drawImage(iconImage, {
                            x: 320 + 80 + 80,   // X-coordinate for the image
                            y: 170,  // Y-coordinate for the image
                            width: 70,  // Scale the icon width
                            height: 70, // Scale the icon height
                            opacity: 0.8, 
                        });
                    } 
                }
            }

            if (checker1?.claim) {
                page.drawImage(iconImage, {
                    x: 78,
                    y: 140,
                    width: 10,  // Scale the icon width
                    height: 10, // Scale the icon height
                });
            }

            if (checker1?.complain) {
                page.drawImage(iconImage, {
                    x: 78,
                    y: 115,
                    width: 10,  // Scale the icon width
                    height: 10, // Scale the icon height
                });
            }

            if (checker1?.updatedBy) { // Mass Production  Service
                const updatedBy = checker1.updatedBy
    
                this.DrawTextWithWrapping({
                    page,
                    text: `${updatedBy}`,
                    x: 513,
                    y: 135,
                    size: 7,
                    font,
                    color: rgb(0, 0, 0),
                    maxWidth: 250,
                    lineHeight: 16
                });
            }

            if (checker2?.updatedBy) { // Mass Production  Service
                const updatedBy = checker2.updatedBy
    
                this.DrawTextWithWrapping({
                    page,
                    text: `${updatedBy}`,
                    x: 445,
                    y: 135,
                    size: 7,
                    font,
                    color: rgb(0, 0, 0),
                    maxWidth: 250,
                    lineHeight: 16
                });
            }

            if (checker3?.updatedBy) { // Mass Production  Service
                const updatedBy = checker3.updatedBy
    
                this.DrawTextWithWrapping({
                    page,
                    text: `${updatedBy}`,
                    x: 383,
                    y: 135,
                    size: 7,
                    font,
                    color: rgb(0, 0, 0),
                    maxWidth: 250,
                    lineHeight: 16
                });
            }

        }


        if (View) {
            page.drawText('View', {
                x: page.getWidth() / 3,    // X-coordinate (adjust as needed)
                y: page.getHeight() / 3,   // Y-coordinate (adjust as needed)
                size: 150,        // Font size
                font,
                color: rgb(0.75, 0.75, 0.75), // Light grey color
                rotate: degrees(45),       // Rotate the text to a 45-degree angle
                opacity: 0.5,                 // Set the opacity for transparency
            });
        }
        
        const pdfBytesOutput = await pdfDoc.save();
        return pdfBytesOutput;
    }

    ConvertImageToJPG = async (pathFigures : string): Promise<Buffer> => {
        const fileExt = extname(pathFigures).toLowerCase();
        let iconBytes: Buffer;

        // 🔹 แปลงภาพเป็น JPG ก่อน (หากไม่ใช่ JPG)
        if (fileExt !== '.jpg' && fileExt !== '.jpeg') {
            iconBytes = await sharp(pathFigures).jpeg().toBuffer(); // แปลงเป็น JPG
        } else {
            iconBytes = readFileSync(pathFigures); // ถ้าเป็น JPG อยู่แล้ว อ่านไฟล์ตรงๆ
        }

        return iconBytes;
    }

    DrawTextWithWrapping({
        page,
        text,
        x,
        y, // Coordinates for the description box
        size,
        font,
        color,
        maxWidth,
        lineHeight,
    }: {
        page: PDFPage,            // The PDF page where text is drawn
        text: string,         // The text to be drawn
        x: number,            // The x-coordinate for drawing the text
        y: number,            // The starting y-coordinate for drawing the text
        font: any,            // The embedded font object
        size: number,     // The size of the font
        maxWidth: number,     // Maximum width for a single line in pixels
        lineHeight: number,   // Height between lines
        color: any            // Color for the text (e.g., rgb(0,0,0))
    }) {
        const words = text.split(' ');  // Split the text into words
        let line = '';                  // Current line of text

        for (const word of words) {
            const lineWidth = font.widthOfTextAtSize(line + word + ' ', size);

            // Check if the line exceeds the max width
            if (lineWidth > maxWidth) {
                // Draw the current line
                page.drawText(line, {
                    x: x,
                    y: y,
                    size: size,
                    font: font,
                    color: color,
                });

                // Move to the next line by decreasing the y-coordinate
                y -= lineHeight;

                // Start a new line with the current word
                line = word + ' ';
            } else {
                // Add the word to the current line
                line += word + ' ';
            }
        }

        // Draw the last line if any text remains
        if (line.trim()) {
            page.drawText(line.trim(), {
                x: x,
                y: y,
                size: size,
                font: font,
                color: color,
            });
        }
    }

    async ViewFile8D(id: number) {
        try {
            const data = await this.findId(id);
            let object8DReportDto = data?.object8DReportDto && data?.object8DReportDto.length ? data?.object8DReportDto[data?.object8DReportDto.length - 1] : undefined
            if (object8DReportDto && object8DReportDto.object8D && object8DReportDto.object8D.upload8DReport && object8DReportDto.object8D.upload8DReport.file) {
                const file8D = object8DReportDto.object8D.upload8DReport;
                if (file8D.file) {
                    const pathFile = join(__dirname, '..', '..', file8D.file)
                    if (!fs.existsSync(pathFile)) {
                        console.log(`File: ${file8D.name} not found at path: ${pathFile}`);
                        throw new NotFoundException(`File: ${file8D.name} not found.`);
                    }
        
                    let pdfBytes: Uint8Array | null = fs.readFileSync(pathFile);
                    // Load the PDF template into pdf-lib
                    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
            
                    // Set the PDF metadata
                    pdfDoc.setTitle(file8D.name);
                    pdfDoc.setAuthor('');
                    pdfDoc.setSubject('View File');
                    pdfDoc.setKeywords(['View', 'Claim App']);
                    pdfDoc.setProducer(`Claim App`);
                    pdfDoc.setCreationDate(new Date());
                    pdfDoc.registerFontkit(fontkit);
            
                    // Load the font
                    const fontBytes = fs.readFileSync(join(__dirname, '..', '..', '/files-templates/fonts/NotoSansThai-Medium.ttf'));
                    const font = await pdfDoc.embedFont(fontBytes);
            
                    // Add watermark to each page
                    const pages = pdfDoc.getPages();
            
                    if (!pages.length) {
                        throw new Error('The PDF contains no pages to process.');
                    }
            
                    const watermarkText = 'View';
        
                    for (const page of pages) {
                        const pageWidth = page.getWidth();
                        const pageHeight = page.getHeight();
                    
                        // Calculate font size to make the text approximately 1/3 of the page
                        const fontSize = Math.min(pageWidth, pageHeight) / 3;
                    
                        // Calculate text dimensions
                        const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
                        const textHeight = fontSize; // Approximation
                    
                        // Adjust for rotation to center the text
                        const angle = 45; // Rotate 45 degrees
                        const radians = (angle * Math.PI) / 180;
                    
                        // Calculate the rotated dimensions
                        const rotatedWidth = Math.abs(textWidth * Math.cos(radians)) + Math.abs(textHeight * Math.sin(radians));
                        const rotatedHeight = Math.abs(textWidth * Math.sin(radians)) + Math.abs(textHeight * Math.cos(radians));
                    
                        // Center the text on the page
                        const x = (pageWidth - rotatedWidth) / 2 + rotatedWidth / 4; // Adjust for proper centering
                        const y = (pageHeight - rotatedHeight) / 2;
                    
                        // Draw the text
                        page.drawText(watermarkText, {
                            x,
                            y,
                            size: fontSize,
                            font,
                            color: rgb(0.75, 0.75, 0.75), // Light grey
                            rotate: degrees(angle), // Rotate 45 degrees
                            opacity: 0.5, // Semi-transparent text
                        });
                    }
            
                    const pdfBytesOutput = await pdfDoc.save();
                    return pdfBytesOutput;
                }
                throw new NotFoundException(`File: ${file8D.name} not found.`);
            }
            throw new NotFoundException(`File not found.`);
            
        } catch (e) {
            console.error('Error processing ViewFileDrawing:', e.message);
            throw new BadRequestException(e.message || 'An error occurred while processing the PDF.');
        }
    }
}
