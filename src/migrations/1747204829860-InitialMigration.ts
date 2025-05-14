import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1747204829860 implements MigrationInterface {
    name = 'InitialMigration1747204829860'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" int NOT NULL IDENTITY(1,1), "code" nvarchar(255) NOT NULL, "name" nvarchar(255) NOT NULL, "department" nvarchar(255) NOT NULL, "role" nvarchar(255) NOT NULL, "email" nvarchar(255) NOT NULL, "image" text, "password" nvarchar(255), "_active" nvarchar(1) CONSTRAINT "DF_16c59f3dfa49a55a4dac1e6bdb0" DEFAULT 'N', "accessMasterManagement" nvarchar(1) NOT NULL CONSTRAINT "DF_0a78e1cefbffeb63ec5816ce5c6" DEFAULT 'N', "expiresPassword" datetime, "_activeRow" nvarchar(1) NOT NULL CONSTRAINT "DF_68c72b4d0dd2c3eb9c1f8f84ef4" DEFAULT 'Y', "createdAt" datetime2 NOT NULL CONSTRAINT "DF_204e9b624861ff4a5b268192101" DEFAULT getdate(), "updatedAt" datetime2 NOT NULL CONSTRAINT "DF_0f5cbe00928ba4489cc7312573b" DEFAULT getdate(), "deletedAt" datetime2, "supplierId" int, "createdById" int, "updatedById" int, "deletedById" int, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "suppliers" ("id" int NOT NULL IDENTITY(1,1), "supplierCode" nvarchar(20) NOT NULL, "supplierName" nvarchar(100) NOT NULL, "tel" nvarchar(15), "email" ntext, "contactPerson" ntext, "_activeRow" nvarchar(1) NOT NULL CONSTRAINT "DF_a11c0c0d9ce0d8248cc33abb4a5" DEFAULT 'Y', "created_at" datetime NOT NULL CONSTRAINT "DF_9f44246fb458d4367d206b1c9a9" DEFAULT getdate(), "updated_at" datetime NOT NULL CONSTRAINT "DF_04a653cd3684cbd2539a3dad3b6" DEFAULT getdate(), "deleted_at" datetime, "createdById" int, "updatedById" int, "deletedById" int, CONSTRAINT "PK_b70ac51766a9e3144f778cfe81e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "qpr" ("id" int NOT NULL IDENTITY(1,1), "qpr_issue_no" nvarchar(255) NOT NULL, "occurrence_date" datetime2 NOT NULL, "date_reported" datetime2 NOT NULL, "reply_quick_action" datetime2 NOT NULL, "reply_report" datetime2 NOT NULL, "part_name" nvarchar(255) NOT NULL, "part_no" nvarchar(255) NOT NULL, "model" nvarchar(255) NOT NULL, "when" nvarchar(255) NOT NULL, "who" nvarchar(255) NOT NULL, "where_found" ntext NOT NULL, "defect" ntext NOT NULL, "state" nvarchar(255) NOT NULL, "importance_level" nvarchar(255) NOT NULL, "urgent" bit NOT NULL, "frequency" ntext NOT NULL, "defective_contents" ntext NOT NULL, "issue" nvarchar(255), "figures" ntext NOT NULL, "delay_document" nvarchar(255) NOT NULL CONSTRAINT "DF_9c3fc0a3fe33f852253174789c2" DEFAULT 'Quick Report', "quick_report_status" nvarchar(255) NOT NULL CONSTRAINT "DF_1c31fd9653e4e866ffcd3d71525" DEFAULT 'Wait for Supplier', "quick_report_status_checker_1" nvarchar(255), "quick_report_date_checker_1" datetime2, "quick_report_status_checker_2" nvarchar(255), "quick_report_date_checker_2" datetime2, "eight_d_report_approver" nvarchar(255), "quick_report_status_checker_3" nvarchar(255), "quick_report_date_checker_3" datetime2, "eight_d_status_checker_1" nvarchar(255), "eight_d_date_checker_1" datetime2, "eight_d_status_checker_2" nvarchar(255), "eight_d_date_checker_2" datetime2, "eight_d_status_checker_3" nvarchar(255), "eight_d_date_checker_3" datetime2, "quick_report_status_for_supplier" nvarchar(255) NOT NULL CONSTRAINT "DF_e3377efb1e656f9069cb09bd5b7" DEFAULT 'Pending', "quick_report_date" datetime2, "quick_report_date_for_supplier" datetime2, "eight_d_report_status" nvarchar(255), "eight_d_report_status_for_supplier" nvarchar(255), "eight_d_report_date" datetime2, "eight_d_report_date_for_supplier" datetime2, "status" nvarchar(255) NOT NULL CONSTRAINT "DF_c8250f2c882520e9bee058d464d" DEFAULT 'Wait for Supplier', "_activeRow" nvarchar(1) NOT NULL CONSTRAINT "DF_c7473b18cb0d839f9c7ee60b4b6" DEFAULT 'Y', "approve_eight_d_and_reject_doc_other" nvarchar(1) NOT NULL CONSTRAINT "DF_a733a02ec67b116077c4d01949b" DEFAULT 'N', "due_date_req_doc_other" datetime2, "objectQPRSupplier" ntext, "object8DReportDto" ntext, "created_at" datetime NOT NULL CONSTRAINT "DF_2beaea2b59d36773a25d40f2594" DEFAULT getdate(), "updated_at" datetime NOT NULL CONSTRAINT "DF_622cdd0beafe1408b67571d654d" DEFAULT getdate(), "deleted_at" datetime, "supplierId" int, "createdById" int, "updatedById" int, "deletedById" int, CONSTRAINT "PK_05a4cef687a8705b9ace2c33a5e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_723896385b4f9f07cb7497d9f2" ON "qpr" ("qpr_issue_no") `);
        await queryRunner.query(`CREATE INDEX "IDX_e8b94f396c499c14ccc25d5890" ON "qpr" ("occurrence_date") `);
        await queryRunner.query(`CREATE INDEX "IDX_5d2a82af5d3c42109d919b22ff" ON "qpr" ("date_reported") `);
        await queryRunner.query(`CREATE INDEX "IDX_db9853e67bea01abb1a42197d8" ON "qpr" ("supplierId") `);
        await queryRunner.query(`CREATE INDEX "IDX_364d208e7c48a23def9c9f839e" ON "qpr" ("part_no") `);
        await queryRunner.query(`CREATE INDEX "IDX_47b8531b4083506344aef71d6e" ON "qpr" ("model") `);
        await queryRunner.query(`CREATE INDEX "IDX_3d79b86c51d6193600ba5645b0" ON "qpr" ("when") `);
        await queryRunner.query(`CREATE INDEX "IDX_6a6dbd801c5d6198a881e00f63" ON "qpr" ("who") `);
        await queryRunner.query(`CREATE INDEX "IDX_9c3fc0a3fe33f852253174789c" ON "qpr" ("delay_document") `);
        await queryRunner.query(`CREATE INDEX "IDX_1c31fd9653e4e866ffcd3d7152" ON "qpr" ("quick_report_status") `);
        await queryRunner.query(`CREATE INDEX "IDX_5eaa250edaa3fa8964299128b8" ON "qpr" ("quick_report_status_checker_1") `);
        await queryRunner.query(`CREATE INDEX "IDX_fac1e8de41ff98917a0655041c" ON "qpr" ("eight_d_status_checker_1") `);
        await queryRunner.query(`CREATE INDEX "IDX_e3377efb1e656f9069cb09bd5b" ON "qpr" ("quick_report_status_for_supplier") `);
        await queryRunner.query(`CREATE INDEX "IDX_bdd2e6f973e7e484c6427b4706" ON "qpr" ("eight_d_report_status") `);
        await queryRunner.query(`CREATE INDEX "IDX_354b3dc0ce5f6b288c450ee1fe" ON "qpr" ("eight_d_report_status_for_supplier") `);
        await queryRunner.query(`CREATE INDEX "IDX_c7473b18cb0d839f9c7ee60b4b" ON "qpr" ("_activeRow") `);
        await queryRunner.query(`CREATE INDEX "IDX_2beaea2b59d36773a25d40f259" ON "qpr" ("created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_fe16d412ec2a32681b1ad675f3" ON "qpr" ("_activeRow", "created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_b4515d75d425deece0766632e4" ON "qpr" ("_activeRow", "date_reported") `);
        await queryRunner.query(`CREATE TABLE "logs" ("id" int NOT NULL IDENTITY(1,1), "qprNo" nvarchar(50) NOT NULL, "roleType" nvarchar(50) NOT NULL CONSTRAINT "DF_ed95dbd4495da3d3568b7bf5f4e" DEFAULT '', "documentType" nvarchar(50) NOT NULL, "IsDocumentOther" nvarchar(1) NOT NULL CONSTRAINT "DF_932aba2dbcee0b1a08816c0fc0c" DEFAULT 'N', "action" nvarchar(50) NOT NULL, "performedAt" datetime NOT NULL CONSTRAINT "DF_7851b8b23215bf06ea4f65d007a" DEFAULT getdate(), "remark" nvarchar(500), "idQprId" int NOT NULL, "performedById" int NOT NULL, CONSTRAINT "PK_fb1b805f2f7795de79fa69340ba" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_1e47d41df5aad908e61bfded2f9" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_51d635f1d983d505fb5a2f44c52" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_52e97c477859f8019f3705abd21" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_e9d50c91bd84f566ce0ac1acf44" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "suppliers" ADD CONSTRAINT "FK_e4d10e6df143ef83689f4f96c1b" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "suppliers" ADD CONSTRAINT "FK_a514a784909249fe9da16b81d37" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "suppliers" ADD CONSTRAINT "FK_acb5ba8b2e9f690a370a15e0196" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "qpr" ADD CONSTRAINT "FK_db9853e67bea01abb1a42197d8d" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "qpr" ADD CONSTRAINT "FK_df8f796dc4efe6eda0d7f86d0c3" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "qpr" ADD CONSTRAINT "FK_ef40488958b8b42d721a255b69e" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "qpr" ADD CONSTRAINT "FK_405e28403310456c9b5768e0fcb" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "logs" ADD CONSTRAINT "FK_fb64518c14e03b63fd2c4f7deb7" FOREIGN KEY ("idQprId") REFERENCES "qpr"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "logs" ADD CONSTRAINT "FK_4f055b0148dc6119a426eee56ab" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`
            INSERT INTO "users" (
                [code],
                [name],
                [department],
                [role],
                [email],
                [password],
                [_active],
                [_activeRow]
            ) VALUES (
                N'001',
                N'นายทดสอบ ระบบ',
                N'developer',
                N'Leader / Engineer',
                N'admin1@gmail.com',
                N'$2b$10$MsGHU0CwNhiwnVTtnG8oy.a.xKFHspJquVr9eBJjnJ.0eoKpw06IK',
                N'Y',
                N'Y'
            )
        `)

    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "logs" DROP CONSTRAINT "FK_4f055b0148dc6119a426eee56ab"`);
        await queryRunner.query(`ALTER TABLE "logs" DROP CONSTRAINT "FK_fb64518c14e03b63fd2c4f7deb7"`);
        await queryRunner.query(`ALTER TABLE "qpr" DROP CONSTRAINT "FK_405e28403310456c9b5768e0fcb"`);
        await queryRunner.query(`ALTER TABLE "qpr" DROP CONSTRAINT "FK_ef40488958b8b42d721a255b69e"`);
        await queryRunner.query(`ALTER TABLE "qpr" DROP CONSTRAINT "FK_df8f796dc4efe6eda0d7f86d0c3"`);
        await queryRunner.query(`ALTER TABLE "qpr" DROP CONSTRAINT "FK_db9853e67bea01abb1a42197d8d"`);
        await queryRunner.query(`ALTER TABLE "suppliers" DROP CONSTRAINT "FK_acb5ba8b2e9f690a370a15e0196"`);
        await queryRunner.query(`ALTER TABLE "suppliers" DROP CONSTRAINT "FK_a514a784909249fe9da16b81d37"`);
        await queryRunner.query(`ALTER TABLE "suppliers" DROP CONSTRAINT "FK_e4d10e6df143ef83689f4f96c1b"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_e9d50c91bd84f566ce0ac1acf44"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_52e97c477859f8019f3705abd21"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_51d635f1d983d505fb5a2f44c52"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_1e47d41df5aad908e61bfded2f9"`);
        await queryRunner.query(`DROP TABLE "logs"`);
        await queryRunner.query(`DROP INDEX "IDX_b4515d75d425deece0766632e4" ON "qpr"`);
        await queryRunner.query(`DROP INDEX "IDX_fe16d412ec2a32681b1ad675f3" ON "qpr"`);
        await queryRunner.query(`DROP INDEX "IDX_2beaea2b59d36773a25d40f259" ON "qpr"`);
        await queryRunner.query(`DROP INDEX "IDX_c7473b18cb0d839f9c7ee60b4b" ON "qpr"`);
        await queryRunner.query(`DROP INDEX "IDX_354b3dc0ce5f6b288c450ee1fe" ON "qpr"`);
        await queryRunner.query(`DROP INDEX "IDX_bdd2e6f973e7e484c6427b4706" ON "qpr"`);
        await queryRunner.query(`DROP INDEX "IDX_e3377efb1e656f9069cb09bd5b" ON "qpr"`);
        await queryRunner.query(`DROP INDEX "IDX_fac1e8de41ff98917a0655041c" ON "qpr"`);
        await queryRunner.query(`DROP INDEX "IDX_5eaa250edaa3fa8964299128b8" ON "qpr"`);
        await queryRunner.query(`DROP INDEX "IDX_1c31fd9653e4e866ffcd3d7152" ON "qpr"`);
        await queryRunner.query(`DROP INDEX "IDX_9c3fc0a3fe33f852253174789c" ON "qpr"`);
        await queryRunner.query(`DROP INDEX "IDX_6a6dbd801c5d6198a881e00f63" ON "qpr"`);
        await queryRunner.query(`DROP INDEX "IDX_3d79b86c51d6193600ba5645b0" ON "qpr"`);
        await queryRunner.query(`DROP INDEX "IDX_47b8531b4083506344aef71d6e" ON "qpr"`);
        await queryRunner.query(`DROP INDEX "IDX_364d208e7c48a23def9c9f839e" ON "qpr"`);
        await queryRunner.query(`DROP INDEX "IDX_db9853e67bea01abb1a42197d8" ON "qpr"`);
        await queryRunner.query(`DROP INDEX "IDX_5d2a82af5d3c42109d919b22ff" ON "qpr"`);
        await queryRunner.query(`DROP INDEX "IDX_e8b94f396c499c14ccc25d5890" ON "qpr"`);
        await queryRunner.query(`DROP INDEX "IDX_723896385b4f9f07cb7497d9f2" ON "qpr"`);
        await queryRunner.query(`DROP TABLE "qpr"`);
        await queryRunner.query(`DROP TABLE "suppliers"`);
        await queryRunner.query(`DROP TABLE "users"`);

    }

}
