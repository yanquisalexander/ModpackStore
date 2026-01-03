import { ArmadilloLoading } from "@/components/ArmadilloLoading";
import { ModpackCard } from "@/components/ModpackCard";
import { Button } from "@/components/ui/button";
import { trackSectionView } from "@/lib/analytics";
import { getUserAcquisitions, ModpackAcquisition } from "@/services/getUserAcquisitions";
import { useAuthentication } from "@/stores/AuthContext";
import { useGlobalContext } from "@/stores/GlobalContext";
import { invoke } from "@tauri-apps/api/core";
import { LucideCheck, LucideLibrary, LucideDownloadCloud, LucideBox, LucideFilter } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

type FilterType = 'all' | 'installed' | 'not-installed';

interface ModpackWithInstallStatus extends ModpackAcquisition {
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
    const checkModpackInstallation = useCallback(async (modpackId: string): Promise<boolean> => {
        try {
            const instances = await invoke('get_instances_by_modpack_id', { modpackId }) as any[];
            return instances.length > 0;
        } catch (error) {
            console.error(`Error checking installation for modpack ${modpackId}:`, error);
            return false;
        }
    }, []);

    const fetchAcquisitions = useCallback(async () => {
        if (!sessionTokens?.accessToken) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await getUserAcquisitions(sessionTokens.accessToken, 1, 100);

            const acquisitionsWithStatus = await Promise.all(
                response.data.map(async (acquisition) => {
                    const isInstalled = await checkModpackInstallation(acquisition.modpack.id);
                    return { ...acquisition, isInstalled };
                })
            );

            setAcquisitions(acquisitionsWithStatus);
        } catch (error) {
            console.error('Error fetching acquisitions:', error);
            setError('No pudimos sincronizar tu biblioteca.');
        } finally {
            setIsLoading(false);
        }
    }, [sessionTokens?.accessToken, checkModpackInstallation]);

    useEffect(() => {
        setTitleBarState({
            title: "Biblioteca",
            icon: LucideLibrary,
            canGoBack: true,
            customIconClassName: "bg-purple-500/20 text-purple-400",
            opaque: true,
        });
        trackSectionView("library");
    }, [setTitleBarState]);

    useEffect(() => {
        fetchAcquisitions();
    }, [fetchAcquisitions]);

    // --- FILTER LOGIC ---
    const filteredAcquisitions = acquisitions.filter(acquisition => {
        switch (filter) {
            case 'installed': return acquisition.isInstalled;
            case 'not-installed': return !acquisition.isInstalled;
            default: return true;
        }
    });

    // --- ANIMATIONS ---
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.05 }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
    };

    return (
        <div className="relative min-h-dvh bg-[#0a0a0a] text-white overflow-hidden">

            {/* Background Glows */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-900/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-900/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 mx-auto max-w-7xl px-6 py-12 md:px-12 h-full overflow-y-auto custom-scrollbar">

                {/* HEADER & FILTERS */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b border-white/5 pb-6">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                <LucideLibrary className="w-6 h-6 text-purple-400" />
                            </div>
                            <h1 className="tracking-tight inline font-semibold text-3xl bg-gradient-to-b from-purple-200 to-purple-500 bg-clip-text text-transparent">
                                Tu Biblioteca
                            </h1>
                        </div>
                        <p className="text-neutral-400 text-sm max-w-xl leading-relaxed">
                            Gestiona los modpacks que has adquirido. Instala tus favoritos o redescubre viejas aventuras.
                        </p>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex p-1 bg-white/5 rounded-xl border border-white/5 backdrop-blur-sm">
                        {[
                            { id: 'all', label: 'Todos', count: acquisitions.length },
                            { id: 'installed', label: 'Instalados', count: acquisitions.filter(a => a.isInstalled).length },
                            { id: 'not-installed', label: 'No instalados', count: acquisitions.filter(a => !a.isInstalled).length }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setFilter(tab.id as FilterType)}
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
                </header>

                {/* CONTENT AREA */}
                <div className="min-h-[400px]">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-4">
                            <ArmadilloLoading className="h-16 w-16" />
                            <p className="text-neutral-500 text-sm font-medium animate-pulse">Sincronizando biblioteca...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <div className="p-4 rounded-full bg-red-500/10 mb-4">
                                <LucideDownloadCloud className="h-8 w-8 text-red-400" />
                            </div>
                            <p className="text-white font-medium mb-1">Algo salió mal</p>
                            <p className="text-neutral-500 text-sm mb-4">{error}</p>
                            <Button onClick={fetchAcquisitions} variant="outline" className="border-white/10 hover:bg-white/5 text-white">
                                Reintentar
                            </Button>
                        </div>
                    ) : filteredAcquisitions.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center justify-center h-80 text-center border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.01]"
                        >
                            <div className="p-6 rounded-full bg-white/5 mb-4 ring-1 ring-white/10">
                                <LucideBox className="h-10 w-10 text-neutral-600" />
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">
                                {filter === 'all' ? 'Biblioteca vacía' :
                                    filter === 'installed' ? 'Nada instalado aún' :
                                        'Todo está instalado'}
                            </h3>
                            <p className="text-neutral-500 text-sm max-w-xs">
                                {filter === 'all' ? 'Aún no has adquirido ningún modpack. ¡Visita la tienda!' :
                                    filter === 'installed' ? 'Instala un modpack desde tu biblioteca para verlo aquí.' :
                                        'Parece que tienes todo tu contenido listo para jugar.'}
                            </p>
                        </motion.div>
                    ) : (
                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                        >
                            {filteredAcquisitions.map((acquisition) => {
                                const modpackForCard = {
                                    ...acquisition.modpack,
                                    publisher: acquisition.modpack.publisher || { publisherName: 'Desconocido' }
                                };

                                return (
                                    <motion.div key={acquisition.id} variants={itemVariants} className="relative group">
                                        <ModpackCard
                                            modpack={modpackForCard}
                                            to={`/modpack/${acquisition.modpack.id}`}
                                            className="h-full hover:ring-2 hover:ring-purple-500/50 transition-all duration-300"
                                        />

                                        {/* INSTALLED BADGE */}
                                        {acquisition.isInstalled && (
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
                </div>
            </div>
        </div>
    );
};