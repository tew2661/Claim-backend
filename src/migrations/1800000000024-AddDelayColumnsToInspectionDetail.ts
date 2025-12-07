import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDelayColumnsToInspectionDetail1800000000024 implements MigrationInterface {
    name = 'AddDelayColumnsToInspectionDetail1800000000024'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add has_delay column
        await queryRunner.query(`
            ALTER TABLE [dbo].[sds_inspection_detail] 
            ADD [has_delay] bit NOT NULL CONSTRAINT DF_sds_inspection_detail_has_delay DEFAULT 0
        `);

        // Add delay_days column
        await queryRunner.query(`
            ALTER TABLE [dbo].[sds_inspection_detail] 
            ADD [delay_days] int NULL
        `);

        // Create index on has_delay for faster filtering
        await queryRunner.query(`
            CREATE INDEX [IX_sds_inspection_detail_has_delay] 
            ON [dbo].[sds_inspection_detail] ([has_delay])
        `);

        // Create composite index on due_date and has_delay for optimized queries
        await queryRunner.query(`
            CREATE INDEX [IX_sds_inspection_detail_due_date_has_delay] 
            ON [dbo].[sds_inspection_detail] ([due_date], [has_delay])
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`
            DROP INDEX [IX_sds_inspection_detail_due_date_has_delay] 
            ON [dbo].[sds_inspection_detail]
        `);

        await queryRunner.query(`
            DROP INDEX [IX_sds_inspection_detail_has_delay] 
            ON [dbo].[sds_inspection_detail]
        `);

        // Drop columns
        await queryRunner.query(`
            ALTER TABLE [dbo].[sds_inspection_detail] 
            DROP CONSTRAINT DF_sds_inspection_detail_has_delay
        `);

        await queryRunner.query(`
            ALTER TABLE [dbo].[sds_inspection_detail] 
            DROP COLUMN [delay_days]
        `);

        await queryRunner.query(`
            ALTER TABLE [dbo].[sds_inspection_detail] 
            DROP COLUMN [has_delay]
        `);
    }
}
