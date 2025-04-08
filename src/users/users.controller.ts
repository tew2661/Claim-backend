import { UsersEntity } from './entities/users.entity';
import { Controller, Get, Post, Body, Param, Patch, Delete, UseInterceptors, BadRequestException, UploadedFile, UseGuards, Res, Req, Query, ParseIntPipe, Inject, Put } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdatePasswordDto, UpdateUserDto } from './dto/update-user.dto';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import { GetUserDto } from './dto/get-user.dto';
import { configPath } from 'src/path-files-config';
import { JwtAuthGuard } from 'src/middlewares/jwt-auth.middleware';

@ApiTags('Users')
@ApiBearerAuth('JWT')
@Controller('users')
export class UsersController {
    constructor(
        private readonly usersService: UsersService,
    ) { }

    @Get()
    @UseGuards(JwtAuthGuard)
    async findAll(@Query() Query : GetUserDto) {
        const users = await this.usersService.findAll(Query);
        const count = await this.usersService.count(Query);
        return {
            statusCode: 200,
            data: users,
            total: count
        }
    }

    @Get('dropdown')
    @UseGuards(JwtAuthGuard)
    async findDropdownAll() {
        return (await this.usersService.findAllForDropdown()).map((arr)=> {
            return {
                value: arr.id,
                label: arr.name
            }
        });
    }

    @Get(':id')
    @UseGuards(JwtAuthGuard)
    findOne(@Param('id') id: number) {
        return this.usersService.findOne(id);
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FileInterceptor('image', {
        storage: diskStorage({
            destination: (req, file, cb) => {
                const uploadPath = configPath.pathFileSignatureUser;
                if (!fs.existsSync(uploadPath)) {
                    fs.mkdirSync(uploadPath, { recursive: true });
                }
                cb(null, uploadPath);
            },
            filename: (req, file, callback) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                const ext = extname(file.originalname);
                callback(null, `signature-${uniqueSuffix}${ext}`);
            },
        }),
        fileFilter: (req, file, cb) => {
            const typefiles = ['image/png'];
            if (file.size > (3 * 1024 * 1024)) {
                return cb(new BadRequestException(`ไฟล์ใหญ่เกิน 3 MB`), false);
            }
            if (typefiles.filter((x)=> file.mimetype == x).length) {
              cb(null, true);
            } else {
              return cb(new BadRequestException(`Only ${typefiles.join(' and ')} files are allowed`), false);
            }
          },
    }))
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        description: 'Create User',
        type: CreateUserDto,
    })
    create(
        @Body() createUserDto: CreateUserDto, 
        @UploadedFile() image: Express.Multer.File,
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
    ) {
        return this.usersService.create(createUserDto, undefined, image?.filename, undefined, actionBy);
    }

    @Patch('fixPassword')
    @UseGuards(JwtAuthGuard)
    fixPassword(
        @Body() updatePasswordDto: UpdatePasswordDto,
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
    ) {
        return this.usersService.fixPassword({ ...updatePasswordDto, id: actionBy.id }, actionBy, false);
    }

    @Put('reset-password')
    @UseGuards(JwtAuthGuard)
    resetPasswordUser(
        @Body() updatePasswordDto: UpdatePasswordDto,
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
    ) {
        return this.usersService.fixPassword(updatePasswordDto, actionBy, true);
    }

    @Put('reset-password-supplier')
    @UseGuards(JwtAuthGuard)
    resetPasswordUserSupplier(
        @Body() updatePasswordDto: UpdatePasswordDto,
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
    ) {
        return this.usersService.fixPasswordSupplier(updatePasswordDto, actionBy);
    }

    @Put(':id')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FileInterceptor('image', {
        storage: diskStorage({
            destination: (req, file, cb) => {
                const uploadPath = configPath.pathFileSignatureUser;
                if (!fs.existsSync(uploadPath)) {
                    fs.mkdirSync(uploadPath, { recursive: true });
                }
                cb(null, uploadPath);
            },
            filename: (req, file, callback) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                const ext = extname(file.originalname);
                callback(null, `signature-${uniqueSuffix}${ext}`);
            },
        }),
        fileFilter: (req, file, cb) => {
            const typefiles = ['image/png'];
            if (typefiles.filter((x)=> file.mimetype == x).length) {
              cb(null, true);
            } else {
                return cb(new BadRequestException(`Only ${typefiles.join(' and ')} files are allowed`), false);
            }
          },
    }))
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        description: 'Update User',
        type: UpdateUserDto,
    })
    async update(
        @Param('id') id: number, 
        @Body() updateUserDto: UpdateUserDto , 
        @UploadedFile() image: Express.Multer.File,
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
    ) {
        return this.usersService.update(id, updateUserDto ,actionBy, image?.filename);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    remove(
        @Param('id') id: number,
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
    ) {
        return this.usersService.remove(id, actionBy);
    }

    

}
