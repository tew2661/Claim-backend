// src/qpr/qpr.entity.ts
import { SupplierEntity } from 'src/supplier/entities/supplier.entity';
import { UsersEntity } from 'src/users/entities/users.entity';
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    ManyToOne,
    UpdateDateColumn,
    Index
} from 'typeorm';
import { Object8DReportDto, SaveObjectQPR } from '../dto/action-supplier.dto';

export enum ActiveStatus {
    YES = 'Y',
    NO = 'N',
}

export enum ReportStatus {
    Approved = 'Approved',
    Save = 'Save',
    WaitForSupplier = 'Wait for Supplier',
    Rejected = 'Rejected',
    Completed = 'Completed',
    Pending = 'Pending',
    Inprocess = 'In Process'
}

@Entity({ schema: 'dbo', name: 'qpr' })
@Index(['activeRow', 'dateReported'])
@Index(['activeRow', 'createdAt'])
export class QprEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Index()
    @Column({ name: 'qpr_issue_no' })
    qprIssueNo: string;

    @Index()
    @Column({ type: 'datetime2', name: 'occurrence_date' })
    occurrenceDate: Date;

    @Index()
    @Column({ type: 'datetime2', name: 'date_reported' })
    dateReported: Date;

    @Column({ type: 'datetime2', name: 'reply_quick_action' })
    replyQuickAction: Date;

    @Column({ type: 'datetime2', name: 'reply_report' })
    replyReport: Date;

    @Index()
    @ManyToOne(() => SupplierEntity, supplier => supplier.id, { nullable: true, onDelete: 'NO ACTION' })
    supplier: SupplierEntity;

    @Column({ name: 'part_name' })
    partName: string;

    @Index()
    @Column({ name: 'part_no' })
    partNo: string;

    @Index()
    @Column()
    model: string;

    @Index()
    @Column()
    when: string;

    @Index()
    @Column()
    who: string;

    @Column({ type: 'simple-json', name: 'where_found' })
    whereFound: {
        receiving: boolean;
        receivingDetails: string;
        inprocess: boolean;
        inprocessDetails: string;
        fg: boolean;
        fgDetails: string;
        wh: boolean;
        whDetails: string;
        customerClaim: boolean;
        customerClaimDetails: string;
        warrantyClaim: boolean;
        warrantyClaimDetails: string;
        other: boolean;
        otherDetails: string;
    };

    @Column({ type: 'simple-json' })
    defect: {
        dimension: boolean;
        material: boolean;
        appearance: boolean;
        characteristics: boolean;
        other: boolean;
        otherDetails: string;
    };

    @Column()
    state: string;

    @Column({ name: 'importance_level' })
    importanceLevel: string;

    @Column()
    urgent: boolean;

    @Column({ type: 'simple-json' })
    frequency: {
        firstDefective: boolean;
        reoccurrence: boolean;
        reoccurrenceDetails: number;
        chronicDisease: boolean;
    };

    @Column({ type: 'simple-json', name: 'defective_contents' })
    defectiveContents: {
        problemCase: string;
        specification: string;
        action: string;
        ngEffective: string;
        lot: string;
    };

    @Column({ nullable: true })
    issue: string;

    @Column({ type: 'simple-json' })
    figures: {
        img1: string | null;
        img2: string | null;
        img3: string | null;
        img4: string | null;
    };

    @Index()
    @Column({ type: 'nvarchar', name: 'delay_document', default: "Quick Report" })
    delayDocument: "8D Report" | "Quick Report"

    @Index()
    @Column({ name: 'quick_report_status', default: ReportStatus.WaitForSupplier })
    quickReportStatus: ReportStatus;

    @Index()
    @Column({ name: 'quick_report_status_checker_1', nullable: true })
    quickReportStatusChecker1: ReportStatus;

    @Column({ type: 'datetime2', name: 'quick_report_date_checker_1', nullable: true })
    quickReportDateChecker1: Date | null;

    @Column({ name: 'quick_report_status_checker_2',  nullable: true })
    quickReportStatusChecker2: ReportStatus;

    @Column({ type: 'datetime2', name: 'quick_report_date_checker_2', nullable: true })
    quickReportDateChecker2: Date | null;

    @Column({ name: 'eight_d_report_approver', nullable: true })
    eightDReportApprover: string;

    @Column({ name: 'quick_report_status_checker_3', nullable: true })
    quickReportStatusChecker3: ReportStatus;

    @Column({ type: 'datetime2', name: 'quick_report_date_checker_3', nullable: true })
    quickReportDateChecker3: Date | null;

    @Index()
    @Column({ name: 'eight_d_status_checker_1', nullable: true })
    eightDStatusChecker1: ReportStatus;

    @Column({ type: 'datetime2', name: 'eight_d_date_checker_1', nullable: true })
    eightDDateChecker1: Date | null;

    @Column({ name: 'eight_d_status_checker_2',  nullable: true })
    eightDStatusChecker2: ReportStatus;

    @Column({ type: 'datetime2', name: 'eight_d_date_checker_2', nullable: true })
    eightDDateChecker2: Date | null;

    @Column({ name: 'eight_d_status_checker_3', nullable: true })
    eightDStatusChecker3: ReportStatus;

    @Column({ type: 'datetime2', name: 'eight_d_date_checker_3', nullable: true })
    eightDDateChecker3: Date | null;

    @Index()
    @Column({ name: 'quick_report_status_for_supplier', default: ReportStatus.Pending })
    quickReportSupplierStatus: ReportStatus;

    @Column({ type: 'datetime2', name: 'quick_report_date', nullable: true })
    quickReportDate: Date | null;

    @Column({ type: 'datetime2', name: 'quick_report_date_for_supplier', nullable: true })
    quickReportSupplierDate: Date | null;

    @Index()
    @Column({ name: 'eight_d_report_status', nullable: true })
    eightDReportStatus?: ReportStatus;

    @Index()
    @Column({ name: 'eight_d_report_status_for_supplier', nullable: true })
    eightDReportSupplierStatus?: ReportStatus;

    @Column({ type: 'datetime2', name: 'eight_d_report_date', nullable: true })
    eightDReportDate: Date | null;

    @Column({ type: 'datetime2', name: 'eight_d_report_date_for_supplier', nullable: true })
    eightDReportSupplierDate: Date | null;

    @Column({ name: 'status', default: ReportStatus.WaitForSupplier })
    status: ReportStatus;

    @Index()
    @Column({ type: 'nvarchar', name: '_activeRow', length: 1, nullable: false, default: ActiveStatus.YES })
    activeRow: ActiveStatus;

    @Column({ type: 'nvarchar', name: 'approve_eight_d_and_reject_doc_other', length: 1, nullable: false, default: ActiveStatus.NO })
    approve8dAndRejectDocOther: ActiveStatus;

    @Column({ type: 'datetime2', nullable: true, name: 'due_date_req_doc_other' })
    dueDateReqDocumentOther: Date | null;

    @Column({ type: 'simple-json' , nullable: true })
    objectQPRSupplier: SaveObjectQPR[];

    @Column({ type: 'simple-json' , nullable: true })
    object8DReportDto: Object8DReportDto[];

    @Index()
    @CreateDateColumn({ type: "datetime", name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ type: "datetime", name: "updated_at" })
    updatedAt: Date;

    @DeleteDateColumn({ type: "datetime", name: "deleted_at", nullable: true })
    deletedAt?: Date;

    @ManyToOne(() => UsersEntity, user => user.id, { nullable: true, onDelete: 'NO ACTION' })
    createdBy: UsersEntity;

    @ManyToOne(() => UsersEntity, user => user.id, { nullable: true, onDelete: 'NO ACTION' })
    updatedBy: UsersEntity;

    @ManyToOne(() => UsersEntity, user => user.id, { nullable: true, onDelete: 'NO ACTION' })
    deletedBy?: UsersEntity;
}