import { PartialType } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray, IsEmail, IsPhoneNumber } from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  supplierCode: string; // รหัสผู้จำหน่าย (Required)

  @IsString()
  @IsNotEmpty()
  supplierName: string; // ชื่อผู้จำหน่าย (Required)

  @IsOptional()
  tel?: string; // เบอร์โทรศัพท์ (Optional)

  @IsOptional()
  @IsArray()
  contactPerson?: string[];

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true }) // ตรวจสอบว่าเป็นอีเมลและรองรับ Array
  email?: string[]; // อีเมล (Optional)

  @IsOptional()
  @IsString()
  password?: string;
}

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}
