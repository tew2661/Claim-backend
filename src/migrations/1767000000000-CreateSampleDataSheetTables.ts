import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateSampleDataSheetTables1767000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                schema: 'dbo',
                name: 'sample_data_sheets',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'supplier',
                        type: 'nvarchar',
                        length: '255',
                        isNullable: false,
                    },
                    {
                        name: 'part_no',
                        type: 'nvarchar',
                        length: '100',
                        isNullable: false,
                    },
                    {
                        name: 'part_name',
                        type: 'nvarchar',
                        length: '255',
                        isNullable: false,
                    },
                    {
                        name: 'model',
                        type: 'nvarchar',
                        length: '100',
                        isNullable: false,
                    },
                    {
                        name: 'production_08_2025',
                        type: 'nvarchar',
                        length: '5',
                        isNullable: false,
                    },
                    {
                        name: 'sdr_date',
                        type: 'date',
                        isNullable: false,
                    },
                    {
                        name: 'ais_file',
                        type: 'nvarchar',
                        length: '500',
                        isNullable: true,
                    },
                    {
                        name: 'sdr_file',
                        type: 'nvarchar',
                        length: '500',
                        isNullable: true,
                    },
                    {
                        name: 'sdr_report_file',
                        type: 'nvarchar',
                        length: '500',
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

        await queryRunner.createTable(
            new Table({
                schema: 'dbo',
                name: 'sample_data_sheet_rows',
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
                        name: 'no',
                        type: 'int',
                        isNullable: false,
                    },
                    {
                        name: 'measuring_item',
                        type: 'nvarchar',
                        length: '255',
                        isNullable: false,
                    },
                    {
                        name: 'specification',
                        type: 'nvarchar',
                        length: '100',
                        isNullable: false,
                    },
                    {
                        name: 'rank',
                        type: 'nvarchar',
                        length: '1',
                        isNullable: false,
                    },
                    {
                        name: 'inspection_instrument',
                        type: 'nvarchar',
                        length: '255',
                        isNullable: false,
                    },
                    {
                        name: 'remark',
                        type: 'nvarchar',
                        length: '255',
                        isNullable: true,
                    },
                    {
                        name: 'sample_qty',
                        type: 'int',
                        isNullable: false,
                    },
                    {
                        name: 'samples',
                        type: 'nvarchar',
                        length: 'max',
                        isNullable: false,
                    },
                    {
                        name: 'judgement',
                        type: 'nvarchar',
                        length: '5',
                        isNullable: true,
                    },
                    {
                        name: 'x_bar',
                        type: 'nvarchar',
                        length: '50',
                        isNullable: true,
                    },
                    {
                        name: 'r',
                        type: 'nvarchar',
                        length: '50',
                        isNullable: true,
                    },
                    {
                        name: 'cp',
                        type: 'nvarchar',
                        length: '50',
                        isNullable: true,
                    },
                    {
                        name: 'cpk',
                        type: 'nvarchar',
                        length: '50',
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

        await queryRunner.createForeignKey(
            'dbo.sample_data_sheet_rows',
            new TableForeignKey({
                columnNames: ['sample_data_sheet_id'],
                referencedTableName: 'sample_data_sheets',
                referencedSchema: 'dbo',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('dbo.sample_data_sheet_rows', true);
        await queryRunner.dropTable('dbo.sample_data_sheets', true);
    }
}
