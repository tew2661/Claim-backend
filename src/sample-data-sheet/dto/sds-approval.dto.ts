import { IsInt, IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';

export enum ApprovalAction {
    APPROVE = 'approve',
    REJECT = 'reject',
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
