import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BaseEntity, Index } from "typeorm";
import { User } from "./User";

@Entity({ name: "game_sessions" })
@Index(["accessToken"], { unique: true })
@Index(["clientToken"])
@Index(["userId"])
export class GameSession extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "user_id", type: "uuid" })
    userId: string;

    @Column({ name: "access_token", type: "text", unique: true })
    accessToken: string;

    @Column({ name: "client_token", type: "text" })
    clientToken: string;

    @Column({ name: "selected_profile_id", type: "uuid", nullable: true })
    selectedProfileId?: string | null;

    @Column({ name: "selected_profile_name", type: "text", nullable: true })
    selectedProfileName?: string | null;

    @Column({ name: "last_activity_at", type: "timestamp" })
    lastActivityAt: Date;

    @Column({ name: "expires_at", type: "timestamp" })
    expiresAt: Date;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;

    // Relations
    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user: User;

    // Helper methods
    isExpired(): boolean {
        return new Date() > this.expiresAt;
    }

    isInactive(): boolean {
        const inactivityThreshold = 20 * 60 * 1000; // 20 minutes in milliseconds
        return new Date().getTime() - this.lastActivityAt.getTime() > inactivityThreshold;
    }

    updateActivity(): void {
        this.lastActivityAt = new Date();
    }

    // Static finder methods
    static async findByAccessToken(accessToken: string): Promise<GameSession | null> {
        return await GameSession.findOne({ 
            where: { accessToken },
            relations: ["user"]
        });
    }

    static async findByClientToken(clientToken: string): Promise<GameSession | null> {
        return await GameSession.findOne({ 
            where: { clientToken },
            relations: ["user"]
        });
    }

    static async cleanupExpiredSessions(): Promise<void> {
        await GameSession.createQueryBuilder()
            .delete()
            .where("expires_at < :now", { now: new Date() })
            .execute();
    }

    static async cleanupInactiveSessions(): Promise<void> {
        const inactivityThreshold = new Date(Date.now() - 20 * 60 * 1000); // 20 minutes ago
        await GameSession.createQueryBuilder()
            .delete()
            .where("last_activity_at < :threshold", { threshold: inactivityThreshold })
            .execute();
    }
}
