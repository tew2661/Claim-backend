import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndexesForListInspectionDetails1732252800000 implements MigrationInterface {
    name = 'AddIndexesForListInspectionDetails1732252800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE INDEX [IX_sds_inspection_detail_active_created]
            ON [dbo].[sds_inspection_detail] ([created_at] DESC)
            INCLUDE ([supplier_code], [part_no], [part_name], [model], [supplier_name])
            WHERE [active_row] = 'Y' AND [sds_created] = 1
        `);

        await queryRunner.query(`
            CREATE INDEX [IX_sample_data_sheets_detail]
            ON [dbo].[sample_data_sheets] ([inspection_detail_id])
            INCLUDE ([id], [loop], [sdr_date], [supplier], [part_no], [part_name], [model])
        `);

        await queryRunner.query(`
            CREATE INDEX [IX_sds_special_request_detail_desc]
            ON [dbo].[sds_inspection_special_request] ([inspection_detail_id], [id] DESC)
            INCLUDE ([due_date])
        `);

        await queryRunner.query(`
            CREATE INDEX [IX_sds_approvals_sheet_loop_role]
            ON [dbo].[sample_data_sheet_approvals] ([sample_data_sheet_id], [loop], [document_type], [role], [id] DESC)
            INCLUDE ([action])
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX [IX_sds_approvals_sheet_loop_role] ON [dbo].[sample_data_sheet_approvals]
        `);

        await queryRunner.query(`
            DROP INDEX [IX_sds_special_request_detail_desc] ON [dbo].[sds_inspection_special_request]
        `);

        await queryRunner.query(`
            DROP INDEX [IX_sample_data_sheets_detail] ON [dbo].[sample_data_sheets]
        `);

        await queryRunner.query(`
            DROP INDEX [IX_sds_inspection_detail_active_created] ON [dbo].[sds_inspection_detail]
        `);
    }
}
