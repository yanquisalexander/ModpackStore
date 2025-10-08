import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BaseEntity } from "typeorm";
import { User } from "./User";

/**
 * GameSession entity - Manages temporary authentication tokens for Minecraft game clients
 * These sessions are separate from web sessions and have a shorter lifetime (20 min inactivity)
 */
@Entity({ name: "game_sessions" })
export class GameSession extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "user_id", type: "uuid" })
    userId: string;

    @Column({ name: "access_token", type: "text", unique: true })
    accessToken: string;

    @Column({ name: "client_token", type: "text", nullable: true })
    clientToken?: string | null;

    @Column({ name: "profile_name", type: "varchar", length: 16 })
    profileName: string;

    @Column({ name: "profile_id", type: "uuid" })
    profileId: string;

    @Column({ name: "last_activity_at", type: "timestamp" })
    lastActivityAt: Date;

    @Column({ name: "expires_at", type: "timestamp" })
    expiresAt: Date;

    @Column({ name: "invalidated", type: "boolean", default: false })
    invalidated: boolean;

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
        return this.invalidated || new Date() > this.expiresAt;
    }

    updateActivity(): void {
        this.lastActivityAt = new Date();
        // Extend expiration by 20 minutes on activity
        this.expiresAt = new Date(Date.now() + 20 * 60 * 1000);
    }

    // Static finder methods
    static async findByAccessToken(accessToken: string): Promise<GameSession | null> {
        return await GameSession.findOne({ 
            where: { accessToken },
            relations: ["user"]
        });
    }

    static async findValidByAccessToken(accessToken: string): Promise<GameSession | null> {
        const session = await GameSession.findByAccessToken(accessToken);
        if (!session || session.isExpired()) {
            return null;
        }
        return session;
    }

    static async findByUserAndClientToken(userId: string, clientToken: string): Promise<GameSession | null> {
        return await GameSession.findOne({
            where: { 
                userId,
                clientToken,
                invalidated: false
            },
            relations: ["user"]
        });
    }

    static async invalidateAllForUser(userId: string): Promise<void> {
        await GameSession.update(
            { userId, invalidated: false },
            { invalidated: true }
        );
    }
}
