import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, BaseEntity } from "typeorm";
import { ModpackVersion } from "./ModpackVersion";
import { ModpackFile } from "./ModpackFile";

@Entity({ name: "modpack_version_files" })
export class ModpackVersionFile extends BaseEntity {

    @PrimaryColumn({ name: "file_hash", type: "varchar", length: 64 })
    fileHash: string;

    @PrimaryColumn({ name: "modpack_version_id", type: "uuid" })
    modpackVersionId: string;

    @PrimaryColumn({ name: "path", type: "text" })
    path: string; // e.g., "mods/jei.jar" inside the pack

    // Relations
    @ManyToOne(() => ModpackVersion, modpackVersion => modpackVersion.files, { onDelete: "CASCADE" })
    @JoinColumn({ name: "modpack_version_id" })
    modpackVersion: ModpackVersion;

    @ManyToOne(() => ModpackFile, modpackFile => modpackFile.versionFiles, { onDelete: "CASCADE" })
    @JoinColumn({ name: "file_hash" })
    file: ModpackFile;
}