import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, TrendingUp, Star, BrainCircuit, ChevronLeft, ChevronRight, Zap, Flame, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthentication } from '@/stores/AuthContext';
import { API_ENDPOINT } from "@/consts";
import { motion } from 'motion/react';

// Interfaz ajustada a la respuesta real de tu API
interface Modpack {
    id: string;
    name: string;
    slug: string;
    shortDescription?: string;
    iconUrl?: string;
    bannerUrl?: string;
    featured?: boolean;
    createdAt?: string; // Importante para calcular si es nuevo
    publisher?: {
        id: string;
        name: string; // Usaremos esto en el frontend
        publisherName?: string; // Esto viene del backend
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
    const [algorithm, setAlgorithm] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { sessionTokens } = useAuthentication();
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(false);

    // --- FETCH LOGIC MEJORADA ---
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
                    headers: { 'Authorization': `Bearer ${sessionTokens.accessToken}` }
                });

                if (!response.ok) throw new Error('Failed to fetch recommendations');

                const data = await response.json();

                // Normalización de datos para arreglar el problema de "Desconocido"
                const normalizeModpack = (item: any): Modpack => {
                    // Si viene anidado en attributes (JSON:API style) o plano
                    const base = item.attributes || item;

                    return {
                        id: item.id || base.id,
                        ...base,
                        // FIX: Mapeo inteligente del publisher
                        publisher: base.publisher ? {
                            ...base.publisher,
                            // Si existe publisherName, úsalo como name. Si no, usa name.
                            name: base.publisher.publisherName || base.publisher.name || "Desconocido"
                        } : undefined
                    };
                };

                let modpacksData: Modpack[] = [];

                // Manejo de las diferentes estructuras raras que devuelve tu API
                if (Array.isArray(data.data)) {
                    // Caso: { data: { data: [...] } } (Tu ejemplo actual)
                    if (data.data.length > 0 && data.data[0]?.type) {
                        modpacksData = data.data.map(normalizeModpack);
                    } else {
                        // Caso: { data: [...] } simple
                        modpacksData = data.data.map(normalizeModpack);
                    }
                } else if (Array.isArray(data.data?.data)) {
                    // Caso anidado profundo
                    modpacksData = data.data.data.map(normalizeModpack);
                } else if (Array.isArray(data)) {
                    modpacksData = data.map(normalizeModpack);
                }

                setModpacks(modpacksData);
                setAlgorithm(data.meta?.algorithm || null);

            } catch (err) {
                console.error('Error fetching recommendations:', err);
                setError(err instanceof Error ? err.message : 'Failed');
            } finally {
                setIsLoading(false);
            }
        };

        if (sessionTokens?.accessToken) fetchRecommendations();
    }, [userId, limit, sessionTokens]);

    // --- SCROLL LOGIC ---
    const updateArrowVisibility = () => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const { scrollLeft, scrollWidth, clientWidth } = container;
        setShowLeftArrow(scrollLeft > 5);
        setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5);
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

    // --- HELPER PARA BADGES INTELIGENTES ---
    const getSmartBadge = (modpack: Modpack) => {
        // 1. Prioridad: Featured (Destacado explícitamente)
        if (modpack.featured) {
            return { label: 'HOT', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', icon: Flame };
        }

        // 2. Prioridad: Fecha de creación (Nuevo real, < 14 días)
        if (modpack.createdAt) {
            const created = new Date(modpack.createdAt);
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - created.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays <= 14) {
                return { label: 'NEW', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', icon: Sparkles };
            }
        }

        // 3. Fallback: Score de recomendación simulado
        return { label: '98%', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', icon: BrainCircuit };
    };

    // --- META GLOBAL (Para el título de la sección) ---
    const getSectionMeta = () => {
        if (algorithm === 'popular') return { title: showFallbackLabel ? 'Tendencias' : 'Populares', icon: TrendingUp, color: 'text-orange-400' };
        if (algorithm === 'new') return { title: showFallbackLabel ? 'Recién llegados' : 'Novedades', icon: Clock, color: 'text-yellow-400' };
        return { title: title || 'Para ti', icon: BrainCircuit, color: 'text-purple-400' };
    };

    const sectionMeta = getSectionMeta();
    const ScrollButton = ({ direction, onClick, isVisible }: any) => (
        <div className={`absolute top-0 bottom-0 z-20 flex items-center transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'} ${direction === 'left' ? 'left-0' : 'right-0'}`}>
            <div className={`absolute inset-0 w-24 ${direction === 'left' ? 'bg-gradient-to-r from-[#121212] to-transparent' : 'bg-gradient-to-l from-[#121212] to-transparent'}`} />
            <button onClick={onClick} className="relative mx-2 p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 hover:bg-white/10 hover:scale-110 active:scale-95 transition-all text-white shadow-xl">
                {direction === 'left' ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
            </button>
        </div>
    );

    if (isLoading) return <div className={cn("py-4 h-48 animate-pulse bg-white/5 rounded-xl", className)} />;
    if (error || modpacks.length === 0) return null;

    return (
        <section className={cn("relative py-6 group/section", className)}>
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-5 px-1 relative z-10">
                <div className={`p-1.5 rounded-lg bg-neutral-800/80 border border-white/10 ${sectionMeta.color}`}>
                    <sectionMeta.icon className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-white tracking-tight leading-none">
                        {sectionMeta.title}
                    </h2>
                    <p className="text-xs text-neutral-400 font-medium mt-0.5">
                        Basado en tus preferencias
                    </p>
                </div>
            </div>

            {/* Scroll Container */}
            <div className="relative group">
                <div
                    ref={scrollContainerRef}
                    onScroll={updateArrowVisibility}
                    className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 pb-4 px-1 -mx-1"
                >
                    {modpacks.map((modpack, idx) => {
                        const badge = getSmartBadge(modpack);

                        return (
                            <motion.div
                                key={modpack.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="snap-start flex-shrink-0"
                            >
                                <Link
                                    to={`/modpack/${modpack.id}`}
                                    className="group/card relative flex items-center gap-4 w-72 p-3 rounded-2xl bg-neutral-900/40 backdrop-blur-md border border-white/5 hover:bg-neutral-800/60 hover:border-white/10 hover:shadow-lg hover:shadow-purple-900/10 transition-all duration-300"
                                >
                                    {/* Icono */}
                                    <div className="relative w-14 h-14 flex-shrink-0">
                                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl opacity-20 group-hover/card:opacity-40 transition-opacity blur-sm" />
                                        <div className="relative w-full h-full rounded-xl overflow-hidden bg-neutral-900 border border-white/10">
                                            {modpack.iconUrl ? (
                                                <img src={modpack.iconUrl} alt={modpack.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-neutral-600">
                                                    <Zap className="w-6 h-6" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-0.5 gap-2">
                                            <h3 className="font-semibold text-sm text-white truncate group-hover/card:text-purple-300 transition-colors">
                                                {modpack.name}
                                            </h3>

                                            {/* Badge Inteligente Individual */}
                                            <div className={`hidden sm:flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${badge.bg} ${badge.color}`}>
                                                <badge.icon size={8} />
                                                {badge.label}
                                            </div>
                                        </div>

                                        <p className="text-xs text-neutral-400 truncate">
                                            {modpack.publisher?.name || "Desconocido"}
                                        </p>

                                        {/* Barra decorativa */}
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <div className="h-1 w-full bg-neutral-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 w-[85%] rounded-full opacity-60 group-hover/card:opacity-100 transition-opacity" />
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </motion.div>
                        );
                    })}

                    <div className="w-2 flex-shrink-0" />
                </div>

                <ScrollButton direction="left" onClick={() => scroll(-300)} isVisible={showLeftArrow} />
                <ScrollButton direction="right" onClick={() => scroll(300)} isVisible={showRightArrow} />
            </div>
        </section>
    );
};