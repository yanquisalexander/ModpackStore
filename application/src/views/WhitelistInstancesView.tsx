import { Button } from '@/components/ui/button';
import { ModpackCard } from '@/components/ModpackCard';
import { whitelistService } from '@/services/whitelist.service';
import { useAuthentication } from '@/stores/AuthContext';
import { useGlobalContext } from '@/stores/GlobalContext';
import { WhitelistedModpack } from '@/types/whitelist';
import { LucideShieldCheck, LucideLock, LucideRefreshCw, LucidePackage } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import GlassLock from "@/icons/GlassLock";

export const WhitelistInstancesView = () => {
    const { sessionTokens, isAuthenticated } = useAuthentication();
    const { setTitleBarState } = useGlobalContext();

    const [modpacks, setModpacks] = useState<WhitelistedModpack[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchWhitelistedModpacks = useCallback(async () => {
        if (!sessionTokens?.accessToken) return;

        setIsLoading(true);
        setError(null);

        try {
            const data = await whitelistService.getMyWhitelistedModpacks(sessionTokens.accessToken);
            setModpacks(data);
        } catch (err) {
            console.error('Error loading whitelisted modpacks:', err);
            setError(err instanceof Error ? err.message : 'Error desconocido');
            toast.error('No se pudieron cargar tus instancias');
        } finally {
            setIsLoading(false);
        }
    }, [sessionTokens?.accessToken]);

    useEffect(() => {
        setTitleBarState({
            title: "Acceso Privado",
            icon: GlassLock,
            canGoBack: true,
            customIconClassName: "bg-blue-500/10 text-blue-400",
            opaque: false,
        });
    }, [setTitleBarState]);

    useEffect(() => {
        if (isAuthenticated && sessionTokens?.accessToken) {
            fetchWhitelistedModpacks();
        }
    }, [isAuthenticated, sessionTokens?.accessToken, fetchWhitelistedModpacks]);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.08 }
        }
    };

    const itemVariants = {
        hidden: { y: 16, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { type: "spring" as const, stiffness: 90, damping: 18 }
        }
    };

    return (
        <div className="relative min-h-full bg-[#0e0e10] overflow-hidden">

            {/* Background Glows */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 mx-auto max-w-7xl px-6 py-10 md:px-10 h-full overflow-y-auto custom-scrollbar">

                {/* Header */}
                <header className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <GlassLock className="w-6 h-6 text-blue-400" />
                        <h1 className="text-xl font-semibold bg-gradient-to-b from-blue-200 to-blue-500 bg-clip-text text-transparent">
                            Instancias Privadas
                        </h1>
                    </div>
                    <p className="text-sm text-neutral-500 max-w-xl leading-relaxed">
                        Colección de modpacks a los que tienes acceso exclusivo mediante <span className="text-blue-400 font-medium">Whitelist</span>.
                    </p>
                </header>

                {/* Content */}
                {isLoading ? (
                    <div className="grid grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-[260px] rounded-xl bg-white/[0.03] animate-pulse border border-white/[0.04]" />
                        ))}
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="p-4 rounded-full bg-red-500/10 mb-4">
                            <LucideRefreshCw className="h-8 w-8 text-red-400" />
                        </div>
                        <p className="text-white font-medium mb-1">Algo salió mal</p>
                        <p className="text-neutral-500 text-sm mb-4">{error}</p>
                        <Button onClick={fetchWhitelistedModpacks} variant="outline" className="border-white/10 hover:bg-white/5 text-white">
                            Reintentar
                        </Button>
                    </div>
                ) : (
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="grid grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-5"
                    >
                        {modpacks.map((modpack) => {
                            const modpackForCard = modpack;
                            return (
                                <motion.div key={modpack.id} variants={itemVariants} className="relative group">
                                    <div className="absolute top-3 right-3 z-10">
                                        <div className="flex items-center gap-1 bg-blue-600/90 backdrop-blur-md border border-blue-400/50 text-white px-2 py-1 rounded-full shadow-lg shadow-blue-900/20">
                                            <LucideLock className="h-3 w-3 stroke-[3]" />
                                            <span className="text-[10px] font-bold uppercase tracking-wide">Privado</span>
                                        </div>
                                    </div>
                                    <ModpackCard
                                        modpack={modpackForCard}
                                        to={`/modpack/${modpack.id}`}
                                        className="h-full hover:ring-2 hover:ring-blue-500/50 transition-all duration-300"
                                    />
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}

                {/* Empty State */}
                {!isLoading && !error && modpacks.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                        className="mt-10 p-6 rounded-xl bg-gradient-to-br from-blue-900/10 to-indigo-900/10 border border-white/[0.04] text-center max-w-sm mx-auto"
                    >
                        <div className="flex justify-center mb-4">
                            <div className="p-3 rounded-full bg-white/[0.04]">
                                <LucidePackage className="h-6 w-6 text-neutral-500" />
                            </div>
                        </div>
                        <h3 className="text-base font-semibold text-white/80 mb-1">No tienes accesos activos</h3>
                        <p className="text-xs text-neutral-600 mb-4">
                            Actualmente no estás en la lista blanca de ningún modpack privado.
                            Contacta con los creadores o únete a sus comunidades para solicitar acceso.
                        </p>
                    </motion.div>
                )}
            </div>
        </div>
    );
};
