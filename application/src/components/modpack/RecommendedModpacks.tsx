import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
// Using simple avatar tiles instead of ModpackCard here
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
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(false);

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

                // The API may return either a JSON:API structure (data: [ { id, attributes } ])
                // or a direct array inside data.data or data.data.data. Mirror RelatedModpacks logic.
                let modpacksData: any[] = [];

                if (Array.isArray(data.data)) {
                    // data.data already is an array of items
                    modpacksData = data.data.map((item: any) => (
                        item.attributes ? { id: item.id, ...item.attributes } : item
                    ));
                } else if (Array.isArray(data.data?.data)) {
                    // nested data.data.data
                    modpacksData = data.data.data.map((item: any) => ({ id: item.id, ...item.attributes }));
                } else if (Array.isArray(data)) {
                    // sometimes the endpoint returns a raw array
                    modpacksData = data;
                } else {
                    // fallback: try to read items from data.data
                    const possible = data.data || data;
                    if (Array.isArray(possible)) {
                        modpacksData = possible.map((item: any) => (
                            item.attributes ? { id: item.id, ...item.attributes } : item
                        ));
                    }
                }

                setModpacks(modpacksData || []);
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

    // Scroll control logic (mirror CategoryHorizontalSection)
    const updateArrowVisibility = () => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const { scrollLeft, scrollWidth, clientWidth } = container;
        const scrollEndBuffer = 10;

        setShowLeftArrow(scrollLeft > 0);
        setShowRightArrow(scrollLeft < scrollWidth - clientWidth - scrollEndBuffer);
    };

    useEffect(() => {
        updateArrowVisibility();
        window.addEventListener('resize', updateArrowVisibility);
        return () => window.removeEventListener('resize', updateArrowVisibility);
    }, [modpacks]);

    const scroll = (offset: number) => {
        if (!scrollContainerRef.current) return;
        scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    };

    const ScrollControl = ({ direction, onClick, isVisible }: { direction: 'left' | 'right'; onClick: () => void; isVisible: boolean; }) => {
        const isLeft = direction === 'left';
        const gradientClass = isLeft ? 'bg-gradient-to-r from-ms-primary to-transparent' : 'bg-gradient-to-l from-ms-primary to-transparent';
        const buttonPositionClass = isLeft ? 'left-4' : 'right-4';
        return (
            <>
                <div style={{ opacity: isVisible ? 1 : 0 }} className={`pointer-events-none absolute top-0 bottom-0 ${isLeft ? 'left-0' : 'right-0'} w-40 transition-opacity duration-300 z-10 ${gradientClass}`} />
                {isVisible && (
                    <button onClick={onClick} className={`absolute top-1/2 -translate-y-1/2 cursor-pointer transition-opacity bg-gray-800/80 hover:bg-gray-700 w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg z-20 ${buttonPositionClass}`} aria-label={`Scroll ${direction}`}>
                        {isLeft ? (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" /></svg>) : (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" /></svg>)}
                    </button>
                )}
            </>
        );
    };

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
        <div className={cn("space-y-4 relative z-1", className)}>
            <img src='/images/magic-bg.webp' className="absolute inset-0 w-full h-full blur-3xl saturate-150" />
            <div className="flex items-center gap-2">
                {getIcon()}
                <h2 className="text-2xl font-bold">{getTitle()}</h2>

            </div>

            <div className="relative">
                <div
                    ref={scrollContainerRef}
                    onScroll={updateArrowVisibility}
                    className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 px-4 scroll-p-4"
                >
                    {modpacks.map((modpack) => (
                        <div key={modpack.id} className="snap-start flex-shrink-0 w-40 md:w-48 lg:w-56">
                            <Link
                                to={`/modpack/${modpack.id}`}
                                className="flex flex-col items-center gap-2 p-3 rounded-lg bg-card hover:shadow-lg hover:scale-[1.02] transition-transform duration-150"
                                title={modpack.name}
                            >
                                <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center bg-muted">
                                    {modpack.iconUrl ? (
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
                        </div>
                    ))}
                </div>

                <ScrollControl direction="left" onClick={() => scroll(-360)} isVisible={showLeftArrow} />
                <ScrollControl direction="right" onClick={() => scroll(360)} isVisible={showRightArrow} />
            </div>
        </div>
    );
};
