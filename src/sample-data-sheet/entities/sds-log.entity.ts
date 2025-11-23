import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    Index,
} from 'typeorm';

@Entity('sds_log')
@Index('IDX_sds_log_part_no', ['partNo'])
@Index('IDX_sds_log_action_date', ['actionDate'])
@Index('IDX_sds_log_inspection_detail_id', ['sdsInspectionDetailId'])
export class SdsLogEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'menu', type: 'varchar', length: 100 })
    menu: string;

    @Column({ name: 'sds_inspection_detail_id', type: 'int', nullable: true })
    sdsInspectionDetailId: number;

    @Column({ name: 'part_no', type: 'varchar', length: 100, nullable: true })
    partNo: string;

    @Column({ name: 'sds_month_year', type: 'varchar', length: 20, nullable: true })
    sdsMonthYear: string;

    @Column({ name: 'action', type: 'varchar', length: 100 })
    action: string;

    @Column({ name: 'action_role', type: 'varchar', length: 100, nullable: true })
    actionRole: string;

    @Column({ name: 'action_by', type: 'varchar', length: 255, nullable: true })
    actionBy: string;

    @Column({ name: 'action_date', type: 'datetime2' })
    actionDate: Date;

    @Column({ name: 'remark', type: 'text', nullable: true })
    remark: string;

    @CreateDateColumn({ name: 'created_at', type: 'datetime2' })
    createdAt: Date;
}
