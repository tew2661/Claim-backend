import { ActiveStatus } from './../users/entities/users.entity';
// src/qpr/qpr.service.ts
import { BadGatewayException, Injectable } from '@nestjs/common';
import { CreateQprDto } from './dto/create-qpr.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Like, Repository } from 'typeorm';
import { QprEntity } from './entities/qpr.entity';
import { UsersEntity } from 'src/users/entities/users.entity';
import { configPath } from 'src/path-files-config';
import { saveBase64File } from 'src/convert-base64-img';
import { GetQprDto } from './dto/get-qpr.dto';
import { SupplierEntity } from 'src/supplier/entities/supplier.entity';
import { MyGatewayGateway } from 'src/my-gateway/my-gateway.gateway';
import * as moment from 'moment';

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
        const haveNo = await this.qprRepository.findOne({ where: { qprIssueNo: createQprDto.qprIssueNo , activeRow: ActiveStatus.YES } });
        if (haveNo) {
            throw new BadGatewayException(`เลข QPR Issue No : ${createQprDto.qprIssueNo} มีอยู่แล้ว`);
        }

         const haveSupplier = await this.supplierRepository.findOne({ where: { supplierCode: createQprDto.supplierCode , activeRow: ActiveStatus.YES }})
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

    count(query: GetQprDto): Promise<number> {
        return this.qprRepository.count({
            where: {
                ...query.date ? { dateReported : Between(
                    moment(moment(query.date).format('YYYY-MM-DD 00:00:00')).toDate(), 
                    moment(moment(query.date).format('YYYY-MM-DD 23:59:59')).toDate(), 
                )} : {},
                ...query.qprNo ? { qprIssueNo: Like(`%${query.qprNo}%`) } : {},
                ...query.severity ? { importanceLevel : query.severity } : {},
                ...query.status ? { status : query.status as 'In Progress' | 'Completed' } : {},
                activeRow: ActiveStatus.YES,
            },
        });
    }

    findAll(query: GetQprDto):Promise<QprEntity[]> {
        return this.qprRepository.find({ 
            relations: ['supplier'],
            skip: query.offset,
            take: query.limit,
            where: {
                ...query.date ? { dateReported : Between(
                    moment(moment(query.date).format('YYYY-MM-DD 00:00:00')).toDate(), 
                    moment(moment(query.date).format('YYYY-MM-DD 23:59:59')).toDate(), 
                )} : {},
                ...query.qprNo ? { qprIssueNo: Like(`%${query.qprNo}%`) } : {},
                ...query.severity ? { importanceLevel : query.severity } : {},
                ...query.status ? { status : query.status as 'In Progress' | 'Completed' } : {},
                activeRow: ActiveStatus.YES,
            },
            order: {
                createdAt: 'DESC'
            }
        });
    }
}
