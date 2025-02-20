import { QprEntity } from 'src/qpr/entities/qpr.entity';
import { UsersEntity } from 'src/users/entities/users.entity';
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
} from 'typeorm';

export enum LogAction {
    CREATED = 'Created',
    APPROVED = 'Approved',
    REJECTED = 'Rejected',
    UPDATED = 'Updated',
    SUBMITED = 'Submited',
}

export enum DocumentType {
    QUICK_REPORT = "Quick-Report",
    REPORT_8D = "8D-Report",
}

export enum RoleType {
    SUPPLIER = "Supplier",
    CHECKER1 = "Checker1",
    CHECKER2 = "Checker2",
    APPROVER1 = "Approver1",
    APPROVER2 = "Approver2",
    ISNULL = ""
}

@Entity({ schema: 'dbo', name: 'logs' })
export class LogEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'nvarchar', length: 50, nullable: false })
    qprNo: string;

    @ManyToOne(() => QprEntity, qpr => qpr.id, { nullable: false })
    idQpr: number

    @Column({
        type: 'nvarchar',
        length: 50,
        nullable: false,
        default: RoleType.ISNULL
    })
    roleType: string;

    @Column({
        type: 'nvarchar',
        length: 50,
        nullable: false,
    })
    documentType: DocumentType;

    @Column({
        type: 'nvarchar',
        length: 1,
        nullable: false,
        default: 'N'
    })
    IsDocumentOther: 'Y' | 'N'

    @Column({
        type: 'nvarchar',
        length: 50,
        nullable: false,
    })
    action: LogAction;

    @ManyToOne(() => UsersEntity, user => user.id, { nullable: false })
    performedBy: UsersEntity;

    @CreateDateColumn({ type: 'datetime' })
    performedAt: Date;

    @Column({ type: 'nvarchar', length: 500, nullable: true })
    remark?: string;
}
