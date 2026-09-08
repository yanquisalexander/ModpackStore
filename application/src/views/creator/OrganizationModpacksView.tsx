// @ts-nocheck

import React, { useEffect, useState, useCallback } from "react";
import { useAuthentication } from "@/stores/AuthContext";
import { API_ENDPOINT } from "@/consts";
import { Modpack } from "@/types/modpacks";
import { Button } from "@/components/ui/button";
import CreateModpackDialog from "@/components/creator/dialogs/CreateModpackDialog";
import ImportCurseForgeDialog from "@/components/creator/dialogs/ImportCurseForgeDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LucideEdit, LucideHistory, LucideTrash2, LucidePackage } from "lucide-react";
import { toast } from "sonner";
import { useParams, useNavigate } from "react-router-dom";
import { ApiErrorPayload } from "@/types/ApiResponses";
import { playSound } from "@/utils/sounds";
import { ModpackStatus } from "@/components/creator/ModpackStatus";
import { MdiMinecraft } from "@/icons/MdiMinecraft";

interface ModpackListItemProps {
    modpack: Modpack;
    onEdit: (modpack: Modpack) => void;
    onDelete: (modpack: Modpack) => void;
    onVersions: (modpack: Modpack) => void;
}

const ModpackListItem: React.FC<ModpackListItemProps> = ({ modpack, onEdit, onDelete, onVersions }) => {
    return (
        <div
            className="relative cursor-crosshair border rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden group"
        >
            <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                style={{
                    backgroundImage: `url(${modpack.bannerUrl || '/images/modpack-fallback.webp'})`,
                }}
            />

            <div className="absolute inset-0 bg-gradient-to-tr from-black/95 via-black/80 to-transparent" />

            <div className="relative z-10 flex flex-col justify-between h-full p-4">
                <div>
                    <h3 className="text-lg font-semibold text-white drop-shadow mb-1">
                        {modpack.name}
                    </h3>
                    {modpack.creatorUser && (
                        <div className="text-xs text-white/70 mb-2">
                            <img src={modpack.creatorUser.avatarUrl} alt={modpack.creatorUser.username} className="inline-block size-6 rounded-full mr-1" />
                            {modpack.creatorUser.username}
                        </div>
                    )}

                    <p className="text-sm text-white/80 my-1">
                        <ModpackStatus status={modpack.status} />
                    </p>

                    <p className="text-xs text-white/60 mb-2">
                        Última actualización: {new Date(modpack.updatedAt).toLocaleDateString()}
                    </p>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onEdit(modpack)}
                        title="Editar Modpack"
                        className="bg-white/20 backdrop-blur text-white hover:bg-white/30"
                    >
                        <LucideEdit size={16} />
                        Editar
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        className="w-full bg-white/20 backdrop-blur text-white hover:bg-white/30"
                        title="Gestionar Versiones"
                        onClick={() => onVersions(modpack)}
                    >
                        <LucideHistory size={16} />
                        Versiones
                    </Button>
                    {modpack.status !== 'deleted' && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => onDelete(modpack)}
                            title="Eliminar Modpack"
                        >
                            <LucideTrash2 size={16} />
                            Eliminar
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

interface OrganizationModpacksViewProps {
    teams: any;
}

export const OrganizationModpacksView: React.FC<OrganizationModpacksViewProps> = ({ teams }) => {
    const { sessionTokens } = useAuthentication();
    const { publisherId } = useParams<{ publisherId: string }>();
    const navigate = useNavigate();

    const team = teams.find((t: { id: string }) => t.id === publisherId);

    const [modpacks, setModpacks] = useState<Modpack[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deletingModpack, setDeletingModpack] = useState<Modpack | null>(null);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

    const fetchModpacks = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_ENDPOINT}/creators/${team?.id}/modpacks`, {
                headers: {
                    Authorization: sessionTokens?.accessToken ? `Bearer ${sessionTokens.accessToken}` : "",
                },
            });
            if (!res.ok) throw new Error(`Error fetching modpacks: ${res.status}`);
            const data = await res.json();
            const items = Array.isArray(data) ? data : (data.modpacks || []);
            setModpacks(items);
        } catch (err: any) {
            const apiError = err as ApiErrorPayload;
            setError(apiError.errors?.[0]?.detail || String(err));
        } finally {
            setIsLoading(false);
        }
    }, [team?.id, sessionTokens]);

    useEffect(() => {
        fetchModpacks();
    }, [fetchModpacks]);

    const handleCreateSuccess = () => {
        setIsCreateDialogOpen(false);
        fetchModpacks();
    };

    const handleImportSuccess = (result: any) => {
        setIsImportDialogOpen(false);
        fetchModpacks();
        toast.success(`Modpack "${result.modpack.name}" importado exitosamente`);
    };

    const openEditDialog = (modpack: Modpack) => {
        if (modpack.status === 'deleted') {
            playSound("ERROR_NOTIFICATION");
            toast.warning("No se puede editar un modpack eliminado");
            return;
        }
        navigate(`/creators/org/${publisherId}/modpacks/${modpack.id}/edit`);
    };

    const openDeleteDialog = (modpack: Modpack) => {
        setDeletingModpack(modpack);
        setIsDeleteDialogOpen(true);
    };

    const openVersionsDialog = (modpack: Modpack) => {
        if (modpack.status === 'deleted') {
            playSound("ERROR_NOTIFICATION");
            toast.warning("No se puede administrar un modpack eliminado", {
                icon: <MdiMinecraft />
            });
            return;
        }
        navigate(`/creators/org/${publisherId}/modpacks/${modpack.id}/versions`);
    };

    const confirmDelete = async () => {
        if (!deletingModpack || !team) return;
        const res = await fetch(`${API_ENDPOINT}/creators/${team.id}/modpacks/${deletingModpack.id}`, {
            method: "DELETE",
            headers: {
                Authorization: sessionTokens?.accessToken ? `Bearer ${sessionTokens.accessToken}` : "",
            },
        });
        if (!res.ok) {
            const apiError = await res.json() as ApiErrorPayload;
            toast.error(apiError.errors[0]?.detail || "Error al eliminar el modpack");
            return;
        }
        setIsDeleteDialogOpen(false);
        setDeletingModpack(null);
        fetchModpacks();
        toast.success("Modpack eliminado correctamente");
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Modpacks de {team?.publisherName || team?.displayName}</h1>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setIsImportDialogOpen(true)}
                        className="flex items-center gap-2"
                    >
                        <LucidePackage className="h-4 w-4" />
                        Importar desde CurseForge
                    </Button>
                    <Button onClick={() => setIsCreateDialogOpen(true)}>Crear nuevo Modpack</Button>
                </div>
            </div>
            {isLoading && (
                <div className="flex items-center justify-center py-8">
                    <LucidePackage className="h-8 w-8 animate-spin text-primary" />
                </div>
            )}
            {error && (
                <div className="bg-destructive/10 text-destructive border border-destructive p-4 rounded-md mb-4">
                    <p>{error}</p>
                </div>
            )}
            {!isLoading && !error && modpacks.length === 0 && (
                <div className="text-center py-12">
                    <LucidePackage className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">No hay modpacks</h3>
                    <p className="text-muted-foreground mb-4">
                        {team?.publisherName || team?.displayName} aún no tiene modpacks.
                    </p>
                    <Button onClick={() => setIsCreateDialogOpen(true)}>
                        Crear primer modpack
                    </Button>
                </div>
            )}
            {!isLoading && !error && modpacks.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {modpacks.map((modpack) => (
                        <ModpackListItem
                            key={modpack.id}
                            modpack={modpack}
                            onEdit={openEditDialog}
                            onDelete={openDeleteDialog}
                            onVersions={openVersionsDialog}
                        />
                    ))}
                </div>
            )}
            <CreateModpackDialog
                isOpen={isCreateDialogOpen}
                onClose={() => setIsCreateDialogOpen(false)}
                onSuccess={handleCreateSuccess}
                creatorId={team?.id}
            />

            {deletingModpack && (
                <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Seguro que quieres eliminar este modpack?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta acción eliminará el modpack de la organización.
                                <br />
                                <br />
                                <span className="text-xs">
                                    Por motivos de seguridad, el modpack no se eliminará permanentemente, sino que se marcará como "eliminado" y se ocultará de la vista pública.
                                </span>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setDeletingModpack(null)}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Confirmar eliminación
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}

            <ImportCurseForgeDialog
                isOpen={isImportDialogOpen}
                onClose={() => setIsImportDialogOpen(false)}
                onSuccess={handleImportSuccess}
                publisherId={team?.id}
            />
        </div>
    );
};
