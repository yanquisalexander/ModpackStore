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

    // Relations
    @ManyToOne(() => Modpack, modpack => modpack.categories)
    @JoinColumn({ name: "modpack_id" })
    modpack: Modpack;

    @ManyToOne(() => Category, category => category.modpacks)
    @JoinColumn({ name: "category_id" })
    category: Category;
}