import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdatePasswordDto, UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DeepPartial, IsNull, Like, Not, Repository } from 'typeorm';
import { ActiveStatus, UsersEntity } from './entities/users.entity';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs'
import { configPath } from 'src/path-files-config';
import { GetUserDto } from './dto/get-user.dto';
import { MyGatewayGateway } from 'src/my-gateway/my-gateway.gateway';
import { SupplierEntity } from 'src/supplier/entities/supplier.entity';
import * as moment from 'moment';
import { EmailService } from 'src/email/email.service';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(UsersEntity)
        private readonly usersRepository: Repository<UsersEntity>, // AuthEntity
        private readonly myGatewayGateway: MyGatewayGateway,
        private readonly emailService: EmailService
    ) { }


    findAll(query: GetUserDto): Promise<UsersEntity[]> {
        return this.usersRepository.find({
            skip: query.offset,
            take: query.limit,
            where: {
                ...query.name ? { name: Like(`%${query.name || ''}%`) } : {},
                ...query.code ? { code: Like(`%${query.code || ''}%`) } : {},
                activeRow: ActiveStatus.YES,
                supplier: IsNull()
            },
        });
    }

    count(query: GetUserDto): Promise<number> {
        return this.usersRepository.count({
            where: {
                ...query.name ? { name: Like(`%${query.name || ''}%`) } : {},
                ...query.code ? { code: Like(`%${query.code || ''}%`) } : {},
                activeRow: ActiveStatus.YES,
                supplier: IsNull()
            },
        });
    }

    findOne(id: number) {
        const data = this.usersRepository.findOne({ where: { id, activeRow: ActiveStatus.YES, supplier: IsNull() } });
        if (!data) {
            throw new NotFoundException(`ไม่พบข้อมูล Users ที่มี ID ${id} ในระบบ.`);
        }
        return data;
    }

    findOneForSupplier(id: number) {
        const data = this.usersRepository.findOne({ relations: ['supplier'], where: { id, activeRow: ActiveStatus.YES, supplier: Not(IsNull()) } });
        if (!data) {
            throw new NotFoundException(`ไม่พบข้อมูล Users ที่มี ID ${id} ในระบบ.`);
        }
        return data;
    }

    findOneAll(id: number) {
        const data = this.usersRepository.findOne({ relations: ['supplier'], where: { id, activeRow: ActiveStatus.YES } });
        if (!data) {
            throw new NotFoundException(`ไม่พบข้อมูล Users ที่มี ID ${id} ในระบบ.`);
        }
        return data;
    }

    findForMiddlewares(id: number) {
        const data = this.usersRepository.findOne({ where: { id } });
        if (!data) {
            throw new NotFoundException(`ไม่พบข้อมูล Users ที่มี ID ${id} ในระบบ.`);
        }
        return data;
    }

    findByEmail(email: string) {
        return this.usersRepository.findOne({ where: { email, activeRow: ActiveStatus.YES, supplier: IsNull() } });
    }

    async create(createUserDto: CreateUserDto, supplier?: SupplierEntity, imageFilename?: string, isSupplier?: boolean, actionBy?: UsersEntity): Promise<UsersEntity> {

        if (actionBy.accessMasterManagement !== ActiveStatus.YES) {
            throw new BadRequestException(`ไม่สามารถสร้างผู้ใช้งานได้ เนื่องจากไม่ใช่ ผู้ดูแลระบบ`);
        }

        const user2 = await this.usersRepository.findOne({
            where: {
                code: createUserDto.code,
                activeRow: ActiveStatus.YES,
                ...isSupplier ? { supplier: Not(IsNull()) } : { supplier: IsNull() }
            }
        });

        if (user2) {
            throw new ConflictException('รหัสพนักงาน นี้ถูกใช้งานแล้ว')
        }

        const saltRounds = 10;
        let listPasswordc = false;
        // เข้ารหัสรหัสผ่านก่อนบันทึก
        listPasswordc = true
        createUserDto.password = await bcrypt.hash('P@ssw0rd', saltRounds);

        const createUser: DeepPartial<UsersEntity> = {
            ...createUserDto,
            ...supplier ? { supplier } : {},
            active: ActiveStatus.YES,
            expiresPassword: listPasswordc ? undefined : moment().add(3, 'M').toDate(),
            image: (imageFilename) ? (`${configPath.pathFileUser}/${imageFilename}`) : null,
        };

        const newUser = this.usersRepository.create(createUser);
        const data = await this.usersRepository.save(newUser);

        const htmlContent = `
            <!DOCTYPE html>
            <html>
                <head>
                <meta charset="utf-8" />
                <title>Welcome to SCM</title>
                </head>
                <body>
                <p>Dear ${data.name},</p>
                <p>
                    Please access Supplier Claim Management (SCM) through the link below:
                </p>
                <p>
                    <a href="${isSupplier ? (process.env.MAIL_LINK_WEBAPP_SUPPLIER || '') : (process.env.MAIL_LINK_WEBAPP_JTEKT || '')}">${isSupplier ? (process.env.MAIL_LINK_WEBAPP_SUPPLIER || '') : (process.env.MAIL_LINK_WEBAPP_JTEKT || '')}</a>
                </p>
                <p>
                    Username: <strong>${data.code}</strong><br />
                    Password: <strong>${'P@ssw0rd'}</strong>
                </p>
                <p>Thank you and Best regards,</p>
                <p><strong>ทีมงาน SCM</strong></p>
                <p style="font-size: small; color: #888;">
                    [THIS IS AN AUTOMATED MESSAGE - PLEASE DO NOT REPLY THIS EMAIL]
                </p>
                </body>
            </html>
        `;

        this.emailService.sendEmail(
            data.email,
            'Welcome to SCM',
            htmlContent,
        );
        
        return await this.findOne(data.id);
    }

    async update(id: number, updateUserDto: UpdateUserDto, actionBy: UsersEntity, imageFilename?: string, isSupplier?: boolean): Promise<UsersEntity> {
        if (actionBy.accessMasterManagement !== ActiveStatus.YES) {
            throw new BadRequestException(`ไม่สามารถแก้ไขผู้ใช้งานได้ เนื่องจากไม่ใช่ ผู้ดูแลระบบ`);
        }

        const user = await this.usersRepository.findOne({ where: { id, activeRow: ActiveStatus.YES, ...isSupplier ? { supplier: Not(IsNull()) } : { supplier: IsNull() } } });
        if (!user) {
            throw new BadRequestException('ไม่พบข้อมูลผู้ใช้งานนี้');
        }

        const saltRounds = 10;

        const fieldUpdate: DeepPartial<UsersEntity> = {}

        if (updateUserDto.code) {
            const user2 = await this.usersRepository.findOne({
                where: {
                    code: updateUserDto.code,
                    activeRow: ActiveStatus.YES,
                    id: Not(id),
                    supplier: IsNull()
                }
            });
            if (user2) {
                throw new ConflictException('รหัสพนักงาน นี้ถูกใช้งานแล้ว')
            }

            fieldUpdate.code = updateUserDto.code
        }

        if (updateUserDto.name) {
            fieldUpdate.name = updateUserDto.name
        }

        if (updateUserDto.role) {
            fieldUpdate.role = updateUserDto.role
        }

        if (updateUserDto.email) {
            const user2 = await this.usersRepository.findOne({
                where: {
                    email: updateUserDto.email,
                    id: Not(id),
                    activeRow: ActiveStatus.YES,
                    supplier: IsNull()
                }
            });
            if (user2) {
                throw new ConflictException('Email นี้ถูกใช้งานแล้ว')
            }
            fieldUpdate.email = updateUserDto.email
        }

        if (updateUserDto.password) {
            fieldUpdate.expiresPassword = updateUserDto.password == 'P@ssw0rd' ? null : moment().add(3, 'M').toDate(),
            fieldUpdate.password = await bcrypt.hash(updateUserDto.password, saltRounds);
        }

        if (imageFilename) {
            fieldUpdate.image = (imageFilename) ? (`${configPath.pathFileSignatureUser}/${imageFilename}`) : user.image
        }

        if (updateUserDto.active) {
            fieldUpdate.active = updateUserDto.active
        }

        fieldUpdate.updatedBy = actionBy

        if (imageFilename) {
            if (fs.existsSync(user.image)) {
                fs.unlinkSync(user.image);
            }
        }

        await this.usersRepository.update(user.id, fieldUpdate);
        const newValue = await this.findOneAll(user.id);
        this.myGatewayGateway.sendMessage('update-user', newValue);

        return newValue;
    }

    async remove(id: number, actionBy: UsersEntity): Promise<void> {

        if (actionBy.accessMasterManagement !== ActiveStatus.YES) {
            throw new BadRequestException(`ไม่สามารถแก้ไขผู้ใช้งานได้ เนื่องจากไม่ใช่ ผู้ดูแลระบบ`);
        }

        const user = await this.usersRepository.findOne({ where: { id, activeRow: ActiveStatus.YES, supplier: IsNull() } });
        if (!user) {
            throw new BadRequestException('ไม่พบข้อมูลผู้ใช้งานนี้');
        }
        await this.usersRepository.update(user.id, {
            updatedBy: actionBy,
            deletedBy: actionBy,
            activeRow: ActiveStatus.NO
        });
    }

    async fixPassword(updatePasswordDto: UpdatePasswordDto, actionBy: UsersEntity , isAccessMasterManagement: boolean): Promise<UsersEntity> {
        const saltRounds = 10;
        const fieldUpdate: DeepPartial<UsersEntity> = {}

        if (actionBy.accessMasterManagement !== ActiveStatus.YES && isAccessMasterManagement) {
            throw new BadRequestException(`ไม่สามารถเปลี่ยนรหัสผ่านได้ เนื่องจากไม่ใช่ ผู้ดูแลระบบ`);
        }

        const data = await this.findOneAll(updatePasswordDto.id);
        if (updatePasswordDto.newPassword) {
            fieldUpdate.password = await bcrypt.hash(updatePasswordDto.newPassword, saltRounds);
            fieldUpdate.expiresPassword = updatePasswordDto.newPassword == 'P@ssw0rd' ? null : moment().add(3, 'M').toDate()
        }
        await this.usersRepository.update(data.id, fieldUpdate);

        const newValue = await this.findOneAll(data.id);
        this.myGatewayGateway.sendMessage('update-user', newValue);
        return newValue;
    }

    async validateUser(username: string, plainPassword: string): Promise<UsersEntity> {
        const user = await this.usersRepository
            .createQueryBuilder('user')
            .addSelect('user.password')
            .where('CAST(user.code AS NVARCHAR) = :username', { username })
            .andWhere('CAST(user._activeRow AS NVARCHAR) = :activeRow', { activeRow: 'Y' })
            .andWhere('supplierId IS NULL')
            .getOne();
        if (user && await bcrypt.compare(plainPassword, user.password)) {
            return user;
        }
        return null;
    }

    async validateUserForSupplier(username: string, plainPassword: string): Promise<UsersEntity> {
        const user = await this.usersRepository
            .createQueryBuilder('user')
            .addSelect('user.password')
            .where('CAST(user.code AS NVARCHAR) = :username', { username })
            .andWhere('CAST(user._activeRow AS NVARCHAR) = :activeRow', { activeRow: 'Y' })
            .andWhere('supplierId IS NOT NULL')
            .getOne();
        if (user && await bcrypt.compare(plainPassword, user.password)) {
            return user;
        }
        return null;
    }

    findAllForDropdown() {
        return this.usersRepository.find({
            select: ["id", "name"],
            where: {
                supplier: IsNull(),
                activeRow: ActiveStatus.YES,
            },
        });
    }
}
