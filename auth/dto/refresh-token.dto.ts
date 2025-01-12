import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

export class RefreshTokenUserDto {
    @Expose()
    @IsString()
    @ApiProperty({ example: 'xxxxxx', description: 'auth' })
    refresh_token: string;

}
