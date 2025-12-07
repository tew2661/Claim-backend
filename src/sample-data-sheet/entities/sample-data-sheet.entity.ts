import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
    OneToMany,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { SampleDataSheetRowEntity } from './sample-data-sheet-row.entity';
import { InspectionDetailEntity } from 'src/inspection-detail/entities/inspection-detail.entity';
import { SampleDataSheetApprovalEntity } from './sample-data-sheet-approval.entity';

@Entity({ schema: 'dbo', name: 'sample_data_sheets' })
export class SampleDataSheetEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'supplier', type: 'nvarchar', length: 255 })
    supplier: string;

    @Column({ name: 'part_no', type: 'nvarchar', length: 100 })
    partNo: string;

    @Column({ name: 'part_name', type: 'nvarchar', length: 255 })
    partName: string;

    @Column({ name: 'model', type: 'nvarchar', length: 100 })
    model: string;

    @Column({ name: 'inspection_detail_id', type: 'int', nullable: true })
    inspectionDetailId: number;

    @ManyToOne(() => InspectionDetailEntity, { nullable: true })
    @JoinColumn({ name: 'inspection_detail_id' })
    inspectionDetail?: InspectionDetailEntity;

    @Column({ name: 'production_08_2025', type: 'nvarchar', length: 5 })
    production082025: 'Yes' | 'No';

    @Column({ name: 'sdr_date', type: 'datetime2' })
    sdrDate: Date;

    @Column({ name: 'ais_file', type: 'nvarchar', length: 500, nullable: true })
    aisFile: string;

    @Column({ name: 'sdr_file', type: 'nvarchar', length: 500, nullable: true })
    sdrFile: string;

    @Column({ name: 'sdr_report_file', type: 'nvarchar', length: 500, nullable: true })
    sdrReportFile: string;

    @CreateDateColumn({ name: 'created_at', type: 'datetime2' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'datetime2' })
    updatedAt: Date;

    @DeleteDateColumn({ name: 'deleted_at', type: 'datetime2', nullable: true })
    deletedAt: Date;

    @OneToMany(() => SampleDataSheetRowEntity, row => row.sampleDataSheet, { cascade: true })
    rows: SampleDataSheetRowEntity[];

    @Column({ name: 'loop', type: 'int', nullable: false, default: 1 })
    loop: number;

    @Column({ name: 'remark', type: 'nvarchar', length: 1000, nullable: true })
    remark: string;

    @Column({ name: 'has_delay', type: 'bit', nullable: false, default: 0 })
    hasDelay: boolean;

    @Column({ name: 'delay_days', type: 'int', nullable: true })
    delayDays: number;

    @OneToMany(() => SampleDataSheetApprovalEntity, row => row.sampleDataSheet, { cascade: true })
    approvals: SampleDataSheetApprovalEntity[];
}
