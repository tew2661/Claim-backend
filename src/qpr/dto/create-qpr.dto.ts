import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsDateString, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class WhereFoundDto {
  @IsBoolean()
  receiving: boolean;

  @IsString()
  @IsOptional()
  receivingDetails: string;

  @IsBoolean()
  inprocess: boolean;

  @IsString()
  @IsOptional()
  inprocessDetails: string;

  @IsBoolean()
  fg: boolean;

  @IsString()
  @IsOptional()
  fgDetails: string;

  @IsBoolean()
  wh: boolean;

  @IsString()
  @IsOptional()
  whDetails: string;

  @IsBoolean()
  customerClaim: boolean;

  @IsString()
  @IsOptional()
  customerClaimDetails: string;

  @IsBoolean()
  warrantyClaim: boolean;

  @IsString()
  @IsOptional()
  warrantyClaimDetails: string;

  @IsBoolean()
  other: boolean;

  @IsString()
  @IsOptional()
  otherDetails: string;
}

class DefectDto {
  @IsBoolean()
  dimension: boolean;

  @IsBoolean()
  material: boolean;

  @IsBoolean()
  appearance: boolean;

  @IsBoolean()
  characteristics: boolean;

  @IsBoolean()
  other: boolean;

  @IsString()
  @IsOptional()
  otherDetails: string;
}

class FrequencyDto {
  @IsBoolean()
  firstDefective: boolean;

  @IsBoolean()
  reoccurrence: boolean;

  @IsNumber()
  @IsOptional()
  reoccurrenceDetails?: number;

  @IsBoolean()
  chronicDisease: boolean;
}

class DefectiveContentsDto {
  @IsString()
  problemCase: string;

  @IsString()
  specification: string;

  @IsString()
  action: string;

  @IsString()
  ngEffective: string;

  @IsString()
  lot: string;
}

class ImageDto {
  @IsString()
  @IsOptional()
  imageUrl: string;

  // เนื่องจาก file อาจเป็น object หรือข้อมูล binary
  @IsOptional()
  file: any;
}

class FiguresDto {
  @ValidateNested()
  @Type(() => ImageDto)
  img1: ImageDto;

  @ValidateNested()
  @Type(() => ImageDto)
  img2: ImageDto;

  @ValidateNested()
  @Type(() => ImageDto)
  img3: ImageDto;

  @ValidateNested()
  @Type(() => ImageDto)
  img4: ImageDto;
}

export class CreateQprDto {
  @IsString()
  @IsNotEmpty()
  qprIssueNo: string;

  @IsDateString()
  occurrenceDate: Date;

  @IsDateString()
  dateReported: Date;

  @IsDateString()
  replyQuickAction: Date;

  @IsDateString()
  replyReport: Date;

  @IsString()
  @IsNotEmpty()
  supplierCode: string;

  @IsString()
  @IsNotEmpty()
  partName: string;

  @IsString()
  @IsNotEmpty()
  partNo: string;

  @IsString()
  @IsNotEmpty()
  model: string;

  @IsString()
  @IsNotEmpty()
  when: string;

  @IsString()
  @IsNotEmpty()
  who: string;

  @ValidateNested()
  @Type(() => WhereFoundDto)
  whereFound: WhereFoundDto;

  @ValidateNested()
  @Type(() => DefectDto)
  defect: DefectDto;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  importanceLevel: string;

  @IsBoolean()
  urgent: boolean;

  @ValidateNested()
  @Type(() => FrequencyDto)
  frequency: FrequencyDto;

  @ValidateNested()
  @Type(() => DefectiveContentsDto)
  defectiveContents: DefectiveContentsDto;

  @IsString()
  @IsOptional()
  issue: string;

  @ValidateNested()
  @Type(() => FiguresDto)
  figures: FiguresDto;
}
