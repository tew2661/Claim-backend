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
    approve: "approve" | "reject";
    remark: string;
    claim: boolean
    complain: boolean
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
