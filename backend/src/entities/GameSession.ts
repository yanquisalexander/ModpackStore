import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BaseEntity, Index } from "typeorm";
import { User } from "./User";

/**
 * GameSession entity for Yggdrasil authentication
 * Stores temporary game authentication sessions for Minecraft server access
 */
@Entity({ name: "game_sessions" })
export class GameSession extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "user_id", type: "uuid" })
    @Index()
    userId: string;

    @Column({ name: "access_token", type: "text", unique: true })
    @Index()
    accessToken: string;

    @Column({ name: "client_token", type: "text" })
    clientToken: string;

    @Column({ name: "server_id", type: "text", nullable: true })
    @Index()
    serverId: string | null;

    @Column({ name: "ip_address", type: "inet", nullable: true })
    ipAddress: string | null;

    @Column({ name: "last_activity", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
    lastActivity: Date;

    @Column({ name: "expires_at", type: "timestamp" })
    @Index()
    expiresAt: Date;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;

    @Column({ name: "requested_username", type: "text", nullable: true })
    requestedUsername: string | null;

    // Relations
    @ManyToOne(() => User)
    @JoinColumn({ name: "user_id" })
    user: User;

    /**
     * Check if session is expired
     */
    isExpired(): boolean {
        return new Date() > this.expiresAt;
    }

    /**
     * Check if session is inactive (20 minutes without activity)
     */
    isInactive(): boolean {
        const inactivityTimeout = 20 * 60 * 1000; // 20 minutes in milliseconds
        return new Date().getTime() - this.lastActivity.getTime() > inactivityTimeout;
    }

    /**
     * Update last activity timestamp
     */
    async updateActivity(): Promise<void> {
        this.lastActivity = new Date();
        await this.save();
    }

    /**
     * Find session by access token
     */
    static async findByAccessToken(accessToken: string): Promise<GameSession | null> {
        return await GameSession.findOne({
            where: { accessToken },
            relations: ['user']
        });
    }

    /**
     * Find active session by user ID
     */
    static async findActiveByUserId(userId: string): Promise<GameSession | null> {
        return await GameSession
            .createQueryBuilder('gameSession')
            .where('gameSession.userId = :userId', { userId })
            .andWhere('gameSession.expiresAt > :now', { now: new Date() })
            .orderBy('gameSession.createdAt', 'DESC')
            .getOne();
    }

    /**
     * Find session by server ID and username
     */
    static async findByServerIdAndUsername(serverId: string, username: string): Promise<GameSession | null> {
        return await GameSession
            .createQueryBuilder('gameSession')
            .leftJoinAndSelect('gameSession.user', 'user')
            .where('gameSession.serverId = :serverId', { serverId })
            .andWhere('(user.username = :username OR gameSession.requestedUsername = :username)', { username })
            .andWhere('gameSession.expiresAt > :now', { now: new Date() })
            .getOne();
    }

    /**
     * Clean up expired sessions
     */
    static async cleanupExpiredSessions(): Promise<void> {
        await GameSession
            .createQueryBuilder()
            .delete()
            .where('expiresAt < :now', { now: new Date() })
            .execute();
    }
}
