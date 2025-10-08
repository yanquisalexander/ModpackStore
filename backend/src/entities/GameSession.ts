import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, BaseEntity, Index, ManyToOne, JoinColumn } from "typeorm";
import { User } from "./User";

/**
 * GameSession entity for Yggdrasil authentication
 * Manages temporary game authentication tokens for Minecraft launcher integration
 */
@Entity({ name: "game_sessions" })
export class GameSession extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "user_id", type: "uuid" })
    @Index()
    userId: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: "user_id" })
    user: User;

    /**
     * Access token for game authentication (UUID format for Yggdrasil compatibility)
     */
    @Column({ name: "access_token", type: "uuid", unique: true })
    @Index()
    accessToken: string;

    /**
     * Client token provided by launcher (for pairing)
     */
    @Column({ name: "client_token", type: "uuid", nullable: true })
    clientToken?: string | null;

    /**
     * Custom nickname for this session (overrides username if set)
     */
    @Column({ name: "custom_nickname", type: "varchar", length: 16, nullable: true })
    customNickname?: string | null;

    /**
     * Last activity timestamp for inactivity timeout
     */
    @Column({ name: "last_activity_at", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
    @Index()
    lastActivityAt: Date;

    /**
     * Session expiration timestamp
     */
    @Column({ name: "expires_at", type: "timestamp" })
    @Index()
    expiresAt: Date;

    /**
     * Whether this session is still valid
     */
    @Column({ name: "is_valid", type: "boolean", default: true })
    isValid: boolean;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;

    /**
     * Check if session has expired due to inactivity (20 minutes)
     */
    isExpired(): boolean {
        const now = new Date();
        const inactivityTimeout = 20 * 60 * 1000; // 20 minutes in milliseconds
        const lastActivity = new Date(this.lastActivityAt);
        
        return now > this.expiresAt || (now.getTime() - lastActivity.getTime() > inactivityTimeout);
    }

    /**
     * Update last activity timestamp
     */
    updateActivity(): void {
        this.lastActivityAt = new Date();
    }
}
