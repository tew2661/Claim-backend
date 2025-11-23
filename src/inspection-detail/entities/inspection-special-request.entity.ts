import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { InspectionDetailEntity, ActiveStatus } from './inspection-detail.entity';

export enum SpecialRequestStatus {
  Pending = 'Pending',
  Processed = 'Processed',
  Rejected = 'Rejected',
}

@Entity({ schema: 'dbo', name: 'sds_inspection_special_request' })
@Index(['activeRow', 'createdAt'])
@Index(['inspectionDetailId'])
export class InspectionSpecialRequestEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'inspection_detail_id', type: 'int' })
  inspectionDetailId: number;

  @Column({ name: 'special_request_items', type: 'nvarchar', length: 'max' })
  specialRequestItems: string;

  @Column({ name: 'qty', type: 'int' })
  qty: number;

  @Column({ name: 'cp_cpk', type: 'varchar', length: '20' })
  cpCpk: string;

  @Column({ name: 'due_date', type: 'datetime2' })
  dueDate: Date;

  @Column({ name: 'status', type: 'varchar', length: '20', default: SpecialRequestStatus.Pending })
  status: SpecialRequestStatus;

  @Column({ name: 'comments', type: 'nvarchar', length: '1000', nullable: true })
  comments?: string;

  @Column({ name: 'active_row', type: 'char', length: '1', default: 'Y' })
  activeRow: string;

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

  @ManyToOne(() => InspectionDetailEntity, { nullable: false })
  @JoinColumn({ name: 'inspection_detail_id' })
  inspectionDetail: InspectionDetailEntity;
}