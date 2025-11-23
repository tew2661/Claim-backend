import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class AddInspectionDetailRefToSampleDataSheet1800000000008 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            'dbo.sample_data_sheets',
            new TableColumn({
                name: 'inspection_detail_id',
                type: 'int',
                isNullable: true,
            }),
        );

        await queryRunner.createForeignKey(
            'dbo.sample_data_sheets',
            new TableForeignKey({
                columnNames: ['inspection_detail_id'],
                referencedTableName: 'sds_inspection_detail',
                referencedColumnNames: ['id'],
                onDelete: 'SET NULL',
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('dbo.sample_data_sheets');
        const foreignKey = table?.foreignKeys.find((fk) => fk.columnNames.includes('inspection_detail_id'));
        if (foreignKey) {
            await queryRunner.dropForeignKey('dbo.sample_data_sheets', foreignKey);
        }
        await queryRunner.dropColumn('dbo.sample_data_sheets', 'inspection_detail_id');
    }
}
