import { MigrationInterface, QueryRunner } from "typeorm";

export class VarcharToNvarchar1800000000004 implements MigrationInterface {
    name = 'VarcharToNvarchar1800000000004'

    public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_sds_inspection_detail_supplier_code ON [dbo].[sds_inspection_detail]`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_sds_inspection_detail_part_no ON [dbo].[sds_inspection_detail]`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_sds_inspection_detail_active_row_part_no ON [dbo].[sds_inspection_detail]`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_sds_inspection_detail_active_row_created_at ON [dbo].[sds_inspection_detail]`);

    await queryRunner.query(`DECLARE @dc nvarchar(255);
    SELECT @dc = dc.name
    FROM sys.default_constraints dc
    JOIN sys.columns c ON dc.parent_column_id = c.column_id AND dc.parent_object_id = c.object_id
    WHERE OBJECT_NAME(dc.parent_object_id) = 'sds_inspection_detail' AND c.name = 'part_status';
    IF @dc IS NOT NULL EXEC('ALTER TABLE [dbo].[sds_inspection_detail] DROP CONSTRAINT [' + @dc + ']');`);
    await queryRunner.query(`DECLARE @dc nvarchar(255);
    SELECT @dc = dc.name
    FROM sys.default_constraints dc
    JOIN sys.columns c ON dc.parent_column_id = c.column_id AND dc.parent_object_id = c.object_id
    WHERE OBJECT_NAME(dc.parent_object_id) = 'sds_inspection_detail' AND c.name = 'supplier_edit_status';
    IF @dc IS NOT NULL EXEC('ALTER TABLE [dbo].[sds_inspection_detail] DROP CONSTRAINT [' + @dc + ']');`);

    await queryRunner.query(`ALTER TABLE [dbo].[sds_inspection_detail] ALTER COLUMN [supplier_code] nvarchar(50) NOT NULL`);
    await queryRunner.query(`ALTER TABLE [dbo].[sds_inspection_detail] ALTER COLUMN [part_no] nvarchar(100) NOT NULL`);
    await queryRunner.query(`ALTER TABLE [dbo].[sds_inspection_detail] ALTER COLUMN [model] nvarchar(100) NOT NULL`);
    await queryRunner.query(`ALTER TABLE [dbo].[sds_inspection_detail] ALTER COLUMN [part_status] nvarchar(20) NOT NULL`);
    await queryRunner.query(`ALTER TABLE [dbo].[sds_inspection_detail] ALTER COLUMN [supplier_edit_status] nvarchar(20) NOT NULL`);

    await queryRunner.query(`ALTER TABLE [dbo].[sds_inspection_detail] ADD CONSTRAINT DF_sds_inspection_detail_part_status DEFAULT (N'Inactive') FOR [part_status]`);
    await queryRunner.query(`ALTER TABLE [dbo].[sds_inspection_detail] ADD CONSTRAINT DF_sds_inspection_detail_supplier_edit_status DEFAULT (N'Unlocked') FOR [supplier_edit_status]`);

        await queryRunner.query(`CREATE INDEX IDX_sds_inspection_detail_active_row_created_at ON [dbo].[sds_inspection_detail]([active_row], [created_at])`);
        await queryRunner.query(`CREATE INDEX IDX_sds_inspection_detail_active_row_part_no ON [dbo].[sds_inspection_detail]([active_row], [part_no])`);
        await queryRunner.query(`CREATE INDEX IDX_sds_inspection_detail_supplier_code ON [dbo].[sds_inspection_detail]([supplier_code])`);
        await queryRunner.query(`CREATE INDEX IDX_sds_inspection_detail_part_no ON [dbo].[sds_inspection_detail]([part_no])`);

        await queryRunner.query(`ALTER TABLE [dbo].[sds_inspection_items] ALTER COLUMN [specification] nvarchar(100) NOT NULL`);
        await queryRunner.query(`ALTER TABLE [dbo].[sds_inspection_items] ALTER COLUMN [tolerance_plus] nvarchar(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE [dbo].[sds_inspection_items] ALTER COLUMN [tolerance_minus] nvarchar(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE [dbo].[sds_inspection_items] ALTER COLUMN [rank] nvarchar(1) NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_sds_inspection_detail_supplier_code ON [dbo].[sds_inspection_detail]`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_sds_inspection_detail_part_no ON [dbo].[sds_inspection_detail]`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_sds_inspection_detail_active_row_part_no ON [dbo].[sds_inspection_detail]`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_sds_inspection_detail_active_row_created_at ON [dbo].[sds_inspection_detail]`);

    await queryRunner.query(`ALTER TABLE [dbo].[sds_inspection_detail] DROP CONSTRAINT IF EXISTS DF_sds_inspection_detail_part_status`);
    await queryRunner.query(`ALTER TABLE [dbo].[sds_inspection_detail] DROP CONSTRAINT IF EXISTS DF_sds_inspection_detail_supplier_edit_status`);

        await queryRunner.query(`ALTER TABLE [dbo].[sds_inspection_items] ALTER COLUMN [rank] varchar(1) NOT NULL`);
        await queryRunner.query(`ALTER TABLE [dbo].[sds_inspection_items] ALTER COLUMN [tolerance_minus] varchar(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE [dbo].[sds_inspection_items] ALTER COLUMN [tolerance_plus] varchar(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE [dbo].[sds_inspection_items] ALTER COLUMN [specification] varchar(100) NOT NULL`);

        await queryRunner.query(`ALTER TABLE [dbo].[sds_inspection_detail] ALTER COLUMN [supplier_edit_status] varchar(20) NOT NULL`);
        await queryRunner.query(`ALTER TABLE [dbo].[sds_inspection_detail] ALTER COLUMN [part_status] varchar(20) NOT NULL`);
        await queryRunner.query(`ALTER TABLE [dbo].[sds_inspection_detail] ALTER COLUMN [model] varchar(100) NOT NULL`);
        await queryRunner.query(`ALTER TABLE [dbo].[sds_inspection_detail] ALTER COLUMN [part_no] varchar(100) NOT NULL`);
        await queryRunner.query(`ALTER TABLE [dbo].[sds_inspection_detail] ALTER COLUMN [supplier_code] varchar(50) NOT NULL`);

    await queryRunner.query(`ALTER TABLE [dbo].[sds_inspection_detail] ADD CONSTRAINT DF_sds_inspection_detail_part_status DEFAULT ('Inactive') FOR [part_status]`);
    await queryRunner.query(`ALTER TABLE [dbo].[sds_inspection_detail] ADD CONSTRAINT DF_sds_inspection_detail_supplier_edit_status DEFAULT ('Unlocked') FOR [supplier_edit_status]`);

    await queryRunner.query(`CREATE INDEX IDX_sds_inspection_detail_active_row_created_at ON [dbo].[sds_inspection_detail]([active_row], [created_at])`);
    await queryRunner.query(`CREATE INDEX IDX_sds_inspection_detail_active_row_part_no ON [dbo].[sds_inspection_detail]([active_row], [part_no])`);
    await queryRunner.query(`CREATE INDEX IDX_sds_inspection_detail_supplier_code ON [dbo].[sds_inspection_detail]([supplier_code])`);
    await queryRunner.query(`CREATE INDEX IDX_sds_inspection_detail_part_no ON [dbo].[sds_inspection_detail]([part_no])`);
    }
}
