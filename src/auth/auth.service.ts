import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActiveStatus, UsersEntity } from 'src/users/entities/users.entity';

@Injectable()
export class AuthService {
    private readonly jwtSecret = process.env.NEST_JWT_SECRET; // Replace with your secret key or use environment variables
    private readonly refreshTokenSecret = process.env.NEST_REFRESH_JWT_SECRET; // Replace with your secret key for refresh tokens

    private readonly jwtSecretExpiresIn = process.env.NEST_JWT_SECRET_EXPIRESIN; // Replace with your secret key or use environment variables
    private readonly refreshTokenSecretExpiresIn = process.env.NEST_REFRESH_JWT_SECRET_EXPIRESIN; // Replace with your secret key for refresh tokens

    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,

    ) { }

    async login(username: string, password: string, mode: 'supplier' | 'jtekt' = 'jtekt') {
        let user = null;

        if (mode == 'jtekt') {
            user = await this.usersService.validateUser(username, password);
        } else {
            user = await this.usersService.validateUserForSupplier(username, password);
        }
        if (!user) {
            throw new BadRequestException('รหัสผ่านไม่ถูกต้อง.');
        }

        let dataUser = null;
        if (mode == 'jtekt') {
            dataUser = await this.usersService.findOne(user.id);
        } else {
            dataUser = await this.usersService.findOneForSupplier(user.id);
        }
        if (!dataUser) {
            throw new BadRequestException('ไม่พบ user ที่ใช้งานได้');
        }
        if (dataUser.active == ActiveStatus.NO) {
            throw new BadRequestException('user ไม่ถูกเปิดใช้งาน');
        }

        const payload = { name: user.name, id: user.id, role: dataUser.role };
        const accessToken = this.jwtService.sign(payload, { secret: this.jwtSecret, expiresIn: this.jwtSecretExpiresIn || '15m' });
        const refreshToken = this.jwtService.sign(payload, { secret: this.refreshTokenSecret, expiresIn: this.refreshTokenSecretExpiresIn || '7d' });

        return {
            user: dataUser,
            access_token: accessToken,
            refresh_token: refreshToken
        };
    }

    async refreshTokens(refreshToken: string) {
        try {
            const _user = this.jwtService.verify(refreshToken, { secret: this.refreshTokenSecret });
            const user = await this.usersService.findOneAll(_user.id);
            if (!user) {
                throw new UnauthorizedException('Invalid refresh token');
            }

            if (user.active == ActiveStatus.NO) {
                throw new BadRequestException('user ไม่ถูกเปิดใช้งาน');
            }

            const payload = { name: user.name, id: user.id, role: user.role };
            const newAccessToken = this.jwtService.sign(payload, { secret: this.jwtSecret, expiresIn: this.jwtSecretExpiresIn || '15m' });
            const newRefreshToken = this.jwtService.sign(payload, { secret: this.refreshTokenSecret, expiresIn: this.refreshTokenSecretExpiresIn || '7d' });
            return {
                user: user,
                access_token: newAccessToken,
                refresh_token: newRefreshToken
            };
        } catch (error) {
            throw new UnauthorizedException('Invalid refresh token');
        }
    }
}
