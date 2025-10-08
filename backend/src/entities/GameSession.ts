import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BaseEntity, Index } from "typeorm";
import { User } from "./User";

/**
 * GameSession entity for AuthServer
 * Manages temporary game session tokens for ModpackStore accounts
 * Compatible with Yggdrasil/authlib-injector protocol
 */
@Entity({ name: "game_sessions" })
@Index(["accessToken"], { unique: true })
@Index(["userId", "isActive"])
export class GameSession extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "user_id", type: "uuid" })
    userId: string;

    @Column({ name: "access_token", type: "text", unique: true })
    accessToken: string;

    @Column({ name: "client_token", type: "text" })
    clientToken: string;

    @Column({ name: "is_active", type: "boolean", default: true })
    isActive: boolean;

    @Column({ name: "last_activity_at", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
    lastActivityAt: Date;

    @Column({ name: "ip_address", type: "text", nullable: true })
    ipAddress?: string | null;

    @Column({ name: "user_agent", type: "text", nullable: true })
    userAgent?: string | null;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;

    // Relations
    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user: User;

    // Helper methods
    
    /**
     * Check if session is expired (20 minutes of inactivity)
     */
    isExpired(): boolean {
        const now = new Date();
        const inactivityMs = now.getTime() - this.lastActivityAt.getTime();
        const twentyMinutesMs = 20 * 60 * 1000;
        return inactivityMs > twentyMinutesMs;
    }

    /**
     * Update last activity timestamp
     */
    async updateActivity(): Promise<void> {
        this.lastActivityAt = new Date();
        await this.save();
    }

    /**
     * Invalidate this session
     */
    async invalidate(): Promise<void> {
        this.isActive = false;
        await this.save();
    }

    /**
     * Find active session by access token
     */
    static async findByAccessToken(accessToken: string): Promise<GameSession | null> {
        return await GameSession.findOne({
            where: { accessToken, isActive: true },
            relations: ["user"]
        });
    }

    /**
     * Find active session by user ID
     */
    static async findActiveByUserId(userId: string): Promise<GameSession | null> {
        return await GameSession.findOne({
            where: { userId, isActive: true },
            order: { createdAt: "DESC" }
        });
    }

    /**
     * Clean up expired sessions (for maintenance job)
     */
    static async cleanupExpired(): Promise<number> {
        const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
        const result = await GameSession
            .createQueryBuilder()
            .update(GameSession)
            .set({ isActive: false })
            .where("last_activity_at < :date", { date: twentyMinutesAgo })
            .andWhere("is_active = :isActive", { isActive: true })
            .execute();
        
        return result.affected || 0;
    }
}
