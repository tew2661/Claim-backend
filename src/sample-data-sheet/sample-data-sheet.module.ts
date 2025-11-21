import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SampleDataSheetController } from './sample-data-sheet.controller';
import { SampleDataSheetService } from './sample-data-sheet.service';
import { SampleDataSheetEntity } from './entities/sample-data-sheet.entity';
import { SampleDataSheetRowEntity } from './entities/sample-data-sheet-row.entity';
import { SampleDataSheetApprovalEntity } from './entities/sample-data-sheet-approval.entity';
import { AuthModule } from 'src/auth/auth.module';
import { UsersModule } from 'src/users/users.module';
import { InspectionDetailEntity } from 'src/inspection-detail/entities/inspection-detail.entity';
import { InspectionSpecialRequestEntity } from 'src/inspection-detail/entities/inspection-special-request.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            SampleDataSheetEntity,
            SampleDataSheetRowEntity,
            SampleDataSheetApprovalEntity,
            InspectionDetailEntity,
            InspectionSpecialRequestEntity,
        ]),
        AuthModule,
        UsersModule,
    ],
    controllers: [SampleDataSheetController],
    providers: [SampleDataSheetService],
})
export class SampleDataSheetModule {}
