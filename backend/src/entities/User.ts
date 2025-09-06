import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, BaseEntity } from "typeorm";
import { Session } from "./Session";
import { PublisherMember } from "./PublisherMember";
import { Modpack } from "./Modpack";
import { ModpackVersion } from "./ModpackVersion";
import { UserPurchase } from "./UserPurchase";
import { WalletTransaction } from "./WalletTransaction";
import { Publisher } from "./Publisher";
import { PublisherMemberRole, UserRole } from "@/types/enums";
import { sign } from "jsonwebtoken";
import { TwitchService } from "@/services/twitch.service";

@Entity({ name: "users" })
export class User extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "username", type: "varchar", length: 32, unique: true })
    username: string;

    @Column({ name: "email", type: "text" })
    email: string;

    @Column({ name: "avatar_url", type: "text", nullable: true })
    avatarUrl?: string | null;

    // Discord fields
    @Column({ name: "discord_id", type: "text", nullable: true, unique: true })
    discordId?: string | null;

    @Column({ name: "discord_access_token", type: "text", nullable: true })
    discordAccessToken?: string | null;

    @Column({ name: "discord_refresh_token", type: "text", nullable: true })
    discordRefreshToken?: string | null;

    // Patreon fields
    @Column({ name: "patreon_id", type: "text", nullable: true })
    patreonId?: string | null;

    @Column({ name: "patreon_access_token", type: "text", nullable: true })
    patreonAccessToken?: string | null;

    @Column({ name: "patreon_refresh_token", type: "text", nullable: true })
    patreonRefreshToken?: string | null;

    // Twitch fields
    @Column({ name: "twitch_id", type: "text", nullable: true, unique: true })
    twitchId?: string | null;

    @Column({ name: "twitch_access_token", type: "text", nullable: true })
    twitchAccessToken?: string | null;

    @Column({ name: "twitch_refresh_token", type: "text", nullable: true })
    twitchRefreshToken?: string | null;

    @Column({
        name: "role",
        type: "enum",
        enum: UserRole,
        default: UserRole.USER
    })
    role: UserRole;

    @Column({ name: "provider", type: "varchar", length: 50, nullable: true })
    provider?: string | null;

    @Column({ name: "last_login_at", type: "timestamp", nullable: true })
    lastLoginAt?: Date | null;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;

    // Relations
    @OneToMany(() => Session, session => session.user)
    sessions: Session[];

    @OneToMany(() => PublisherMember, publisherMember => publisherMember.user)
    publisherMemberships: PublisherMember[];

    @OneToMany(() => Modpack, modpack => modpack.creatorUser)
    createdModpacks: Modpack[];

    @OneToMany(() => ModpackVersion, modpackVersion => modpackVersion.createdByUser)
    createdVersions: ModpackVersion[];

    @OneToMany(() => UserPurchase, userPurchase => userPurchase.user)
    purchases: UserPurchase[];

    @OneToMany(() => WalletTransaction, transaction => transaction.relatedUser)
    relatedTransactions: WalletTransaction[];

    @OneToMany(() => import("./Ticket").Ticket, ticket => ticket.user)
    tickets: import("./Ticket").Ticket[];

    async getPublishers(): Promise<Publisher[]> {
        const memberships = await PublisherMember.find({ where: { user: { id: this.id } }, relations: ["publisher"] });
        return memberships.map(membership => membership.publisher);
    }

    async getRoleInPublisher(publisherId: string): Promise<PublisherMemberRole | null> {
        const membership = await PublisherMember.findOne({ where: { user: { id: this.id }, publisher: { id: publisherId } } });
        return membership ? membership.role : null;
    }

    // Helper methods for role checking
    isAdmin(): boolean {
        return this.role === UserRole.ADMIN || this.role === UserRole.SUPERADMIN;
    }

    isSuperAdmin(): boolean {
        return this.role === UserRole.SUPERADMIN;
    }

    isSupport(): boolean {
        return this.role === UserRole.SUPPORT;
    }

    isStaff(): boolean {
        return this.role === UserRole.ADMIN || this.role === UserRole.SUPERADMIN || this.role === UserRole.SUPPORT;
    }

    hasRole(role: UserRole): boolean {
        return this.role === role;
    }

    // Business logic methods
    isPatron(): boolean {
        return !!(this.patreonId && this.patreonAccessToken);
    }

    // Check if user has Twitch linked
    hasTwitchLinked(): boolean {
        return !!(this.twitchId && this.twitchAccessToken);
    }

    async getTwitchUserInfo(): Promise<{ id: string; username: string } | null> {
        if (!this.hasTwitchLinked()) return null;

        try {
            // Use TwitchService with Twurple for better API handling
            const apiClient = await TwitchService.getUserApiClient(
                this.id,
                this.twitchAccessToken!,
                this.twitchRefreshToken || undefined
            );

            // For user API client, we need to get the authenticated user's info
            // Since we have the user ID stored, we can use it directly
            const user = await apiClient.users.getUserById(this.twitchId!);

            if (!user) {
                // Fallback to stored data if user not found
                return {
                    id: this.twitchId!,
                    username: 'unknown',
                };
            }

            return {
                id: user.id,
                username: user.name,
            };
        } catch (error) {
            console.error('Failed to fetch Twitch user info with Twurple:', error);
            return {
                id: this.twitchId!,
                username: 'unknown',
            };
        }
    }

    // Static finder methods
    static async findByIdWithRelations(id: string): Promise<User | null> {
        return await User.findOne({
            where: { id },
            relations: ["publisherMemberships", "publisherMemberships.publisher"]
        });
    }

    // Token generation method
    async generateTokens(session: Session): Promise<{ accessToken: string; refreshToken: string }> {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error("JWT_SECRET is not configured");
        }

        const payload = {
            sub: this.id,
            sessionId: session.id,
        };

        try {
            const accessToken = sign(payload, secret, {
                expiresIn: '4h',
                issuer: 'ModpackStore',
            });

            const refreshToken = sign(payload, secret, {
                expiresIn: '30d',
                issuer: 'ModpackStore',
            });

            return { accessToken, refreshToken };
        } catch (error) {
            throw new Error(`Failed to generate tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Public JSON serialization (excludes sensitive data)
    toPublicJson() {
        return {
            id: this.id,
            username: this.username,
            email: this.email,
            avatarUrl: this.avatarUrl,
            role: this.role,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            discordId: this.discordId,
            patreonId: this.patreonId,
            twitchId: this.twitchId,
        };
    }
}