import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
    JoinColumn,
    Index
} from 'typeorm';
import { SampleDataSheetRowEntity } from './sample-data-sheet-row.entity';

@Entity({ schema: 'dbo', name: 'sample_data_sheet_row_samples' })
@Index(['sampleDataSheetRowId'])
export class SampleDataSheetRowSampleEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Index()
    @Column({ name: 'sample_data_sheet_row_id', type: 'int' })
    sampleDataSheetRowId: number;

    @Column({ name: 'no', type: 'int' })
    no: number;

    @Column({ name: 'value', type: 'decimal', precision: 18, scale: 2, nullable: true })
    value: number;

    @CreateDateColumn({ name: 'created_at', type: 'datetime2' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'datetime2' })
    updatedAt: Date;

    @DeleteDateColumn({ name: 'deleted_at', type: 'datetime2', nullable: true })
    deletedAt: Date;

    @ManyToOne(() => SampleDataSheetRowEntity, row => row.samples, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sample_data_sheet_row_id' })
    sampleDataSheetRow: SampleDataSheetRowEntity;
}
