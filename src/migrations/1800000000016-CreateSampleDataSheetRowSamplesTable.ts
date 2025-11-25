import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateSampleDataSheetRowSamplesTable1800000000016 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create the new sample_data_sheet_row_samples table
        await queryRunner.createTable(
            new Table({
                schema: 'dbo',
                name: 'sample_data_sheet_row_samples',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'sample_data_sheet_row_id',
                        type: 'int',
                        isNullable: false,
                    },
                    {
                        name: 'no',
                        type: 'int',
                        isNullable: false,
                    },
                    {
                        name: 'value',
                        type: 'decimal',
                        precision: 18,
                        scale: 2,
                        isNullable: true,
                    },
                    {
                        name: 'created_at',
                        type: 'datetime2',
                        default: 'GETDATE()',
                    },
                    {
                        name: 'updated_at',
                        type: 'datetime2',
                        default: 'GETDATE()',
                    },
                ],
            }),
        );

        // Create index on sample_data_sheet_row_id
        await queryRunner.createIndex(
            'dbo.sample_data_sheet_row_samples',
            new TableIndex({
                name: 'IDX_sample_data_sheet_row_samples_row_id',
                columnNames: ['sample_data_sheet_row_id'],
            }),
        );

        // Create foreign key
        await queryRunner.createForeignKey(
            'dbo.sample_data_sheet_row_samples',
            new TableForeignKey({
                columnNames: ['sample_data_sheet_row_id'],
                referencedTableName: 'sample_data_sheet_rows',
                referencedSchema: 'dbo',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }),
        );

        // 2. Migrate data from JSON string to new table
        await queryRunner.query(`
            INSERT INTO dbo.sample_data_sheet_row_samples (sample_data_sheet_row_id, no, value, created_at, updated_at)
            SELECT 
                sdr.id AS sample_data_sheet_row_id,
                CAST(JSON_VALUE(sample.value, '$.no') AS INT) AS no,
                CASE 
                    WHEN JSON_VALUE(sample.value, '$.value') IS NULL THEN NULL
                    WHEN JSON_VALUE(sample.value, '$.value') = '' THEN NULL
                    WHEN ISNUMERIC(JSON_VALUE(sample.value, '$.value')) = 0 THEN NULL
                    ELSE TRY_CAST(JSON_VALUE(sample.value, '$.value') AS DECIMAL(18,2))
                END AS value,
                sdr.created_at,
                sdr.updated_at
            FROM dbo.sample_data_sheet_rows sdr
            CROSS APPLY OPENJSON(sdr.samples) AS sample
            WHERE sdr.samples IS NOT NULL AND sdr.samples != ''
        `);

        // 3. Drop the samples column from sample_data_sheet_rows
        await queryRunner.dropColumn('dbo.sample_data_sheet_rows', 'samples');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 1. Re-add the samples column
        await queryRunner.query(`
            ALTER TABLE dbo.sample_data_sheet_rows
            ADD samples NVARCHAR(MAX) NULL
        `);

        // 2. Migrate data back from table to JSON string
        await queryRunner.query(`
            UPDATE sdr
            SET sdr.samples = (
                SELECT 
                    CONCAT('[', 
                        STRING_AGG(
                            CONCAT('{"no":', s.no, ',"value":', 
                                CASE WHEN s.value IS NULL THEN 'null' ELSE CAST(s.value AS NVARCHAR(50)) END, 
                            '}'), 
                            ','
                        ) WITHIN GROUP (ORDER BY s.no),
                    ']')
                FROM dbo.sample_data_sheet_row_samples s
                WHERE s.sample_data_sheet_row_id = sdr.id
            )
            FROM dbo.sample_data_sheet_rows sdr
            WHERE EXISTS (
                SELECT 1 
                FROM dbo.sample_data_sheet_row_samples s 
                WHERE s.sample_data_sheet_row_id = sdr.id
            )
        `);

        // 3. Drop the new table (foreign key and index will be dropped automatically)
        await queryRunner.dropTable('dbo.sample_data_sheet_row_samples', true);
    }
}
