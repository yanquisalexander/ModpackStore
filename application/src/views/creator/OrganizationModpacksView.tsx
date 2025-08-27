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

interface ModpackListItemProps {
    modpack: Modpack;
    onEdit: (modpack: Modpack) => void;
    onDelete: (modpack: Modpack) => void;
}

const ModpackListItem: React.FC<ModpackListItemProps> = ({ modpack, onEdit, onDelete }) => {
    return (
        <div className="p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
                <img src={modpack.iconUrl || '/placeholder-icon.png'} alt={modpack.name} className="w-full h-32 object-cover rounded-md mb-3" />
                <h3 className="text-lg font-semibold mb-1">{modpack.name}</h3>
                <p className="text-sm text-gray-600 mb-1">Status: <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${modpack.status === 'published' ? 'bg-green-100 text-green-800' : modpack.status === 'draft' ? 'bg-yellow-100 text-yellow-800' : modpack.status === 'archived' ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700'}`}>{modpack.status}</span></p>
                <p className="text-xs text-gray-500 mt-1">Slug: {modpack.slug}</p>
                <p className="text-xs text-gray-500 mb-2">Last updated: {new Date(modpack.updatedAt).toLocaleDateString()}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={() => onEdit(modpack)} title="Editar Modpack">
                    <LucideEdit size={16} />
                </Button>
                <Button variant="outline" size="sm" className="w-full" title="Gestionar Versiones">
                    <LucideHistory size={16} />
                </Button>
                <Button variant="destructive" size="sm" onClick={() => onDelete(modpack)} title="Eliminar Modpack">
                    <LucideTrash2 size={16} />
                </Button>
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
            const res = await fetch(`${API_ENDPOINT}/creators/teams/${team?.id}/modpacks`, {
                headers: {
                    Authorization: sessionTokens?.accessToken ? `Bearer ${sessionTokens.accessToken}` : "",
                },
            });
            if (!res.ok) throw new Error(`Error fetching modpacks: ${res.status}`);
            const data = await res.json();
            setModpacks(data.modpacks || []);
        } catch (err: any) {
            setError(err.message || String(err));
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
        setEditingModpack(modpack);
        setIsEditDialogOpen(true);
    };

    const openDeleteDialog = (modpack: Modpack) => {
        setDeletingModpack(modpack);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        setIsDeleteDialogOpen(false);
        setDeletingModpack(null);
        toast.success("Modpack eliminado (mock)");
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
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
                                Esta acción eliminará el modpack de la organización (mock).
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
