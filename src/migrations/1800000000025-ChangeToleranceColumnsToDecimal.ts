import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeToleranceColumnsToDecimal1800000000025 implements MigrationInterface {
    name = 'ChangeToleranceColumnsToDecimal1800000000025'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Change tolerance_plus from int to decimal(18,4) in sample_data_sheet_rows
        await queryRunner.query(`ALTER TABLE "dbo"."sample_data_sheet_rows" ALTER COLUMN "tolerance_plus" decimal(18,4)`);
        
        // Change tolerance_minus from int to decimal(18,4) in sample_data_sheet_rows
        await queryRunner.query(`ALTER TABLE "dbo"."sample_data_sheet_rows" ALTER COLUMN "tolerance_minus" decimal(18,4)`);
        
        // Change specification from nvarchar to decimal(18,4) in sample_data_sheet_rows
        await queryRunner.query(`ALTER TABLE "dbo"."sample_data_sheet_rows" ALTER COLUMN "specification" decimal(18,4)`);
        
        // Change tolerance_plus from nvarchar to decimal(18,4) in sds_inspection_items
        await queryRunner.query(`ALTER TABLE "dbo"."sds_inspection_items" ALTER COLUMN "tolerance_plus" decimal(18,4)`);
        
        // Change tolerance_minus from nvarchar to decimal(18,4) in sds_inspection_items
        await queryRunner.query(`ALTER TABLE "dbo"."sds_inspection_items" ALTER COLUMN "tolerance_minus" decimal(18,4)`);
        
        // Change specification from nvarchar to decimal(18,4) in sds_inspection_items
        await queryRunner.query(`ALTER TABLE "dbo"."sds_inspection_items" ALTER COLUMN "specification" decimal(18,4)`);
        
        // Change value from decimal(18,2) to decimal(18,4) in sample_data_sheet_row_samples
        await queryRunner.query(`ALTER TABLE "dbo"."sample_data_sheet_row_samples" ALTER COLUMN "value" decimal(18,4)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert sample_data_sheet_row_samples value back to decimal(18,2)
        await queryRunner.query(`ALTER TABLE "dbo"."sample_data_sheet_row_samples" ALTER COLUMN "value" decimal(18,2)`);
        
        // Revert sds_inspection_items specification back to nvarchar
        await queryRunner.query(`ALTER TABLE "dbo"."sds_inspection_items" ALTER COLUMN "specification" nvarchar(100)`);
        
        // Revert sds_inspection_items tolerance_minus back to nvarchar
        await queryRunner.query(`ALTER TABLE "dbo"."sds_inspection_items" ALTER COLUMN "tolerance_minus" nvarchar(50)`);
        
        // Revert sds_inspection_items tolerance_plus back to nvarchar
        await queryRunner.query(`ALTER TABLE "dbo"."sds_inspection_items" ALTER COLUMN "tolerance_plus" nvarchar(50)`);
        
        // Revert sample_data_sheet_rows specification back to nvarchar
        await queryRunner.query(`ALTER TABLE "dbo"."sample_data_sheet_rows" ALTER COLUMN "specification" nvarchar(100)`);
        
        // Revert sample_data_sheet_rows tolerance_minus back to int
        await queryRunner.query(`ALTER TABLE "dbo"."sample_data_sheet_rows" ALTER COLUMN "tolerance_minus" int`);
        
        // Revert sample_data_sheet_rows tolerance_plus back to int
        await queryRunner.query(`ALTER TABLE "dbo"."sample_data_sheet_rows" ALTER COLUMN "tolerance_plus" int`);
    }
}
