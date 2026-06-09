import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, BaseEntity } from "typeorm";
import { Publisher } from "./Publisher";
import { User } from "./User";
import { Scope } from "./Scope";
import { PublisherMemberRole } from "../types/enums";

@Entity({ name: "publisher_members" })
export class PublisherMember extends BaseEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: "publisher_id", type: "uuid" })
    publisherId: string;

    @Column({ name: "user_id", type: "uuid" })
    userId: string;

    @Column({
        name: "role",
        type: "enum",
        enum: PublisherMemberRole,
        enumName: "publisher_member_role",
        default: PublisherMemberRole.MEMBER
    })
    role: PublisherMemberRole;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;

    // Relations
    @ManyToOne(() => Publisher, publisher => publisher.members)
    @JoinColumn({ name: "publisher_id" })
    publisher: Publisher;

    @ManyToOne(() => User, user => user.publisherMemberships)
    @JoinColumn({ name: "user_id" })
    user: User;

    @OneToMany(() => Scope, scope => scope.publisherMember)
    scopes: Scope[];
}