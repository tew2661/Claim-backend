import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InspectionDetailController } from './inspection-detail.controller';
import { InspectionDetailService } from './inspection-detail.service';
import { InspectionDetailEntity } from './entities/inspection-detail.entity';
import { InspectionItemEntity } from './entities/inspection-item.entity';
import { AuthModule } from 'src/auth/auth.module';
import { UsersModule } from 'src/users/users.module';
import { SupplierModule } from 'src/supplier/supplier.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([InspectionDetailEntity, InspectionItemEntity]),
  forwardRef(() => AuthModule),
  forwardRef(() => UsersModule),
  forwardRef(() => SupplierModule),
  ],
  controllers: [InspectionDetailController],
  providers: [InspectionDetailService],
})
export class InspectionDetailModule {}
