import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateSampleDataSheetApprovalsTable1772000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                schema: 'dbo',
                name: 'sample_data_sheet_approvals',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'sample_data_sheet_id',
                        type: 'int',
                        isNullable: false,
                    },
                    {
                        name: 'action',
                        type: 'nvarchar',
                        length: '50',
                        isNullable: false,
                    },
                    {
                        name: 'role',
                        type: 'nvarchar',
                        length: '50',
                        isNullable: false,
                    },
                    {
                        name: 'document_type',
                        type: 'nvarchar',
                        length: '20',
                        isNullable: false,
                    },
                    {
                        name: 'action_by_user_id',
                        type: 'int',
                        isNullable: false,
                    },
                    {
                        name: 'remark',
                        type: 'nvarchar',
                        length: '1000',
                        isNullable: true,
                    },
                    {
                        name: 're_submit_date',
                        type: 'date',
                        isNullable: true,
                    },
                    {
                        name: 'action_date',
                        type: 'datetime2',
                        default: 'GETDATE()',
                        isNullable: false,
                    },
                    {
                        name: 'part_no',
                        type: 'nvarchar',
                        length: '100',
                        isNullable: false,
                    },
                    {
                        name: 'sds_month_year',
                        type: 'nvarchar',
                        length: '20',
                        isNullable: true,
                    },
                ],
            }),
            true,
        );

        // Create index on part_no for faster searching
        await queryRunner.query(
            `CREATE INDEX idx_sds_approvals_part_no ON dbo.sample_data_sheet_approvals (part_no)`,
        );

        // Create index on sds_month_year for faster filtering
        await queryRunner.query(
            `CREATE INDEX idx_sds_approvals_month_year ON dbo.sample_data_sheet_approvals (sds_month_year)`,
        );

        // Create index on action_date for faster sorting
        await queryRunner.query(
            `CREATE INDEX idx_sds_approvals_action_date ON dbo.sample_data_sheet_approvals (action_date DESC)`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(
            `DROP INDEX idx_sds_approvals_action_date ON dbo.sample_data_sheet_approvals`,
        );
        await queryRunner.query(
            `DROP INDEX idx_sds_approvals_month_year ON dbo.sample_data_sheet_approvals`,
        );
        await queryRunner.query(
            `DROP INDEX idx_sds_approvals_part_no ON dbo.sample_data_sheet_approvals`,
        );

        // Drop table
        await queryRunner.dropTable('dbo.sample_data_sheet_approvals');
    }
}
