import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from "typeorm";

export class CreateInspectionDetailTables1800000000002 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create sds_inspection_detail table
        await queryRunner.createTable(
            new Table({
                name: "sds_inspection_detail",
                schema: "dbo",
                columns: [
                    {
                        name: "id",
                        type: "int",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "increment"
                    },
                    {
                        name: "supplier_code",
                        type: "varchar",
                        length: "50",
                        isNullable: false
                    },
                    {
                        name: "supplier_name",
                        type: "nvarchar",
                        length: "255",
                        isNullable: false
                    },
                    {
                        name: "part_no",
                        type: "varchar",
                        length: "100",
                        isNullable: false
                    },
                    {
                        name: "part_name",
                        type: "nvarchar",
                        length: "255",
                        isNullable: false
                    },
                    {
                        name: "model",
                        type: "varchar",
                        length: "100",
                        isNullable: false
                    },
                    {
                        name: "ais_file",
                        type: "nvarchar",
                        length: "500",
                        isNullable: true
                    },
                    {
                        name: "sdr_file",
                        type: "nvarchar",
                        length: "500",
                        isNullable: true
                    },
                    {
                        name: "part_status",
                        type: "varchar",
                        length: "20",
                        default: "'Inactive'"
                    },
                    {
                        name: "supplier_edit_status",
                        type: "varchar",
                        length: "20",
                        default: "'Unlocked'"
                    },
                    {
                        name: "active_row",
                        type: "char",
                        length: "1",
                        default: "'Y'"
                    },
                    {
                        name: "created_at",
                        type: "datetime2",
                        default: "GETDATE()"
                    },
                    {
                        name: "updated_at",
                        type: "datetime2",
                        default: "GETDATE()"
                    },
                    {
                        name: "deleted_at",
                        type: "datetime2",
                        isNullable: true
                    },
                    {
                        name: "created_by",
                        type: "int",
                        isNullable: true
                    },
                    {
                        name: "updated_by",
                        type: "int",
                        isNullable: true
                    }
                ]
            }),
            true
        );

        // Create indexes for sds_inspection_detail
        await queryRunner.createIndex(
            "sds_inspection_detail",
            new TableIndex({
                name: "IDX_sds_inspection_detail_active_row_created_at",
                columnNames: ["active_row", "created_at"]
            })
        );

        await queryRunner.createIndex(
            "sds_inspection_detail",
            new TableIndex({
                name: "IDX_sds_inspection_detail_active_row_part_no",
                columnNames: ["active_row", "part_no"]
            })
        );

        await queryRunner.createIndex(
            "sds_inspection_detail",
            new TableIndex({
                name: "IDX_sds_inspection_detail_supplier_code",
                columnNames: ["supplier_code"]
            })
        );

        await queryRunner.createIndex(
            "sds_inspection_detail",
            new TableIndex({
                name: "IDX_sds_inspection_detail_part_no",
                columnNames: ["part_no"]
            })
        );

        // Create sds_inspection_items table
        await queryRunner.createTable(
            new Table({
                name: "sds_inspection_items",
                schema: "dbo",
                columns: [
                    {
                        name: "id",
                        type: "int",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "increment"
                    },
                    {
                        name: "inspection_detail_id",
                        type: "int",
                        isNullable: false
                    },
                    {
                        name: "no",
                        type: "int",
                        isNullable: false
                    },
                    {
                        name: "measuring_item",
                        type: "nvarchar",
                        length: "255",
                        isNullable: false
                    },
                    {
                        name: "specification",
                        type: "varchar",
                        length: "100",
                        isNullable: false
                    },
                    {
                        name: "tolerance_plus",
                        type: "varchar",
                        length: "50",
                        isNullable: false
                    },
                    {
                        name: "tolerance_minus",
                        type: "varchar",
                        length: "50",
                        isNullable: false
                    },
                    {
                        name: "inspection_instrument",
                        type: "nvarchar",
                        length: "255",
                        isNullable: false
                    },
                    {
                        name: "rank",
                        type: "varchar",
                        length: "1",
                        isNullable: false
                    }
                ]
            }),
            true
        );

        // Create index for sds_inspection_items
        await queryRunner.createIndex(
            "sds_inspection_items",
            new TableIndex({
                name: "IDX_sds_inspection_items_inspection_detail_id",
                columnNames: ["inspection_detail_id"]
            })
        );


        // No foreign keys created — tables kept independent by design
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    // No foreign keys to drop (migration creates no FKs)

        // Drop indexes
        await queryRunner.dropIndex("sds_inspection_items", "IDX_sds_inspection_items_inspection_detail_id");
        await queryRunner.dropIndex("sds_inspection_detail", "IDX_sds_inspection_detail_part_no");
        await queryRunner.dropIndex("sds_inspection_detail", "IDX_sds_inspection_detail_supplier_code");
        await queryRunner.dropIndex("sds_inspection_detail", "IDX_sds_inspection_detail_active_row_part_no");
        await queryRunner.dropIndex("sds_inspection_detail", "IDX_sds_inspection_detail_active_row_created_at");

        // Drop tables
        await queryRunner.dropTable("sds_inspection_items");
        await queryRunner.dropTable("sds_inspection_detail");
    }
}
