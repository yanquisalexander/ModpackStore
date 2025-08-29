import React, { useEffect, useState, useCallback } from "react";
import { useAuthentication } from "@/stores/AuthContext";
import { API_ENDPOINT } from "@/consts";
import { Modpack } from "@/types/modpacks";
import { Button } from "@/components/ui/button";
import CreateModpackDialog from "@/components/creator/CreateModpackDialog";
import EditModpackDialog from "../../components/creator/EditModpackDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LucideEdit, LucideHistory, LucideTrash2 } from "lucide-react";
import { toast } from "sonner";
import { useParams } from "react-router-dom";
import { ApiErrorPayload } from "@/types/ApiResponses";
import { playSound } from "@/utils/sounds";

interface ModpackListItemProps {
    modpack: Modpack;
    onEdit: (modpack: Modpack) => void;
    onDelete: (modpack: Modpack) => void;
}

const ModpackListItem: React.FC<ModpackListItemProps> = ({ modpack, onEdit, onDelete }) => {
    return (
        <div
            className="relative cursor-crosshair border rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden group"
        >
            {/* Imagen de fondo con efecto scale */}
            <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                style={{
                    backgroundImage: `url(${modpack.bannerUrl || '/images/modpack-fallback.webp'})`,
                }}
            />

            {/* Overlay degradado */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent" />

            {/* Contenido */}
            <div className="relative z-10 flex flex-col justify-between h-full p-4">
                <div>
                    <h3 className="text-lg font-semibold text-white drop-shadow mb-1">
                        {modpack.name}
                    </h3>
                    <p className="text-sm text-gray-200 mb-1">
                        Status:{' '}
                        <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${modpack.status === 'published'
                                ? 'bg-green-600/80 text-white'
                                : modpack.status === 'draft'
                                    ? 'bg-yellow-500/80 text-white'
                                    : modpack.status === 'archived'
                                        ? 'bg-gray-500/80 text-white'
                                        : 'bg-red-600/80 text-white'
                                }`}
                        >
                            {modpack.status}
                        </span>
                    </p>
                    <p className="text-xs text-gray-300 mt-1">Slug: {modpack.slug}</p>
                    <p className="text-xs text-gray-300 mb-2">
                        Last updated: {new Date(modpack.updatedAt).toLocaleDateString()}
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
                            className="bg-red-600/80 hover:bg-red-700/90"
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
    const { orgId } = useParams();

    const team = teams.find((t) => t.id === orgId);

    const [modpacks, setModpacks] = useState<Modpack[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingModpack, setEditingModpack] = useState<Modpack | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deletingModpack, setDeletingModpack] = useState<Modpack | null>(null);

    const fetchModpacks = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_ENDPOINT}/creators/publishers/${team?.id}/modpacks`, {
                headers: {
                    Authorization: sessionTokens?.accessToken ? `Bearer ${sessionTokens.accessToken}` : "",
                },
            });
            if (!res.ok) throw new Error(`Error fetching modpacks: ${res.status}`);
            const data = await res.json();
            setModpacks(data.modpacks || []);
        } catch (err: any) {
            const apiError = err as ApiErrorPayload;
            setError(apiError.errors[0]?.detail || String(err));
        } finally {
            setIsLoading(false);
        }
    }, [team?.id, sessionTokens]);

    useEffect(() => {
        fetchModpacks();
    }, [fetchModpacks]);

    const handleCreateSuccess = (created?: Modpack) => {
        setIsCreateDialogOpen(false);
        fetchModpacks();
    };

    const handleEditSuccess = () => {
        setIsEditDialogOpen(false);
        setEditingModpack(null);
        fetchModpacks();
    };

    const openEditDialog = (modpack: Modpack) => {
        if (modpack.status === 'deleted') {
            playSound("ERROR_NOTIFICATION")
            toast.warning("No se puede editar un modpack eliminado");
            return;
        };
        setEditingModpack(modpack);
        setIsEditDialogOpen(true);
    };

    const openDeleteDialog = (modpack: Modpack) => {
        setDeletingModpack(modpack);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!deletingModpack || !team) return;
        const res = await fetch(`${API_ENDPOINT}/creators/publishers/${team.id}/modpacks/${deletingModpack.id}`, {
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
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Modpacks de {team?.publisherName}</h1>
                <Button onClick={() => setIsCreateDialogOpen(true)}>Crear nuevo Modpack</Button>
            </div>
            {isLoading && <p className="text-center py-8">Cargando modpacks...</p>}
            {error && <p className="text-red-500 text-center py-8">{error}</p>}
            {!isLoading && !error && modpacks.length === 0 && (
                <p className="text-center py-8 text-gray-600">Esta organización no tiene modpacks aún.</p>
            )}
            {!isLoading && !error && modpacks.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2  gap-6">
                    {modpacks.map((modpack) => (
                        <ModpackListItem
                            key={modpack.id}
                            modpack={modpack}
                            onEdit={openEditDialog}
                            onDelete={openDeleteDialog}
                        />
                    ))}
                </div>
            )}
            <CreateModpackDialog
                isOpen={isCreateDialogOpen}
                onClose={() => setIsCreateDialogOpen(false)}
                onSuccess={handleCreateSuccess}
                teamId={team?.id}
            />
            {editingModpack && (
                <EditModpackDialog
                    isOpen={isEditDialogOpen}
                    onClose={() => { setIsEditDialogOpen(false); setEditingModpack(null); }}
                    onSuccess={handleEditSuccess}
                    modpack={editingModpack}
                />
            )}
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
                                    Por motivos de seguridad, el modpack no se eliminará permanentemente, sino que se marcará como "eliminado" y se ocultará de la vista pública. Si deseas eliminarlo permanentemente, contacta con el soporte.
                                </span>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setDeletingModpack(null)}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                                Confirmar eliminación
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    );
};
