import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, BaseEntity } from "typeorm";
import { User } from "./User";

@Entity({ name: "bans" })
export class Ban extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "user_id", type: "uuid" })
    userId: string;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user: User;

    @Column({ name: "admin_id", type: "uuid" })
    adminId: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: "admin_id" })
    admin: User;

    @Column({ name: "reason", type: "text", nullable: true })
    reason?: string | null;

    @CreateDateColumn({ name: "ban_date" })
    banDate: Date;

    @Column({ name: "unban_date", type: "timestamp", nullable: true })
    unbanDate?: Date | null;

    @Column({ name: "unbanned_by_id", type: "uuid", nullable: true })
    unbannedById?: string | null;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: "unbanned_by_id" })
    unbannedBy?: User | null;

    // Helper method to check if ban is active
    isActive(): boolean {
        return this.unbanDate === null || this.unbanDate === undefined;
    }
}
