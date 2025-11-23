import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddRemarkToSampleDataSheet1800000000009 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            'dbo.sample_data_sheets',
            new TableColumn({
                name: 'remark',
                type: 'nvarchar',
                length: '1000',
                isNullable: true,
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('dbo.sample_data_sheets', 'remark');
    }
}
