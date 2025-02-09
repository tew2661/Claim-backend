import { ActiveStatus } from './../users/entities/users.entity';
// src/qpr/qpr.service.ts
import { BadGatewayException, Injectable, NotAcceptableException } from '@nestjs/common';
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
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

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
        const data = await this.qprRepository.findOne({ where: { id } });
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
                    newSketches.push(fileObj);
                }
                if (!fileObj.file?.delete) {
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
                    newSketches.push(fileObj);
                }
                if (!fileObj.file?.delete) {
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
                eightDReportStatus: ReportStatus.WaitForSupplier,
                eightDStatusChecker3: ReportStatus.Pending,
                eightDDateChecker3: new Date(),
            } : {
                delayDocument: "8D Report",
                eightDReportStatus: completed ? ReportStatus.Completed : ReportStatus.Approved,
                eightDReportDate: new Date(),
                status: completed ? ReportStatus.Completed : ReportStatus.Approved,

                eightDStatusChecker3: ReportStatus.Completed,
                eightDDateChecker3: new Date(),
            },
            
            updatedBy: actionBy
        })

    }
}
