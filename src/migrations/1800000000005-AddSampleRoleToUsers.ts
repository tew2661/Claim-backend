import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSampleRoleToUsers1800000000005 implements MigrationInterface {
    name = 'AddSampleRoleToUsers1800000000005'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE [dbo].[users] ADD [sampleDataSheetRole] nvarchar(255) NOT NULL CONSTRAINT DF_users_sample_data_sheet_role DEFAULT (N'')`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE [dbo].[users] DROP CONSTRAINT IF EXISTS DF_users_sample_data_sheet_role`);
        await queryRunner.query(`ALTER TABLE [dbo].[users] DROP COLUMN [sampleDataSheetRole]`);
    }
}
