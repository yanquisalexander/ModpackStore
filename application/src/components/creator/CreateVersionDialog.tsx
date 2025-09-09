import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LucidePackage, LucidePlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { API_ENDPOINT } from '@/consts';
import { useAuthentication } from '@/stores/AuthContext';
import { handleApiError } from '@/lib/utils';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (versionId: string) => void;
    modpack: {
        id: string;
        name: string;
        publisherId: string;
    };
    existingVersions: {
        id: string;
        version: string;
        mcVersion: string;
        forgeVersion?: string;
        changelog?: string;
        status: string;
        releaseDate?: string;
        createdAt: string;
        updatedAt: string;
    }[];
}

export const CreateVersionDialog: React.FC<Props> = ({ isOpen, onClose, onSuccess, modpack, existingVersions }) => {
    const { sessionTokens } = useAuthentication();
    const [loading, setLoading] = useState(false);

    // Get the latest version's MC and Forge versions for pre-selection
    const latestVersion = existingVersions.length > 0 ? existingVersions[existingVersions.length - 1] : null;

    const [formData, setFormData] = useState({
        versionName: '',
        mcVersion: latestVersion?.mcVersion || '',
        forgeVersion: latestVersion?.forgeVersion || 'none',
        changelog: ''
    });

    // Versions fetching/state (reuse logic used elsewhere)
    interface MinecraftVersion {
        id: string;
        type: string;
        url: string;
        time?: string;
        releaseTime?: string;
    }

    const LAUNCHER_VERSIONS_URL = "https://launchermeta.mojang.com/mc/game/version_manifest.json";
    const FORGE_VERSIONS_URL = "https://mc-versions-api.net/api/forge";

    const [minecraftVersions, setMinecraftVersions] = useState<MinecraftVersion[]>([]);
    const [forgeVersionsMap, setForgeVersionsMap] = useState<Record<string, string[]>>({});
    const [compatibleForgeVersions, setCompatibleForgeVersions] = useState<string[]>([]);
    const [loadingVersions, setLoadingVersions] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.versionName.trim() || !formData.mcVersion) {
            toast.error('El nombre de la versión y la versión de Minecraft son requeridos');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(
                `${API_ENDPOINT}/creators/publishers/${modpack.publisherId}/modpacks/${modpack.id}/versions`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        versionName: formData.versionName.trim(),
                        mcVersion: formData.mcVersion,
                        forgeVersion: formData.forgeVersion === 'none' ? null : formData.forgeVersion || null,
                        changelog: formData.changelog.trim() || null
                    }),
                }
            );

            if (!response.ok) {
                await handleApiError(response);
                return;
            }

            const data = await response.json();
            toast.success('Versión creada exitosamente');

            // Reset form
            setFormData({
                versionName: '',
                mcVersion: latestVersion?.mcVersion || '',
                forgeVersion: latestVersion?.forgeVersion || 'none',
                changelog: ''
            });

            onSuccess(data.version?.id || 'new-version');
            onClose();
        } catch (error) {
            console.error('Error creating version:', error);
            toast.error(error instanceof Error ? error.message : 'Error al crear la versión');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            setFormData({
                versionName: '',
                mcVersion: latestVersion?.mcVersion || '',
                forgeVersion: latestVersion?.forgeVersion || 'none',
                changelog: ''
            });
            onClose();
        }
    };

    // Load versions when dialog opens
    useEffect(() => {
        if (isOpen) {
            fetchMinecraftVersions();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Update compatible forge versions when selected mcVersion changes
    useEffect(() => {
        const forgeVersions = forgeVersionsMap[formData.mcVersion] || [];
        setCompatibleForgeVersions(forgeVersions);

        if (forgeVersions.length > 0 && (!formData.forgeVersion || formData.forgeVersion === 'none')) {
            setFormData(prev => ({ ...prev, forgeVersion: forgeVersions[0] }));
        } else if (forgeVersions.length === 0) {
            setFormData(prev => ({ ...prev, forgeVersion: 'none' }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.mcVersion, forgeVersionsMap]);

    const fetchMinecraftVersions = async (): Promise<void> => {
        setLoadingVersions(true);
        try {
            const response = await fetch(LAUNCHER_VERSIONS_URL);
            const data = await response.json();

            // Filter to releases (sensible default for modpack versions)
            const releaseVersions = data.versions.filter((version: MinecraftVersion) => version.type === 'release');

            setMinecraftVersions(releaseVersions);

            if (releaseVersions.length > 0 && !formData.mcVersion) {
                setFormData(prev => ({ ...prev, mcVersion: releaseVersions[0].id }));
            }

            await fetchForgeVersions();
        } catch (error) {
            console.error('Error fetching Minecraft versions:', error);
            toast.error('No se pudieron cargar las versiones de Minecraft');
        } finally {
            setLoadingVersions(false);
        }
    };

    const fetchForgeVersions = async (): Promise<void> => {
        try {
            const response = await fetch(FORGE_VERSIONS_URL);
            const data = await response.json();

            const rawData = data.result?.[0] || {};
            const processedData: Record<string, string[]> = {};

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
            console.error('Error fetching Forge versions:', error);
            toast.error('No se pudieron cargar las versiones de Forge');
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <LucidePackage className="h-5 w-5" />
                        Crear Nueva Versión
                    </DialogTitle>
                    <DialogDescription>
                        Crear una nueva versión para el modpack "{modpack.name}"
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Version Name */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                            Nombre de la Versión *
                        </label>
                        <Input
                            value={formData.versionName}
                            onChange={(e) => setFormData(prev => ({ ...prev, versionName: e.target.value }))}
                            placeholder="ej: 1.0.0, v2.1.3, Release Candidate 1"
                            disabled={loading}
                            required
                        />
                    </div>

                    {/* Minecraft Version */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                            Versión de Minecraft *
                        </label>
                        {loadingVersions ? (
                            <div className="flex items-center gap-2 p-2">
                                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                <span className="text-sm text-gray-500">Cargando versiones...</span>
                            </div>
                        ) : (
                            <Select
                                value={formData.mcVersion}
                                onValueChange={(value) => setFormData(prev => ({ ...prev, mcVersion: value }))}
                                disabled={loading}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar versión de Minecraft" />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                    {minecraftVersions.map((v) => (
                                        <SelectItem key={v.id} value={v.id}>
                                            {v.id}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {/* Forge Version */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                            Versión de Forge (Opcional)
                        </label>
                        {loadingVersions ? (
                            <div className="flex items-center gap-2 p-2">
                                <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                                <span className="text-sm text-gray-500">Cargando versiones de Forge...</span>
                            </div>
                        ) : (
                            <Select
                                value={formData.forgeVersion}
                                onValueChange={(value) => setFormData(prev => ({ ...prev, forgeVersion: value }))}
                                disabled={loading}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar versión de Forge (opcional)" />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                    <SelectItem value="none">Sin Forge (Vanilla)</SelectItem>
                                    {compatibleForgeVersions.map((version) => (
                                        <SelectItem key={version} value={version}>
                                            {version}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {/* Changelog */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                            Changelog (Opcional)
                        </label>
                        <Textarea
                            value={formData.changelog}
                            onChange={(e) => setFormData(prev => ({ ...prev, changelog: e.target.value }))}
                            placeholder="Describe los cambios en esta versión..."
                            disabled={loading}
                            rows={4}
                        />
                    </div>

                    {/* Info Box */}
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800">
                            <strong>Siguiente paso:</strong> Después de crear la versión, podrás subir archivos
                            o reutilizar archivos de versiones anteriores en cada categoría (mods, resourcepacks, config, etc.).
                        </p>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading || !formData.versionName.trim() || !formData.mcVersion}
                        >
                            <LucidePlus className="h-4 w-4 mr-2" />
                            {loading ? 'Creando...' : 'Crear Versión'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};