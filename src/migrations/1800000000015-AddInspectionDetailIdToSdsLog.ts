import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddInspectionDetailIdToSdsLog1800000000015 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            'sds_log',
            new TableColumn({
                name: 'sds_inspection_detail_id',
                type: 'int',
                isNullable: true,
            }),
        );

        await queryRunner.createIndex(
            'sds_log',
            new TableIndex({
                name: 'IDX_sds_log_inspection_detail_id',
                columnNames: ['sds_inspection_detail_id'],
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex('sds_log', 'IDX_sds_log_inspection_detail_id');
        await queryRunner.dropColumn('sds_log', 'sds_inspection_detail_id');
    }
}
