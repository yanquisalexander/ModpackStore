import { ModpackVote } from "@/entities/ModpackVote";
import { UserRecommendation } from "@/entities/UserRecommendation";
import { Modpack } from "@/entities/Modpack";
import { User } from "@/entities/User";
import { ModpackVisibility, ModpackStatus } from "@/types/enums";
import { In, Not } from "typeorm";

interface UserItemMatrix {
    [userId: string]: {
        [modpackId: string]: number; // 1, -1, or 0
    };
}

interface SimilarUser {
    userId: string;
    similarity: number;
}

export class RecommendationService {
    private static readonly K_NEIGHBORS = 10; // Number of similar users to consider
    private static readonly MIN_COMMON_VOTES = 3; // Minimum common votes for similarity calculation
    private static readonly RECOMMENDATIONS_PER_USER = 20; // Number of recommendations to generate per user
    private static readonly MIN_SCORE_THRESHOLD = 0.1; // Minimum score to include in recommendations

    // Fallback scoring constants
    private static readonly POPULAR_BASE_SCORE = 1.0;
    private static readonly POPULAR_DECAY_RATE = 0.05;
    private static readonly NEW_BASE_SCORE = 0.7;
    private static readonly NEW_DECAY_RATE = 0.03;
    private static readonly EMPTY_UUID = '00000000-0000-0000-0000-000000000000'; // Placeholder for empty arrays in SQL queries

    /**
     * Generate recommendations for all users (batch job)
     */
    static async generateAllRecommendations(): Promise<void> {
        console.log("[RECOMMENDATION] Starting batch recommendation generation...");

        // Get all users who have voted
        const allVotes = await ModpackVote.find();
        const userIds = [...new Set(allVotes.map(v => v.userId))];

        console.log(`[RECOMMENDATION] Found ${userIds.length} users with votes`);

        // Build user-item matrix
        const matrix = await this.buildUserItemMatrix();

        // Generate recommendations for each user
        let processedCount = 0;
        for (const userId of userIds) {
            try {
                await this.generateRecommendationsForUser(userId, matrix);
                processedCount++;

                if (processedCount % 10 === 0) {
                    console.log(`[RECOMMENDATION] Processed ${processedCount}/${userIds.length} users`);
                }
            } catch (error) {
                console.error(`[RECOMMENDATION] Error generating recommendations for user ${userId}:`, error);
            }
        }

        console.log(`[RECOMMENDATION] Completed recommendation generation for ${processedCount} users`);
    }

    /**
     * Generate recommendations for a specific user
     */
    static async generateRecommendationsForUser(
        userId: string,
        matrix?: UserItemMatrix
    ): Promise<void> {
        // Build matrix if not provided
        if (!matrix) {
            matrix = await this.buildUserItemMatrix();
        }

        // Get user's votes
        const userVotes = matrix[userId];
        if (!userVotes || Object.keys(userVotes).length === 0) {
            // User has no votes, use fallback
            await this.generateFallbackRecommendations(userId);
            return;
        }

        // Find similar users using KNN
        const similarUsers = await this.findSimilarUsers(userId, matrix);

        if (similarUsers.length === 0) {
            // No similar users found, use fallback
            await this.generateFallbackRecommendations(userId);
            return;
        }

        // Generate recommendations based on similar users
        const recommendations = await this.calculateRecommendations(
            userId,
            userVotes,
            similarUsers,
            matrix
        );

        // Clear old recommendations
        await UserRecommendation.clearUserRecommendations(userId);

        // Save new recommendations
        if (recommendations.length > 0) {
            await UserRecommendation.bulkInsert(recommendations);
        }
    }

    /**
     * Build user-item matrix from all votes
     */
    private static async buildUserItemMatrix(): Promise<UserItemMatrix> {
        const votes = await ModpackVote.find();
        const matrix: UserItemMatrix = {};

        for (const vote of votes) {
            if (!matrix[vote.userId]) {
                matrix[vote.userId] = {};
            }
            matrix[vote.userId][vote.modpackId] = vote.vote;
        }

        return matrix;
    }

