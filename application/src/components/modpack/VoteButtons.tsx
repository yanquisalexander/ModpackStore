import React, { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuthentication } from '@/stores/AuthContext';
import { API_ENDPOINT } from "@/consts";

export type VoteType = 'like' | 'dislike' | 'none';

interface VoteButtonsProps {
    modpackId: string;
    initialVote?: VoteType;
    initialCounts?: {
        likes: number;
        dislikes: number;
    };
    onVoteChange?: (vote: VoteType, counts: { likes: number; dislikes: number }) => void;
    className?: string;
    showCounts?: boolean;
}

export const VoteButtons: React.FC<VoteButtonsProps> = ({
    modpackId,
    initialVote = 'none',
    initialCounts = { likes: 0, dislikes: 0 },
    onVoteChange,
    className,
    showCounts = true
}) => {
    const [currentVote, setCurrentVote] = useState<VoteType>(initialVote);
    const [counts, setCounts] = useState(initialCounts);
    const [isLoading, setIsLoading] = useState(false);
    const { sessionTokens } = useAuthentication();

    useEffect(() => {
        setCurrentVote(initialVote);
    }, [initialVote]);

    useEffect(() => {
        setCounts(initialCounts);
    }, [initialCounts.likes, initialCounts.dislikes]);

    const handleVote = async (voteType: VoteType) => {
        // If clicking the same vote, remove it
        const newVote = currentVote === voteType ? 'none' : voteType;

        // Optimistic update
        const previousVote = currentVote;
        const previousCounts = { ...counts };

        setCurrentVote(newVote);

        // Update counts optimistically
        const newCounts = { ...counts };

        // Remove previous vote from count
        if (previousVote === 'like') {
            newCounts.likes = Math.max(0, newCounts.likes - 1);
        } else if (previousVote === 'dislike') {
            newCounts.dislikes = Math.max(0, newCounts.dislikes - 1);
        }

        // Add new vote to count
        if (newVote === 'like') {
            newCounts.likes += 1;
        } else if (newVote === 'dislike') {
            newCounts.dislikes += 1;
        }

        setCounts(newCounts);

        try {
            setIsLoading(true);

            if (!sessionTokens?.accessToken) {
                toast.error('You must be logged in to vote');
                return;
            }

            const response = await fetch(`${API_ENDPOINT}/votes/modpacks/${modpackId}/vote`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionTokens.accessToken}`
                },
                body: JSON.stringify({ vote: newVote })
            });

            if (!response.ok) {
                throw new Error('Failed to vote');
            }

            const data = await response.json();

            // Update with actual server data
            setCounts(data.counts);

            if (onVoteChange) {
                onVoteChange(newVote, data.counts);
            }

        } catch (error) {
            console.error('Error voting:', error);

            // Revert optimistic update
            setCurrentVote(previousVote);
            setCounts(previousCounts);

            toast.error('Failed to register vote. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={cn("flex items-center gap-2", className)}>
            {(currentVote === 'none' || currentVote === 'like') && (
                <Button
                    variant={currentVote === 'like' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleVote('like')}
                    disabled={isLoading}
                    className={cn(
                        "gap-2 transition-all",
                        currentVote === 'like' && "bg-green-600 hover:bg-green-700"
                    )}
                >
                    <ThumbsUp className="h-4 w-4" />
                    {showCounts && <span>{counts.likes}</span>}
                </Button>
            )}

            {(currentVote === 'none' || currentVote === 'dislike') && (
                <Button
                    variant={currentVote === 'dislike' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleVote('dislike')}
                    disabled={isLoading}
                    className={cn(
                        "gap-2 transition-all",
                        currentVote === 'dislike' && "bg-red-600 hover:bg-red-700"
                    )}
                >
                    <ThumbsDown className="h-4 w-4" />
                    {showCounts && <span>{counts.dislikes}</span>}
                </Button>
            )}
        </div>
    );
};
