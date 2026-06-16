import { ArmadilloLoading } from "@/components/ArmadilloLoading";
import { ModpackCard } from "@/components/ModpackCard";
import { Button } from "@/components/ui/button";
import { trackSectionView } from "@/lib/analytics";
import { getUserAcquisitions, AcquisitionItem } from "@/services/getUserAcquisitions";
import { useAuthentication } from "@/stores/AuthContext";
import { useGlobalContext } from "@/stores/GlobalContext";
import { invoke } from "@tauri-apps/api/core";
import { LucideCheck, LucideLibrary, LucideDownloadCloud, LucideBox } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { MinecraftInstance } from "@/types/TauriCommandReturns";

type FilterType = 'all' | 'installed' | 'not-installed';

interface ModpackWithInstallStatus extends AcquisitionItem {
    isInstalled: boolean;
}

export const LibrarySection = () => {
    const { setTitleBarState } = useGlobalContext();
    const { sessionTokens } = useAuthentication();

    const [acquisitions, setAcquisitions] = useState<ModpackWithInstallStatus[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<FilterType>('all');

    // --- LOGIC ---
    const fetchAcquisitions = useCallback(async () => {
        if (!sessionTokens?.accessToken) return;

        setIsLoading(true);
        setError(null);

        try {
            const [response, allInstances] = await Promise.all([
                getUserAcquisitions(sessionTokens.accessToken),
                invoke<MinecraftInstance[]>('get_all_instances'),
            ]);

            const installedModpackIds = new Set(
                allInstances
                    .filter(i => i.modpackId != null)
                    .map(i => i.modpackId)
            );

            const acquisitionsWithStatus = response.data.map((item) => ({
                ...item,
                isInstalled: installedModpackIds.has(item.modpack.id),
            }));

            setAcquisitions(acquisitionsWithStatus);
        } catch (error) {
            console.error('Error fetching acquisitions:', error);
            setError('No pudimos sincronizar tu biblioteca.');
        } finally {
            setIsLoading(false);
        }
    }, [sessionTokens?.accessToken]);

    useEffect(() => {
        setTitleBarState({
            title: "Biblioteca",
            icon: LucideLibrary,
            canGoBack: true,
            customIconClassName: "bg-purple-500/20 text-purple-400",
            opaque: false,
        });
        trackSectionView("library");
    }, [setTitleBarState]);

    useEffect(() => {
        fetchAcquisitions();
    }, [fetchAcquisitions]);

    const filteredAcquisitions = acquisitions.filter(acquisition => {
        switch (filter) {
            case 'installed': return acquisition.isInstalled;
            case 'not-installed': return !acquisition.isInstalled;
            default: return true;
        }
    });

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
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 mx-auto max-w-7xl px-6 py-10 md:px-10 h-full overflow-y-auto custom-scrollbar">

                {/* Header */}
                <header className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <LucideLibrary className="w-6 h-6 text-purple-400" />
                        <h1 className="text-xl font-semibold bg-gradient-to-b from-purple-200 to-purple-500 bg-clip-text text-transparent">
                            Biblioteca
                        </h1>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <p className="text-sm text-neutral-500 max-w-xl leading-relaxed">
                            Gestiona los modpacks que has adquirido. Instala tus favoritos o redescubre viejas aventuras.
                        </p>

                        {/* Filter Tabs */}
                        <div className="flex p-1 bg-white/5 rounded-xl border border-white/5 backdrop-blur-sm shrink-0">
                            {[
                                { id: 'all' as const, label: 'Todos', count: acquisitions.length },
                                { id: 'installed' as const, label: 'Instalados', count: acquisitions.filter(a => a.isInstalled).length },
                                { id: 'not-installed' as const, label: 'No instalados', count: acquisitions.filter(a => !a.isInstalled).length }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setFilter(tab.id)}
                                    className={cn(
                                        "px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-2",
                                        filter === tab.id
                                            ? "bg-purple-600 text-white shadow-lg shadow-purple-900/20"
                                            : "text-neutral-400 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    {tab.label}
                                    <span className={cn(
                                        "px-1.5 py-0.5 rounded-md text-[10px]",
                                        filter === tab.id ? "bg-white/20 text-white" : "bg-white/5 text-neutral-500"
                                    )}>
                                        {tab.count}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
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
                            <LucideDownloadCloud className="h-8 w-8 text-red-400" />
                        </div>
                        <p className="text-white font-medium mb-1">Algo salió mal</p>
                        <p className="text-neutral-500 text-sm mb-4">{error}</p>
                        <Button onClick={fetchAcquisitions} variant="outline" className="border-white/10 hover:bg-white/5 text-white">
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
                        {filteredAcquisitions.map((item) => {
                            const modpackForCard = {
                                ...item.modpack,
                                publisher: { publisherName: item.modpack.creatorName || 'Desconocido' },
                            };
                            return (
                                <motion.div key={item.acquisition.id} variants={itemVariants} className="relative group">
                                    <ModpackCard
                                        modpack={modpackForCard}
                                        to={`/modpack/${item.modpack.id}`}
                                        className="h-full hover:ring-2 hover:ring-purple-500/50 transition-all duration-300"
                                    />

                                    {item.isInstalled && (
                                        <div className="absolute top-3 right-3 z-20">
                                            <div className="flex items-center gap-1.5 bg-emerald-500/90 backdrop-blur-md border border-emerald-400/50 text-white px-2.5 py-1 rounded-full shadow-lg shadow-emerald-900/20">
                                                <LucideCheck className="h-3 w-3 stroke-[3]" />
                                                <span className="text-[10px] font-bold uppercase tracking-wide">Instalado</span>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}

                {/* Empty State */}
                {!isLoading && !error && filteredAcquisitions.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                        className="mt-10 p-6 rounded-xl bg-gradient-to-br from-purple-900/10 to-blue-900/10 border border-white/[0.04] text-center max-w-sm mx-auto"
                    >
                        <h3 className="text-base font-semibold text-white/80 mb-1">
                            {filter === 'all' ? 'Biblioteca vacía' :
                                filter === 'installed' ? 'Nada instalado aún' :
                                    'Todo está instalado'}
                        </h3>
                        <p className="text-xs text-neutral-600 mb-4">
                            {filter === 'all' ? 'Aún no has adquirido ningún modpack. ¡Visita la tienda!' :
                                filter === 'installed' ? 'Instala un modpack desde tu biblioteca para verlo aquí.' :
                                    'Parece que tienes todo tu contenido listo para jugar.'}
                        </p>
                        <div className="text-purple-400/80 text-xs font-medium flex items-center justify-center gap-1.5">
                            <LucideLibrary className="w-3.5 h-3.5" />
                            Explora en la tienda
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
};