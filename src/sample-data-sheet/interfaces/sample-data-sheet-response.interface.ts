export interface SampleDataSheetSampleResponse {
    no: number;
    value: string;
}

export interface SampleDataSheetRowResponse {
    id: number;
    sampleDataSheetId: number;
    no: number;
    measuringItem: string;
    specification: string;
    rank: string;
    inspectionInstrument: string;
    remark: string | null;
    sampleQty: number;
    samples: SampleDataSheetSampleResponse[];
    judgement: string | null;
    xBar: string | null;
    r: string | null;
    cp: string | null;
    cpk: string | null;
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
    remark: string | null;
    createdAt: Date;
    updatedAt: Date;
    sdrData: SampleDataSheetRowResponse[];
}
