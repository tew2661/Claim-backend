import { Module, forwardRef } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from 'src/middlewares/jwt.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthEntity } from './entities/auth.entity';
import { UsersModule } from 'src/users/users.module';

@Module({
    imports: [
        PassportModule,
        forwardRef(() => UsersModule),
        JwtModule.register({
            secret: process.env.NEST_JWT_SECRET, // Replace with your actual secret
            signOptions: { expiresIn: '60m' }, // Token expiration
        }),
        TypeOrmModule.forFeature([AuthEntity]),
    ],
    providers: [AuthService, JwtStrategy],
    controllers: [AuthController],
    exports: [AuthService , JwtModule]
})
export class AuthModule { }
