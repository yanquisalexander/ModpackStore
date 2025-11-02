import React, { useEffect, useState } from 'react';
import { ModpackCard } from '@/components/ModpackCard';
import { Sparkles, TrendingUp, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthentication } from '@/stores/AuthContext';
import { API_ENDPOINT } from "@/consts";

interface Modpack {
    id: string;
    name: string;
    slug: string;
    shortDescription?: string;
    iconUrl?: string;
    bannerUrl?: string;
    publisher?: {
        id: string;
        name: string;
    };
}

interface RecommendedModpacksProps {
    userId?: string;
    limit?: number;
    className?: string;
    title?: string;
    showFallbackLabel?: boolean;
}

export const RecommendedModpacks: React.FC<RecommendedModpacksProps> = ({
    userId,
    limit = 10,
    className,
    title,
    showFallbackLabel = true
}) => {
    const [modpacks, setModpacks] = useState<Modpack[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFallback, setIsFallback] = useState(false);
    const [algorithm, setAlgorithm] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { sessionTokens } = useAuthentication();

    useEffect(() => {
        const fetchRecommendations = async () => {
            try {
                setIsLoading(true);
                setError(null);

                if (!sessionTokens?.accessToken) {
                    setError('Authentication required');
                    setIsLoading(false);
                    return;
                }

                const response = await fetch(`${API_ENDPOINT}/recommendations/for-you?limit=${limit}`, {
                    headers: {
                        'Authorization': `Bearer ${sessionTokens.accessToken}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch recommendations');
                }

                const data = await response.json();

                // Extract modpacks from JSON:API format
                const modpacksData = data.data?.map((item: any) => ({
                    id: item.id,
                    ...item.attributes
                })) || [];

                setModpacks(modpacksData);
                setIsFallback(data.meta?.isFallback || false);
                setAlgorithm(data.meta?.algorithm || null);

            } catch (err) {
                console.error('Error fetching recommendations:', err);
                setError(err instanceof Error ? err.message : 'Failed to load recommendations');
            } finally {
                setIsLoading(false);
            }
        };

        if (sessionTokens?.accessToken) {
            fetchRecommendations();
        }
    }, [userId, limit, sessionTokens]);

    const getTitle = () => {
        if (title) return title;

        if (algorithm === 'popular') {
            return showFallbackLabel ? 'Quizá te guste...' : 'Popular Modpacks';
        } else if (algorithm === 'new') {
            return showFallbackLabel ? 'Quizá te guste...' : 'New Modpacks';
        }

        return 'Recomendado para ti';
    };

    const getIcon = () => {
        if (algorithm === 'popular') {
            return <TrendingUp className="h-5 w-5" />;
        } else if (algorithm === 'new') {
            return <Star className="h-5 w-5" />;
        }
        return <Sparkles className="h-5 w-5" />;
    };

    if (isLoading) {
        return (
            <div className={cn("space-y-4", className)}>
                <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 animate-pulse" />
                    <h2 className="text-2xl font-bold">Loading recommendations...</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return null; // Silently fail - recommendations are optional
    }

    if (modpacks.length === 0) {
        return null; // Don't show anything if no recommendations
    }

    return (
        <div className={cn("space-y-4", className)}>
            <div className="flex items-center gap-2">
                {getIcon()}
                <h2 className="text-2xl font-bold">{getTitle()}</h2>
                {isFallback && showFallbackLabel && (
                    <span className="text-sm text-muted-foreground ml-2">
                        (Based on {algorithm === 'popular' ? 'popularity' : 'recent releases'})
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {modpacks.map((modpack) => (
                    <ModpackCard
                        key={modpack.id}
                        modpack={modpack}
                    />
                ))}
            </div>
        </div>
    );
};
