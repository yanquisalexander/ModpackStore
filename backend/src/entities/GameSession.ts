import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BaseEntity } from "typeorm";
import { User } from "./User";

@Entity({ name: "game_sessions" })
export class GameSession extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "user_id", type: "uuid" })
    userId: string;

    @Column({ name: "access_token", type: "text", unique: true })
    accessToken: string;

    @Column({ name: "client_token", type: "text" })
    clientToken: string;

    @Column({ name: "username", type: "varchar", length: 16 })
    username: string;

    @Column({ name: "player_uuid", type: "uuid" })
    playerUuid: string;

    @Column({ name: "last_activity_at", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
    lastActivityAt: Date;

    @Column({ name: "expires_at", type: "timestamp" })
    expiresAt: Date;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;

    // Relations
    @ManyToOne(() => User, user => user.gameSessions)
    @JoinColumn({ name: "user_id" })
    user: User;

    // Helper methods
    isExpired(): boolean {
        return new Date() > this.expiresAt;
    }

    isInactive(): boolean {
        const inactivityLimit = 20 * 60 * 1000; // 20 minutes in milliseconds
        return new Date().getTime() - new Date(this.lastActivityAt).getTime() > inactivityLimit;
    }

    updateActivity(): void {
        this.lastActivityAt = new Date();
    }

    // Static finder methods
    static async findByAccessToken(accessToken: string): Promise<GameSession | null> {
        return await GameSession.findOne({ where: { accessToken }, relations: ["user"] });
    }

    static async findByClientToken(clientToken: string): Promise<GameSession | null> {
        return await GameSession.findOne({ where: { clientToken }, relations: ["user"] });
    }

    static async findValidSession(accessToken: string): Promise<GameSession | null> {
        const session = await GameSession.findByAccessToken(accessToken);
        if (!session || session.isExpired() || session.isInactive()) {
            return null;
        }
        return session;
    }

    static async cleanupExpiredSessions(): Promise<void> {
        await GameSession.createQueryBuilder()
            .delete()
            .where("expires_at < :now", { now: new Date() })
            .orWhere("last_activity_at < :inactiveLimit", { 
                inactiveLimit: new Date(Date.now() - 20 * 60 * 1000) 
            })
            .execute();
    }
}
