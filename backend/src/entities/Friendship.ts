import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, BaseEntity, Index } from "typeorm";
import { User } from "./User";
import { FriendshipStatus } from "@/types/enums";

@Entity({ name: "friendships" })
@Index(["requesterId", "addresseeId"], { unique: true })
export class Friendship extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "requester_id", type: "uuid" })
    requesterId: string;

    @Column({ name: "addressee_id", type: "uuid" })
    addresseeId: string;

    @Column({
        name: "status",
        type: "enum",
        enum: FriendshipStatus,
        default: FriendshipStatus.PENDING
    })
    status: FriendshipStatus;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;

    // Relations
    @ManyToOne(() => User, { onDelete: "CASCADE" })
    requester: User;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    addressee: User;

    // Helper methods
    static async findFriendship(userId1: string, userId2: string): Promise<Friendship | null> {
        return await Friendship.findOne({
            where: [
                { requesterId: userId1, addresseeId: userId2 },
                { requesterId: userId2, addresseeId: userId1 }
            ]
        });
    }

    static async areFriends(userId1: string, userId2: string): Promise<boolean> {
        const friendship = await this.findFriendship(userId1, userId2);
        return friendship?.status === FriendshipStatus.ACCEPTED;
    }

    static async isBlocked(userId1: string, userId2: string): Promise<boolean> {
        const friendship = await this.findFriendship(userId1, userId2);
        return friendship?.status === FriendshipStatus.BLOCKED;
    }

    // Get the other user in the friendship relationship
    getOtherUserId(currentUserId: string): string {
        return this.requesterId === currentUserId ? this.addresseeId : this.requesterId;
    }

    // Check if current user is the requester
    isRequester(userId: string): boolean {
        return this.requesterId === userId;
    }
}