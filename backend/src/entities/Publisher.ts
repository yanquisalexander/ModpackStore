import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, BaseEntity } from "typeorm";
import { PublisherMember } from "./PublisherMember";
import { Modpack } from "./Modpack";
import { Scope } from "./Scope";
import { Wallet } from "./Wallet";

@Entity({ name: "publishers" })
export class Publisher extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "publisher_name", type: "varchar", length: 32 })
    publisherName: string;

    @Column({ name: "tos_url", type: "text" })
    tosUrl: string;

    @Column({ name: "privacy_url", type: "text" })
    privacyUrl: string;

    @Column({ name: "banner_url", type: "text" })
    bannerUrl: string;

    @Column({ name: "logo_url", type: "text" })
    logoUrl: string;

    @Column({ name: "description", type: "text" })
    description: string;

    @Column({ name: "website_url", type: "text", nullable: true })
    websiteUrl?: string;

    @Column({ name: "discord_url", type: "text", nullable: true })
    discordUrl?: string;

    @Column({ name: "banned", type: "boolean", default: false })
    banned: boolean;

    @Column({ name: "verified", type: "boolean", default: false })
    verified: boolean;

    @Column({ name: "partnered", type: "boolean", default: false })
    partnered: boolean;

    @Column({ name: "is_hosting_partner", type: "boolean", default: false })
    isHostingPartner: boolean;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    // Relations
    @OneToMany(() => PublisherMember, publisherMember => publisherMember.publisher)
    members: PublisherMember[];

    @OneToMany(() => Modpack, modpack => modpack.publisher)
    modpacks: Modpack[];

    @OneToMany(() => Scope, scope => scope.publisher)
    teamScopes: Scope[];

    @OneToMany(() => Wallet, wallet => wallet.publisher)
    wallets: Wallet[];
}