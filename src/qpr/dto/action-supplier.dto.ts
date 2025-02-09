import { IsObject, IsNotEmptyObject, IsString, IsNumber, IsOptional, ValidateNested, IsArray, IsNotEmpty, IsBoolean } from "class-validator";
import { Type } from "class-transformer";

class SketchFile {
    @IsOptional()
    @IsString()
    name: string | null;

    @IsOptional()
    @IsString()
    file: string | null;

    @IsOptional()
    @IsBoolean()
    new?: boolean

    @IsOptional()
    @IsBoolean()
    delete?: boolean
}

export class Sketch {
    @IsOptional()
    @IsString()
    key: string | null;

    @ValidateNested()
    @Type(() => SketchFile)
    file: SketchFile;
}

class ObjectQPR {
    @IsString()
    remark: string;

    @IsString()
    actionDetail: string;

    @IsString()
    date: string;

    @IsString()
    time: string;

    @IsOptional()
    @IsNumber()
    quantity: number | null;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => Sketch)
    sketches: Sketch[];

    @IsString()
    email: string;

    @IsString()
    contactPerson: string;

}

export class SaveChecker1 {
    @IsString()
    approve: "approve" | "reject";

    @IsString()
    remark: string;

    @IsBoolean()
    claim: boolean

    @IsBoolean()
    complain: boolean

    @IsString()
    replay: string
}

export class SaveChecker2 extends SaveChecker1 {
    eightDReportApprover: string
}

export class SaveChecker3 extends SaveChecker2 {

}

export class SaveObjectQPR {
    @IsObject()
    @IsNotEmptyObject()
    @ValidateNested()
    @Type(() => ObjectQPR)
    objectQPR: ObjectQPR;

    @IsOptional()
    @IsString()
    status: 'draft' | 'approve'

    @IsOptional()
    @IsString()
    actionBy: string;

    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => SaveChecker1)
    checker1?: SaveChecker1;

    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => SaveChecker2)
    checker2?: SaveChecker2;
}

export class UploadSectionDto {
    @IsString()
    extension: string; // ประเภทไฟล์ เช่น jpg

    @IsString()
    file: string;      // ข้อมูลไฟล์ในรูป Base64

    @IsString()
    key: string;       // Key ของไฟล์

    @IsString()
    name: string;      // ชื่อไฟล์

    @IsOptional()
    @IsBoolean()
    new?: boolean

    @IsOptional()
    @IsBoolean()
    edit?: boolean

    @IsOptional()
    @IsBoolean()
    delete?: boolean
}

export class Upload8DReportDto {
    @IsString()
    file: string;      // ข้อมูลไฟล์ในรูป Base64

    @IsString()
    name: string;      // ชื่อไฟล์ PDF
}

export class Object8D {

    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => UploadSectionDto)
    upload8DReport: Upload8DReportDto; // รายละเอียดเอกสาร 8D Report

    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => UploadSectionDto)
    uploadSections: UploadSectionDto[]; // รายละเอียดไฟล์อื่น ๆ ใน Sections
}

export class Object8DReportDto {
    @IsOptional()
    @IsString()
    status: 'draft' | 'approve'

    @IsOptional()
    @IsString()
    actionBy: string;

    @IsObject()
    @IsNotEmptyObject()
    @ValidateNested()
    @Type(() => Object8D)
    object8D: Object8D;
}

export class DocumentOtherDto {
    key: string; // Unique key ของเอกสาร
    num: number; // ลำดับของเอกสาร
    name: string; // ชื่อของเอกสาร
    path: string; // พาธไฟล์ของเอกสาร
    approve: string; // สถานะการอนุมัติ ("approve" หรือ "reject")
    remark: string; // หมายเหตุ (อาจว่างเปล่า)
}

export class Save8DChecker1 {
    @IsString()
    approve: string; // สถานะการอนุมัติของฟอร์ม ("approve" หรือ "reject")

    @IsString()
    @IsOptional()
    remark?: string; // หมายเหตุ (อาจว่างเปล่า)

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DocumentOtherDto)
    documentOther: DocumentOtherDto[]; // รายการเอกสารอื่น ๆ

    @IsString()
    @IsOptional()
    reqDocumentOther?: string; // เอกสารอื่น ๆ ที่ร้องขอ (อาจว่างเปล่า)

    @IsString()
    @IsOptional()
    dueDateReqDocumentOther?: string; // วันที่ครบกำหนดสำหรับเอกสารอื่น ๆ ที่ร้องขอ (ในรูปแบบ ISO-8601)
}

export class Save8DChecker2 extends Save8DChecker1 {}

export class Save8DChecker3 extends Save8DChecker1 {}