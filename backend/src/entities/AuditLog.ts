import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, BaseEntity } from "typeorm";
import { User } from "./User";

export enum AuditAction {
    USER_LOGIN = 'user_login',
    USER_LOGOUT = 'user_logout',
    USER_CREATED = 'user_created',
    USER_UPDATED = 'user_updated',
    USER_DELETED = 'user_deleted',
    USER_ROLE_CHANGED = 'user_role_changed',
    MODPACK_CREATED = 'modpack_created',
    MODPACK_UPDATED = 'modpack_updated',
    MODPACK_DELETED = 'modpack_deleted',
    ADMIN_ACCESS = 'admin_access',
    AUDIT_LOG_VIEWED = 'audit_log_viewed'
}

@Entity({ name: "audit_logs" })
export class AuditLog extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ 
        name: "action", 
        type: "enum", 
        enum: AuditAction 
    })
    action: AuditAction;

    @ManyToOne(() => User, { nullable: true })
    user: User | null;

    @Column({ name: "user_id", type: "uuid", nullable: true })
    userId: string | null;

    @Column({ name: "target_user_id", type: "uuid", nullable: true })
    targetUserId: string | null;

    @Column({ name: "target_resource_id", type: "uuid", nullable: true })
    targetResourceId: string | null;

    @Column({ name: "details", type: "jsonb", nullable: true })
    details: Record<string, any> | null;

    @Column({ name: "ip_address", type: "varchar", length: 45, nullable: true })
    ipAddress: string | null;

    @Column({ name: "user_agent", type: "text", nullable: true })
    userAgent: string | null;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;
}