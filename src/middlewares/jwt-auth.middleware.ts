import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { ActiveStatus } from 'src/users/entities/users.entity';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
    private readonly usersService: UsersService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.split(' ')[1];
    try {
      // ตรวจสอบและถอดรหัส JWT token
      const decoded = this.jwtService.verify(token, { secret : process.env.NEST_JWT_SECRET });
      const user = await this.usersService.findForMiddlewares(decoded.id);
      if (user.activeRow == ActiveStatus.NO) {
        throw new ForbiddenException('user ยังไม่ถูกเปิดการใช้งาน');
      }
      request.headers.actionBy = user;
      return true; // อนุญาตให้เข้าถึงเส้นทางนี้
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired Access Token');
    }
  }
}

@Injectable()
export class JwtAuthMiddlewareImageUser implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // ดึง token จาก headers
    const token = req.cookies['access_token'];

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      jwt.verify(token, process.env.NEST_JWT_SECRET);
      next();
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired Access Token');
    }
  }
}
