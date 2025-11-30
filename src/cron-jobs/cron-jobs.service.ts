import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InspectionDetailService } from 'src/inspection-detail/inspection-detail.service';
import { EmailService } from 'src/email/email.service';
import { SupplierService } from 'src/supplier/supplier.service';

@Injectable()
export class CronJobsService {
    private readonly logger = new Logger(CronJobsService.name);

    constructor(
        private readonly inspectionDetailService: InspectionDetailService,
        private readonly emailService: EmailService,
        private readonly supplierService: SupplierService,
    ) { }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'delay_notifications' })
    async handleDelayNotifications() {
        this.logger.debug('Running delay notification job...');
        await this.handleMonthlyReminder();
        await this.handleMonthlyDelay();
        await this.handleSpecialRequestDelay();
    }

    async handleMonthlyReminder() {
        const now = new Date();
        // Run only on the 1st of the month
        if (now.getDate() !== 1) {
            return;
        }

        try {
            const activeItems = await this.inspectionDetailService.findActiveInspectionDetails();
            console.log('handMonthlyReminder', activeItems)
            if (activeItems.length === 0) return;

            this.logger.debug(`Found ${activeItems.length} active items for monthly reminder.`);

            for (const item of activeItems) {
                const supplier = await this.supplierService.findByCode(item.supplierCode);
                if (supplier && supplier.email && supplier.email.length > 0) {
                    const subject = `Monthly SDS Submission Reminder: ${item.partNo}`;
                    const html = `
                        <p>Dear Supplier,</p>
                        <p>This is a reminder to submit the Monthly SDS for Part No: <strong>${item.partNo}</strong>.</p>
                        <p>Please log in to the system and submit the data by the 25th of this month.</p>
                        <br>
                        <p>Best regards,</p>
                        <p>Sample Data Sheet System</p>
                    `;
                    for (const email of supplier.email) {
                        await this.emailService.sendEmail(email, subject, html);
                    }
                }
            }
        } catch (error) {
            this.logger.error('Error handling monthly reminder', error);
        }
    }

    async handleMonthlyDelay() {
        try {
            const delayedItems = await this.inspectionDetailService.findMonthlyDelayedItems();
            console.log('handMonthlyDelay', delayedItems)
            if (delayedItems.length === 0) return;

            this.logger.debug(`Found ${delayedItems.length} monthly delayed items.`);

            for (const item of delayedItems) {
                const supplier = await this.supplierService.findByCode(item.supplierCode);
                if (supplier && supplier.email && supplier.email.length > 0) {
                    const subject = `SDS Submission Delayed: ${item.partNo}`;
                    const html = `
                        <p>Dear Supplier,</p>
                        <p>This is a reminder that the SDS submission for Part No: <strong>${item.partNo}</strong> is delayed.</p>
                        <p>Please submit the SDS as soon as possible.</p>
                        <br>
                        <p>Best regards,</p>
                        <p>Sample Data Sheet System</p>
                    `;
                    for (const email of supplier.email) {
                        await this.emailService.sendEmail(email, subject, html);
                    }
                }
            }
        } catch (error) {
            this.logger.error('Error handling monthly delay notifications', error);
        }
    }

    async handleSpecialRequestDelay() {
        try {
            const delayedRequests = await this.inspectionDetailService.findSpecialRequestDelayedItems();
            console.log('handSpecialRequestDelay', delayedRequests)
            if (delayedRequests.length === 0) return;

            this.logger.debug(`Found ${delayedRequests.length} special request delayed items.`);

            for (const request of delayedRequests) {
                // Access inspectionDetail via relation
                const inspectionDetail = request;
                if (!inspectionDetail) continue;

                const supplier = await this.supplierService.findByCode(inspectionDetail.supplierCode);
                if (supplier && supplier.email && supplier.email.length > 0) {
                    const subject = `Special Request SDS Submission Delayed: ${inspectionDetail.partNo}`;
                    const html = `
                        <p>Dear Supplier,</p>
                        <p>This is a reminder that the Special Request SDS submission for Part No: <strong>${inspectionDetail.partNo}</strong> is overdue.</p>
                        <p>Due Date: ${request.dueDate}</p>
                        <p>Please submit the SDS as soon as possible.</p>
                        <br>
                        <p>Best regards,</p>
                        <p>Sample Data Sheet System</p>
                    `;
                    for (const email of supplier.email) {
                        await this.emailService.sendEmail(email, subject, html);
                    }
                }
            }
        } catch (error) {
            this.logger.error('Error handling special request delay notifications', error);
        }
    }
}
