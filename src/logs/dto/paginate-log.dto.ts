import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { Expose, Type } from 'class-transformer';
import { FilterLogDto } from './filter-log.dto';
import { ApiProperty } from '@nestjs/swagger';

export class PaginateLogDto extends FilterLogDto {
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
