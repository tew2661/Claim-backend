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

    @Column({ name: 'specification', type: 'nvarchar', length: 100 })
    specification: string;

    @Column({ name: 'tolerance_plus', type: 'nvarchar', length: 50 })
    tolerancePlus: string;

    @Column({ name: 'tolerance_minus', type: 'nvarchar', length: 50 })
    toleranceMinus: string;

    @Column({ name: 'inspection_instrument', type: 'nvarchar', length: 255 })
    inspectionInstrument: string;

    @Column({ name: 'rank', type: 'nvarchar', length: 1 })
    rank: RankType;

    // Relations
    @ManyToOne(() => InspectionDetailEntity, detail => detail.inspectionItems, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'inspection_detail_id' })
    inspectionDetail: InspectionDetailEntity;
}
