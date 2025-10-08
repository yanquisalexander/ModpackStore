import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BaseEntity, Index } from "typeorm";
import { User } from "./User";

/**
 * GameSession entity for authlib-injector game tokens
 * These are temporary tokens (20 min TTL) used for Minecraft server authentication
 * Separate from regular user sessions for security and lifecycle management
 */
@Entity({ name: "game_sessions" })
export class GameSession extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "user_id", type: "uuid" })
    @Index()
    userId: string;

    @Column({ name: "access_token", type: "varchar", length: 512, unique: true })
    @Index()
    accessToken: string;

    @Column({ name: "client_token", type: "varchar", length: 512, nullable: true })
    clientToken?: string;

    @Column({ name: "profile_name", type: "varchar", length: 16 })
    profileName: string;

    @Column({ name: "expires_at", type: "timestamp" })
    @Index()
    expiresAt: Date;

    @Column({ name: "last_activity_at", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
    lastActivityAt: Date;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;

    // Relations
    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user: User;

    /**
     * Check if the game session is still valid
     */
    isValid(): boolean {
        return new Date() < this.expiresAt;
    }

    /**
     * Update last activity timestamp
     */
    async updateActivity(): Promise<void> {
        this.lastActivityAt = new Date();
        await this.save();
    }

    /**
     * Find a valid game session by access token
     */
    static async findValidByAccessToken(accessToken: string): Promise<GameSession | null> {
        const session = await GameSession.findOne({
            where: { accessToken },
            relations: ["user"]
        });

        if (!session || !session.isValid()) {
            return null;
        }

        return session;
    }

    /**
     * Clean up expired game sessions (cron job or periodic cleanup)
     */
    static async cleanupExpired(): Promise<number> {
        const result = await GameSession.createQueryBuilder()
            .delete()
            .where("expires_at < :now", { now: new Date() })
            .execute();
        
        return result.affected || 0;
    }

    /**
     * Invalidate all game sessions for a user
     */
    static async invalidateUserSessions(userId: string): Promise<number> {
        const result = await GameSession.createQueryBuilder()
            .delete()
            .where("user_id = :userId", { userId })
            .execute();
        
        return result.affected || 0;
    }
}
