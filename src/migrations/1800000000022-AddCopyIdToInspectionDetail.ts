import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCopyIdToInspectionDetail1800000000022 implements MigrationInterface {
    name = 'AddCopyIdToInspectionDetail1800000000022'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dbo"."sds_inspection_detail" ADD "copy_id" int`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dbo"."sds_inspection_detail" DROP COLUMN "copy_id"`);
    }
}
