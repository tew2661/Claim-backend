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
                    const moment = require('moment');
                    const monthLabel = moment(item.dueDate ?? new Date()).format('MM-YYYY');
                    const dueDate25 = moment(item.dueDate ?? new Date()).set('date', 25).format('DD-MM-YYYY');
                    const baseUrl = process.env.MAIL_LINK_WEBAPP_SUPPLIER_SDS ?? 'http://192.168.3.156:8000/';
                    const subject = `SDS Monthly Request Reminder: ${item.partNo}`;
                    const html = `
                                            <div style="font-family: Arial, 'Noto Sans Thai', sans-serif; color: #222; line-height: 1.6;">
                                                <p style="margin:0 0 6px 0;">Dear ${item.supplierName || 'Supplier'},</p>
                                                <p style="margin:0 0 10px 0;">
                                                    You have received, <span style="font-weight:700;">SDS Monthly Request</span> on <span style="color:#1e88e5; font-weight:700;">${monthLabel}</span>
                                                </p>
                                                <p style="margin:0 0 10px 0;">Please input and Submit Monthly SDS by <span style="color:#1e88e5; font-weight:700;">${dueDate25}</span></p>

                                                <table style="margin:10px 0;">
                                                    <tr><td style="padding-right:10px;">Part No. :</td><td><strong>${item.partNo}</strong></td></tr>
                                                    <tr><td style="padding-right:10px;">Part Name :</td><td><strong>${item.partName}</strong></td></tr>
                                                    <tr><td style="padding-right:10px;">Model :</td><td><strong>${item.model}</strong></td></tr>
                                                </table>

                                                <p style="margin:14px 0 6px 0;">To Submit SDS Monthly Request., Please access in MENU : <strong>Create SDS</strong></p>
                                                <p style="margin:6px 0;">Please access Sample Data Sheet (SDS) to review through below link;</p>
                                                <p style="margin:6px 0;"><a href="${baseUrl}" target="_blank" rel="noopener" style="color:#1e88e5;">${baseUrl}</a></p>

                                                <p style="margin:18px 0 6px 0;">Thank you and Best regards,</p>
                                                <p style="margin:0 0 18px 0;">Sample Data Sheet System</p>

                                                <p style="margin:0; padding:10px; border:1px dashed #999; background:#f7f7f7; font-size:12px;">
                                                    THIS IS AN AUTOMATED MESSAGE - PLEASE DO NOT REPLY THIS EMAIL.
                                                </p>
                                            </div>
                                        `;
                    this.emailService.sendEmail(supplier.email.join(','), subject, html);
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
                    const monthLabel = require('moment')(item.dueDate ?? new Date()).format('MM-YYYY');
                    const dueDateLabel = require('moment')(item.dueDate ?? new Date()).format('DD-MM-YYYY');
                    const baseUrl = process.env.MAIL_LINK_WEBAPP_SUPPLIER_SDS ?? 'http://192.168.3.156:8000/';
                    const subject = `SDS Monthly Request OVERDUE: ${item.partNo}`;
                    const html = `
                                            <div style="font-family: Arial, 'Noto Sans Thai', sans-serif; color: #222; line-height: 1.6;">
                                                <p style="margin:0 0 6px 0;">Dear ${item.supplierName || 'Supplier'},</p>
                                                <p style="margin:0 0 10px 0;">
                                                    You have received Alert E-Mail, SDS Monthly Request / SDS Special Request Status is <span style="color:#e53935; font-weight:700;">OVERDUE X Day</span> on <span style="font-weight:700;">${monthLabel}</span>
                                                </p>
                                                <p style="margin:0 0 6px 0;">Your SDS submission Due Date is on <span style="color:#1e88e5; font-weight:700;">${dueDateLabel}</span></p>
                                                <p style="margin:0 0 10px 0; color:#e53935; font-weight:700;">Please input and Submit AS SOON AS POSSIBLE</p>

                                                <table style="margin:10px 0;">
                                                    <tr><td style="padding-right:10px;">Part No. :</td><td><strong>${item.partNo}</strong></td></tr>
                                                    <tr><td style="padding-right:10px;">Part Name :</td><td><strong>${item.partName}</strong></td></tr>
                                                    <tr><td style="padding-right:10px;">Model :</td><td><strong>${item.model}</strong></td></tr>
                                                </table>

                                                <p style="margin:14px 0 6px 0;">To Submit SDS Monthly Request., Please access in MENU : <strong>Create SDS</strong></p>
                                                <p style="margin:6px 0;">Please access Sample Data Sheet (SDS) to review through below link;</p>
                                                <p style="margin:6px 0;"><a href="${baseUrl}" target="_blank" rel="noopener" style="color:#1e88e5;">${baseUrl}</a></p>

                                                <p style="margin:18px 0 6px 0;">Thank you and Best regards,</p>
                                                <p style="margin:0 0 18px 0;">Sample Data Sheet System</p>

                                                <p style="margin:0; padding:10px; border:1px dashed #999; background:#f7f7f7; font-size:12px;">
                                                    THIS IS AN AUTOMATED MESSAGE - PLEASE DO NOT REPLY THIS EMAIL.
                                                </p>
                                            </div>
                                        `;
                    this.emailService.sendEmail(supplier.email.join(','), subject, html);
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
                    const monthLabel = require('moment')(request.dueDate ?? new Date()).format('MM-YYYY');
                    const dueDateLabel = require('moment')(request.dueDate ?? new Date()).format('DD-MM-YYYY');
                    const baseUrl = process.env.MAIL_LINK_WEBAPP_SUPPLIER_SDS ?? 'http://192.168.3.156:8000/';
                    const subject = `SDS Monthly / Special Request OVERDUE: ${inspectionDetail.partNo}`;
                    const html = `
                                            <div style="font-family: Arial, 'Noto Sans Thai', sans-serif; color: #222; line-height: 1.6;">
                                                <p style="margin:0 0 6px 0;">Dear ${inspectionDetail.supplierName || 'Supplier'},</p>
                                                <p style="margin:0 0 10px 0;">
                                                    You have received Alert E-Mail, SDS Monthly Request / SDS Special Request Status is <span style="color:#e53935; font-weight:700;">OVERDUE X Day</span> on <span style="font-weight:700;">${monthLabel}</span>
                                                </p>
                                                <p style="margin:0 0 6px 0;">Your SDS submission Due Date is on <span style="color:#1e88e5; font-weight:700;">${dueDateLabel}</span></p>
                                                <p style="margin:0 0 10px 0; color:#e53935; font-weight:700;">Please input and Submit AS SOON AS POSSIBLE</p>

                                                <table style="margin:10px 0;">
                                                    <tr><td style="padding-right:10px;">Part No. :</td><td><strong>${inspectionDetail.partNo}</strong></td></tr>
                                                    <tr><td style="padding-right:10px;">Part Name :</td><td><strong>${inspectionDetail.partName}</strong></td></tr>
                                                    <tr><td style="padding-right:10px;">Model :</td><td><strong>${inspectionDetail.model}</strong></td></tr>
                                                </table>

                                                <p style="margin:14px 0 6px 0;">To Submit SDS Monthly Request., Please access in MENU : <strong>Create SDS</strong></p>
                                                <p style="margin:6px 0;">Please access Sample Data Sheet (SDS) to review through below link;</p>
                                                <p style="margin:6px 0;"><a href="${baseUrl}" target="_blank" rel="noopener" style="color:#1e88e5;">${baseUrl}</a></p>

                                                <p style="margin:18px 0 6px 0;">Thank you and Best regards,</p>
                                                <p style="margin:0 0 18px 0;">Sample Data Sheet System</p>

                                                <p style="margin:0; padding:10px; border:1px dashed #999; background:#f7f7f7; font-size:12px;">
                                                    THIS IS AN AUTOMATED MESSAGE - PLEASE DO NOT REPLY THIS EMAIL.
                                                </p>
                                            </div>
                                        `;
                    this.emailService.sendEmail(supplier.email.join(','), subject, html);
                }
            }
        } catch (error) {
            this.logger.error('Error handling special request delay notifications', error);
        }
    }
}
