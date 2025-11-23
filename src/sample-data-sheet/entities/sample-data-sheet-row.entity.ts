import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn,
    Index
} from 'typeorm';
import { SampleDataSheetEntity } from './sample-data-sheet.entity';

@Entity({ schema: 'dbo', name: 'sample_data_sheet_rows' })
@Index(['sampleDataSheetId'])
export class SampleDataSheetRowEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Index()
    @Column({ name: 'sample_data_sheet_id', type: 'int' })
    sampleDataSheetId: number;

    @Column({ name: 'no', type: 'int' })
    no: number;

    @Column({ name: 'measuring_item', type: 'nvarchar', length: 255 })
    measuringItem: string;

    @Column({ name: 'specification', type: 'nvarchar', length: 100 })
    specification: string;

    @Column({ name: 'rank', type: 'nvarchar', length: 1 })
    rank: string;

    @Column({ name: 'inspection_instrument', type: 'nvarchar', length: 255 })
    inspectionInstrument: string;

    @Column({ name: 'remark', type: 'nvarchar', length: 255, nullable: true })
    remark: string;

    @Column({ name: 'sample_qty', type: 'int' })
    sampleQty: number;

    @Column({ name: 'samples', type: 'nvarchar', length: 'max' })
    samples: string;

    @Column({ name: 'judgement', type: 'nvarchar', length: 5, nullable: true })
    judgement: string;

    @Column({ name: 'x_bar', type: 'nvarchar', length: 50, nullable: true })
    xBar: string;

    @Column({ name: 'r', type: 'nvarchar', length: 50, nullable: true })
    r: string;

    @Column({ name: 'cp', type: 'nvarchar', length: 50, nullable: true })
    cp: string;

    @Column({ name: 'cpk', type: 'nvarchar', length: 50, nullable: true })
    cpk: string;

    @CreateDateColumn({ name: 'created_at', type: 'datetime2' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'datetime2' })
    updatedAt: Date;

    @ManyToOne(() => SampleDataSheetEntity, sheet => sheet.rows, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sample_data_sheet_id' })
    sampleDataSheet: SampleDataSheetEntity;
}
