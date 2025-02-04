import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { dataSource } from './data-source';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { NotificationModule } from './my-gateway/my-gateway.module';
import { SupplierModule } from './supplier/supplier.module';
import { QprModule } from './qpr/qpr.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Make ConfigModule globally available
    }),
    TypeOrmModule.forRoot(dataSource.options),
    AuthModule,
    UsersModule,
    NotificationModule,
    SupplierModule,
    QprModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
