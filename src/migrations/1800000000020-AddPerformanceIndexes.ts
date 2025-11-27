import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformanceIndexes1800000000020 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Index for sample_data_sheets - inspection_detail_id lookup
        await queryRunner.query(`
            CREATE INDEX IX_sample_data_sheets_inspection_detail_id 
            ON dbo.sample_data_sheets(inspection_detail_id)
        `);

        // Index for sample_data_sheets - created_at for sorting
        await queryRunner.query(`
            CREATE INDEX IX_sample_data_sheets_created_at 
            ON dbo.sample_data_sheets(created_at DESC)
        `);

        // Composite index for sds_inspection_detail - filtering by sds_created and active_row
        // INCLUDE clause adds frequently accessed columns to avoid key lookups
        await queryRunner.query(`
            CREATE INDEX IX_sds_inspection_detail_sds_created_active 
            ON dbo.sds_inspection_detail(sds_created, active_row) 
            INCLUDE (part_status, supplier_edit_status, supplier_code)
        `);

        // Composite index for sample_data_sheet_approvals - complex filtering
        // This index supports queries that filter by sample_data_sheet_id, loop, document_type, role, and action
        await queryRunner.query(`
            CREATE INDEX IX_approvals_composite 
            ON dbo.sample_data_sheet_approvals(sample_data_sheet_id, loop, document_type, role, action)
            INCLUDE (action_date, re_submit_date)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes in reverse order
        await queryRunner.query(`
            DROP INDEX IX_approvals_composite 
            ON dbo.sample_data_sheet_approvals
        `);

        await queryRunner.query(`
            DROP INDEX IX_sds_inspection_detail_sds_created_active 
            ON dbo.sds_inspection_detail
        `);

        await queryRunner.query(`
            DROP INDEX IX_sample_data_sheets_created_at 
            ON dbo.sample_data_sheets
        `);

        await queryRunner.query(`
            DROP INDEX IX_sample_data_sheets_inspection_detail_id 
            ON dbo.sample_data_sheets
        `);
    }
}
