import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTimestampColumnsToSampleDataSheetTables1800000000017 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add deleted_at to sample_data_sheet_row_samples
        await queryRunner.addColumn(
            'dbo.sample_data_sheet_row_samples',
            new TableColumn({
                name: 'deleted_at',
                type: 'datetime2',
                isNullable: true,
            }),
        );

        // Add deleted_at to sample_data_sheet_rows
        await queryRunner.addColumn(
            'dbo.sample_data_sheet_rows',
            new TableColumn({
                name: 'deleted_at',
                type: 'datetime2',
                isNullable: true,
            }),
        );

        // Add deleted_at to sample_data_sheets
        await queryRunner.addColumn(
            'dbo.sample_data_sheets',
            new TableColumn({
                name: 'deleted_at',
                type: 'datetime2',
                isNullable: true,
            }),
        );

        // Add updated_at and deleted_at to sample_data_sheet_approvals
        await queryRunner.addColumn(
            'dbo.sample_data_sheet_approvals',
            new TableColumn({
                name: 'updated_at',
                type: 'datetime2',
                default: 'GETDATE()',
            }),
        );

        await queryRunner.addColumn(
            'dbo.sample_data_sheet_approvals',
            new TableColumn({
                name: 'deleted_at',
                type: 'datetime2',
                isNullable: true,
            }),
        );

        // Add updated_at and deleted_at to sds_log
        await queryRunner.addColumn(
            'dbo.sds_log',
            new TableColumn({
                name: 'updated_at',
                type: 'datetime2',
                default: 'GETDATE()',
            }),
        );

        await queryRunner.addColumn(
            'dbo.sds_log',
            new TableColumn({
                name: 'deleted_at',
                type: 'datetime2',
                isNullable: true,
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove columns in reverse order
        await queryRunner.dropColumn('dbo.sds_log', 'deleted_at');
        await queryRunner.dropColumn('dbo.sds_log', 'updated_at');
        await queryRunner.dropColumn('dbo.sample_data_sheet_approvals', 'deleted_at');
        await queryRunner.dropColumn('dbo.sample_data_sheet_approvals', 'updated_at');
        await queryRunner.dropColumn('dbo.sample_data_sheets', 'deleted_at');
        await queryRunner.dropColumn('dbo.sample_data_sheet_rows', 'deleted_at');
        await queryRunner.dropColumn('dbo.sample_data_sheet_row_samples', 'deleted_at');
    }
}
