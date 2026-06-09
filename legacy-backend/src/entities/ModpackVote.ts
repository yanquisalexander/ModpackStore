import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BaseEntity, Index } from "typeorm";
import { User } from "./User";
import { Modpack } from "./Modpack";

@Entity({ name: "modpack_votes" })
@Index(["userId", "modpackId"], { unique: true })
@Index(["modpackId"])
@Index(["userId"])
export class ModpackVote extends BaseEntity {
    @PrimaryColumn({ name: "user_id", type: "uuid" })
    userId: string;

    @PrimaryColumn({ name: "modpack_id", type: "uuid" })
    modpackId: string;

    /**
     * Vote value: 1 for like, -1 for dislike
     */
    @Column({ name: "vote", type: "smallint" })
    vote: number;

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

    // Helper method to check if vote is a like
    isLike(): boolean {
        return this.vote === 1;
    }

    // Helper method to check if vote is a dislike
    isDislike(): boolean {
        return this.vote === -1;
    }

    // Static method to get vote counts for a modpack
    static async getVoteCounts(modpackId: string): Promise<{ likes: number; dislikes: number }> {
        const votes = await ModpackVote.find({ where: { modpackId } });
        
        const likes = votes.filter(v => v.vote === 1).length;
        const dislikes = votes.filter(v => v.vote === -1).length;

        return { likes, dislikes };
    }

    // Static method to get user's vote for a modpack
    static async getUserVote(userId: string, modpackId: string): Promise<ModpackVote | null> {
        return await ModpackVote.findOne({ where: { userId, modpackId } });
    }

    // Static method to get all user's votes
    static async getUserVotes(userId: string): Promise<ModpackVote[]> {
        return await ModpackVote.find({ 
            where: { userId },
            relations: ["modpack"]
        });
    }
}
