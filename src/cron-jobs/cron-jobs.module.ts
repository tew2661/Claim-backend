import { Module } from '@nestjs/common';
import { CronJobsService } from './cron-jobs.service';
import { InspectionDetailModule } from 'src/inspection-detail/inspection-detail.module';
import { EmailModule } from 'src/email/email.module';
import { SupplierModule } from 'src/supplier/supplier.module';

@Module({
    imports: [
        InspectionDetailModule,
        EmailModule,
        SupplierModule,
    ],
    providers: [CronJobsService],
})
export class CronJobsModule { }
