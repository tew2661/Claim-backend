import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { IsNumber, IsOptional, IsString } from "class-validator";

export class GetQprDto {

    @IsString()
    @IsOptional()
    date?: string;

    @IsString()
    @IsOptional()
    qprNo?: string;

    @IsString()
    @IsOptional()
    severity?: string;

    @IsString()
    @IsOptional()
    status?: string;

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