export class FilterSdsLogDto {
    menu?: string;
    sdsInspectionDetailId?: number;
    partNo?: string;
    sdsMonthYear?: string;
    action?: string;
    actionRole?: string;
    actionBy?: string;
    actionDateFrom?: Date;
    actionDateTo?: Date;
    limit?: number;
    offset?: number;
}
