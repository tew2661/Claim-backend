import { MigrationInterface, QueryRunner } from "typeorm";

export class AddToleranceColumnsToSampleDataSheetRow1800000000021 implements MigrationInterface {
    name = 'AddToleranceColumnsToSampleDataSheetRow1800000000021'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dbo"."sample_data_sheet_rows" ADD "tolerance_plus" int`);
        await queryRunner.query(`ALTER TABLE "dbo"."sample_data_sheet_rows" ADD "tolerance_minus" int`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dbo"."sample_data_sheet_rows" DROP COLUMN "tolerance_minus"`);
        await queryRunner.query(`ALTER TABLE "dbo"."sample_data_sheet_rows" DROP COLUMN "tolerance_plus"`);
    }
}
