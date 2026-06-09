import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BaseEntity, Index } from "typeorm";
import { User } from "./User";
import { Modpack } from "./Modpack";

@Entity({ name: "user_recommendations" })
@Index(["userId"])
@Index(["userId", "score"])
export class UserRecommendation extends BaseEntity {
    @PrimaryColumn({ name: "user_id", type: "uuid" })
    userId: string;

    @PrimaryColumn({ name: "modpack_id", type: "uuid" })
    modpackId: string;

    /**
     * Recommendation score (higher is better)
     */
    @Column({ name: "score", type: "float" })
    score: number;

    /**
     * Algorithm used to generate this recommendation
     * (e.g., "ubcf", "popular", "new")
     */
    @Column({ name: "algorithm", type: "varchar", length: 50, default: "ubcf" })
    algorithm: string;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;

    // Relations
    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user: User;

    @ManyToOne(() => Modpack, { onDelete: "CASCADE" })
    @JoinColumn({ name: "modpack_id" })
    modpack: Modpack;

    // Static method to get recommendations for a user
    static async getRecommendationsForUser(
        userId: string,
        limit: number = 10
    ): Promise<UserRecommendation[]> {
        return await UserRecommendation.find({
            where: { userId },
            relations: ["modpack", "modpack.publisher", "modpack.creatorUser"],
            select: {
                userId: true,
                modpackId: true,
                score: true,
                algorithm: true,
                modpack: {
                    id: true,
                    name: true,
                    slug: true,
                    shortDescription: true,
                    iconUrl: true,
                    bannerUrl: true,
                    featured: true,
                    createdAt: true,
                    publisher: {
                        id: true,
                        publisherName: true,
                        logoUrl: true,
                        verified: true
                    },
                    creatorUser: {
                        id: true,
                        username: true,
                        avatarUrl: true
                    }
                }
            },
            order: { score: "DESC" },
            take: limit
        });
    }

    // Static method to clear old recommendations for a user
    static async clearUserRecommendations(userId: string): Promise<void> {
        await UserRecommendation.delete({ userId });
    }

    // Static method to bulk insert recommendations
    static async bulkInsert(recommendations: Partial<UserRecommendation>[]): Promise<void> {
        if (recommendations.length === 0) return;

        await UserRecommendation.save(recommendations);
    }
}
