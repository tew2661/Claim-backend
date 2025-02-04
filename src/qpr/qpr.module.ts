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

@Module({
  controllers: [QprController],
  providers: [QprService],
  imports: [
    TypeOrmModule.forFeature([
        QprEntity,
        SupplierEntity
    ]),
    forwardRef(() => AuthModule),
    UsersModule,
    NotificationModule
  ]
})
export class QprModule {}
