import { UsersService } from 'src/users/users.service';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Not, Repository } from 'typeorm';
import { ActiveStatus, SupplierEntity } from './entities/supplier.entity';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';
import { UsersEntity } from 'src/users/entities/users.entity';
import { GetSupplierDto } from './dto/get-supplier.dto';
import { CreateUserDto } from 'src/users/dto/create-user.dto';

@Injectable()
export class SupplierService {
    constructor(
        @InjectRepository(SupplierEntity)
        private supplierRepository: Repository<SupplierEntity>,
        @InjectRepository(UsersEntity)
        private userRepository: Repository<UsersEntity>,
        private usersService: UsersService
    ) { }

    // Create Supplier
    async create(supplier: CreateSupplierDto, actionBy: UsersEntity): Promise<SupplierEntity> {
        const checkCode = await this.supplierRepository.findOne({
            where: {
                supplierCode: supplier.supplierCode,
                activeRow: ActiveStatus.YES,
            }
        })
        if (checkCode) {
            throw new ConflictException('Supplier Code นี้มีอยู่แล้ว')
        }

        const newSupplier = this.supplierRepository.create({
            ...supplier,
            activeRow: ActiveStatus.YES,
            createdBy: actionBy,
            updatedBy: actionBy
        });

        const user: CreateUserDto = {
            code: supplier.supplierCode,
            name: supplier.supplierName,
            department: 'Supplier',
            role: 'Supplier',
            email: supplier.email.length ? supplier.email[0] : "",
            password: supplier.password,
            
        }
        await this.usersService.create(user, newSupplier);

        return await this.supplierRepository.save(newSupplier);
    }

    // Get All Suppliers
    findAll(query: GetSupplierDto):Promise<SupplierEntity[]> {
        return this.supplierRepository.find({ 
            skip: query.offset,
            take: query.limit,
            where: {
                ...query.supplierCode ? { supplierCode: Like(`%${query.supplierCode || ''}%`)} : {} ,
                ...query.supplierName ? { supplierName: Like(`%${query.supplierName || ''}%`)} : {} ,
                activeRow: ActiveStatus.YES,
            },
        });
    }

    findAllForDropdown():Promise<SupplierEntity[]> {
        return this.supplierRepository.find({ 
            select: ['supplierCode' , 'supplierName' ],
            where: {
                activeRow: ActiveStatus.YES,
            },
        });
    }

    count(query: GetSupplierDto): Promise<number> {
        return this.supplierRepository.count({
            where: {
                ...query.supplierCode ? { supplierCode: Like(`%${query.supplierCode || ''}%`)} : {} ,
                ...query.supplierName ? { supplierName: Like(`%${query.supplierName || ''}%`)} : {} ,
                activeRow: ActiveStatus.YES,
            },
        });
    }

    // Get Supplier by ID
    async findOne(id: number): Promise<SupplierEntity> {
        const data = await this.supplierRepository.findOne({ where: { id, activeRow: ActiveStatus.YES } });
        if (!data) {
            throw new NotFoundException('ไม่พบ supplier id นี้')
        }
        return data
    }

    // Update Supplier
    async update(id: number, supplier: UpdateSupplierDto, actionBy: UsersEntity): Promise<SupplierEntity> {
        const updateSupplier: Partial<SupplierEntity> = {}

        if (supplier.supplierCode) {
            const checkCode = await this.supplierRepository.findOne({
                where: {
                    supplierCode: supplier.supplierCode,
                    activeRow: ActiveStatus.YES,
                    id: Not(id)
                }
            })
            if (checkCode) {
                throw new ConflictException('Supplier Code นี้มีอยู่แล้ว')
            }
    
            updateSupplier.supplierCode = supplier.supplierCode
        }

        if (supplier.supplierName) {
            updateSupplier.supplierName = supplier.supplierName
        }

        if (supplier.email && supplier.email.length) {
            updateSupplier.email = supplier.email
        }

        if (supplier.tel) {
            updateSupplier.tel = supplier.tel
        }

        if (supplier.contactPerson && supplier.contactPerson.length) {
            updateSupplier.contactPerson = supplier.contactPerson
        }

        await this.supplierRepository.update(id, {
            ...supplier,
            updatedBy: actionBy
        });
        return await this.findOne(id);
    }

    // Delete Supplier
    async delete(id: number, actionBy: UsersEntity): Promise<void> {
        const user = await this.supplierRepository.findOne({ where: { id, activeRow: ActiveStatus.YES } });
        if (!user) {
            throw new BadRequestException('ไม่พบข้อมูล supplier นี้');
        }
        await this.supplierRepository.update(user.id, {
            updatedBy: actionBy,
            deletedBy: actionBy,
            activeRow: ActiveStatus.NO
        });
    }
}
