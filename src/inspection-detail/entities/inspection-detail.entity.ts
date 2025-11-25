import { UsersEntity } from 'src/users/entities/users.entity';
import { SupplierEntity } from 'src/supplier/entities/supplier.entity';
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    ManyToOne,
    UpdateDateColumn,
    OneToMany,
    Index,
    JoinColumn
} from 'typeorm';
import { InspectionItemEntity } from './inspection-item.entity';
import { InspectionSpecialRequestEntity } from './inspection-special-request.entity';

export enum ActiveStatus {
    YES = 'Y',
    NO = 'N',
}

export enum PartStatus {
    Active = 'Active',
    Inactive = 'Inactive',
}

export enum SupplierEditStatus {
    Locked = 'Locked',
    Unlocked = 'Unlocked',
}

@Entity({ schema: 'dbo', name: 'sds_inspection_detail' })
@Index(['activeRow', 'createdAt'])
@Index(['activeRow', 'partNo'])
export class InspectionDetailEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Index()
    @Column({ name: 'supplier_code', type: 'nvarchar', length: 50 })
    supplierCode: string;

    @Column({ name: 'supplier_name', type: 'nvarchar', length: 255 })
    supplierName: string;

    @Index()
    @Column({ name: 'part_no', type: 'nvarchar', length: 100 })
    partNo: string;

    @Column({ name: 'part_name', type: 'nvarchar', length: 255 })
    partName: string;

    @Column({ name: 'model', type: 'nvarchar', length: 100 })
    model: string;

    @Column({ name: 'ais_file', type: 'nvarchar', length: 500, nullable: true })
    aisFile: string;

    @Column({ name: 'sdr_file', type: 'nvarchar', length: 500, nullable: true })
    sdrFile: string;

    @Column({
        name: 'part_status',
        type: 'nvarchar',
        length: 20,
        default: PartStatus.Inactive
    })
    partStatus: PartStatus;

    @Column({
        name: 'supplier_edit_status',
        type: 'nvarchar',
        length: 20,
        default: SupplierEditStatus.Unlocked
    })
    supplierEditStatus: SupplierEditStatus;

    @Column({
        name: 'sds_created',
        type: 'bit',
        default: () => '0',
    })
    sdsCreated: boolean;

    @Column({
        name: 'active_row',
        type: 'char',
        length: 1,
        default: ActiveStatus.YES
    })
    activeRow: ActiveStatus;

    @Column({
        name: 'due_date',
        type: 'datetime2',
        nullable: true,
    })
    dueDate: Date;

    @CreateDateColumn({ name: 'created_at', type: 'datetime2' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'datetime2' })
    updatedAt: Date;

    @DeleteDateColumn({ name: 'deleted_at', type: 'datetime2', nullable: true })
    deletedAt: Date;

    @Column({ name: 'created_by', type: 'int', nullable: true })
    createdBy: number;

    @Column({ name: 'updated_by', type: 'int', nullable: true })
    updatedBy: number;

    // Relations
    @ManyToOne(() => SupplierEntity, { nullable: true })
    @JoinColumn({ name: 'supplier_code', referencedColumnName: 'supplierCode' })
    supplier: SupplierEntity;

    @ManyToOne(() => UsersEntity, { nullable: true })
    @JoinColumn({ name: 'created_by' })
    creator: UsersEntity;

    @ManyToOne(() => UsersEntity, { nullable: true })
    @JoinColumn({ name: 'updated_by' })
    updater: UsersEntity;

    @OneToMany(() => InspectionItemEntity, (item: InspectionItemEntity) => item.inspectionDetail, { cascade: true })
    inspectionItems: InspectionItemEntity[];

    @OneToMany(() => InspectionSpecialRequestEntity, (s: InspectionSpecialRequestEntity) => s.inspectionDetail, { cascade: true })
    specialRequest: InspectionSpecialRequestEntity[];
}
