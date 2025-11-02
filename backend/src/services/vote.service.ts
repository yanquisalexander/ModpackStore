import { ModpackVote } from "@/entities/ModpackVote";
import { User } from "@/entities/User";
import { Modpack } from "@/entities/Modpack";
import { ModpackVisibility, ModpackStatus } from "@/types/enums";

export type VoteType = "like" | "dislike" | "none";

export class VoteService {
    /**
     * Vote on a modpack (create, update, or remove vote)
     */
    static async voteOnModpack(
        user: User,
        modpack: Modpack,
        voteType: VoteType
    ): Promise<ModpackVote | null> {
        // Check if modpack is published and public
        if (modpack.status !== ModpackStatus.PUBLISHED || modpack.visibility !== ModpackVisibility.PUBLIC) {
            throw new Error("Cannot vote on unpublished or private modpacks");
        }

        // Find existing vote
        const existingVote = await ModpackVote.getUserVote(user.id, modpack.id);

        // If vote type is "none", remove the vote
        if (voteType === "none") {
            if (existingVote) {
                await existingVote.remove();
            }
            return null;
        }

        // Convert vote type to numeric value
        const voteValue = voteType === "like" ? 1 : -1;

        // If vote exists, update it
        if (existingVote) {
            existingVote.vote = voteValue;
            await existingVote.save();
            return existingVote;
        }

        // Create new vote
        const newVote = ModpackVote.create({
            userId: user.id,
            modpackId: modpack.id,
            vote: voteValue
        });

        await newVote.save();
        return newVote;
    }

    /**
     * Get vote counts for a modpack
     */
    static async getVoteCounts(modpackId: string): Promise<{ likes: number; dislikes: number }> {
        return await ModpackVote.getVoteCounts(modpackId);
    }

    /**
     * Get user's vote for a modpack
     */
    static async getUserVote(userId: string, modpackId: string): Promise<VoteType> {
        const vote = await ModpackVote.getUserVote(userId, modpackId);
        
        if (!vote) return "none";
        return vote.vote === 1 ? "like" : "dislike";
    }

    /**
     * Get all votes by a user as a map
     */
    static async getUserVotesMap(userId: string): Promise<Record<string, VoteType>> {
        const votes = await ModpackVote.getUserVotes(userId);
        
        const votesMap: Record<string, VoteType> = {};
        votes.forEach(vote => {
            votesMap[vote.modpackId] = vote.vote === 1 ? "like" : "dislike";
        });

        return votesMap;
    }

    /**
     * Get modpacks liked by a user
     */
    static async getUserLikedModpacks(userId: string, limit: number = 50): Promise<string[]> {
        const votes = await ModpackVote.find({
            where: { userId, vote: 1 },
            take: limit
        });

        return votes.map(v => v.modpackId);
    }

    /**
     * Get modpacks disliked by a user
     */
    static async getUserDislikedModpacks(userId: string): Promise<string[]> {
        const votes = await ModpackVote.find({
            where: { userId, vote: -1 }
        });

        return votes.map(v => v.modpackId);
    }

    /**
     * Get all users who voted on a modpack with their vote type
     */
    static async getModpackVoters(modpackId: string): Promise<Array<{ userId: string; vote: number }>> {
        const votes = await ModpackVote.find({
            where: { modpackId }
        });

        return votes.map(v => ({ userId: v.userId, vote: v.vote }));
    }
}
