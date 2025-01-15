import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { IsNumber, IsOptional, IsString } from "class-validator";

export class GetSupplierDto {

    @IsString()
    @IsOptional()
    supplierCode?: string;

    @IsString()
    @IsOptional()
    supplierName?: string;

    @Expose()
    @IsNumber()
    @Type(() => Number)
    @ApiProperty({
        example: 10,
        description: 'limit',
    })
    limit: number;

    @Expose()
    @IsNumber()
    @Type(() => Number)
    @ApiProperty({
        example: 0,
        description: 'offset',
    })
    offset: number;
}