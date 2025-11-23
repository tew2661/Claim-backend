import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateSdsLogTable1732356000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'sds_log',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'menu',
                        type: 'varchar',
                        length: '100',
                        isNullable: false,
                    },
                    {
                        name: 'part_no',
                        type: 'varchar',
                        length: '100',
                        isNullable: true,
                    },
                    {
                        name: 'sds_month_year',
                        type: 'varchar',
                        length: '20',
                        isNullable: true,
                    },
                    {
                        name: 'action',
                        type: 'varchar',
                        length: '100',
                        isNullable: false,
                    },
                    {
                        name: 'action_role',
                        type: 'varchar',
                        length: '100',
                        isNullable: true,
                    },
                    {
                        name: 'action_by',
                        type: 'nvarchar',
                        length: '255',
                        isNullable: true,
                    },
                    {
                        name: 'action_date',
                        type: 'datetime2',
                        isNullable: false,
                    },
                    {
                        name: 'remark',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'created_at',
                        type: 'datetime2',
                        default: 'GETDATE()',
                        isNullable: false,
                    },
                ],
            }),
            true,
        );

        await queryRunner.createIndex(
            'sds_log',
            new TableIndex({
                name: 'IDX_sds_log_part_no',
                columnNames: ['part_no'],
            }),
        );

        await queryRunner.createIndex(
            'sds_log',
            new TableIndex({
                name: 'IDX_sds_log_action_date',
                columnNames: ['action_date'],
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex('sds_log', 'IDX_sds_log_action_date');
        await queryRunner.dropIndex('sds_log', 'IDX_sds_log_part_no');
        await queryRunner.dropTable('sds_log');
    }
}
