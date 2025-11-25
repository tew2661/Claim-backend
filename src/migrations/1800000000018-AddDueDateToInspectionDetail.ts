import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddDueDateToInspectionDetail1800000000018 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add due_date column to sds_inspection_detail table
        await queryRunner.addColumn(
            'dbo.sds_inspection_detail',
            new TableColumn({
                name: 'due_date',
                type: 'datetime2',
                isNullable: true,
            }),
        );

        // Set default value to 25th of current month for existing records
        await queryRunner.query(`
            UPDATE dbo.sds_inspection_detail
            SET due_date = DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 25)
            WHERE due_date IS NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove due_date column
        await queryRunner.dropColumn('dbo.sds_inspection_detail', 'due_date');
    }
}
