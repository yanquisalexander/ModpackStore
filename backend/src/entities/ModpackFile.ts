import { Entity, PrimaryColumn, Column, CreateDateColumn, OneToMany, BaseEntity } from "typeorm";
import { ModpackVersionFile } from "./ModpackVersionFile";

@Entity({ name: "modpack_files" })
export class ModpackFile extends BaseEntity {
    @PrimaryColumn({ name: "hash", type: "varchar", length: 64 })
    hash: string; // SHA256 in hex

    @Column({ name: "size", type: "integer" })
    size: number; // bytes

    @Column({ name: "mime_type", type: "text", nullable: true })
    mimeType?: string;

    @CreateDateColumn({ name: "uploaded_at" })
    uploadedAt: Date;

    // Relations
    @OneToMany(() => ModpackVersionFile, modpackVersionFile => modpackVersionFile.file)
    versionFiles: ModpackVersionFile[];
}