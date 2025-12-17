import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSaStatusAndDueToImplementToRows1800000000026 implements MigrationInterface {
    name = 'AddSaStatusAndDueToImplementToRows1800000000026';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add sa_status column
        await queryRunner.query(`
            ALTER TABLE "dbo"."sample_data_sheet_rows" 
            ADD "sa_status" nvarchar(50) NULL
        `);

        // Add due_to_implement column
        await queryRunner.query(`
            ALTER TABLE "dbo"."sample_data_sheet_rows" 
            ADD "due_to_implement" datetime2 NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "dbo"."sample_data_sheet_rows" 
            DROP COLUMN "due_to_implement"
        `);

        await queryRunner.query(`
            ALTER TABLE "dbo"."sample_data_sheet_rows" 
            DROP COLUMN "sa_status"
        `);
    }
}
