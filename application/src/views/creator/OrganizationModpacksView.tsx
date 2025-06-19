import React, { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Modpack } from "@/types/modpacks";
import { Button } from "@/components/ui/button";
import { CreateModpackDialog } from "@/components/creator/CreateModpackDialog";
import { EditModpackDialog } from "@/components/creator/EditModpackDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LucideEdit, LucideTrash2, LucideLayers } from "lucide-react";
import { toast } from "sonner";

interface ModpackListItemProps {
    modpack: Modpack;
    onEdit: (modpack: Modpack) => void;
    onDelete: (modpack: Modpack) => void;
}

const ModpackListItem: React.FC<ModpackListItemProps> = ({ modpack, onEdit, onDelete }) => {
    const [, setLocation] = useLocation();
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
                <Button variant="outline" size="sm" className="w-full" title="Gestionar Versiones" onClick={() => setLocation(`/creators/modpacks/${modpack.id}/versions/new`)}>
                    <LucideLayers size={16} />
                </Button>
                <Button variant="destructive" size="sm" onClick={() => onDelete(modpack)} title="Eliminar Modpack">
                    <LucideTrash2 size={16} />
                </Button>
            </div>
            <Button variant="secondary" size="sm" className="mt-2 w-full" onClick={() => setLocation(`/creators/modpacks/${modpack.id}/edit`)}>
                Editar detalles
            </Button>
        </div>
    );
};

export const OrganizationModpacksView: React.FC = () => {
    const [location] = useLocation();
    const orgMatch = location.match(/^\/creators\/organizations\/(\w+)/);
    const selectedOrgId = orgMatch ? orgMatch[1] : undefined;

    const [modpacks, setModpacks] = useState<Modpack[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingModpack, setEditingModpack] = useState<Modpack | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deletingModpack, setDeletingModpack] = useState<Modpack | null>(null);

    // MOCK: Modpacks por organización
    useEffect(() => {
        setModpacks([
            { id: "1", name: "Modpack A", slug: "modpack-a", status: "published", updatedAt: new Date().toISOString(), iconUrl: "", organizationId: "1", visibility: "public", publisherId: "org-1", createdAt: new Date().toISOString() },
            { id: "2", name: "Modpack B", slug: "modpack-b", status: "draft", updatedAt: new Date().toISOString(), iconUrl: "", organizationId: "2", visibility: "private", publisherId: "org-2", createdAt: new Date().toISOString() },
            { id: "3", name: "Modpack C", slug: "modpack-c", status: "published", updatedAt: new Date().toISOString(), iconUrl: "", organizationId: "1", visibility: "public", publisherId: "org-1", createdAt: new Date().toISOString() },
            { id: "4", name: "Modpack D", slug: "modpack-d", status: "archived", updatedAt: new Date().toISOString(), iconUrl: "", organizationId: "3", visibility: "patreon", publisherId: "org-3", createdAt: new Date().toISOString() },
        ]);
        setIsLoading(false);
    }, []);

    const filteredModpacks = selectedOrgId ? modpacks.filter(m => m.organizationId === selectedOrgId) : [];

    const handleCreateSuccess = () => {
        setIsCreateDialogOpen(false);
        toast.success("Modpack creado correctamente");
    };

    const handleEditSuccess = () => {
        setIsEditDialogOpen(false);
        setEditingModpack(null);
        toast.success("Modpack actualizado correctamente");
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

    if (!selectedOrgId) {
        return <div className="p-8 text-center text-neutral-400">Selecciona una organización para ver sus modpacks.</div>;
    }

    return (
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Modpacks de la organización</h1>
                <Button onClick={() => setIsCreateDialogOpen(true)}>Crear nuevo Modpack</Button>
            </div>
            {isLoading && <p className="text-center py-8">Cargando modpacks...</p>}
            {error && <p className="text-red-500 text-center py-8">{error}</p>}
            {!isLoading && !error && filteredModpacks.length === 0 && (
                <p className="text-center py-8 text-gray-600">Esta organización no tiene modpacks aún.</p>
            )}
            {!isLoading && !error && filteredModpacks.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {filteredModpacks.map((modpack) => (
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
                organizationId={selectedOrgId}
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
