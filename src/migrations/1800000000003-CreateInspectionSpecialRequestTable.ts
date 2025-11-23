import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateInspectionSpecialRequestTable1800000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'sds_inspection_special_request',
        schema: 'dbo',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'inspection_detail_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'special_request_items',
            type: 'nvarchar',
            length: 'max',
            isNullable: false,
          },
          {
            name: 'qty',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'cp_cpk',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'due_date',
            type: 'datetime2',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'Pending'",
          },
          {
            name: 'comments',
            type: 'nvarchar',
            length: '1000',
            isNullable: true,
          },
          {
            name: 'active_row',
            type: 'char',
            length: '1',
            default: "'Y'",
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
          {
            name: 'deleted_at',
            type: 'datetime2',
            isNullable: true,
          },
          {
            name: 'created_by',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'updated_by',
            type: 'int',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'sds_inspection_special_request',
      new TableIndex({
        name: 'IDX_sds_inspection_special_request_active_row_created_at',
        columnNames: ['active_row', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'sds_inspection_special_request',
      new TableIndex({
        name: 'IDX_sds_inspection_special_request_inspection_detail_id',
        columnNames: ['inspection_detail_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('sds_inspection_special_request', 'IDX_sds_inspection_special_request_inspection_detail_id');
    await queryRunner.dropIndex('sds_inspection_special_request', 'IDX_sds_inspection_special_request_active_row_created_at');
    await queryRunner.dropTable('sds_inspection_special_request');
  }
}