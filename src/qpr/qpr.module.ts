// src/qpr/qpr.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { QprController } from './qpr.controller';
import { QprService } from './qpr.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { UsersModule } from 'src/users/users.module';
import { QprEntity } from './entities/qpr.entity';
import { SupplierEntity } from 'src/supplier/entities/supplier.entity';
import { NotificationModule } from 'src/my-gateway/my-gateway.module';
import { LogEntity } from 'src/logs/entities/log.entity';

@Module({
  controllers: [QprController],
  providers: [QprService],
  imports: [
    TypeOrmModule.forFeature([
        QprEntity,
        SupplierEntity,
        LogEntity
    ]),
    forwardRef(() => AuthModule),
    UsersModule,
    NotificationModule
  ]
})
export class QprModule {}
