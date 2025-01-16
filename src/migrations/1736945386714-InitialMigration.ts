import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1736945386714 implements MigrationInterface {
    name = 'InitialMigration1736945386714'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "suppliers" ("id" int NOT NULL IDENTITY(1,1), "supplierCode" nvarchar(20) NOT NULL, "supplierName" nvarchar(100) NOT NULL, "tel" nvarchar(15), "email" ntext, "contactPerson" ntext, "_activeRow" nvarchar(1) NOT NULL CONSTRAINT "DF_a11c0c0d9ce0d8248cc33abb4a5" DEFAULT 'Y', "created_at" datetime NOT NULL CONSTRAINT "DF_9f44246fb458d4367d206b1c9a9" DEFAULT getdate(), "updated_at" datetime NOT NULL CONSTRAINT "DF_04a653cd3684cbd2539a3dad3b6" DEFAULT getdate(), "deleted_at" datetime, "createdById" int, "updatedById" int, "deletedById" int, CONSTRAINT "PK_b70ac51766a9e3144f778cfe81e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "suppliers" ADD CONSTRAINT "FK_e4d10e6df143ef83689f4f96c1b" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "suppliers" ADD CONSTRAINT "FK_a514a784909249fe9da16b81d37" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "suppliers" ADD CONSTRAINT "FK_acb5ba8b2e9f690a370a15e0196" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "suppliers" DROP CONSTRAINT "FK_acb5ba8b2e9f690a370a15e0196"`);
        await queryRunner.query(`ALTER TABLE "suppliers" DROP CONSTRAINT "FK_a514a784909249fe9da16b81d37"`);
        await queryRunner.query(`ALTER TABLE "suppliers" DROP CONSTRAINT "FK_e4d10e6df143ef83689f4f96c1b"`);
        await queryRunner.query(`DROP TABLE "suppliers"`);
    }

}
