import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginUserDto {
    @Expose()
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: 'john.doe@example.com', description: 'Email of the user' })
    username: string;

    @Expose()
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: '12345678', description: 'Pass of the user' })
    password: string;

}
