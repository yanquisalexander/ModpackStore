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

    // Legacy permissions (keeping for compatibility)
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

    // Granular modpack permissions
    @Column({ name: "modpack_view", type: "boolean", default: false })
    modpackView: boolean;

    @Column({ name: "modpack_modify", type: "boolean", default: false })
    modpackModify: boolean;

    @Column({ name: "modpack_manage_versions", type: "boolean", default: false })
    modpackManageVersions: boolean;

    @Column({ name: "modpack_publish", type: "boolean", default: false })
    modpackPublish: boolean;

    @Column({ name: "modpack_delete", type: "boolean", default: false })
    modpackDelete: boolean;

    @Column({ name: "modpack_manage_access", type: "boolean", default: false })
    modpackManageAccess: boolean;

    // Granular publisher permissions
    @Column({ name: "publisher_manage_categories_tags", type: "boolean", default: false })
    publisherManageCategoriesTags: boolean;

    @Column({ name: "publisher_view_stats", type: "boolean", default: false })
    publisherViewStats: boolean;

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