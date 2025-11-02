import React, { useEffect, useState } from 'react';
import { ModpackCard } from '@/components/ModpackCard';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_ENDPOINT } from "@/consts";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

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

interface RelatedModpacksProps {
    modpackId: string;
    limit?: number;
    className?: string;
}

export const RelatedModpacks: React.FC<RelatedModpacksProps> = ({
    modpackId,
    limit = 10,
    className
}) => {
    const [modpacks, setModpacks] = useState<Modpack[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchRelatedModpacks = async () => {
            try {
                setIsLoading(true);
                setError(null);

                const response = await fetchWithAuth(`${API_ENDPOINT}/recommendations/related-to/${modpackId}?limit=${limit}`, {});

                if (!response.ok) {
                    throw new Error('Failed to fetch related modpacks');
                }

                const data = await response.json();

                // Extract modpacks from API response: data.data is always an array
                const modpacksData = (data.data?.data || []).map((item: any) => ({
                    id: item.id,
                    ...item.attributes
                }));

                setModpacks(modpacksData);

            } catch (err) {
                console.error('Error fetching related modpacks:', err);
                setError(err instanceof Error ? err.message : 'Failed to load related modpacks');
            } finally {
                setIsLoading(false);
            }
        };

        if (modpackId) {
            fetchRelatedModpacks();
        }
    }, [modpackId, limit]);

    if (isLoading) {
        return (
            <div className={cn("space-y-4", className)}>
                <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 animate-pulse" />
                    <h3 className="text-xl font-semibold">Loading related modpacks...</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={cn("space-y-4", className)}>
                <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-red-500" />
                    <h3 className="text-xl font-semibold text-red-500">Error loading related modpacks</h3>
                </div>
                <p className="text-sm text-muted-foreground">{error}</p>
            </div>
        );
    }

    if (modpacks.length === 0) {
        return (
            <div className={cn("space-y-4", className)}>
                <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-xl font-semibold text-muted-foreground">No related modpacks found</h3>
                </div>
                <p className="text-sm text-muted-foreground">We couldn't find any similar modpacks at this time.</p>
            </div>
        );
    }

    return (
        <div className={cn("space-y-4", className)}>
            <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <h3 className="text-xl font-semibold">Los usuarios que les gustó este modpack también disfrutaron de...</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
