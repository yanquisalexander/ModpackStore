import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, BaseEntity } from "typeorm";
import { Publisher } from "./Publisher";

@Entity({ name: "publisher_files" })
export class PublisherFile extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "publisher_id", type: "uuid" })
    publisherId: string;

    @Column({ name: "file_name", type: "text" })
    fileName: string;

    @Column({ name: "file_size_kb", type: "integer" })
    fileSizeKb: number;

    @Column({ name: "r2_key", type: "text", unique: true })
    r2Key: string;

    @Column({ name: "content_type", type: "text" })
    contentType: string;

    @CreateDateColumn({ name: "uploaded_at" })
    uploadedAt: Date;

    // Relations
    @ManyToOne(() => Publisher, publisher => publisher.files, { onDelete: "CASCADE" })
    @JoinColumn({ name: "publisher_id" })
    publisher: Publisher;
}
