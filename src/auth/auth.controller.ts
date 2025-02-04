import { Controller, Post, Body, Res, Req, UseGuards, Get } from '@nestjs/common';
import { LoginUserDto } from './dto/login-user.dto';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {  Response } from 'express';
import { JwtAuthGuard } from 'src/middlewares/jwt-auth.middleware';
import { UsersEntity } from 'src/users/entities/users.entity';
import { RefreshTokenUserDto } from './dto/refresh-token.dto';

@ApiTags('Auth')
@ApiBearerAuth('JWT')
@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
    ) { }

    @Post('login')
    @ApiOperation({ summary: 'User Login' })
    @ApiBody({ type: LoginUserDto })
    async login(@Body() body: LoginUserDto, @Res() res: Response) {
        const { username, password } = body;
        const dataLogin = await this.authService.login(username, password)
        return res.status(200).json({ 
            message: 'Login successful', 
            statusCode: 200, 
            ...dataLogin
        });
    }

    @Post('login-supplier')
    @ApiOperation({ summary: 'User Login' })
    @ApiBody({ type: LoginUserDto })
    async loginSupplier(@Body() body: LoginUserDto, @Res() res: Response) {
        const { username, password } = body;
        const dataLogin = await this.authService.login(username, password, 'supplier')
        return res.status(200).json({ 
            message: 'Login successful', 
            statusCode: 200, 
            ...dataLogin
        });
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    async GetUserMe(
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }}
    ): Promise<UsersEntity> {
        return actionBy
    }

    @Post('refresh')
    @ApiBody({ type: RefreshTokenUserDto })
    async refresh(
        @Res() res: Response,
        @Body() { refresh_token } : { refresh_token : string },
    ) {
        if (!refresh_token) {
            return res.status(401).json({ message: 'Refresh Token is missing' });
        }

        const dataUser = await this.authService.refreshTokens(refresh_token);
        return res.status(200).json({ 
            message: 'Token refreshed successfully', 
            statusCode: 200, 
            ...dataUser
        });
    }

    // @Post('logout')
    // @UseGuards(JwtAuthGuard)
    // async logout(@Req() req: Request, @Res() res: Response) {

    //     return res.status(200).json({ message: 'Logout successfully', statusCode: 200 });
    // }

   
}
