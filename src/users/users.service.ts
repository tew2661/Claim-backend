import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdatePasswordDto, UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Like, Not, Repository } from 'typeorm';
import { ActiveStatus, UsersEntity } from './entities/users.entity';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs'
import { configPath } from 'src/path-files-config';
import { GetUserDto } from './dto/get-user.dto';
import { MyGatewayGateway } from 'src/my-gateway/my-gateway.gateway';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(UsersEntity)
        private readonly usersRepository: Repository<UsersEntity>, // AuthEntity
        private readonly myGatewayGateway: MyGatewayGateway
    ) { }


    findAll(query: GetUserDto):Promise<UsersEntity[]> {
        return this.usersRepository.find({ 
            skip: query.offset,
            take: query.limit,
            where: {
                ...query.name ? { name: Like(`%${query.name || ''}%`)} : {} ,
                ...query.code ? { code: Like(`%${query.code || ''}%`)} : {} ,
                activeRow: ActiveStatus.YES,
            },
        });
    }

    count(query: GetUserDto): Promise<number> {
        return this.usersRepository.count({
            where: {
                ...query.name ? { name: Like(`%${query.name || ''}%`)} : {} ,
                ...query.code ? { code: Like(`%${query.code || ''}%`)} : {} ,
                activeRow: ActiveStatus.YES,
            },
        });
    }

    findOne(id: number) {
        const data = this.usersRepository.findOne({ where: { id, activeRow: ActiveStatus.YES } });
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
        return this.usersRepository.findOne({ where: { email, activeRow: ActiveStatus.YES } });
    }

    async create(createUserDto: CreateUserDto, imageFilename?: string ): Promise<UsersEntity> {
        const user = await this.usersRepository.findOne({ where: { email: createUserDto.email, activeRow: ActiveStatus.YES } });
        if (user) {
            throw new ConflictException('Email นี้ถูกใช้งานแล้ว')
        }

        const user2 = await this.usersRepository.findOne({ where: { code: createUserDto.code, activeRow: ActiveStatus.YES } });
        if (user2) {
            throw new ConflictException('รหัสพนักงาน นี้ถูกใช้งานแล้ว')
        }

        const saltRounds = 10;

        // เข้ารหัสรหัสผ่านก่อนบันทึก
        if (createUserDto.password) {
            createUserDto.password = await bcrypt.hash(createUserDto.password, saltRounds);
        }

        const createUser: DeepPartial<UsersEntity> = {
            ...createUserDto,
            active: ActiveStatus.YES,
            image: (imageFilename) ? (`${configPath.pathFileUser}/${imageFilename}`) : null,
        };

        const newUser = this.usersRepository.create(createUser);
        const data = await this.usersRepository.save(newUser);
        return await this.findOne(data.id);
    }

    async update(id: number, updateUserDto: UpdateUserDto, actionBy: UsersEntity, imageFilename?: string): Promise<UsersEntity> {
        const user = await this.usersRepository.findOne({ where: { id, activeRow: ActiveStatus.YES } });
        if (!user) {
            throw new BadRequestException('ไม่พบข้อมูลผู้ใช้งานนี้');
        }
        
        const saltRounds = 10;

        const fieldUpdate: DeepPartial<UsersEntity> = {}

        if (updateUserDto.code) {
            const user2 = await this.usersRepository.findOne({ where: { 
                code: updateUserDto.code, 
                activeRow: ActiveStatus.YES ,
                id: Not(id)
            } });
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
            const user2 = await this.usersRepository.findOne({ where: { 
                email: updateUserDto.email , 
                id: Not(id), 
                activeRow: ActiveStatus.YES 
            }});
            if (user2) {
                throw new ConflictException('Email นี้ถูกใช้งานแล้ว')
            }
            fieldUpdate.email = updateUserDto.email
        }

        if (updateUserDto.password) {
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
        const newValue = await this.findOne(user.id);
        this.myGatewayGateway.sendMessage('update-user', newValue);

        return newValue;
    }

    async remove(id: number, actionBy: UsersEntity): Promise<void> {
        const user = await this.usersRepository.findOne({ where: { id, activeRow: ActiveStatus.YES } });
        if (!user) {
            throw new BadRequestException('ไม่พบข้อมูลผู้ใช้งานนี้');
        }
        await this.usersRepository.update(user.id, {
            updatedBy: actionBy,
            deletedBy: actionBy,
            activeRow: ActiveStatus.NO
        });
    }

    async fixPassword(updatePasswordDto: UpdatePasswordDto) : Promise<UsersEntity> {
        const saltRounds = 10;
        const fieldUpdate: DeepPartial<UsersEntity> = {}

        const dataUser = await this.findOne(updatePasswordDto.id);
        if (updatePasswordDto.newPassword) {
            fieldUpdate.password = await bcrypt.hash(updatePasswordDto.newPassword, saltRounds);
        }
        await this.usersRepository.update(dataUser.id, fieldUpdate);
        return dataUser;
    }

    async validateUser(username: string, plainPassword: string): Promise<UsersEntity> {
        const user = await this.usersRepository
            .createQueryBuilder('user')
            .addSelect('user.password')
            .where('CAST(user.code AS NVARCHAR) = :username', { username })
            .andWhere('CAST(user._activeRow AS NVARCHAR) = :activeRow', { activeRow: 'Y' })
            .getOne();

        if (user && await bcrypt.compare(plainPassword, user.password)) {
            return user;
        }
        return null;
    }
}
 