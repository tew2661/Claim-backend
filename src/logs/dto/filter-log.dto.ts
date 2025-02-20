import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { LogAction, DocumentType } from '../entities/log.entity';
import { Type } from 'class-transformer';

export class FilterLogDto {
  @IsOptional()
  @IsString()
  qprNo?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number) 
  user?: number;

  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType;

  @IsOptional()
  @IsEnum(LogAction)
  action?: LogAction;
}
