import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, BaseEntity, Index } from "typeorm";

@Entity({ name: "yggdrasil_sessions" })
@Index(["userId"])
@Index(["accessToken"], { unique: true })
export class YggdrasilSession extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "user_id", type: "uuid" })
    userId: string;

    @Column({ name: "access_token", type: "varchar", length: 64, unique: true })
    accessToken: string;

    @Column({ name: "client_token", type: "varchar", length: 64 })
    clientToken: string;

    @Column({ name: "server_id", type: "varchar", length: 255, nullable: true })
    serverId?: string | null;

    @Column({ name: "last_activity", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
    lastActivity: Date;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;

    // Check if session is expired (20 minutes of inactivity)
    isExpired(): boolean {
        const now = new Date();
        const expirationTime = 20 * 60 * 1000; // 20 minutes in milliseconds
        const timeSinceActivity = now.getTime() - this.lastActivity.getTime();
        return timeSinceActivity > expirationTime;
    }

    // Update last activity timestamp
    async updateActivity(): Promise<void> {
        this.lastActivity = new Date();
        await this.save();
    }
}
