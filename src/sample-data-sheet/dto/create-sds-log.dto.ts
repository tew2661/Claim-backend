export class CreateSdsLogDto {
    menu: string;
    sdsInspectionDetailId?: number;
    partNo?: string;
    sdsMonthYear?: string;
    action: string;
    actionRole?: string;
    actionBy?: string;
    actionDate: Date;
    remark?: string;
}
