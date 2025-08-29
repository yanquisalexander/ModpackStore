import React, { useState, useEffect, useCallback } from 'react';
import { Link as WouterLink, useNavigate } from "react-router-dom"; // Import Link for navigation and useLocation
import { Modpack } from '@/types/modpacks';
import { getUserModpacks, deleteModpack, ApiError } from '@/services/userModpacks';
import { Button } from '@/components/ui/button';
import { CreateModpackDialog } from '@/components/creator/CreateModpackDialog';
import { EditModpackDialog } from '@/components/creator/EditModpackDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LucideEdit, LucideTrash2, LucideLayers } from 'lucide-react'; // Added LucideLayers for versions icon
import { toast } from "sonner";

interface ModpackListItemProps {
  modpack: Modpack;
  onEdit: (modpack: Modpack) => void;
  onDelete: (modpack: Modpack) => void;
}

const ModpackListItem: React.FC<ModpackListItemProps> = ({ modpack, onEdit, onDelete }) => {
  return (
    <div className="p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
      <div>
        <img src={modpack.iconUrl || '/images/modpack-fallback.webp'} alt={modpack.name} className="w-full h-32 object-cover rounded-md mb-3" />
        <h3 className="text-lg font-semibold mb-1">{modpack.name}</h3>
        <p className="text-sm text-gray-600 mb-1">Status: <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${modpack.status === 'published' ? 'bg-green-100 text-green-800' :
          modpack.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
            modpack.status === 'archived' ? 'bg-gray-100 text-gray-700' :
              'bg-red-100 text-red-700' // deleted or other
          }`}>{modpack.status}</span></p>
        <p className="text-xs text-gray-500 mt-1">Slug: {modpack.slug}</p>
        <p className="text-xs text-gray-500 mb-2">Last updated: {new Date(modpack.updatedAt).toLocaleDateString()}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <Button variant="outline" size="sm" onClick={() => onEdit(modpack)} title="Edit Modpack">
          <LucideEdit size={16} />
        </Button>
        <WouterLink to={`/creator/modpacks/${modpack.id}/versions`}>
          <Button variant="outline" size="sm" className="w-full" title="Manage Versions">
            <LucideLayers size={16} />
          </Button>
        </WouterLink>
        <Button variant="destructive" size="sm" onClick={() => onDelete(modpack)} title="Delete Modpack">
          <LucideTrash2 size={16} />
        </Button>
      </div>
    </div>
  );
};

export const MyModpacksView: React.FC = () => {
  const [modpacks, setModpacks] = useState<Modpack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingModpack, setEditingModpack] = useState<Modpack | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingModpack, setDeletingModpack] = useState<Modpack | null>(null);
  const [location] = useLocation();

  // Detectar si hay organización seleccionada en la ruta
  const orgMatch = location.match(/^\/creators\/organizations\/(\w+)/);
  const selectedOrgId = orgMatch ? orgMatch[1] : undefined;

  // Filtrar modpacks por organización si aplica (mock)
  const filteredModpacks = selectedOrgId
    ? modpacks.filter((m) => m.organizationId === selectedOrgId)
    : modpacks;

  const fetchModpacks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getUserModpacks();
      console.log("Fetched modpacks:", data); // Debug log
      setModpacks(data);
    } catch (err: any) {
      let message = 'Failed to fetch modpacks.';
      if (err instanceof ApiError) message = err.message;
      else if (err instanceof Error) message = err.message;
      setError(message);
      toast.error(message, {
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setModpacks([
      { id: "1", name: "Modpack A", slug: "modpack-a", status: "published", updatedAt: new Date().toISOString(), iconUrl: "", organizationId: "1", visibility: "public", publisherId: "org-1", createdAt: new Date().toISOString() },
      { id: "2", name: "Modpack B", slug: "modpack-b", status: "draft", updatedAt: new Date().toISOString(), iconUrl: "", organizationId: "2", visibility: "private", publisherId: "org-2", createdAt: new Date().toISOString() },
      { id: "3", name: "Modpack C", slug: "modpack-c", status: "published", updatedAt: new Date().toISOString(), iconUrl: "", organizationId: "1", visibility: "public", publisherId: "org-1", createdAt: new Date().toISOString() },
      { id: "4", name: "Modpack D", slug: "modpack-d", status: "archived", updatedAt: new Date().toISOString(), iconUrl: "", organizationId: "3", visibility: "patreon", publisherId: "org-3", createdAt: new Date().toISOString() },
      { id: "5", name: "Modpack E", slug: "modpack-e", status: "published", updatedAt: new Date().toISOString(), iconUrl: "", visibility: "public", publisherId: "user-1", createdAt: new Date().toISOString() }, // Sin organización
    ]);
    setIsLoading(false);
  }, []);

  const handleCreateSuccess = () => {
    fetchModpacks();
    toast.success("Modpack Created", {
      description: "Your new modpack has been created successfully.",
    });
  };

  const handleEditSuccess = () => {
    fetchModpacks();
    toast.success("Modpack Updated", {
      description: "Modpack details saved successfully.",
    });
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
    if (!deletingModpack) return;
    try {
      await deleteModpack(deletingModpack.id);
      setModpacks(modpacks.filter(m => m.id !== deletingModpack.id)); // Optimistic update
      toast.success(`Modpack Deleted`, {
        description: `"${deletingModpack.name}" has been marked as deleted.`,
      });
    } catch (err: any) {
      let message = 'Failed to delete modpack.';
      if (err instanceof ApiError) message = err.message;
      else if (err instanceof Error) message = err.message;
      toast.error(message, {
        description: message,
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setDeletingModpack(null);
      // fetchModpacks(); // Or rely on optimistic update
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Modpacks</h1>
        <Button onClick={() => setIsCreateDialogOpen(true)}>Create New Modpack</Button>
      </div>

      {isLoading && <p className="text-center py-8">Loading modpacks...</p>}
      {error && <p className="text-red-500 text-center py-8">{error}</p>}

      {!isLoading && !error && filteredModpacks.length === 0 && (
        <p className="text-center py-8 text-gray-600">
          {selectedOrgId
            ? "Esta organización no tiene modpacks aún."
            : "You haven't created or been added to any modpacks yet."}
        </p>
      )}

      {!isLoading && !error && filteredModpacks.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredModpacks?.map((modpack) => (
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
              <AlertDialogTitle>Are you sure you want to delete this modpack?</AlertDialogTitle>
              <AlertDialogDescription>
                This action will mark the modpack "{deletingModpack.name}" as deleted.
                It will not be permanently removed immediately but will be hidden from public view.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeletingModpack(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                Confirm Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};
