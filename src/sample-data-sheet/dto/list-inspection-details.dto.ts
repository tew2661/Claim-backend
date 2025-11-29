export interface ListInspectionDetailsQueryDto {
    monthYear?: string;
    year?: string;
    partNo?: string;
    partName?: string;
    model?: string;
    sdsType?: 'All' | 'Special' | 'Normal';
    supplierCode?: string;
    status?: string;
    skip?: number;
    limit?: number;
    checkerLevel?: 1 | 2 | 3;
    hasDelay?: boolean;
    notHasDelay?: boolean;
    pageCreatedSds?: boolean;
}

export interface DashboardStatsQuery extends ListInspectionDetailsQueryDto {
    monthYear?: string;
}

export interface InspectionDetailListItem {
    no: number;
    id: number;
    sheetId?: number;
    supplierCode: string;
    supplierName: string;
    partNo: string;
    partName: string;
    model: string;
    monthYear: string;
    sdsType: 'Special' | 'Normal';
    supplierStatus: string;
    dueDate?: string | null;
    hasDelay: boolean;
    sdsCreated: boolean;
    checker1Approved: boolean;
    checker1Rejected: boolean;
    checker2Approved: boolean;
    checker2Rejected: boolean;
    checker3Approved: boolean;
    checker3Rejected: boolean;
    hasAnyRejection: boolean;
}

export interface InspectionDetailListResponse {
    items: InspectionDetailListItem[];
    total: number;
}
