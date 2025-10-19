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
import { fetchMinecraftManifestWithFailover } from '@/utils/minecraftManifestFailover';
import ModpackVersionWizard from './ModpackVersionWizard';

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
    loaderType?: string;
    loaderVersion?: string;
    createdAt: string;
    status: string;
}

// --- Componente principal ---
const ModpackVersionsDialog: React.FC<Props> = ({ isOpen, onClose, modpackId, modpack, publisherId }) => {
    const { sessionTokens } = useAuthentication();
    const navigate = useNavigate();
    const [versions, setVersions] = useState<ModpackVersion[]>([]);
    const [loading, setLoading] = useState(false);
    const [isNameDialogOpen, setIsNameDialogOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const id = modpackId || modpack?.id;
            if (id) {
                fetchVersions();
            }
        }
    }, [isOpen, modpackId, modpack]);

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

    const openNameDialog = () => {
        setIsNameDialogOpen(true);
    };
    
    const closeNameDialog = () => {
        setIsNameDialogOpen(false);
    };

    const handleVersionCreated = () => {
        fetchVersions();
        closeNameDialog();
    };

    const fetchMinecraftVersions = async (): Promise<void> => {
        // This function is no longer needed as the wizard handles version loading
        // Kept for reference in case of rollback
    };

    const fetchForgeVersions = async (): Promise<void> => {
        // This function is no longer needed as the wizard handles version loading
        // Kept for reference in case of rollback
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
            {/* New Full-Screen Wizard for creating versions */}
            <ModpackVersionWizard
                isOpen={isNameDialogOpen}
                onClose={closeNameDialog}
                onSuccess={handleVersionCreated}
                modpack={{
                    id: modpackId,
                    name: modpack?.name || '',
                    publisherId: publisherId
                }}
                existingVersions={versions.map(v => ({
                    id: v.id,
                    version: v.version,
                    mcVersion: v.mcVersion,
                    forgeVersion: v.forgeVersion,
                    loaderType: v.loaderType,
                    loaderVersion: v.loaderVersion,
                    createdAt: v.createdAt
                }))}
            />
        </>
    );
};

export default ModpackVersionsDialog;
