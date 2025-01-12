import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { IsNumber } from "class-validator";

export class GetUserDto {

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