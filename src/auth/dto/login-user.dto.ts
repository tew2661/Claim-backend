import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

export class LoginUserDto {
    @Expose()
    @IsString()
    @ApiProperty({ example: 'john.doe@example.com', description: 'Email of the user' })
    email: string;

    @Expose()
    @IsString()
    @ApiProperty({ example: '12345678', description: 'Pass of the user' })
    password: string;

}
