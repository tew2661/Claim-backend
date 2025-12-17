import { InspectionDetailEntity } from "src/inspection-detail/entities/inspection-detail.entity";
import { UsersEntity } from "src/users/entities/users.entity";

export interface SampleDataSheetSampleResponse {
    no: number;
    value: string;
}

export interface SampleDataSheetRowResponse {
    id: number;
    sampleDataSheetId: number;
    no: number;
    measuringItem: string;
    specification: number;
    rank: string;
    tolerancePlus: number | null;
    toleranceMinus: number | null;
    inspectionInstrument: string;
    remark: string | null;
    sampleQty: number;
    inspectionDetail?: InspectionDetailEntity;
    samples: SampleDataSheetSampleResponse[];
    judgement: string | null;
    xBar: string | null;
    r: string | null;
    cp: string | null;
    cpk: string | null;
    saStatus: string | null;
    dueToImplement: Date | null;
}

export interface SampleDataSheetResponse {
    id: number;
    supplier: string;
    partNo: string;
    partName: string;
    model: string;
    production08_2025: 'Yes' | 'No';
    sdrDate: Date;
    aisFile: string | null;
    sdrFile: string | null;
    sdrReportFile: string | null;
    inspectionDetailId: number | null;
    loop: number;
    remark: string | null;
    createdAt: Date;
    updatedAt: Date;
    inspectionDetail?: InspectionDetailEntity;
    sdrData: SampleDataSheetRowResponse[];
    approvals?: SampleDataSheetApprovalResponse[];
}

export interface SampleDataSheetApprovalResponse {
    id: number;
    actionByUser: UsersEntity;
    action: string;
    role: string;
    loop: number;
    documentType: string;
    remark: string | null;
    actionDate: Date;
    reSubmitDate: Date | null;
}
