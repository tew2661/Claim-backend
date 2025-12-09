import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InspectionDetailService } from 'src/inspection-detail/inspection-detail.service';
import { EmailService } from 'src/email/email.service';
import { SupplierService } from 'src/supplier/supplier.service';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as moment from 'moment';

@Injectable()
export class CronJobsService {
    private readonly logger = new Logger(CronJobsService.name);

    constructor(
        private readonly inspectionDetailService: InspectionDetailService,
        private readonly emailService: EmailService,
        private readonly supplierService: SupplierService,
        @InjectDataSource()
        private readonly dataSource: DataSource,
    ) { 
        this.updateSampleDataSheetDelayStatus();
    }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'delay_notifications' })
    async handleDelayNotifications() {
        this.logger.debug('Running delay notification job...' , moment().format('YYYY-MM-DD HH:mm:ss'));
        await this.updateSampleDataSheetDelayStatus();
        await this.handleMonthlyReminder();
        await this.handleMonthlyDelay();
        await this.handleSpecialRequestDelay();
        this.logger.debug('Completed delay notification job.' , moment().format('YYYY-MM-DD HH:mm:ss'));
    }

    async updateSampleDataSheetDelayStatus() {
        this.logger.debug('Running daily delay status update job...');
        
        try {
            // Update all sample_data_sheets with computed delay status
            const updateQuery = `
                WITH both_approved AS (
                    SELECT
                        sds_app.sample_data_sheet_id,
                        sds_app.loop,
                        CASE 
                            WHEN sds_app.action_date > sdr_app.action_date THEN sds_app.action_date
                            ELSE sdr_app.action_date
                        END AS action_date
                    FROM sample_data_sheet_approvals sds_app
                    INNER JOIN sample_data_sheet_approvals sdr_app
                        ON sdr_app.sample_data_sheet_id = sds_app.sample_data_sheet_id
                        AND sdr_app.loop = sds_app.loop
                        AND sdr_app.document_type = 'SDR'
                        AND sdr_app.role = 'Approver'
                        AND sdr_app.action = 'Approved'
                        AND sdr_app.deleted_at IS NULL
                    WHERE sds_app.document_type = 'SDS'
                      AND sds_app.role = 'Approver'
                      AND sds_app.action = 'Approved'
                      AND sds_app.deleted_at IS NULL
                )
                UPDATE sds
                SET 
                    has_delay = CASE 
                        WHEN sds.sdr_date IS NOT NULL THEN 
                            CASE 
                                -- ถ้า submitted แล้ว เช็คว่า submit date > due date
                                WHEN ba.action_date IS NOT NULL 
                                 AND CAST(sds.sdr_date AS DATE) < CAST(ba.action_date AS DATE) THEN 1
                                -- ถ้ายังไม่ submitted เช็คว่า current date > due date
                                WHEN ba.action_date IS NULL 
                                 AND CAST(sds.sdr_date AS DATE) < CAST(GETDATE() AS DATE) THEN 1
                                ELSE 0
                            END
                        ELSE 0
                    END,
                    delay_days = CASE 
                        -- ถ้า submitted แล้วและ submit หลัง due date
                        WHEN sds.sdr_date IS NOT NULL 
                         AND ba.action_date IS NOT NULL
                         AND CAST(sds.sdr_date AS DATE) < CAST(ba.action_date AS DATE) THEN 
                            DATEDIFF(day, CAST(sds.sdr_date AS DATE), CAST(ba.action_date AS DATE))
                        -- ถ้ายังไม่ submitted และเลย due date แล้ว
                        WHEN sds.sdr_date IS NOT NULL 
                         AND ba.action_date IS NULL
                         AND CAST(sds.sdr_date AS DATE) < CAST(GETDATE() AS DATE) THEN 
                            DATEDIFF(day, CAST(sds.sdr_date AS DATE), CAST(GETDATE() AS DATE))
                        ELSE NULL
                    END
                FROM dbo.sample_data_sheets sds
                LEFT JOIN both_approved ba 
                    ON ba.sample_data_sheet_id = sds.id
                    AND ba.loop = sds.loop
                WHERE sds.deleted_at IS NULL
            `;            await this.dataSource.query(updateQuery);
            this.logger.debug(`Updated delay status for all sample data sheets`);

            // Update all sds_inspection_detail with computed delay status
            // For records where sds_created = 0 and past due_date
            const updateInspectionQuery = `
                UPDATE detail
                SET 
                    has_delay = CASE 
                        WHEN detail.sds_created = 0 AND detail.due_date IS NOT NULL THEN 
                            CASE 
                                WHEN CAST(detail.due_date AS DATE) < CAST(GETDATE() AS DATE) THEN 1
                                ELSE 0
                            END
                        ELSE 0
                    END,
                    delay_days = CASE 
                        WHEN detail.sds_created = 0 
                         AND detail.due_date IS NOT NULL 
                         AND CAST(detail.due_date AS DATE) < CAST(GETDATE() AS DATE) THEN 
                            DATEDIFF(day, CAST(detail.due_date AS DATE), CAST(GETDATE() AS DATE))
                        ELSE NULL
                    END
                FROM dbo.sds_inspection_detail detail
                WHERE detail.deleted_at IS NULL
                  AND detail.active_row = 'Y'
            `;

            await this.dataSource.query(updateInspectionQuery);
            this.logger.debug(`Updated delay status for all inspection details`);
        } catch (error) {
            this.logger.error('Error updating delay status', error);
        }
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
