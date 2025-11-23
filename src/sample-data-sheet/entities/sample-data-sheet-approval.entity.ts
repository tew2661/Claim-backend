import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
} from 'typeorm';
import { SampleDataSheetEntity } from './sample-data-sheet.entity';
import { UsersEntity } from 'src/users/entities/users.entity';

export enum SdsApprovalAction {
    APPROVED = 'Approved',
    REJECTED = 'Rejected',
    SPECIAL_REQUEST = 'Special Request',
    SUBMITTED = 'Submitted',
    CREATE_EDIT = 'Create / Edit',
}

export enum SdsApprovalRole {
    SUPPLIER = 'Supplier',
    CHECKER1 = 'Checker 1',
    CHECKER1_LEADER = 'Checker1',
    CHECKER2 = 'Checker 2',
    APPROVER = 'Approver',
}

export enum SdsDocumentType {
    SDR = 'SDR',
    SDS = 'SDS',
    BOTH = 'Both',
}

@Entity({ schema: 'dbo', name: 'sample_data_sheet_approvals' })
export class SampleDataSheetApprovalEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'sample_data_sheet_id', type: 'int', nullable: false })
    sampleDataSheetId: number;

    @Column({ name: 'loop', type: 'int', nullable: false, default: 1 })
    loop: number;

    @ManyToOne(() => SampleDataSheetEntity, { nullable: false })
    @JoinColumn({ name: 'sample_data_sheet_id' })
    sampleDataSheet: SampleDataSheetEntity;

    @Column({ name: 'action', type: 'nvarchar', length: 50, nullable: false })
    action: SdsApprovalAction;

    @Column({ name: 'role', type: 'nvarchar', length: 50, nullable: false })
    role: SdsApprovalRole;

    @Column({ name: 'document_type', type: 'nvarchar', length: 20, nullable: false })
    documentType: SdsDocumentType;

    @Column({ name: 'action_by_user_id', type: 'int', nullable: false })
    actionByUserId: number;

    @ManyToOne(() => UsersEntity, { nullable: false })
    @JoinColumn({ name: 'action_by_user_id' })
    actionByUser: UsersEntity;

    @Column({ name: 'remark', type: 'nvarchar', length: 1000, nullable: true })
    remark: string;

    @Column({ name: 're_submit_date', type: 'datetime2', nullable: true })
    reSubmitDate: Date;

    @CreateDateColumn({ name: 'action_date', type: 'datetime2' })
    actionDate: Date;

    @Column({ name: 'part_no', type: 'nvarchar', length: 100, nullable: false })
    partNo: string;

    @Column({ name: 'sds_month_year', type: 'nvarchar', length: 20, nullable: true })
    sdsMonthYear: string;
}
