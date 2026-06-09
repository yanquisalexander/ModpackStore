import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, BaseEntity } from "typeorm";
import { ModpackCategory } from "./ModpackCategory";

@Entity({ name: "categories" })
export class Category extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "name", type: "text" })
    name: string;

    @Column({ name: "short_description", type: "text", nullable: true })
    shortDescription?: string;

    @Column({ name: "description", type: "text", nullable: true })
    description?: string;

    @Column({ name: "icon_url", type: "text", nullable: true })
    iconUrl?: string;

    @Column({ name: "display_order", type: "integer", default: 0 })
    displayOrder: number;

    @Column({ name: "is_admin_only", type: "boolean", default: false })
    isAdminOnly: boolean;

    @Column({ name: "is_selectable", type: "boolean", default: true })
    isSelectable: boolean;

    @Column({ name: "is_automatic", type: "boolean", default: false })
    isAutomatic: boolean;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    // Relations
    @OneToMany(() => ModpackCategory, modpackCategory => modpackCategory.category)
    modpacks: ModpackCategory[];
}