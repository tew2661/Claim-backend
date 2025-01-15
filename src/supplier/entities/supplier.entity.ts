import { UsersEntity } from "src/users/entities/users.entity";
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
    ManyToOne,
} from "typeorm";

export enum ActiveStatus {
    YES = 'Y',
    NO = 'N',
}

@Entity({ schema: 'dbo', name: 'suppliers' })
export class SupplierEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: "nvarchar", length: 20 })
    supplierCode: string; // รหัสซัพพลายเออร์

    @Column({ type: "nvarchar", length: 100 })
    supplierName: string; // ชื่อซัพพลายเออร์

    @Column({ type: "nvarchar", length: 15, nullable: true })
    tel: string; // เบอร์โทรศัพท์ (nullable)

    @Column({ type: "simple-array", nullable: true })
    email: string[]; // อีเมล (เก็บเป็น array)

    @Column({ type: "simple-array", nullable: true })
    contactPerson: string[];

    @Column({ type: 'nvarchar', name: '_activeRow', length: 1, nullable: false, default: ActiveStatus.YES })
    activeRow: string;

    @CreateDateColumn({ type: "datetime", name: "created_at" })
    createdAt: Date; // วันที่สร้างข้อมูล

    @UpdateDateColumn({ type: "datetime", name: "updated_at" })
    updatedAt: Date; // วันที่แก้ไขข้อมูลล่าสุด

    @DeleteDateColumn({ type: "datetime", name: "deleted_at", nullable: true })
    deletedAt?: Date; // วันที่ลบข้อมูล (nullable สำหรับ soft delete)

    @ManyToOne(() => UsersEntity, user => user.id, { nullable: true, onDelete: 'NO ACTION' })
    createdBy: UsersEntity

    @ManyToOne(() => UsersEntity, user => user.id, { nullable: true, onDelete: 'NO ACTION' })
    updatedBy: UsersEntity;

    @ManyToOne(() => UsersEntity, user => user.id, { nullable: true, onDelete: 'NO ACTION' })
    deletedBy?: UsersEntity;
}
