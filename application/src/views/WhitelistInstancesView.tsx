import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    LucideShieldCheck,
    LucidePackage,
    LucideShieldAlert,
    LucideLock,
    LucideRefreshCw
} from 'lucide-react';
import { useAuthentication } from '@/stores/AuthContext';
import { whitelistService } from '@/services/whitelist.service';
import { WhitelistedModpack } from '@/types/whitelist';
import { toast } from 'sonner';
import { ModpackCard } from '@/components/ModpackCard';
import { motion } from 'motion/react';
import { useGlobalContext } from '@/stores/GlobalContext';

// --- COMPONENTS ---

const WhitelistSkeleton = () => (
    <div className="mx-auto max-w-7xl px-8 py-10">
        {/* Header Skeleton */}
        <div className="mb-12 space-y-4">
            <div className="flex items-center gap-4">
                <Skeleton className="size-16 rounded-2xl bg-neutral-800" />
                <div className="space-y-2">
                    <Skeleton className="h-8 w-64 bg-neutral-800 rounded-lg" />
                    <Skeleton className="h-4 w-96 bg-neutral-800 rounded-lg" />
                </div>
            </div>
        </div>
        {/* Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="space-y-3">
                    <Skeleton className="aspect-[16/9] w-full rounded-xl bg-neutral-800" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-3/4 bg-neutral-800" />
                        <Skeleton className="h-3 w-1/2 bg-neutral-800" />
                    </div>
                </div>
            ))}
        </div>
    </div>
);

// --- MAIN VIEW ---

export const WhitelistInstancesView: React.FC = () => {
    const { sessionTokens, isAuthenticated } = useAuthentication();
    const { setTitleBarState } = useGlobalContext();

    // States
    const [loading, setLoading] = useState(true);
    const [modpacks, setModpacks] = useState<WhitelistedModpack[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Initial Setup
    useEffect(() => {
        setTitleBarState({
            title: "Acceso Privado",
            icon: LucideShieldCheck,
            canGoBack: true,
            customIconClassName: "bg-blue-500/10 text-blue-400",
            opaque: true, // Fondo sólido para evitar transparencias raras al scrollear
        });
    }, [setTitleBarState]);

    // Data Loading
    useEffect(() => {
        if (isAuthenticated && sessionTokens?.accessToken) {
            loadWhitelistedModpacks();
        }
    }, [isAuthenticated, sessionTokens?.accessToken]);

    const loadWhitelistedModpacks = async () => {
        if (!sessionTokens?.accessToken) return;

        setLoading(true);
        setError(null);

        try {
            const data = await whitelistService.getMyWhitelistedModpacks(sessionTokens.accessToken);
            setModpacks(data);
        } catch (err) {
            console.error('Error loading whitelisted modpacks:', err);
            const message = err instanceof Error ? err.message : 'Error desconocido';
            setError(message);
            toast.error('No se pudieron cargar tus instancias');
        } finally {
            // Pequeño delay artificial para que el skeleton no parpadee demasiado rápido si la carga es instantánea
            setTimeout(() => setLoading(false), 300);
        }
    };

    // --- RENDERS ---

    if (loading) return <WhitelistSkeleton />;

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <div className="bg-red-500/10 p-4 rounded-full mb-4 ring-1 ring-red-500/20">
                    <LucideShieldAlert className="h-10 w-10 text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Error de Sincronización</h3>
                <p className="text-neutral-400 max-w-md mb-6">{error}</p>
                <Button onClick={loadWhitelistedModpacks} variant="outline" className="gap-2 border-white/10 hover:bg-white/5">
                    <LucideRefreshCw className="h-4 w-4" />
                    Reintentar
                </Button>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen bg-[#050505] w-full overflow-x-hidden">

            {/* Background Glows (Blue Theme) */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 mx-auto max-w-7xl px-6 py-12 md:px-12 h-full overflow-y-auto custom-scrollbar">

                {/* Header */}
                <motion.header
                    className="mb-12 border-b border-white/5 pb-6"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <LucideLock className="w-6 h-6 text-blue-400" />
                        </div>
                        <h1 className="tracking-tight inline font-semibold text-3xl bg-gradient-to-b from-blue-200 to-blue-500 bg-clip-text text-transparent">
                            Instancias Privadas
                        </h1>
                    </div>
                    <p className="text-neutral-400 text-sm max-w-xl leading-relaxed">
                        Colección de modpacks a los que tienes acceso exclusivo mediante <span className="text-blue-400 font-medium">Whitelist</span>.
                    </p>
                </motion.header>

                {/* Content Grid */}
                {modpacks.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center justify-center py-20 bg-neutral-900/30 border border-dashed border-white/10 rounded-3xl"
                    >
                        <div className="bg-neutral-800/50 p-6 rounded-full mb-6">
                            <LucidePackage className="h-12 w-12 text-neutral-500" />
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">No tienes accesos activos</h3>
                        <p className="text-neutral-400 max-w-md text-center leading-relaxed">
                            Actualmente no estás en la lista blanca de ningún modpack privado.
                            Contacta con los creadores o únete a sus comunidades para solicitar acceso.
                        </p>
                    </motion.div>
                ) : (
                    <motion.div
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                        initial="hidden"
                        animate="visible"
                        variants={{
                            visible: { transition: { staggerChildren: 0.05 } }
                        }}
                    >
                        {modpacks.map((modpack) => {
                            // Adapter: Convertir WhitelistedModpack a la estructura que espera ModpackCard
                            // Asumiendo que ModpackCard maneja la visualización básica
                            const modpackForCard = {
                                ...modpack,
                                publisher: {
                                    ...modpack.publisher,
                                    publisherName: modpack.publisher.name
                                }
                            };

                            return (
                                <motion.div
                                    key={modpack.id}
                                    variants={{
                                        hidden: { y: 20, opacity: 0 },
                                        visible: { y: 0, opacity: 1 }
                                    }}
                                >
                                    <div className="relative group">
                                        {/* Badge Flotante de Whitelist */}
                                        <div className="absolute top-3 right-3 z-10 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg shadow-blue-900/50 flex items-center gap-1">
                                            <LucideLock size={10} />
                                            PRIVATE
                                        </div>

                                        <ModpackCard
                                            modpack={modpackForCard}
                                            to={`/modpack/${modpack.id}`}
                                            className="h-full border-blue-500/10 hover:border-blue-500/40 transition-colors"
                                        />
                                    </div>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}
            </div>
        </div>
    );
};