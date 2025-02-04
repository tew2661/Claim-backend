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
} from 'typeorm';

export enum ActiveStatus {
    YES = 'Y',
    NO = 'N',
}

export enum ReportStatus {
    Approved = 'Approved',
    Pending = 'Pending',
    Reject = 'Reject',
}

@Entity({ schema: 'dbo', name: 'qpr' })
export class QprEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'qpr_issue_no' })
    qprIssueNo: string;

    @Column({ type: 'datetime2', name: 'occurrence_date' })
    occurrenceDate: Date;

    @Column({ type: 'datetime2', name: 'date_reported' })
    dateReported: Date;

    @Column({ type: 'datetime2', name: 'reply_quick_action' })
    replyQuickAction: Date;

    @Column({ type: 'datetime2', name: 'reply_report' })
    replyReport: Date;

    @ManyToOne(() => SupplierEntity, supplier => supplier.id, { nullable: true, onDelete: 'NO ACTION' })
    supplier: SupplierEntity;

    @Column({ name: 'part_name' })
    partName: string;

    @Column({ name: 'part_no' })
    partNo: string;

    @Column()
    model: string;

    @Column()
    when: string;

    @Column()
    who: string;

    // เปลี่ยนจาก type: 'json' เป็น 'simple-json'
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

    // ในส่วน figures เราจะเก็บเฉพาะ file path ของรูปแต่ละรูปเป็น string
    @Column({ type: 'simple-json' })
    figures: {
        img1: string | null;
        img2: string | null;
        img3: string | null;
        img4: string | null;
    };

    @Column({ type: 'nvarchar', name: 'delay_document', default: "Quick Report" })
    delayDocument: "8D Report" | "Quick Report"

    @Column({ name: 'quick_report_status', default: ReportStatus.Pending })
    quickReportStatus: ReportStatus; // เช่น Approved หรือ Pending

    @Column({ type: 'datetime2', name: 'quick_report_date', nullable: true })
    quickReportDate: Date | null; // วันที่ของ Quick Report

    @Column({ name: 'eight_d_report_status', default: ReportStatus.Pending })
    eightDReportStatus: ReportStatus; // เช่น Approved หรือ Pending

    @Column({ type: 'datetime2', name: 'eight_d_report_date', nullable: true })
    eightDReportDate: Date | null; // วันที่ของ 8D Report

    @Column({ name: 'status', default: 'In Progress' })
    status: 'In Progress' | 'Completed'; // เช่น Completed, In Progress, หรืออื่น ๆ

    @Column({ type: 'nvarchar', name: '_activeRow', length: 1, nullable: false, default: ActiveStatus.YES })
    activeRow: ActiveStatus;

    @CreateDateColumn({ type: "datetime", name: "created_at" })
    createdAt: Date; // วันที่สร้างข้อมูล

    @UpdateDateColumn({ type: "datetime", name: "updated_at" })
    updatedAt: Date; // วันที่แก้ไขข้อมูลล่าสุด

    @DeleteDateColumn({ type: "datetime", name: "deleted_at", nullable: true })
    deletedAt?: Date; // วันที่ลบข้อมูล (nullable สำหรับ soft delete)

    @ManyToOne(() => UsersEntity, user => user.id, { nullable: true, onDelete: 'NO ACTION' })
    createdBy: UsersEntity

    @ManyToOne(() => UsersEntity, user => user.id, { nullable: true, onDelete: 'NO ACTION' })
    updatedBy: UsersEntity;

    @ManyToOne(() => UsersEntity, user => user.id, { nullable: true, onDelete: 'NO ACTION' })
    deletedBy?: UsersEntity;
}
