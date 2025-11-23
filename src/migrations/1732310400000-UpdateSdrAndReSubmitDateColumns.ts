import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateSdrAndReSubmitDateColumns1732310400000 implements MigrationInterface {
    name = 'UpdateSdrAndReSubmitDateColumns1732310400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            IF EXISTS (
                SELECT 1 FROM sys.indexes 
                WHERE name = 'IX_sample_data_sheets_detail' 
                  AND object_id = OBJECT_ID('[dbo].[sample_data_sheets]')
            )
            DROP INDEX [IX_sample_data_sheets_detail] ON [dbo].[sample_data_sheets]
        `);

        await queryRunner.query(`
            ALTER TABLE [dbo].[sample_data_sheet_approvals]
            ALTER COLUMN [re_submit_date] datetime2 NULL
        `);

        await queryRunner.query(`
            ALTER TABLE [dbo].[sample_data_sheets]
            ALTER COLUMN [sdr_date] datetime2 NOT NULL
        `);

        await queryRunner.query(`
            CREATE INDEX [IX_sample_data_sheets_detail]
            ON [dbo].[sample_data_sheets] ([inspection_detail_id])
            INCLUDE ([id], [loop], [sdr_date], [supplier], [part_no], [part_name], [model])
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX [IX_sample_data_sheets_detail] ON [dbo].[sample_data_sheets]
        `);

        await queryRunner.query(`
            ALTER TABLE [dbo].[sample_data_sheets]
            ALTER COLUMN [sdr_date] date NOT NULL
        `);

        await queryRunner.query(`
            ALTER TABLE [dbo].[sample_data_sheet_approvals]
            ALTER COLUMN [re_submit_date] date NULL
        `);

        await queryRunner.query(`
            CREATE INDEX [IX_sample_data_sheets_detail]
            ON [dbo].[sample_data_sheets] ([inspection_detail_id])
            INCLUDE ([id], [loop], [sdr_date], [supplier], [part_no], [part_name], [model])
        `);
    }
}
