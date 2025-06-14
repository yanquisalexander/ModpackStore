import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link as WouterLink } from 'wouter';
import { Modpack, ModpackVersion } from '@/types/modpacks';
import { getModpack, getModpackVersions, publishModpackVersion, ApiError } from '@/services/userModpacks'; // Added publishModpackVersion
import { Button } from '@/components/ui/button';
import { CreateVersionDialog } from '@/components/creator/CreateVersionDialog';
import { EditVersionDialog } from '@/components/creator/EditVersionDialog'; // Added EditVersionDialog
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"; // Added AlertDialog
import { LucidePlus, LucideArrowLeft, LucideEdit2, LucideUploadCloud } from 'lucide-react'; // Added more icons
import { toast } from "sonner";

interface VersionListItemProps {
  version: ModpackVersion;
  onEdit: (version: ModpackVersion) => void;
  onPublish: (version: ModpackVersion) => void;
}

const VersionListItem: React.FC<VersionListItemProps> = ({ version, onEdit, onPublish }) => {
  return (
    <div className="p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow bg-white">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-lg font-semibold text-blue-600">{version.version}</h3>
          <p className="text-sm text-gray-500">Minecraft: {version.mcVersion} {version.forgeVersion ? `(Forge: ${version.forgeVersion})` : ''}</p>
        </div>
        <span className={`px-3 py-1 text-xs font-medium rounded-full ${version.status === 'published' ? 'bg-green-100 text-green-800' :
            version.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-700' // archived or other
          }`}>{version.status}</span>
      </div>
      <div className="mb-3 pt-3 border-t border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-1">Changelog:</h4>
        <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 p-2 rounded-md max-h-32 overflow-y-auto">{version.changelog}</pre>
      </div>
      <div className="flex justify-between items-center">
        <div className="text-xs text-gray-400">
          Created: {new Date(version.createdAt).toLocaleDateString()}
          {version.releaseDate && version.status === 'published' && (
            <span className="ml-2">| Released: {new Date(version.releaseDate).toLocaleDateString()}</span>
          )}
        </div>
        {version.status === 'draft' && (
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={() => onEdit(version)}>
              <LucideEdit2 size={14} className="mr-1.5" /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => onPublish(version)} className="text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700">
              <LucideUploadCloud size={14} className="mr-1.5" /> Publish
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export const ManageModpackVersionsView: React.FC = () => {
  const params = useParams<{ modpackId: string }>();
  const modpackId = params.modpackId;

  const [modpack, setModpack] = useState<Modpack | null>(null);
  const [versions, setVersions] = useState<ModpackVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateVersionDialogOpen, setIsCreateVersionDialogOpen] = useState(false);
  const [isEditVersionDialogOpen, setIsEditVersionDialogOpen] = useState(false); // State for Edit Dialog
  const [editingVersion, setEditingVersion] = useState<ModpackVersion | null>(null); // State for version being edited
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false); // State for Publish Dialog
  const [publishingVersion, setPublishingVersion] = useState<ModpackVersion | null>(null); // State for version being published

  const fetchModpackDetailsAndVersions = useCallback(async () => {
    if (!modpackId) {
      setError("Modpack ID is missing.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [modpackData, versionsData] = await Promise.all([
        getModpack(modpackId),
        getModpackVersions(modpackId),
      ]);
      setModpack(modpackData);
      setVersions(versionsData);
    } catch (err: any) {
      let message = 'Failed to fetch modpack versions or details.';
      if (err instanceof ApiError) message = err.message;
      else if (err instanceof Error) message = err.message;
      setError(message);
      toast.error("Error", {
        description: message,
      })
    } finally {
      setIsLoading(false);
    }
  }, [modpackId]);

  useEffect(() => {
    fetchModpackDetailsAndVersions();
  }, [fetchModpackDetailsAndVersions]);

  const handleCreateOrEditSuccess = () => {
    fetchModpackDetailsAndVersions();
    // Toast is handled by individual dialogs
  };

  const openEditVersionDialog = (version: ModpackVersion) => {
    setEditingVersion(version);
    setIsEditVersionDialogOpen(true);
  };

  const openPublishDialog = (version: ModpackVersion) => {
    setPublishingVersion(version);
    setIsPublishDialogOpen(true);
  };

  const confirmPublish = async () => {
    if (!publishingVersion) return;
    try {
      await publishModpackVersion(publishingVersion.id);
      toast.success(`Version ${publishingVersion.version} has been published.`);
      fetchModpackDetailsAndVersions(); // Refresh to show updated status and releaseDate
    } catch (err: any) {
      let message = 'Failed to publish version.';
      if (err instanceof ApiError) message = err.message;
      else if (err instanceof Error) message = err.message;
      toast.error(message, {
        description: message,
      });
      console.error("Error publishing version:", err);
    } finally {
      setIsPublishDialogOpen(false);
      setPublishingVersion(null);
    }
  };


  if (isLoading) return <div className="container mx-auto p-4 text-center">Loading version details...</div>;
  if (error) return <div className="container mx-auto p-4 text-center text-red-500">{error}</div>;
  if (!modpack) return <div className="container mx-auto p-4 text-center">Modpack details not found.</div>;

  return (
    <div className="container mx-auto p-4">
      <div className="mb-8">
        <WouterLink href="/creator/modpacks">
          <Button variant="outline" className="mb-4">
            <LucideArrowLeft size={16} className="mr-2" /> Back to My Modpacks
          </Button>
        </WouterLink>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{modpack.name}</h1>
            <p className="text-md text-gray-500">Manage Versions</p>
          </div>
          {modpack.status !== 'deleted' && modpack.status !== 'archived' && (
            <Button onClick={() => setIsCreateVersionDialogOpen(true)} className="mt-3 sm:mt-0">
              <LucidePlus size={18} className="mr-2" /> Create New Version
            </Button>
          )}
        </div>
      </div>

      {versions.length === 0 ? (
        <p className="text-center py-8 text-gray-600">No versions found for this modpack yet.</p>
      ) : (
        <div className="space-y-4">
          {versions.map((version) => (
            <VersionListItem
              key={version.id}
              version={version}
              onEdit={openEditVersionDialog}
              onPublish={openPublishDialog}
            />
          ))}
        </div>
      )}

      <CreateVersionDialog
        isOpen={isCreateVersionDialogOpen}
        onClose={() => setIsCreateVersionDialogOpen(false)}
        onSuccess={handleCreateOrEditSuccess}
        modpackId={modpackId!}
        modpackName={modpack.name}
      />
      {editingVersion && (
        <EditVersionDialog
          isOpen={isEditVersionDialogOpen}
          onClose={() => { setIsEditVersionDialogOpen(false); setEditingVersion(null); }}
          onSuccess={handleCreateOrEditSuccess}
          modpackVersion={editingVersion}
        />
      )}
      {publishingVersion && (
        <AlertDialog open={isPublishDialogOpen} onOpenChange={setIsPublishDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Publish Version "{publishingVersion.version}"?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to publish this version? Once published, it will be publicly visible (if the modpack is public) and a release date will be set.
                Ensure all files are correctly uploaded and configured.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPublishingVersion(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmPublish} className="bg-green-600 hover:bg-green-700">
                Confirm Publish
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};
