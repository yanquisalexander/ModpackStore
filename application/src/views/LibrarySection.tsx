import { ArmadilloLoading } from "@/components/ArmadilloLoading";
import { ModpackCard } from "@/components/ModpackCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trackSectionView } from "@/lib/analytics";
import { getUserAcquisitions, ModpackAcquisition } from "@/services/getUserAcquisitions";
import { useAuthentication } from "@/stores/AuthContext";
import { useGlobalContext } from "@/stores/GlobalContext";
import { invoke } from "@tauri-apps/api/core";
import { LucideCheck, LucideFilter, LucideLibrary } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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
            
            // Check installation status for each modpack
            const acquisitionsWithStatus = await Promise.all(
                response.data.map(async (acquisition) => {
                    const isInstalled = await checkModpackInstallation(acquisition.modpack.id);
                    return {
                        ...acquisition,
                        isInstalled
                    };
                })
            );

            setAcquisitions(acquisitionsWithStatus);
        } catch (error) {
            console.error('Error fetching acquisitions:', error);
            setError('Error al cargar tu biblioteca. Inténtalo de nuevo.');
        } finally {
            setIsLoading(false);
        }
    }, [sessionTokens?.accessToken, checkModpackInstallation]);

    useEffect(() => {
        setTitleBarState({
            title: "Biblioteca",
            icon: LucideLibrary,
            canGoBack: true,
            customIconClassName: "bg-purple-500/10",
            opaque: true,
        });

        trackSectionView("library");
    }, [setTitleBarState]);

    useEffect(() => {
        fetchAcquisitions();
    }, [fetchAcquisitions]);

    const filteredAcquisitions = acquisitions.filter(acquisition => {
        switch (filter) {
            case 'installed':
                return acquisition.isInstalled;
            case 'not-installed':
                return !acquisition.isInstalled;
            default:
                return true;
        }
    });

    const getFilterButtonVariant = (filterType: FilterType) => {
        return filter === filterType ? "default" : "outline";
    };

    return (
        <div className="mx-auto max-w-7xl px-8 py-10 overflow-y-auto h-full">
            <header className="flex flex-col mb-8">
                <h1 className="tracking-tight inline font-semibold text-2xl bg-gradient-to-b from-purple-200 to-purple-500 bg-clip-text text-transparent">
                    Biblioteca
                </h1>
                <p className="text-gray-400 text-base max-w-2xl mb-6">
                    Aquí puedes ver todos los modpacks que has adquirido. Los modpacks instalados aparecen marcados con un ícono de verificación.
                </p>

                {/* Filter buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                    <LucideFilter className="h-4 w-4 text-gray-400" />
                    <Button
                        variant={getFilterButtonVariant('all')}
                        size="sm"
                        onClick={() => setFilter('all')}
                        className="h-8"
                    >
                        Todos ({acquisitions.length})
                    </Button>
                    <Button
                        variant={getFilterButtonVariant('installed')}
                        size="sm"
                        onClick={() => setFilter('installed')}
                        className="h-8"
                    >
                        Instalados ({acquisitions.filter(a => a.isInstalled).length})
                    </Button>
                    <Button
                        variant={getFilterButtonVariant('not-installed')}
                        size="sm"
                        onClick={() => setFilter('not-installed')}
                        className="h-8"
                    >
                        No instalados ({acquisitions.filter(a => !a.isInstalled).length})
                    </Button>
                </div>
            </header>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64">
                    <ArmadilloLoading className="h-14" />
                    <p className="text-neutral-400 font-minecraft-ten tracking-wider text-sm mt-2">
                        Cargando biblioteca...
                    </p>
                </div>
            ) : error ? (
                <div className="flex flex-col items-center justify-center h-64">
                    <p className="text-red-400 text-lg mb-4">{error}</p>
                    <Button onClick={fetchAcquisitions} variant="outline">
                        Reintentar
                    </Button>
                </div>
            ) : filteredAcquisitions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64">
                    <LucideLibrary className="h-16 w-16 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium mb-2">
                        {filter === 'all' ? 'No tienes modpacks adquiridos' : 
                         filter === 'installed' ? 'No tienes modpacks instalados' :
                         'Todos tus modpacks están instalados'}
                    </h3>
                    <p className="text-muted-foreground text-center max-w-md">
                        {filter === 'all' ? 'Explora la tienda para encontrar modpacks interesantes y adquirirlos.' :
                         filter === 'installed' ? 'Los modpacks que instales aparecerán aquí.' :
                         '¡Excelente! Tienes todos tus modpacks instalados.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredAcquisitions.map((acquisition) => (
                        <div key={acquisition.id} className="relative">
                            <ModpackCard
                                modpack={acquisition.modpack}
                                to={`/modpack/${acquisition.modpack.id}`}
                                className="transition-transform hover:scale-[1.02]"
                            />
                            {acquisition.isInstalled && (
                                <div className="absolute top-2 right-2 z-10">
                                    <Badge
                                        variant="secondary"
                                        className="bg-green-500/90 text-white border-green-400 backdrop-blur-sm"
                                    >
                                        <LucideCheck className="h-3 w-3 mr-1" />
                                        Instalado
                                    </Badge>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};