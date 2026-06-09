import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, BaseEntity, JoinColumn } from "typeorm";
import { User } from "./User";
import { Modpack } from "./Modpack";
import { InvitationStatus } from "@/types/enums";

@Entity({ name: "game_invitations" })
export class GameInvitation extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "sender_id", type: "uuid" })
    senderId: string;

    @Column({ name: "receiver_id", type: "uuid" })
    receiverId: string;

    @Column({ name: "modpack_id", type: "uuid" })
    modpackId: string;

    @Column({
        name: "status",
        type: "enum",
        enum: InvitationStatus,
        default: InvitationStatus.PENDING
    })
    status: InvitationStatus;

    @Column({ name: "message", type: "text", nullable: true })
    message?: string;

    @Column({ name: "expires_at", type: "timestamp" })
    expiresAt: Date;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    // Relations
    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "sender_id" })
    sender: User;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "receiver_id" })
    receiver: User;

    @ManyToOne(() => Modpack, { onDelete: "CASCADE" })
    @JoinColumn({ name: "modpack_id" })
    modpack: Modpack;

    // Helper methods
    isExpired(): boolean {
        return new Date() > this.expiresAt;
    }

    isPending(): boolean {
        return this.status === InvitationStatus.PENDING && !this.isExpired();
    }

    static async findPendingForUser(userId: string): Promise<GameInvitation[]> {
        return await GameInvitation.find({
            where: {
                receiverId: userId,
                status: InvitationStatus.PENDING
            },
            relations: ["sender", "modpack"],
            order: { createdAt: "DESC" }
        });
    }

    static async markExpiredInvitations(): Promise<void> {
        await GameInvitation.update(
            {
                status: InvitationStatus.PENDING,
                expiresAt: new Date() // Less than current date
            },
            { status: InvitationStatus.EXPIRED }
        );
    }
}