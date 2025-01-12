import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { AuthEntity } from './entities/auth.entity';
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
        @InjectRepository(AuthEntity)
        private readonly authRepository: Repository<AuthEntity>,

    ) { }

    async login(email: string, password: string) {
        const user = await this.usersService.validateUser(email, password);
        if (!user) {
            throw new BadRequestException('รหัสผ่านไม่ถูกต้อง.');
        }

        console.log('user' , user);

        const dataUser = await this.usersService.findOne(user.id);
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
            const user = await this.usersService.findOne(_user.id);
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

    async getRefreshToken(user: UsersEntity): Promise<AuthEntity | null> {
        const auth = await this.authRepository
            .createQueryBuilder('auth')
            .addSelect('auth.refreshToken') // ดึง refreshToken ที่ปกติจะถูกซ่อนไว้
            .where('auth.userId = :userId', { userId: user.id })
            .getOne();

        return auth ? auth : null;
    }

    async updateRefreshToken(user: UsersEntity, token: string): Promise<void> {
        // ค้นหาบันทึกในตาราง auth
        const existingAuth = await this.authRepository.findOne({ where: { user: { id: user.id } } });
        if (existingAuth.user.active == ActiveStatus.NO) {
            throw new BadRequestException('user ไม่ถูกเปิดใช้งาน');
        }

        if (existingAuth) {
            // อัปเดต Refresh Token
            existingAuth.refreshToken = token;
            await this.authRepository.save(existingAuth);
        } else {
            // สร้างบันทึกใหม่ใน auth
            const newAuth = this.authRepository.create({
                user: user,
                refreshToken: token,
            });
            await this.authRepository.save(newAuth);
        }
    }
}
