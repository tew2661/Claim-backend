import { IsString, IsEmail, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { ActiveStatus } from '../entities/users.entity';

export class CreateUserDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsString()
  department: string;

  @IsString()
  role: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsEnum(ActiveStatus)
  active?: ActiveStatus;
}
