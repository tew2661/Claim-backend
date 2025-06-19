import { MigrationInterface, QueryRunner } from "typeorm";

export class InitMigration1750326498002 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE [dbo].[users] SET [accessMasterManagement] = N'Y' WHERE [code] = N'001'
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE [dbo].[users] SET [accessMasterManagement] = N'N' WHERE [code] = N'001'
        `)
    }

}
