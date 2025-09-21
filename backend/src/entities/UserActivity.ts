import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, BaseEntity, Index } from "typeorm";
import { User } from "./User";
import { Modpack } from "./Modpack";
import { ActivityType } from "@/types/enums";

@Entity({ name: "user_activities" })
@Index(["userId", "createdAt"])
export class UserActivity extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "user_id", type: "uuid" })
    userId: string;

    @Column({
        name: "activity_type",
        type: "enum",
        enum: ActivityType
    })
    activityType: ActivityType;

    @Column({ name: "modpack_id", type: "uuid", nullable: true })
    modpackId?: string;

    @Column({ name: "metadata", type: "jsonb", nullable: true })
    metadata?: Record<string, any>;

    @Column({ name: "is_visible", type: "boolean", default: true })
    isVisible: boolean;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    // Relations
    @ManyToOne(() => User, { onDelete: "CASCADE" })
    user: User;

    @ManyToOne(() => Modpack, { onDelete: "SET NULL", nullable: true })
    modpack?: Modpack;

    // Helper methods
    static async getActivityFeedForUser(userId: string, limit = 50): Promise<UserActivity[]> {
        // Get friend IDs to include in feed
        const friendshipQuery = `
            SELECT CASE 
                WHEN requester_id = $1 THEN addressee_id 
                ELSE requester_id 
            END as friend_id
            FROM friendships 
            WHERE (requester_id = $1 OR addressee_id = $1) 
            AND status = 'accepted'
        `;
        
        const friendships = await this.query(friendshipQuery, [userId]);
        const friendIds = friendships.map((f: any) => f.friend_id);
        
        // Include user's own activities and friends' activities
        const userIds = [userId, ...friendIds];
        
        return await UserActivity.find({
            where: {
                userId: userIds.length > 0 ? userIds : [userId],
                isVisible: true
            },
            relations: ["user", "modpack"],
            order: { createdAt: "DESC" },
            take: limit
        });
    }

    static async createActivity(
        userId: string, 
        activityType: ActivityType, 
        modpackId?: string, 
        metadata?: Record<string, any>
    ): Promise<UserActivity> {
        const activity = UserActivity.create({
            userId,
            activityType,
            modpackId,
            metadata,
            isVisible: true
        });
        
        await activity.save();
        return activity;
    }

    static async getUserCurrentStatus(userId: string): Promise<{
        isOnline: boolean;
        currentModpack?: { id: string; name: string };
        lastActivity?: Date;
    }> {
        const latestActivity = await UserActivity.findOne({
            where: { userId },
            relations: ["modpack"],
            order: { createdAt: "DESC" }
        });

        if (!latestActivity) {
            return { isOnline: false };
        }

        const isOnline = latestActivity.activityType === ActivityType.USER_ONLINE ||
                        latestActivity.activityType === ActivityType.PLAYING_MODPACK;
        
        const currentModpack = latestActivity.activityType === ActivityType.PLAYING_MODPACK && latestActivity.modpack
            ? { id: latestActivity.modpack.id, name: latestActivity.modpack.name }
            : undefined;

        return {
            isOnline,
            currentModpack,
            lastActivity: latestActivity.createdAt
        };
    }

    // Clean up old activities (older than 30 days)
    static async cleanupOldActivities(): Promise<void> {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        await UserActivity.delete({
            createdAt: thirtyDaysAgo
        });
    }
}