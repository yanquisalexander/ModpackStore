import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BaseEntity } from "typeorm";
import { PublisherMember } from "./PublisherMember";
import { Publisher } from "./Publisher";
import { Modpack } from "./Modpack";

@Entity({ name: "scopes" })
export class Scope extends BaseEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: "publisher_member_id", type: "integer" })
    publisherMemberId: number;

    // Scope target - only one should be present
    @Column({ name: "publisher_id", type: "uuid", nullable: true })
    publisherId?: string;

    @Column({ name: "modpack_id", type: "uuid", nullable: true })
    modpackId?: string;

    // Specific permissions
    @Column({ name: "can_create_modpacks", type: "boolean", default: false })
    canCreateModpacks: boolean;

    @Column({ name: "can_edit_modpacks", type: "boolean", default: false })
    canEditModpacks: boolean;

    @Column({ name: "can_delete_modpacks", type: "boolean", default: false })
    canDeleteModpacks: boolean;

    @Column({ name: "can_publish_versions", type: "boolean", default: false })
    canPublishVersions: boolean;

    @Column({ name: "can_manage_members", type: "boolean", default: false })
    canManageMembers: boolean;

    @Column({ name: "can_manage_settings", type: "boolean", default: false })
    canManageSettings: boolean;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;

    // Relations
    @ManyToOne(() => PublisherMember, publisherMember => publisherMember.scopes)
    @JoinColumn({ name: "publisher_member_id" })
    publisherMember: PublisherMember;

    @ManyToOne(() => Publisher, publisher => publisher.teamScopes, { nullable: true })
    @JoinColumn({ name: "publisher_id" })
    publisher?: Publisher;

    @ManyToOne(() => Modpack, modpack => modpack.scopes, { nullable: true })
    @JoinColumn({ name: "modpack_id" })
    modpack?: Modpack;
}