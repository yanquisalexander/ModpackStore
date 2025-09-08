import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, BaseEntity, Unique } from "typeorm";
import { ModpackVersion } from "./ModpackVersion";
import { ModpackFile } from "./ModpackFile";

@Entity({ name: "modpack_version_files" })
@Unique(["modpackVersionId", "fileHash", "path"])
export class ModpackVersionFile extends BaseEntity {

    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id: string;

    @Column({ name: "modpack_version_id", type: "uuid" })
    modpackVersionId: string;

    @Column({ name: "file_hash", type: "varchar", length: 64 })
    fileHash: string;

    @Column({ name: "path", type: "text" })
    path: string; // e.g., "mods/jei.jar" inside the pack

    // Relations
    @ManyToOne(() => ModpackVersion, modpackVersion => modpackVersion.files, { onDelete: "CASCADE" })
    @JoinColumn({ name: "modpack_version_id" })
    modpackVersion: ModpackVersion;

    @ManyToOne(() => ModpackFile, modpackFile => modpackFile.versionFiles, { onDelete: "CASCADE" })
    @JoinColumn({ name: "file_hash" })
    file: ModpackFile;
}