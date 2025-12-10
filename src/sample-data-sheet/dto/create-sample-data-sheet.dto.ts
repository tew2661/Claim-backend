export interface SampleValueDto {
    no: number;
    value: string;
}

export class CreateSampleDataSheetRowDto {
    no: number;
    measuringItem: string;
    specification: number;
    rank: string;
    inspectionInstrument: string;
    remark?: string;
    sampleQty: number;
    samples: SampleValueDto[];
    judgement?: string;
    xBar?: string;
    r?: string;
    cp?: string;
    cpk?: string;
}

export interface CreateSampleDataSheetDto {
    supplier: string;
    partNo: string;
    partName: string;
    model: string;
    production08_2025: 'Yes' | 'No';
    sdrDate: string;
    sdrData: CreateSampleDataSheetRowDto[];
    inspectionDetailId: number;
    remark: string;
}
