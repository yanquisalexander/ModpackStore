import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, BaseEntity } from "typeorm";
import { Modpack } from "./Modpack";
import { Category } from "./Category";

@Entity({ name: "modpack_categories" })
export class ModpackCategory extends BaseEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: "modpack_id", type: "uuid" })
    modpackId: string;

    @Column({ name: "category_id", type: "uuid" })
    categoryId: string;

    @Column({ name: "is_primary", type: "boolean", default: false })
    isPrimary: boolean;

    // Relations
    @ManyToOne(() => Modpack, modpack => modpack.categories, { onDelete: "CASCADE" })
    @JoinColumn({ name: "modpack_id" })
    modpack: Modpack;

    @ManyToOne(() => Category, category => category.modpacks)
    @JoinColumn({ name: "category_id" })
    category: Category;
}