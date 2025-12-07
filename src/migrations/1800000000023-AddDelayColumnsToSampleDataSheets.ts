import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddDelayColumnsToSampleDataSheets1800000000023 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add has_delay column
        await queryRunner.addColumn(
            'sample_data_sheets',
            new TableColumn({
                name: 'has_delay',
                type: 'bit',
                isNullable: false,
                default: 0,
            }),
        );

        // Add delay_days column
        await queryRunner.addColumn(
            'sample_data_sheets',
            new TableColumn({
                name: 'delay_days',
                type: 'int',
                isNullable: true,
            }),
        );

        // Create index on has_delay for faster filtering
        await queryRunner.query(`
            CREATE INDEX IX_sample_data_sheets_has_delay 
            ON dbo.sample_data_sheets (has_delay)
        `);

        // Create composite index for common queries
        await queryRunner.query(`
            CREATE INDEX IX_sample_data_sheets_sdr_date_has_delay 
            ON dbo.sample_data_sheets (sdr_date, has_delay)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS IX_sample_data_sheets_has_delay ON dbo.sample_data_sheets`);
        await queryRunner.query(`DROP INDEX IF EXISTS IX_sample_data_sheets_sdr_date_has_delay ON dbo.sample_data_sheets`);

        // Drop columns
        await queryRunner.dropColumn('sample_data_sheets', 'delay_days');
        await queryRunner.dropColumn('sample_data_sheets', 'has_delay');
    }
}
