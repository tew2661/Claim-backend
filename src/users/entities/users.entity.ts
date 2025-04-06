

import { SupplierEntity } from 'src/supplier/entities/supplier.entity';
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
    ManyToOne,
} from 'typeorm';

export enum ActiveStatus {
    YES = 'Y',
    NO = 'N',
}

@Entity({ schema: 'dbo', name: 'users' })
export class UsersEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'nvarchar', length: 255, nullable: false })
    code: string;

    @Column({ type: 'nvarchar', length: 255, nullable: false })
    name: string;

    @Column({ type: 'nvarchar', length: 255, nullable: false })
    department: string;

    @Column({ type: 'nvarchar', length: 255, nullable: false })
    role: string;

    @Column({ type: 'nvarchar', length: 255, nullable: false })
    email: string;

    @Column({ type: 'text', nullable: true })
    image: string;

    @Column({ type: 'nvarchar', length: 255, nullable: true, select: false })
    password: string;

    @Column({ type: 'nvarchar', name: '_active', length: 1, nullable: true, default: ActiveStatus.NO })
    active: string;

    @Column({ type: 'nvarchar', length: 1, nullable: false, default: ActiveStatus.NO })
    accessMasterManagement: string

    @Column({ nullable: true })
    expiresPassword: Date;

    @Column({ type: 'nvarchar', name: '_activeRow', length: 1, nullable: false, default: ActiveStatus.YES })
    activeRow: string;

    @ManyToOne(() => SupplierEntity, supplier => supplier.id, { nullable: true, onDelete: 'NO ACTION' })
    supplier: SupplierEntity;

    @CreateDateColumn({ nullable: false })
    createdAt: Date;

    @UpdateDateColumn({ nullable: false })
    updatedAt: Date;

    @DeleteDateColumn({ nullable: true })
    deletedAt: Date;

    @ManyToOne(() => UsersEntity, user => user.id, { nullable: true, onDelete: 'NO ACTION' })
    createdBy: UsersEntity

    @ManyToOne(() => UsersEntity, user => user.id, { nullable: true, onDelete: 'NO ACTION' })
    updatedBy: UsersEntity;

    @ManyToOne(() => UsersEntity, user => user.id, { nullable: true, onDelete: 'NO ACTION' })
    deletedBy: UsersEntity;

}
