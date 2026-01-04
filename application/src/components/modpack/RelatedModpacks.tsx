import React, { useEffect, useState } from 'react';
import { Sparkles, AlertCircle, PackageOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { API_ENDPOINT } from "@/consts";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from 'motion/react';

// --- TYPES ---
interface Modpack {
    id: string;
    name: string;
    slug: string;
    shortDescription?: string;
    iconUrl?: string;
    bannerUrl?: string;
    publisher?: {
        id: string;
        publisherName: string;
    };
}

interface RelatedModpacksProps {
    modpackId: string;
    limit?: number;
    className?: string;
}

// --- SUB-COMPONENTS ---

const RelatedCardSkeleton = () => (
    <div className="flex flex-col gap-3 p-3 rounded-2xl bg-white/5 border border-white/5">
        <Skeleton className="aspect-square w-full rounded-xl bg-neutral-800" />
        <div className="space-y-2">
            <Skeleton className="h-4 w-3/4 bg-neutral-800" />
            <Skeleton className="h-3 w-1/2 bg-neutral-800" />
        </div>
    </div>
);

const EmptyState = ({ message, icon: Icon }: { message: string, icon: any }) => (
    <div className="w-full py-12 flex flex-col items-center justify-center text-center border border-dashed border-white/10 rounded-xl bg-white/5">
        <div className="p-3 bg-neutral-900 rounded-full mb-3">
            <Icon className="h-6 w-6 text-neutral-500" />
        </div>
        <p className="text-sm text-neutral-400 font-medium">{message}</p>
    </div>
);

// --- MAIN COMPONENT ---

export const RelatedModpacks: React.FC<RelatedModpacksProps> = ({
    modpackId,
    limit = 5,
    className
}) => {
    const [modpacks, setModpacks] = useState<Modpack[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchRelatedModpacks = async () => {
            if (!modpackId) return;

            try {
                setIsLoading(true);
                setError(null);

                const response = await fetchWithAuth(`${API_ENDPOINT}/recommendations/related-to/${modpackId}?limit=${limit}`, {});

                if (!response.ok) throw new Error('Failed to fetch recommendations');

                const data = await response.json();
                const modpacksData = (data.data?.data || []).map((item: any) => ({
                    id: item.id,
                    ...item.attributes
                }));

                setModpacks(modpacksData);

            } catch (err) {
                console.error('Error fetching related modpacks:', err);
                // No mostramos el error al usuario de forma agresiva en una sección secundaria
                setError('No se pudieron cargar las recomendaciones.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchRelatedModpacks();
    }, [modpackId, limit]);

    // Container animation variants
    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        show: { y: 0, opacity: 1 }
    };

    // --- RENDER ---

    if (error) return null; // Si falla esta sección secundaria, mejor no mostrar nada que mostrar un error feo.

    if (isLoading) {
        return (
            <div className={cn("space-y-6", className)}>
                <div className="flex items-center gap-2 px-1">
                    <Sparkles className="h-5 w-5 text-purple-400 animate-pulse" />
                    <h3 className="text-lg font-bold text-white">Descubriendo joyas similares...</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {Array.from({ length: limit }).map((_, i) => (
                        <RelatedCardSkeleton key={i} />
                    ))}
                </div>
            </div>
        );
    }

    if (modpacks.length === 0) {
        return (
            <div className={cn("space-y-6", className)}>
                <div className="flex items-center gap-2 px-1">
                    <Sparkles className="h-5 w-5 text-purple-400 opacity-50" />
                    <h3 className="text-lg font-bold text-white">Recomendaciones</h3>
                </div>
                <EmptyState icon={PackageOpen} message="No encontramos modpacks similares por ahora." />
            </div>
        );
    }

    return (
        <div className={cn("space-y-6", className)}>
            {/* Header */}
            <div className="flex items-center gap-2 px-1">
                <Sparkles className="h-5 w-5 text-purple-400" />
                <h3 className="text-lg font-bold text-white tracking-tight">
                    A la comunidad también le gusta
                </h3>
            </div>

            {/* Grid */}
            <motion.div
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
                variants={containerVariants}
                initial="hidden"
                animate="show"
            >
                {modpacks.map((modpack) => (
                    <motion.div key={modpack.id} variants={itemVariants}>
                        <Link
                            to={`/modpack/${modpack.id}`}
                            className="group relative flex flex-col gap-3 p-3 rounded-2xl bg-[#121212] border border-white/5 hover:bg-white/5 hover:border-white/10 hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-500/5 transition-all duration-300"
                            title={modpack.name}
                        >
                            {/* Icon Container */}
                            <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-neutral-900 shadow-inner ring-1 ring-white/5 group-hover:ring-white/10 transition-all">
                                {modpack.iconUrl ? (
                                    <img
                                        src={modpack.iconUrl}
                                        alt={modpack.name}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900 text-3xl">
                                        🎮
                                    </div>
                                )}

                                {/* Overlay Gradient on Hover */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            </div>

                            {/* Info */}
                            <div className="px-1">
                                <h4 className="font-bold text-sm text-neutral-200 truncate group-hover:text-purple-300 transition-colors">
                                    {modpack.name}
                                </h4>
                                <div className="flex items-center justify-between mt-1">
                                    <span className="text-xs text-neutral-500 truncate max-w-[80%]">
                                        {modpack.publisher?.publisherName || "Desconocido"}
                                    </span>
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );
};