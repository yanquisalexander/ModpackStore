import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { API_ENDPOINT } from '@/consts';
import { useAuthentication } from '@/stores/AuthContext';
import { toast } from 'sonner';
import { Modpack } from "@/types/modpacks";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

// --- Tipos ---
interface Props {
    isOpen: boolean;
    onClose: () => void;
    modpackId: string;
    modpack: Modpack;
    publisherId: string;
}

interface ModpackVersion {
    id: string;
    version: string;
    mcVersion: string;
    forgeVersion?: string;
    createdAt: string;
    status: string;
}

// Types for Minecraft and Forge versions
interface MinecraftVersion {
    id: string;
    type: string;
    url: string;
    time?: string;
    releaseTime?: string;
}

const LAUNCHER_VERSIONS_URL = "https://launchermeta.mojang.com/mc/game/version_manifest.json";
const FORGE_VERSIONS_URL = "https://mc-versions-api.net/api/forge";

// --- Componente principal ---
const ModpackVersionsDialog: React.FC<Props> = ({ isOpen, onClose, modpackId, modpack, publisherId }) => {
    const { sessionTokens } = useAuthentication();
    const navigate = useNavigate();
    const [versions, setVersions] = useState<ModpackVersion[]>([]);
    const [loading, setLoading] = useState(false);
    const [isNameDialogOpen, setIsNameDialogOpen] = useState(false);
    const [newVersionName, setNewVersionName] = useState('');
    const [mcVersion, setMcVersion] = useState('');
    const [forgeVersion, setForgeVersion] = useState('');
    const [minecraftVersions, setMinecraftVersions] = useState<MinecraftVersion[]>([]);
    const [forgeVersionsMap, setForgeVersionsMap] = useState<Record<string, string[]>>({});
    const [compatibleForgeVersions, setCompatibleForgeVersions] = useState<string[]>([]);
    const [loadingVersions, setLoadingVersions] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const id = modpackId || modpack?.id;
            if (id) {
                fetchVersions();
                fetchMinecraftVersions();
            }
        }
    }, [isOpen, modpackId, modpack]);

    // Heredar valores de la versión más reciente cuando todas las listas estén cargadas
    useEffect(() => {
        if (versions.length > 0 && minecraftVersions.length > 0) {
            const latestVersion = versions[0]; // Asumiendo que están ordenadas por fecha

            // Heredar versión de Minecraft si existe en la lista disponible
            if (minecraftVersions.some(v => v.id === latestVersion.mcVersion)) {
                setMcVersion(latestVersion.mcVersion);
            }

            // Heredar versión de Forge si existe en la lista compatible
            if (latestVersion.forgeVersion && compatibleForgeVersions.includes(latestVersion.forgeVersion)) {
                setForgeVersion(latestVersion.forgeVersion);
            }
        }
    }, [versions, minecraftVersions, compatibleForgeVersions]);

    // Update compatible forge versions when Minecraft version changes
    useEffect(() => {
        const forgeVersions = forgeVersionsMap[mcVersion] || [];
        setCompatibleForgeVersions(forgeVersions);

        // Set the first compatible forge version as selected if available
        if (forgeVersions.length > 0 && !forgeVersion) {
            setForgeVersion(forgeVersions[0]);
        } else if (forgeVersions.length === 0) {
            setForgeVersion("");
        }
    }, [mcVersion, forgeVersionsMap, forgeVersion]);

    const fetchVersions = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_ENDPOINT}/creators/publishers/${publisherId}/modpacks/${modpackId}/versions`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                },
            });

            if (!res.ok) {
                const err = await res.json().catch(() => null);
                const message = err?.errors?.[0]?.detail || err?.detail || `Error ${res.status}: ${res.statusText}`;
                toast.error(`Error al obtener versiones`, { description: String(message) });
                return;
            }

            const { versions }: { versions: ModpackVersion[] } = await res.json();
            setVersions(versions);

            console.log("Fetched versions:", versions);
        } catch (error) {
            console.error('Fetch versions error', error);
            toast.error('Ocurrió un error inesperado al obtener las versiones.');
        } finally {
            setLoading(false);
        }
    };

    const createVersion = async (versionName: string) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_ENDPOINT}/creators/publishers/${publisherId}/modpacks/${modpackId}/versions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ versionName, mcVersion, forgeVersion }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => null);
                const message = err?.errors?.[0]?.detail || err?.detail || `Error ${res.status}: ${res.statusText}`;
                toast.error(`Error al crear versión`, { description: String(message) });
                return;
            }

            toast.success('Versión creada correctamente');
            fetchVersions();
        } catch (error) {
            console.error('Create version error', error);
            toast.error('Ocurrió un error inesperado al crear la versión.');
        } finally {
            setLoading(false);
        }
    };

    const openNameDialog = () => {
        setIsNameDialogOpen(true);
        // Limpiar valores para nueva versión
        setNewVersionName('');
        setMcVersion('');
        setForgeVersion('');
    };
    const closeNameDialog = () => {
        setIsNameDialogOpen(false);
        setNewVersionName('');
        setMcVersion('');
        setForgeVersion('');
    };

    const confirmCreateVersion = () => {
        createVersion(newVersionName);
        closeNameDialog();
    };

    const fetchMinecraftVersions = async (): Promise<void> => {
        setLoadingVersions(true);
        try {
            const response = await fetch(LAUNCHER_VERSIONS_URL);
            const data = await response.json();

            // Filter versions: only releases for modpacks
            const releaseVersions = data.versions.filter((version: MinecraftVersion) =>
                version.type === "release"
            );

            setMinecraftVersions(releaseVersions);

            // Also fetch forge versions
            await fetchForgeVersions();
        } catch (error) {
            console.error("Error fetching Minecraft versions:", error);
            toast.error("No se pudieron cargar las versiones de Minecraft");
        } finally {
            setLoadingVersions(false);
        }
    };

    const fetchForgeVersions = async (): Promise<void> => {
        try {
            const response = await fetch(FORGE_VERSIONS_URL);
            const data = await response.json();

            // Assume the new format with result array is used
            const rawData = data.result?.[0] || {};

            const processedData: Record<string, string[]> = {};

            // Filter versions before 1.5.2 from the new format structure
            for (const mcVersion in rawData) {
                if (Object.prototype.hasOwnProperty.call(rawData, mcVersion)) {
                    processedData[mcVersion] = rawData[mcVersion].filter((version: string) => {
                        const versionParts = version.split('.');
                        return versionParts.length > 1 && (parseInt(versionParts[0]) > 1 || (parseInt(versionParts[0]) === 1 && parseInt(versionParts[1]) >= 5));
                    });
                }
            }

            setForgeVersionsMap(processedData);

        } catch (error) {
            console.error("Error fetching Forge versions:", error);
            toast.error("No se pudieron cargar las versiones de Forge");
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-2xl bg-zinc-900 border-zinc-800 text-white">
                    <DialogHeader>
                        <DialogTitle>Versiones del Modpack</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            {modpack?.name ? `Lista de versiones para el modpack "${modpack.name}".` : 'Lista de versiones disponibles para este modpack.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 p-2 max-h-[70vh] overflow-y-auto">
                        <Button
                            type="button"
                            className="self-end-safe bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-md"
                            onClick={openNameDialog}
                        >
                            Crear nueva versión
                        </Button>

                        {loading ? (
                            <p className="text-center text-zinc-400">Cargando versiones...</p>
                        ) : versions.length > 0 ? (
                            <ul className="space-y-2">
                                {versions.map((version) => (
                                    <li
                                        key={version.id}
                                        className="bg-zinc-800 p-3 rounded-md cursor-pointer hover:bg-zinc-700 transition-colors"
                                        onClick={() => {
                                            onClose();
                                            navigate(`/creators/org/${publisherId}/modpacks/${modpackId}/versions/${version.id}`);
                                        }}
                                    >
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="text-white font-semibold">{version.version}</p>
                                                <p className="text-zinc-400 text-sm">Minecraft: {version.mcVersion}</p>
                                                {version.forgeVersion && <p className="text-zinc-400 text-sm">Forge: {version.forgeVersion}</p>}
                                                <p className="text-zinc-400 text-sm">Creado el: {new Date(version.createdAt).toLocaleDateString()}</p>
                                                <p className="text-zinc-400 text-sm">Estado: {version.status}</p>
                                            </div>
                                            <Badge
                                                variant={version.status === 'published' ? 'default' : 'secondary'}
                                                className={version.status === 'published' ? 'bg-green-100 text-green-800' : ''}
                                            >
                                                {version.status === 'published' ? 'Publicado' : 'Borrador'}
                                            </Badge>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-center text-zinc-400">No hay versiones disponibles.</p>
                        )}
                    </div>

                    <DialogFooter className="pt-4">
                        <div className="flex gap-2 justify-end">
                            <Button type="button" variant="outline" onClick={onClose}>
                                Cerrar
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Diálogo para ingresar el nombre de la nueva versión */}
            <Dialog open={isNameDialogOpen} onOpenChange={closeNameDialog}>
                <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-white">
                    <DialogHeader>
                        <DialogTitle>Nuevo nombre de versión</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <input
                            type="text"
                            placeholder="Ingrese el nombre de la nueva versión"
                            className="w-full bg-zinc-800 text-white p-2 rounded-md"
                            value={newVersionName}
                            onChange={(e) => setNewVersionName(e.target.value)}
                        />

                        {/* Minecraft Version Selector */}
                        <div className="space-y-2">
                            <label className="text-white text-sm">Versión de Minecraft</label>
                            {loadingVersions ? (
                                <div className="flex items-center justify-center p-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                    <span className="ml-2 text-sm text-gray-400">Cargando versiones...</span>
                                </div>
                            ) : (
                                <Select
                                    value={mcVersion}
                                    onValueChange={setMcVersion}
                                >
                                    <SelectTrigger className="w-full bg-zinc-800 text-white border-zinc-600">
                                        <SelectValue placeholder="Selecciona una versión de Minecraft" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-60 bg-zinc-800 border-zinc-600">
                                        {minecraftVersions.map((version) => (
                                            <SelectItem key={version.id} value={version.id} className="text-white hover:bg-zinc-700">
                                                {version.id}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        {/* Forge Version Selector */}
                        <div className="space-y-2">
                            <label className="text-white text-sm">Versión de Forge (opcional)</label>
                            {loadingVersions ? (
                                <div className="flex items-center justify-center p-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
                                    <span className="ml-2 text-sm text-gray-400">Cargando versiones...</span>
                                </div>
                            ) : compatibleForgeVersions.length > 0 ? (
                                <Select
                                    value={forgeVersion}
                                    onValueChange={setForgeVersion}
                                >
                                    <SelectTrigger className="w-full bg-zinc-800 text-white border-zinc-600">
                                        <SelectValue placeholder="Selecciona una versión de Forge" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-60 bg-zinc-800 border-zinc-600">
                                        {compatibleForgeVersions.map((version) => (
                                            <SelectItem key={version} value={version} className="text-white hover:bg-zinc-700">
                                                {version}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : mcVersion ? (
                                <div className="p-3 rounded-md bg-yellow-900/20 border border-yellow-700/50">
                                    <p className="text-sm text-yellow-300">
                                        No hay versiones de Forge disponibles para Minecraft {mcVersion}
                                    </p>
                                </div>
                            ) : (
                                <div className="p-3 rounded-md bg-gray-800/50 border border-gray-600/50">
                                    <p className="text-sm text-gray-400">
                                        Selecciona primero una versión de Minecraft
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter className="pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={closeNameDialog}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            onClick={confirmCreateVersion}
                            disabled={!newVersionName || !mcVersion}
                        >
                            Crear
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default ModpackVersionsDialog;
