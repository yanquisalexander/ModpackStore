import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { Link } from 'react-router-dom';
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

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {modpacks.map((modpack) => (
                    <Link
                        key={modpack.id}
                        to={`/modpack/${modpack.id}`}
                        className="flex flex-col items-center gap-2 p-3 rounded-lg bg-card hover:shadow-lg hover:scale-[1.02] transition-transform duration-150"
                        title={modpack.name}
                    >
                        <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center bg-muted">
                            {modpack.iconUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={modpack.iconUrl} alt={modpack.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-2xl">🎮</div>
                            )}
                        </div>
                        <div className="text-center">
                            <div className="font-medium text-sm truncate max-w-[6rem]">{modpack.name}</div>
                            {modpack.publisher && <div className="text-xs text-muted-foreground">{modpack.publisher.name}</div>}
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
};