    /**
     * Find K most similar users using cosine similarity
     */
    private static async findSimilarUsers(
        targetUserId: string,
        matrix: UserItemMatrix
    ): Promise<SimilarUser[]> {
        const targetUserVotes = matrix[targetUserId];
        const similarities: SimilarUser[] = [];

        for (const userId in matrix) {
            if (userId === targetUserId) continue;

            const similarity = this.calculateCosineSimilarity(
                targetUserVotes,
                matrix[userId]
            );

            // Only include users with meaningful similarity
            if (similarity > 0) {
                similarities.push({ userId, similarity });
            }
        }

        // Sort by similarity (descending) and take top K
        return similarities
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, this.K_NEIGHBORS);
    }

    /**
     * Calculate cosine similarity between two users
     */
    private static calculateCosineSimilarity(
        userA: { [modpackId: string]: number },
        userB: { [modpackId: string]: number }
    ): number {
        // Find common modpacks
        const commonModpacks = Object.keys(userA).filter(id => id in userB);

        // Need at least MIN_COMMON_VOTES for reliable similarity
        if (commonModpacks.length < this.MIN_COMMON_VOTES) {
            return 0;
        }

        // Calculate dot product and magnitudes
        let dotProduct = 0;
        let magnitudeA = 0;
        let magnitudeB = 0;

        for (const modpackId of commonModpacks) {
            dotProduct += userA[modpackId] * userB[modpackId];
            magnitudeA += userA[modpackId] * userA[modpackId];
            magnitudeB += userB[modpackId] * userB[modpackId];
        }

        magnitudeA = Math.sqrt(magnitudeA);
        magnitudeB = Math.sqrt(magnitudeB);

        if (magnitudeA === 0 || magnitudeB === 0) {
            return 0;
        }

        return dotProduct / (magnitudeA * magnitudeB);
    }

    /**
     * Calculate recommendations based on similar users
     */
    private static async calculateRecommendations(
        userId: string,
        userVotes: { [modpackId: string]: number },
        similarUsers: SimilarUser[],
        matrix: UserItemMatrix
    ): Promise<Partial<UserRecommendation>[]> {
        // Aggregate scores for modpacks
        const scores: { [modpackId: string]: number } = {};
        const weights: { [modpackId: string]: number } = {};

        // Iterate through similar users
        for (const { userId: similarUserId, similarity } of similarUsers) {
            const similarUserVotes = matrix[similarUserId];

            // Look for modpacks the similar user liked but target user hasn't voted on
            for (const modpackId in similarUserVotes) {
                // Skip if target user already voted on this modpack
                if (modpackId in userVotes) continue;

                // Only consider likes from similar users
                if (similarUserVotes[modpackId] === 1) {
                    if (!scores[modpackId]) {
                        scores[modpackId] = 0;
                        weights[modpackId] = 0;
                    }

                    // Weighted score based on similarity
                    scores[modpackId] += similarity;
                    weights[modpackId] += similarity;
                }
            }
        }

        // Normalize scores and create recommendations
        const recommendations: Partial<UserRecommendation>[] = [];

        for (const modpackId in scores) {
            const normalizedScore = weights[modpackId] > 0
                ? scores[modpackId] / weights[modpackId]
                : 0;

            if (normalizedScore >= this.MIN_SCORE_THRESHOLD) {
                recommendations.push({
                    userId,
                    modpackId,
                    score: normalizedScore,
                    algorithm: "ubcf"
                });
            }
        }

        // Sort by score and take top N
        return recommendations
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .slice(0, this.RECOMMENDATIONS_PER_USER);
    }

    /**
     * Generate fallback recommendations (popular/new modpacks)
     */
    private static async generateFallbackRecommendations(userId: string): Promise<void> {
        // Get user's existing votes to exclude
        const userVotes = await ModpackVote.find({ where: { userId } });
        const votedModpackIds = userVotes.map(v => v.modpackId);

        // Get popular modpacks (based on like count)
        const popularModpacks = await this.getPopularModpacks(votedModpackIds, 10);

        // Get new modpacks
        const newModpacks = await this.getNewModpacks(votedModpackIds, 10);

        // Combine and create recommendations
        const recommendations: Partial<UserRecommendation>[] = [];

        // Popular modpacks get higher scores
        popularModpacks.forEach((modpack, index) => {
            recommendations.push({
                userId,
                modpackId: modpack.id,
                score: this.POPULAR_BASE_SCORE - (index * this.POPULAR_DECAY_RATE), // Decreasing score
                algorithm: "popular"
            });
        });

        // New modpacks get slightly lower scores
        newModpacks.forEach((modpack, index) => {
            // Skip if already in recommendations
            if (recommendations.find(r => r.modpackId === modpack.id)) return;

            recommendations.push({
                userId,
                modpackId: modpack.id,
                score: this.NEW_BASE_SCORE - (index * this.NEW_DECAY_RATE),
                algorithm: "new"
            });
        });

        // Clear old recommendations
        await UserRecommendation.clearUserRecommendations(userId);

        // Save fallback recommendations
        if (recommendations.length > 0) {
            await UserRecommendation.bulkInsert(recommendations);
        }
    }

    /**
     * Get popular modpacks (most liked)
     */
    private static async getPopularModpacks(
        excludeIds: string[],
        limit: number
    ): Promise<Modpack[]> {
        // Get vote counts for all modpacks
        const voteCounts = await ModpackVote.createQueryBuilder("vote")
            .select("vote.modpackId", "modpackId")
            .addSelect("SUM(CASE WHEN vote.vote = 1 THEN 1 ELSE 0 END)", "likes")
            .where("vote.modpackId NOT IN (:...excludeIds)", {
                excludeIds: excludeIds.length > 0 ? excludeIds : [this.EMPTY_UUID]
            })
            .groupBy("vote.modpackId")
            .orderBy("likes", "DESC")
            .limit(limit)
            .getRawMany();

        const modpackIds = voteCounts.map(v => v.modpackId);

        if (modpackIds.length === 0) {
            return [];
        }

        return await Modpack.find({
            where: {
                id: In(modpackIds),
                status: ModpackStatus.PUBLISHED,
                visibility: ModpackVisibility.PUBLIC
            },
            relations: ["publisher", "creatorUser"],
            select: {
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
        });
    }

    /**
     * Get new modpacks
     */
    private static async getNewModpacks(
        excludeIds: string[],
        limit: number
    ): Promise<Modpack[]> {
        return await Modpack.find({
            where: {
                id: excludeIds.length > 0 ? Not(In(excludeIds)) : undefined,
                status: ModpackStatus.PUBLISHED,
                visibility: ModpackVisibility.PUBLIC
            },
            relations: ["publisher", "creatorUser"],
            select: {
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
            },
            order: { createdAt: "DESC" },
            take: limit
        });
    }

    /**
     * Get recommendations for a user
     */
    static async getRecommendationsForUser(
        userId: string,
        limit: number = 10
    ): Promise<UserRecommendation[]> {
        return await UserRecommendation.getRecommendationsForUser(userId, limit);
    }

    /**
     * Get related modpacks (item-based collaborative filtering)
     * Users who liked this modpack also liked...
     */
    static async getRelatedModpacks(
        modpackId: string,
        excludeUserId?: string,
        limit: number = 10
    ): Promise<Modpack[]> {
        // Get users who liked this modpack
        const voters = await ModpackVote.find({
            where: { modpackId, vote: 1 }
        });

        const voterIds = voters.map(v => v.userId);

        if (voterIds.length === 0) {
            // No one liked this modpack, return popular modpacks
            return await this.getPopularModpacks([modpackId], limit);
        }

        // Get other modpacks these users liked
        const relatedVotes = await ModpackVote.createQueryBuilder("vote")
            .select("vote.modpackId", "modpackId")
            .addSelect("COUNT(*)", "count")
            .where("vote.userId IN (:...voterIds)", { voterIds })
            .andWhere("vote.modpackId != :modpackId", { modpackId })
            .andWhere("vote.vote = 1")
            .groupBy("vote.modpackId")
            .orderBy("count", "DESC")
            .limit(limit)
            .getRawMany();

        const relatedModpackIds = relatedVotes.map(v => v.modpackId);

        if (relatedModpackIds.length === 0) {
            return [];
        }

        // Fetch the actual modpack entities
        const modpacks = await Modpack.find({
            where: {
                id: In(relatedModpackIds),
                status: ModpackStatus.PUBLISHED,
                visibility: ModpackVisibility.PUBLIC
            },
            relations: ["publisher", "creatorUser"],
            select: {
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
        });

        // Sort by the order in relatedModpackIds
        return modpacks.sort((a, b) => {
            return relatedModpackIds.indexOf(a.id) - relatedModpackIds.indexOf(b.id);
        });
    }
}
