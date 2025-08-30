import { Entity, PrimaryColumn, Column, CreateDateColumn, OneToMany, BaseEntity } from "typeorm";
import { ModpackVersionFile } from "./ModpackVersionFile";

export type ModpackFileType = 'mods' | 'resourcepacks' | 'config' | 'shaderpacks' | 'extras';

@Entity({ name: "modpack_files" })
export class ModpackFile extends BaseEntity {
    @PrimaryColumn({ name: "hash", type: "varchar", length: 64 })
    hash: string; // SHA256 or MD5 in hex

    @Column({ name: "size", type: "integer" })
    size: number; // bytes

    @Column({ name: "mime_type", type: "text", nullable: true })
    mimeType?: string;

    @Column({ name: "type", type: "varchar", length: 32 })
    type: ModpackFileType;

    @CreateDateColumn({ name: "uploaded_at" })
    uploadedAt: Date;

    // Relations
    @OneToMany(() => ModpackVersionFile, modpackVersionFile => modpackVersionFile.file)
    versionFiles: ModpackVersionFile[];
}
