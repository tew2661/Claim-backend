import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSdsCreatedFlag1800000000007 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            'dbo.sds_inspection_detail',
            new TableColumn({
                name: 'sds_created',
                type: 'bit',
                isNullable: false,
                default: '0',
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('dbo.sds_inspection_detail', 'sds_created');
    }
}
