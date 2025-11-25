import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddSampleDataSheetIdToSdsLog1800000000019 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add sample_data_sheet_id column to sds_log table
        await queryRunner.addColumn(
            'dbo.sds_log',
            new TableColumn({
                name: 'sample_data_sheet_id',
                type: 'int',
                isNullable: true,
            }),
        );

        // Add index for better query performance
        await queryRunner.createIndex(
            'dbo.sds_log',
            new TableIndex({
                name: 'IDX_sds_log_sample_data_sheet_id',
                columnNames: ['sample_data_sheet_id'],
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop index
        await queryRunner.dropIndex('dbo.sds_log', 'IDX_sds_log_sample_data_sheet_id');

        // Remove sample_data_sheet_id column
        await queryRunner.dropColumn('dbo.sds_log', 'sample_data_sheet_id');
    }
}
