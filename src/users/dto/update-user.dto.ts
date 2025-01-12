import {  PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {}

export class UpdatePasswordDto {
    @IsNumber()
    @Type(() => Number)
    id: number

    @IsString()
    newPassword: string
}
