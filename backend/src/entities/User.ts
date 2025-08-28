import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, BaseEntity } from "typeorm";
import { Session } from "./Session";
import { PublisherMember } from "./PublisherMember";
import { Modpack } from "./Modpack";
import { ModpackVersion } from "./ModpackVersion";
import { UserPurchase } from "./UserPurchase";
import { WalletTransaction } from "./WalletTransaction";
import { Publisher } from "./Publisher";

@Entity({ name: "users" })
export class User extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "username", type: "varchar", length: 32, unique: true })
    username: string;

    @Column({ name: "email", type: "text" })
    email: string;

    @Column({ name: "avatar_url", type: "text", nullable: true })
    avatarUrl?: string;

    // Discord fields
    @Column({ name: "discord_id", type: "text", nullable: true })
    discordId?: string;

    @Column({ name: "discord_access_token", type: "text", nullable: true })
    discordAccessToken?: string;

    @Column({ name: "discord_refresh_token", type: "text", nullable: true })
    discordRefreshToken?: string;

    // Patreon fields
    @Column({ name: "patreon_id", type: "text", nullable: true })
    patreonId?: string;

    @Column({ name: "patreon_access_token", type: "text", nullable: true })
    patreonAccessToken?: string;

    @Column({ name: "patreon_refresh_token", type: "text", nullable: true })
    patreonRefreshToken?: string;

    @Column({ name: "admin", type: "boolean", default: false })
    admin: boolean;

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

    async getPublishers(): Promise<Publisher[]> {
        const memberships = await PublisherMember.find({ where: { user: { id: this.id } }, relations: ["publisher"] });
        return memberships.map(membership => membership.publisher);
    }
}