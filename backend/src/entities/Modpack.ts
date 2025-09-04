import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, BaseEntity, Like, Index } from "typeorm";
import { Publisher } from "./Publisher";
import { User } from "./User";
import { ModpackCategory } from "./ModpackCategory";
import { ModpackVersion } from "./ModpackVersion";
import { Scope } from "./Scope";
import { UserPurchase } from "./UserPurchase";
import { WalletTransaction } from "./WalletTransaction";
import { ModpackVisibility, ModpackStatus } from "../types/enums";

@Entity({ name: "modpacks" })
@Index(["visibility", "status"])
@Index(["slug"], { unique: true })
export class Modpack extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "name", type: "text" })
    name: string;

    @Column({ name: "short_description", type: "text", nullable: true })
    shortDescription?: string;

    @Column({ name: "description", type: "text", nullable: true })
    description?: string;

    @Column({ name: "slug", type: "text", unique: true })
    slug: string;

    @Column({ name: "icon_url", type: "text", nullable: true })
    iconUrl?: string;

    @Column({ name: "banner_url", type: "text", nullable: true })
    bannerUrl?: string;

    @Column({ name: "trailer_url", type: "text", nullable: true })
    trailerUrl?: string;

    @Column({ name: "password", type: "text", nullable: true })
    password?: string;

    @Column({
        name: "visibility",
        type: "enum",
        enum: ModpackVisibility,
        enumName: "modpack_visibility",
        default: ModpackVisibility.PRIVATE
    })
    visibility: ModpackVisibility;

    @Column({ name: "publisher_id", type: "uuid" })
    publisherId: string;

    @Column({ name: "show_user_as_publisher", type: "boolean", default: false })
    showUserAsPublisher: boolean;

    @Column({ name: "creator_user_id", type: "uuid", nullable: true })
    creatorUserId?: string;

    @Column({ name: "featured", type: "boolean", default: false })
    featured: boolean;

    @Column({ name: "prelaunch_appearance", type: "jsonb", nullable: true })
    prelaunchAppearance?: {
        title?: string;
        description?: string;
        logo?: {
            url?: string;
            height?: string;
            position?: {
                top?: string;
                left?: string;
                right?: string;
                bottom?: string;
                transform?: string;
            };
            fadeInDuration?: string;
            fadeInDelay?: string;
        };
        playButton?: {
            text?: string;
            backgroundColor?: string;
            hoverColor?: string;
            position?: {
                bottom?: string;
                left?: string;
                right?: string;
                top?: string;
                transform?: string;
            };
            textColor?: string;
            borderColor?: string;
            fadeInDuration?: string;
            fadeInDelay?: string;
        };
        background?: {
            imageUrl?: string;
            videoUrl?: string | string[];
        };
        audio?: {
            url?: string;
            volume?: number;
        };
        news?: {
            position?: {
                top?: string;
                right?: string;
            };
            style?: {
                background?: string;
                color?: string;
                borderRadius?: string;
                padding?: string;
                width?: string;
                fontSize?: string;
            };
            entries?: Array<{
                title?: string;
                content?: string;
            }>;
        };
        footerStyle?: {
            background?: string;
            color?: string;
            borderRadius?: string;
            padding?: string;
            width?: string;
            fontSize?: string;
        };
        footerText?: string;
    };

    @Column({
        name: "status",
        type: "enum",
        enum: ModpackStatus,
        enumName: "modpack_status",
        default: ModpackStatus.DRAFT
    })
    status: ModpackStatus;

    @Column({ name: "is_paid", type: "boolean", default: false })
    isPaid: boolean;

    @Column({ name: "price", type: "decimal", precision: 10, scale: 2, default: "0" })
    price: string;

    // Twitch subscription control fields
    @Column({ name: "requires_twitch_subscription", type: "boolean", default: false })
    requiresTwitchSubscription: boolean;

    @Column({ name: "twitch_creator_ids", type: "text", array: true, nullable: true })
    twitchCreatorIds?: string[] | null;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;

    // Relations
    @ManyToOne(() => Publisher, publisher => publisher.modpacks, { onDelete: "CASCADE" })
    @JoinColumn({ name: "publisher_id" })
    publisher: Publisher;

    @ManyToOne(() => User, user => user.createdModpacks, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "creator_user_id" })
    creatorUser?: User;

    @OneToMany(() => ModpackCategory, modpackCategory => modpackCategory.modpack, { cascade: true })
    categories: ModpackCategory[];

    @OneToMany(() => ModpackVersion, modpackVersion => modpackVersion.modpack, { cascade: true })
    versions: ModpackVersion[];

    @OneToMany(() => Scope, scope => scope.modpack, { cascade: true })
    scopes: Scope[];

    @OneToMany(() => UserPurchase, userPurchase => userPurchase.modpack, { cascade: true })
    purchases: UserPurchase[];

    @OneToMany(() => WalletTransaction, transaction => transaction.relatedModpack, { cascade: true })
    relatedTransactions: WalletTransaction[];

    // Métodos de búsqueda y consulta
    static async search(query: string, limit: number = 25): Promise<Modpack[]> {
        return this.createQueryBuilder("modpack")
            .leftJoinAndSelect("modpack.publisher", "publisher")
            .leftJoinAndSelect("modpack.creatorUser", "creatorUser")
            .leftJoinAndSelect("modpack.categories", "categories")
            .leftJoinAndSelect("categories.category", "category")
            .where("modpack.visibility = :visibility", { visibility: ModpackVisibility.PUBLIC })
            .andWhere("modpack.status = :status", { status: ModpackStatus.PUBLISHED })
            .andWhere("(modpack.name ILIKE :query OR modpack.shortDescription ILIKE :query OR modpack.description ILIKE :query)")
            .setParameters({ query: `%${query}%` })
            .orderBy("modpack.createdAt", "DESC")
            .limit(limit)
            .getMany();
    }

    static async findBySlug(slug: string): Promise<Modpack | null> {
        return this.createQueryBuilder("modpack")
            .leftJoinAndSelect("modpack.publisher", "publisher")
            .leftJoinAndSelect("modpack.creatorUser", "creatorUser")
            .leftJoinAndSelect("modpack.categories", "categories")
            .leftJoinAndSelect("categories.category", "category")
            .leftJoinAndSelect("modpack.versions", "versions")
            .where("modpack.slug = :slug", { slug })
            .andWhere("modpack.visibility = :visibility", { visibility: ModpackVisibility.PUBLIC })
            .andWhere("modpack.status = :status", { status: ModpackStatus.PUBLISHED })
            .getOne();
    }

    static async findFeatured(limit: number = 10): Promise<Modpack[]> {
        return this.createQueryBuilder("modpack")
            .leftJoinAndSelect("modpack.publisher", "publisher")
            .leftJoinAndSelect("modpack.creatorUser", "creatorUser")
            .where("modpack.featured = :featured", { featured: true })
            .andWhere("modpack.visibility = :visibility", { visibility: ModpackVisibility.PUBLIC })
            .andWhere("modpack.status = :status", { status: ModpackStatus.PUBLISHED })
            .orderBy("modpack.createdAt", "DESC")
            .limit(limit)
            .getMany();
    }

    static async findByPublisher(publisherId: string, limit?: number): Promise<Modpack[]> {
        const query = this.createQueryBuilder("modpack")
            .leftJoinAndSelect("modpack.publisher", "publisher")
            .leftJoinAndSelect("modpack.creatorUser", "creatorUser")
            .where("modpack.publisherId = :publisherId", { publisherId })
            .orderBy("modpack.createdAt", "DESC");

        if (limit) {
            query.limit(limit);
        }

        return query.getMany();
    }

    // Método para verificar si el modpack requiere contraseña
    isPasswordProtected(): boolean {
        return this.password !== null && this.password !== undefined && this.password.trim() !== "";
    }

    // Método para validar contraseña
    validatePassword(inputPassword: string): boolean {
        return this.password === inputPassword;
    }

    // Method to check if modpack requires Twitch subscription
    get requiresTwitchSub(): boolean {
        return this.requiresTwitchSubscription && Array.isArray(this.twitchCreatorIds) && this.twitchCreatorIds.length > 0;
    }

    // Method to get required Twitch creator IDs
    getRequiredTwitchCreatorIds(): string[] {
        return this.twitchCreatorIds || [];
    }
}