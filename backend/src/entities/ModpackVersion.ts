import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, BaseEntity } from "typeorm";
import { Modpack } from "./Modpack";
import { User } from "./User";
import { ModpackVersionFile } from "./ModpackVersionFile";
import { ModpackVersionStatus } from "../types/enums";

@Entity({ name: "modpack_versions" })
export class ModpackVersion extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "modpack_id", type: "uuid" })
    modpackId: string;

    @Column({ name: "version", type: "text" })
    version: string;

    @Column({ name: "mc_version", type: "text" })
    mcVersion: string;

    @Column({ name: "forge_version", type: "text", nullable: true })
    forgeVersion?: string;

    @Column({ name: "changelog", type: "text", nullable: true })
    changelog: string;

    @Column({
        name: "status",
        type: "enum",
        enum: ModpackVersionStatus,
        enumName: "modpack_version_status",
        default: ModpackVersionStatus.DRAFT
    })
    status: ModpackVersionStatus;

    @Column({ name: "release_date", type: "timestamp with time zone", nullable: true })
    releaseDate?: Date;

    @Column({ name: "created_by", type: "uuid" })
    createdBy: string;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;

    // Relations
    @ManyToOne(() => Modpack, modpack => modpack.versions)
    @JoinColumn({ name: "modpack_id" })
    modpack: Modpack;

    @ManyToOne(() => User, user => user.createdVersions)
    @JoinColumn({ name: "created_by" })
    createdByUser: User;

    @OneToMany(() => ModpackVersionFile, modpackVersionFile => modpackVersionFile.modpackVersion)
    files: ModpackVersionFile[];
}