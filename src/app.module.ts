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
import { LogsModule } from './logs/logs.module';
import { EmailModule } from './email/email.module';
import { ScheduleModule } from '@nestjs/schedule';
import { InspectionDetailModule } from './inspection-detail/inspection-detail.module';
import { SampleDataSheetModule } from './sample-data-sheet/sample-data-sheet.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Make ConfigModule globally available
    }),
    TypeOrmModule.forRoot(dataSource.options),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    NotificationModule,
  SupplierModule,
    QprModule,
    LogsModule,
    EmailModule,
  InspectionDetailModule,
  SampleDataSheetModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
