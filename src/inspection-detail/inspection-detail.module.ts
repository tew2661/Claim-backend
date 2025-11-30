import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InspectionDetailController } from './inspection-detail.controller';
import { InspectionDetailService } from './inspection-detail.service';
import { InspectionDetailEntity } from './entities/inspection-detail.entity';
import { InspectionItemEntity } from './entities/inspection-item.entity';
import { InspectionSpecialRequestEntity } from './entities/inspection-special-request.entity';
import { AuthModule } from 'src/auth/auth.module';
import { UsersModule } from 'src/users/users.module';
import { SupplierModule } from 'src/supplier/supplier.module';
import { SampleDataSheetModule } from 'src/sample-data-sheet/sample-data-sheet.module';
import { EmailModule } from 'src/email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([InspectionDetailEntity, InspectionItemEntity, InspectionSpecialRequestEntity]),
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
    forwardRef(() => SupplierModule),
    forwardRef(() => SampleDataSheetModule),
    EmailModule,
  ],
  controllers: [InspectionDetailController],
  providers: [InspectionDetailService],
  exports: [InspectionDetailService],
})
export class InspectionDetailModule { }
