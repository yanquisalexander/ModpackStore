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

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    // Relations
    @OneToMany(() => ModpackCategory, modpackCategory => modpackCategory.category)
    modpacks: ModpackCategory[];
}