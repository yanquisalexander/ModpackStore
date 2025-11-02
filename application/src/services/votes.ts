import { API_ENDPOINT } from "@/consts";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

export interface VoteCounts {
    modpackId: string;
    likes: number;
    dislikes: number;
    total: number;
}

export interface UserVotes {
    votes: Record<string, 'like' | 'dislike'>;
}

export const getVoteCounts = async (modpackId: string): Promise<VoteCounts> => {
    const response = await fetch(`${API_ENDPOINT}/votes/modpacks/${modpackId}/votes`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    });

    if (!response.ok) {
        throw new Error('Failed to fetch vote counts');
    }

    return await response.json();
};

export const getUserVotes = async (): Promise<UserVotes> => {
    const response = await fetchWithAuth(`${API_ENDPOINT}/votes/user/votes`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    });

    if (!response.ok) {
        throw new Error('Failed to fetch user votes');
    }

    return await response.json();
};