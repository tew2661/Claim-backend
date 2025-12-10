import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    Index,
    JoinColumn
} from 'typeorm';
import { InspectionDetailEntity } from './inspection-detail.entity';

export enum RankType {
    A = 'A',
    B = 'B',
    C = 'C',
    S = 'S',
    R = 'R',
}

@Entity({ schema: 'dbo', name: 'sds_inspection_items' })
@Index(['inspectionDetailId'])
export class InspectionItemEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Index()
    @Column({ name: 'inspection_detail_id', type: 'int' })
    inspectionDetailId: number;

    @Column({ name: 'no', type: 'int' })
    no: number;

    @Column({ name: 'measuring_item', type: 'nvarchar', length: 255 })
    measuringItem: string;

    @Column({ name: 'specification', type: 'decimal', precision: 18, scale: 4 })
    specification: number;

    @Column({ name: 'tolerance_plus', type: 'decimal', precision: 18, scale: 4 })
    tolerancePlus: number;

    @Column({ name: 'tolerance_minus', type: 'decimal', precision: 18, scale: 4 })
    toleranceMinus: number;

    @Column({ name: 'inspection_instrument', type: 'nvarchar', length: 255 })
    inspectionInstrument: string;

    @Column({ name: 'rank', type: 'nvarchar', length: 1 })
    rank: RankType;

    // Relations
    @ManyToOne(() => InspectionDetailEntity, detail => detail.inspectionItems, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'inspection_detail_id' })
    inspectionDetail: InspectionDetailEntity;
}
