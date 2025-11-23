import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLoopColumnToSampleDataSheetTables1800000000011 implements MigrationInterface {
    name = 'AddLoopColumnToSampleDataSheetTables1800000000011'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add loop column to sample_data_sheets table
        await queryRunner.query(`
            ALTER TABLE [dbo].[sample_data_sheets] 
            ADD [loop] int NOT NULL CONSTRAINT [DF_sample_data_sheets_loop] DEFAULT 1
        `);

        // Add loop column to sample_data_sheet_approvals table
        await queryRunner.query(`
            ALTER TABLE [dbo].[sample_data_sheet_approvals] 
            ADD [loop] int NOT NULL CONSTRAINT [DF_sample_data_sheet_approvals_loop] DEFAULT 1
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop loop column from sample_data_sheet_approvals table
        await queryRunner.query(`
            ALTER TABLE [dbo].[sample_data_sheet_approvals] 
            DROP CONSTRAINT [DF_sample_data_sheet_approvals_loop]
        `);
        await queryRunner.query(`
            ALTER TABLE [dbo].[sample_data_sheet_approvals] 
            DROP COLUMN [loop]
        `);

        // Drop loop column from sample_data_sheets table
        await queryRunner.query(`
            ALTER TABLE [dbo].[sample_data_sheets] 
            DROP CONSTRAINT [DF_sample_data_sheets_loop]
        `);
        await queryRunner.query(`
            ALTER TABLE [dbo].[sample_data_sheets] 
            DROP COLUMN [loop]
        `);
    }
}
