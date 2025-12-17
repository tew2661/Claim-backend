import { IsInt, IsString, IsOptional, IsDateString, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum ApprovalAction {
    APPROVE = 'approve',
    REJECT = 'reject',
}

export class OutOfToleranceRowDto {
    @IsInt()
    rowId: number;

    @IsString()
    @IsOptional()
    saStatus?: string;

    @IsOptional()
    @IsDateString()
    dueToImplement?: string;
}

export class SdsApprovalDto {
    @IsInt()
    id: number;

    @IsString()
    @IsEnum(ApprovalAction)
    actionSdrApproval: string;

    @IsString()
    @IsEnum(ApprovalAction)
    actionSdsApproval: string;

    @IsOptional()
    @IsString()
    remark?: string;

    @IsOptional()
    @IsDateString()
    reSubmitDate?: string;

    @IsString()
    approveRole: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => OutOfToleranceRowDto)
    outOfToleranceRows?: OutOfToleranceRowDto[];
}

export class SdsApprovalHistoryQueryDto {
    @IsOptional()
    @IsString()
    partNo?: string;

    @IsOptional()
    @IsString()
    sdsMonthYear?: string;

    @IsOptional()
    @IsString()
    action?: string;

    @IsOptional()
    @IsString()
    role?: string;

    @IsOptional()
    @IsDateString()
    actionDate?: string;

    @IsOptional()
    @IsString()
    actionBy?: string;
}
