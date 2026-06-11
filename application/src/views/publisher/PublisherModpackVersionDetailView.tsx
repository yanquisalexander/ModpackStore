import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
    LucideEdit2,
    LucideSave,
    LucideUpload,
    LucideFile,
    LucideTrash2,
    LucideSend,
    LucidePackage,
    LucideImage,
    LucideSettings,
    LucidePalette,
    LucideFolder,
    LucideChevronDown,
    LucideChevronRight,
    LucideFileJson,
    LucideFileText,
    LucideFileArchive,
    LucideFileImage,
    LucideMonitor,
    LucideServer,
    LucideGlobe,
    LucideInfo
} from 'lucide-react';
import { toast } from 'sonner';
import { API_ENDPOINT } from '@/consts';
import { useAuthentication } from '@/stores/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from '@/components/ui/progress';
import { handleApiError } from '@/lib/utils';
import { ModpackProcessingStatus } from '@/components/modpack/ModpackProcessingStatus';
import { uploadFileWithUppy } from '@/utils/uppyUpload';

// --- Interfaces & Types ---

interface ModpackVersion {
    id: string;
    version: string;
    mcVersion: string;
    forgeVersion?: string;
    changelog?: string;
    status: string;
    releaseDate?: string;
    createdAt: string;
    updatedAt: string;
    modpack: {
        id: string;
        name: string;
        publisherId: string;
    };
    files: ModpackVersionFile[];
}

interface ModpackVersionFile {
    fileHash: string;
    path: string;
    fileType?: 'mods' | 'resourcepacks' | 'config' | 'shaderpacks' | 'extras' | 'datapacks'; // NEW: direct fileType on ModpackVersionFile
    side: 'client' | 'server' | 'both';
    file: {
        type: 'mods' | 'resourcepacks' | 'config' | 'shaderpacks' | 'extras'; // DEPRECATED: kept for backward compatibility
    };
    size?: number;
}

// --- Helper Components & Types for File Tree ---

interface FileNodeData {
    type: 'file';
    data: ModpackVersionFile;
}

interface FolderNodeData {
    type: 'folder';
    children: { [key: string]: TreeNode };
}

type TreeNode = FileNodeData | FolderNodeData;

const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'json':
            return <LucideFileJson className="h-4 w-4 mr-2 text-yellow-500 flex-shrink-0" />;
        case 'jar':
        case 'zip':
            return <LucideFileArchive className="h-4 w-4 mr-2 text-orange-500 flex-shrink-0" />;
        case 'txt':
        case 'md':
        case 'cfg':
        case 'properties':
            return <LucideFileText className="h-4 w-4 mr-2 text-blue-500 flex-shrink-0" />;
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'webp':
            return <LucideFileImage className="h-4 w-4 mr-2 text-purple-500 flex-shrink-0" />;
        default:
            return <LucideFile className="h-4 w-4 mr-2 text-gray-500 flex-shrink-0" />;
    }
};

const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Status helpers to match PublisherModpackVersionsView
const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
        case 'published': return 'default';
        case 'draft': return 'secondary';
        case 'archived': return 'outline';
        case 'deleted': return 'destructive';
        default: return 'outline';
    }
};

const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
        case 'published': return 'Publicado';
        case 'draft': return 'Borrador';
        case 'archived': return 'Archivado';
        case 'deleted': return 'Eliminado';
        default: return status;
    }
};

const FileTreeNode: React.FC<{
    name: string;
    node: TreeNode;
    expandedFolders: { [key: string]: boolean };
    setExpandedFolders: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
    path: string;
    versionStatus: string;
    onDelete: (fileHash: string, fileType: string) => void;
    onUpdateSide: (fileHash: string, fileType: string, side: 'client' | 'server' | 'both') => void;
}> = ({ name, node, expandedFolders, setExpandedFolders, path, versionStatus, onDelete, onUpdateSide }) => {
    if (node.type === 'folder') {
        const isExpanded = expandedFolders[path];
        const toggleExpand = () => setExpandedFolders(prev => ({ ...prev, [path]: !isExpanded }));

        return (
            <div>
                <div onClick={toggleExpand} className="flex items-center cursor-pointer hover:bg-white/10 p-1 rounded transition-colors group">
                    {isExpanded ? <LucideChevronDown className="h-4 w-4 mr-2 text-gray-400 group-hover:text-gray-200 flex-shrink-0" /> : <LucideChevronRight className="h-4 w-4 mr-2 text-gray-400 group-hover:text-gray-200 flex-shrink-0" />}
                    <LucideFolder className="h-4 w-4 mr-2 text-sky-500 flex-shrink-0" />
                    <span className="text-gray-200 font-medium">{name}</span>
                </div>
                {isExpanded && (
                    <div className="pl-6 border-l border-white/5 ml-2 mt-0.5">
                        {Object.entries(node.children)
                            .sort(([aName, aNode], [bName, bNode]) => {
                                if (aNode.type === 'folder' && bNode.type !== 'folder') return -1;
                                if (aNode.type !== 'folder' && bNode.type === 'folder') return 1;
                                return aName.localeCompare(bName);
                            })
                            .map(([childName, childNode]) => (
                                <FileTreeNode
                                    key={childName}
                                    name={childName}
                                    node={childNode}
                                    expandedFolders={expandedFolders}
                                    setExpandedFolders={setExpandedFolders}
                                    path={`${path}/${childName}`}
                                    versionStatus={versionStatus}
                                    onDelete={onDelete}
                                    onUpdateSide={onUpdateSide}
                                />
                            ))}
                    </div>
                )}
            </div>
        );
    }

    // It's a file
    const fileData = node.data;
    return (
        <div className="flex items-center justify-between p-1 ml-4 group hover:bg-white/10 rounded transition-colors">
            <div className="flex items-center min-w-0 flex-1">
                <div className="w-4 mr-2 flex-shrink-0"></div> {/* Indent spacer */}
                {getFileIcon(name)}
                <span className="text-gray-300 truncate text-sm" title={fileData.path}>{name}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center">
                                <Select
                                    value={fileData.side || 'both'}
                                    onValueChange={(value: any) => onUpdateSide(fileData.fileHash, fileData.fileType || fileData.file.type, value)}
                                    disabled={versionStatus === 'published'}
                                >
                                    <SelectTrigger className="h-7 w-[90px] text-[10px] px-2 bg-white/5 border-none shadow-none focus:ring-0">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="both">
                                            <div className="flex items-center gap-2">
                                                <LucideGlobe className="h-3 w-3" /> Ambos
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="client">
                                            <div className="flex items-center gap-2">
                                                <LucideMonitor className="h-3 w-3" /> Cliente
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="server">
                                            <div className="flex items-center gap-2">
                                                <LucideServer className="h-3 w-3" /> Servidor
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p className="text-xs">
                                {fileData.side === 'client' ? 'Solo se instalará en el cliente.' :
                                    fileData.side === 'server' ? 'Solo se instalará en el servidor.' :
                                        'Se instalará tanto en cliente como en servidor.'}
                            </p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                {versionStatus !== 'published' && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(fileData.fileHash, fileData.fileType || fileData.file.type)}
                        className="h-7 w-7 text-red-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    >
                        <LucideTrash2 className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
};

// --- Main Component ---

const PublisherModpackVersionDetailView: React.FC = () => {
    const { publisherId, modpackId, versionId } = useParams<{
        publisherId: string;
        modpackId: string;
        versionId: string;
    }>();

    const { sessionTokens } = useAuthentication();

    const [version, setVersion] = useState<ModpackVersion | null>(null);
    const [loading, setLoading] = useState(true);
    const [editingChangelog, setEditingChangelog] = useState(false);
    const [changelog, setChangelog] = useState('');
    const [uploadingFile, setUploadingFile] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [uploadSide, setUploadSide] = useState<'client' | 'server' | 'both'>('both');
    const [uploadDialog, setUploadDialog] = useState<{
        open: boolean;
        type: string;
        file: File | null;
        progress: number;
    }>({
        open: false,
        type: '',
        file: null,
        progress: 0
    });

    // AlertDialog states for confirmations
    const [deleteFileDialog, setDeleteFileDialog] = useState<{
        open: boolean;
        fileHash: string;
        fileType: string;
        fileName: string;
    }>({
        open: false,
        fileHash: '',
        fileType: '',
        fileName: ''
    });

    const [publishDialog, setPublishDialog] = useState(false);
    const [deleteVersionDialog, setDeleteVersionDialog] = useState(false);
    const [archiveDialog, setArchiveDialog] = useState(false);

    // New state for file reuse functionality
    const [reuseDialog, setReuseDialog] = useState<{
        open: boolean;
        type: string;
        previousFiles: Array<{
            version: string;
            versionId: string;
            files: Array<{
                fileHash: string;
                path: string;
                size: number;
                type: string;
                side: 'client' | 'server' | 'both';
            }>;
        }>;
        selectedFiles: Array<{
            versionId: string;
            fileHash: string;
            path: string;
        }>;
        loading: boolean;
    }>({
        open: false,
        type: '',
        previousFiles: [],
        selectedFiles: [],
        loading: false
    });

    // State for reuse dialog file tree expansion
    const [reuseExpandedFolders, setReuseExpandedFolders] = useState<{ [key: string]: boolean }>({});

    useEffect(() => {
        if (publisherId && modpackId && versionId) {
            fetchVersionDetails();
        }
    }, [publisherId, modpackId, versionId]);

    useEffect(() => {
        if (reuseDialog.previousFiles.length > 0) {
            const initialExpansionState: { [key: string]: boolean } = {};
            reuseDialog.previousFiles.forEach(versionData => {
                const fileTree = buildFileTree(versionData.files, reuseDialog.type);
                Object.keys(fileTree).forEach(key => {
                    if (fileTree[key].type === 'folder') {
                        initialExpansionState[`${versionData.versionId}-${key}`] = true;
                    }
                });
            });
            setReuseExpandedFolders(initialExpansionState);
        }
    }, [reuseDialog.previousFiles]);

    const fetchVersionDetails = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_ENDPOINT}/creators/${publisherId}/modpacks/${modpackId}/versions/${versionId}`, {
                headers: {
                    'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                },
            });

            if (!res.ok) {
                await handleApiError(res);
            }

            const data = await res.json();
            setVersion(data.version);
            setChangelog(data.version.changelog || '');
        } catch (error) {
            console.error('Error fetching version details:', error);
            toast.error(error instanceof Error ? error.message : 'Error al cargar los detalles de la versión');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateSide = async (fileHash: string, fileType: string, side: 'client' | 'server' | 'both') => {
        if (!version) return;

        try {
            const res = await fetch(
                `${API_ENDPOINT}/creators/${publisherId}/modpacks/${modpackId}/versions/${versionId}/files/${fileType}/${fileHash}/side`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ side }),
                }
            );

            if (!res.ok) {
                await handleApiError(res);
            }

            // Update local state
            setVersion({
                ...version,
                files: version.files.map(f =>
                    f.fileHash === fileHash && (f.fileType === fileType || f.file.type === fileType)
                        ? { ...f, side }
                        : f
                )
            });

            toast.success('Entorno del archivo actualizado');
        } catch (error) {
            console.error('Error updating file side:', error);
            toast.error(error instanceof Error ? error.message : 'Error al actualizar el entorno');
        }
    };

    const updateChangelog = async () => {
        if (!version) return;

        try {
            const res = await fetch(
                `${API_ENDPOINT}/creators/${publisherId}/modpacks/${modpackId}/versions/${versionId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ changelog }),
                }
            );

            if (!res.ok) {
                await handleApiError(res);
            }

            setVersion({ ...version, changelog });
            setEditingChangelog(false);
            toast.success('Changelog actualizado correctamente');
        } catch (error) {
            console.error('Error updating changelog:', error);
            toast.error(error instanceof Error ? error.message : 'Error al actualizar el changelog');
        }
    };

    const confirmPublishVersion = async () => {
        if (!version) return;

        setPublishing(true);
        try {
            const res = await fetch(
                `${API_ENDPOINT}/creators/${publisherId}/modpacks/${modpackId}/versions/${versionId}/publish`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                        'Content-Type': 'application/json',
                    }
                }
            );

            if (!res.ok) {
                throw new Error('Error al publicar la versión');
            }

            setVersion({ ...version, status: 'published', releaseDate: new Date().toISOString() });
            toast.success('Versión publicada correctamente');
            setPublishDialog(false);
        } catch (error) {
            console.error('Error publishing version:', error);
            toast.error('Error al publicar la versión');
        } finally {
            setPublishing(false);
        }
    };



    const confirmDeleteVersion = async () => {
        if (!version) return;

        setPublishing(true);
        try {
            const res = await fetch(
                `${API_ENDPOINT}/creators/${publisherId}/modpacks/${modpackId}/versions/${versionId}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                        'Content-Type': 'application/json',
                    }
                }
            );

            if (!res.ok) {
                throw new Error('Error al eliminar la versión');
            }

            setVersion({ ...version, status: 'deleted' });
            toast.success('Versión eliminada correctamente');
            setDeleteVersionDialog(false);
        } catch (error) {
            console.error('Error deleting version:', error);
            toast.error('Error al eliminar la versión');
        } finally {
            setPublishing(false);
        }
    };

    const confirmArchiveVersion = async () => {
        if (!version) return;

        setPublishing(true);
        try {
            const res = await fetch(
                `${API_ENDPOINT}/creators/${publisherId}/modpacks/${modpackId}/versions/${versionId}/archive`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                        'Content-Type': 'application/json',
                    }
                }
            );

            if (!res.ok) {
                throw new Error('Error al archivar la versión');
            }

            setVersion({ ...version, status: 'archived' });
            toast.success('Versión archivada correctamente');
            setArchiveDialog(false);
        } catch (error) {
            console.error('Error archiving version:', error);
            toast.error('Error al archivar la versión');
        } finally {
            setPublishing(false);
        }
    };

    const handleFileUpload = async (file: File, type: string) => {
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.zip') && !file.name.toLowerCase().endsWith('.rar') && !file.name.toLowerCase().endsWith('.7z')) {
            toast.error('Solo se permiten archivos ZIP, RAR o 7z');
            return;
        }

        setUploadingFile(true);
        setUploadDialog(prev => ({ ...prev, progress: 0 }));

        try {
            await uploadFileWithUppy({
                file,
                endpoint: `${API_ENDPOINT}/creators/${publisherId}/modpacks/${modpackId}/versions/${versionId}/files/${type}`,
                headers: {
                    'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                },
                fieldName: 'file',
                formData: {
                    side: uploadSide
                },
                onProgress: (percentComplete) => {
                    setUploadDialog(prev => ({ ...prev, progress: percentComplete }));
                },
                onSuccess: () => {
                    setUploadDialog(prev => ({ ...prev, progress: 100 }));
                    toast.success('Archivo subido correctamente');
                    fetchVersionDetails();
                },
                onError: (error) => {
                    let message = error.message || 'Error al subir el archivo';

                    // Try to parse error message if it contains API error details
                    try {
                        const errorData = JSON.parse(error.message);
                        if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
                            message = errorData.errors.map((err: any) => err.detail || err.title || err.code || JSON.stringify(err)).join('; ');
                        }
                    } catch (e) {
                        // Keep original message if parsing fails
                    }

                    toast.error(message);
                }
            });
        } catch (error) {
            console.error('Error uploading file:', error);
            toast.error(error instanceof Error ? error.message : 'Error al subir el archivo');
        } finally {
            setUploadingFile(false);
            setUploadDialog(prev => ({ ...prev, open: false, file: null, progress: 0 }));
            setUploadSide('both');
        }
    };

    const deleteFile = (fileHash: string, fileType: string) => {
        // Find file name for display in confirmation dialog
        const fileName = version?.files.find(f => f.fileHash === fileHash)?.path || 'archivo';
        setDeleteFileDialog({
            open: true,
            fileHash,
            fileType,
            fileName
        });
    };

    const confirmDeleteFile = async () => {
        const { fileHash, fileType } = deleteFileDialog;
        try {
            const res = await fetch(
                `${API_ENDPOINT}/creators/${publisherId}/modpacks/${modpackId}/versions/${versionId}/files/${fileType}/${fileHash}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                    },
                }
            );

            if (!res.ok) {
                await handleApiError(res);
                return;
            }

            toast.success('Archivo eliminado correctamente');
            fetchVersionDetails();
            setDeleteFileDialog({ open: false, fileHash: '', fileType: '', fileName: '' });
        } catch (error) {
            console.error('Error deleting file:', error);
            toast.error(error instanceof Error ? error.message : 'Error al eliminar el archivo');
        }
    };

    // Drag and drop handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = async (e: React.DragEvent, type: string) => {
        e.preventDefault();
        e.stopPropagation();

        if (version?.status === 'published') return;

        const files = Array.from(e.dataTransfer.files);
        const zipFile = files.find(file => file.name.toLowerCase().endsWith('.zip'));

        if (zipFile) {
            setUploadDialog({ open: true, type, file: zipFile, progress: 0 });
        } else {
            toast.error('Solo se permiten archivos ZIP');
        }
    };

    const openUploadDialog = (type: string) => {
        setUploadDialog(prev => ({ ...prev, open: true, type, file: null }));
    };

    const openReuseDialog = async (type: string) => {
        setReuseDialog(prev => ({ ...prev, open: true, type, loading: true }));

        try {
            const res = await fetch(`${API_ENDPOINT}/creators/${publisherId}/modpacks/${modpackId}/versions/${versionId}/previous-files/${type}`, {
                headers: {
                    'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                },
            });

            if (!res.ok) {
                await handleApiError(res);
                setReuseDialog(prev => ({ ...prev, open: false, loading: false }));
                return;
            }

            const data = await res.json();
            setReuseDialog(prev => ({
                ...prev,
                previousFiles: data.previousFiles || [],
                selectedFiles: [],
                loading: false
            }));
        } catch (error) {
            console.error('Error fetching previous files:', error);
            toast.error('Error al cargar archivos anteriores');
            setReuseDialog(prev => ({ ...prev, open: false, loading: false }));
        }
    };

    const toggleFileSelection = (versionId: string, fileHash: string, path: string) => {
        const fileIdentifier = { versionId, fileHash, path };
        setReuseDialog(prev => ({
            ...prev,
            selectedFiles: prev.selectedFiles.some(f => f.versionId === versionId && f.fileHash === fileHash && f.path === path)
                ? prev.selectedFiles.filter(f => !(f.versionId === versionId && f.fileHash === fileHash && f.path === path))
                : [...prev.selectedFiles, fileIdentifier]
        }));
    };

    const toggleFolderSelection = (_folderPath: string, fileHashes: string[], versionId?: string) => {
        // For folder selection, prefer selecting files within the given versionId
        // If no versionId is provided, fall back to searching across all previous versions.
        const folderFiles: Array<{ versionId: string, fileHash: string, path: string }> = [];

        if (versionId) {
            const versionData = reuseDialog.previousFiles.find(v => v.versionId === versionId);
            if (versionData) {
                versionData.files.forEach(file => {
                    if (fileHashes.includes(file.fileHash)) {
                        folderFiles.push({
                            versionId: versionData.versionId,
                            fileHash: file.fileHash,
                            path: file.path
                        });
                    }
                });
            }
        } else {
            reuseDialog.previousFiles.forEach(versionData => {
                versionData.files.forEach(file => {
                    if (fileHashes.includes(file.fileHash)) {
                        folderFiles.push({
                            versionId: versionData.versionId,
                            fileHash: file.fileHash,
                            path: file.path
                        });
                    }
                });
            });
        }



        setReuseDialog(prev => {
            const currentlySelected = prev.selectedFiles;
            const isAllSelected = folderFiles.length > 0 && folderFiles.every(ff =>
                currentlySelected.some(f =>
                    f.versionId === ff.versionId &&
                    f.fileHash === ff.fileHash &&
                    f.path === ff.path
                )
            );

            const newSelected = isAllSelected
                ? currentlySelected.filter(f =>
                    !folderFiles.some(ff =>
                        ff.versionId === f.versionId &&
                        ff.fileHash === f.fileHash &&
                        ff.path === f.path
                    )
                )
                : [...currentlySelected, ...folderFiles.filter(ff =>
                    !currentlySelected.some(f =>
                        f.versionId === ff.versionId &&
                        f.fileHash === ff.fileHash &&
                        f.path === f.path
                    )
                )];

            return { ...prev, selectedFiles: newSelected };
        });
    };


    const deselectAllFiles = () => {
        setReuseDialog(prev => ({ ...prev, selectedFiles: [] }));
    };

    const buildFileTree = (files: Array<{ fileHash: string; path: string; size: number; side?: 'client' | 'server' | 'both' }>, type: string): { [key: string]: TreeNode } => {
        const tree: { [key: string]: TreeNode } = {};
        files.forEach(fileEntry => {
            const pathParts = fileEntry.path.split('/');
            let currentLevel: any = tree;
            pathParts.forEach((part, index) => {
                if (index === pathParts.length - 1) {
                    // It's a file
                    const modpackFile: ModpackVersionFile = {
                        fileHash: fileEntry.fileHash,
                        path: fileEntry.path,
                        fileType: type as any, // NEW: Set fileType directly
                        side: fileEntry.side || 'both',
                        file: { type: type as any }, // Keep for backward compatibility
                        size: fileEntry.size
                    };
                    currentLevel[part] = { type: 'file', data: modpackFile };
                } else {
                    if (!currentLevel[part]) {
                        currentLevel[part] = { type: 'folder', children: {} };
                    }
                    currentLevel = currentLevel[part].children;
                }
            });
        });
        return tree;
    };

    const confirmFileReuse = async () => {
        // Build unique list of { versionId, fileHash }
        const uniquePairsMap = new Map<string, { versionId: string; fileHash: string }>();
        reuseDialog.selectedFiles.forEach(f => {
            const key = `${f.versionId}::${f.fileHash}`;
            if (!uniquePairsMap.has(key)) uniquePairsMap.set(key, { versionId: f.versionId, fileHash: f.fileHash });
        });

        const fileRefs = Array.from(uniquePairsMap.values());

        if (fileRefs.length === 0) {
            toast.error('Selecciona al menos un archivo para reutilizar');
            return;
        }

        try {
            const res = await fetch(`${API_ENDPOINT}/creators/${publisherId}/modpacks/${modpackId}/versions/${versionId}/reuse-files/${reuseDialog.type}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ fileRefs })
            });

            if (!res.ok) {
                await handleApiError(res);
                return;
            }

            toast.success(`Añadidos ${fileRefs.length} archivo(s) de versiones anteriores (sin reemplazar existentes)`);
            fetchVersionDetails();
            setReuseDialog(prev => ({ ...prev, open: false, selectedFiles: [] }));
        } catch (error) {
            console.error('Error reusing files:', error);
            toast.error(error instanceof Error ? error.message : 'Error al reutilizar archivos');
        }
    };

    const SelectableFileTreeNode: React.FC<{
        name: string;
        node: TreeNode;
        expandedFolders: { [key: string]: boolean };
        setExpandedFolders: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
        path: string;
        selectedFiles: Array<{
            versionId: string;
            fileHash: string;
            path: string;
        }>;
        onToggleSelection: (versionId: string, fileHash: string, path: string) => void;
        onToggleFolderSelection: (folderPath: string, fileHashes: string[], versionId?: string) => void;
        versionId?: string; // Add versionId for identification
    }> = ({ name, node, expandedFolders, setExpandedFolders, path, selectedFiles, onToggleSelection, onToggleFolderSelection, versionId }) => {
        if (node.type === 'folder') {
            const isExpanded = expandedFolders[path];
            const toggleExpand = () => setExpandedFolders(prev => ({ ...prev, [path]: !isExpanded }));

            // Get all file hashes in this folder recursively
            const getAllFileHashes = (folderNode: FolderNodeData): string[] => {
                const hashes: string[] = [];
                Object.values(folderNode.children).forEach(child => {
                    if (child.type === 'file') {
                        hashes.push(child.data.fileHash);
                    } else {
                        hashes.push(...getAllFileHashes(child));
                    }
                });
                return hashes;
            };

            const folderFileHashes = getAllFileHashes(node);
            const allSelected = folderFileHashes.length > 0 && folderFileHashes.every(hash =>
                selectedFiles.some(f => f.fileHash === hash && f.versionId === versionId)
            );
            const someSelected = folderFileHashes.some(hash =>
                selectedFiles.some(f => f.fileHash === hash && f.versionId === versionId)
            );

            const handleFolderCheckboxChange = () => {
                onToggleFolderSelection(path, folderFileHashes, versionId);
            };

            return (
                <div>
                    <div className="flex items-center cursor-pointer hover:bg-white/5 p-1 rounded transition-colors group">
                        <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => {
                                if (el) el.indeterminate = someSelected && !allSelected;
                            }}
                            onChange={handleFolderCheckboxChange}
                            className="mr-2 rounded border-white/20 bg-transparent"
                        />
                        <div onClick={toggleExpand} className="flex items-center flex-1">
                            {isExpanded ? <LucideChevronDown className="h-4 w-4 mr-2 text-gray-400 group-hover:text-gray-200 flex-shrink-0" /> : <LucideChevronRight className="h-4 w-4 mr-2 text-gray-400 group-hover:text-gray-200 flex-shrink-0" />}
                            <LucideFolder className="h-4 w-4 mr-2 text-sky-500 flex-shrink-0" />
                            <span className="text-gray-200 font-medium">{name}</span>
                            <span className="text-xs text-gray-400 ml-2">({folderFileHashes.length})</span>
                        </div>
                    </div>
                    {isExpanded && (
                        <div className="pl-6 border-l border-white/5 ml-2">
                            {Object.entries(node.children)
                                .sort(([aName, aNode], [bName, bNode]) => {
                                    if (aNode.type === 'folder' && bNode.type !== 'folder') return -1;
                                    if (aNode.type !== 'folder' && bNode.type === 'folder') return 1;
                                    return aName.localeCompare(bName);
                                })
                                .map(([childName, childNode]) => (
                                    <SelectableFileTreeNode
                                        key={childName}
                                        name={childName}
                                        node={childNode}
                                        expandedFolders={expandedFolders}
                                        setExpandedFolders={setExpandedFolders}
                                        path={`${path}/${childName}`}
                                        selectedFiles={selectedFiles}
                                        onToggleSelection={onToggleSelection}
                                        onToggleFolderSelection={onToggleFolderSelection}
                                        versionId={versionId} // Pass versionId for identification
                                    />
                                ))}
                        </div>
                    )}
                </div>
            );
        }

        // It's a file
        const fileData = node.data;
        const isSelected = selectedFiles.some(f =>
            f.versionId === versionId &&
            f.fileHash === fileData.fileHash &&
            f.path === fileData.path
        );

        return (
            <div className="flex items-center justify-between p-1 ml-4 group hover:bg-white/5 rounded transition-colors">
                <div className="flex items-center min-w-0 flex-1">
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelection(versionId!, fileData.fileHash, fileData.path)}
                        className="mr-2 rounded border-white/20 bg-transparent flex-shrink-0"
                    />
                    <div className="w-4 mr-2 flex-shrink-0"></div> {/* Indent spacer */}
                    {getFileIcon(name)}
                    <span
                        className="text-gray-300 truncate text-sm"
                        title={`Versión: ${versionId} - Path: ${fileData.path}`} // Show versionId and full path on hover
                    >
                        {name}
                    </span>
                </div>
                <div className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
                    {formatFileSize(fileData.size || 0)}
                </div>
            </div>
        );
    };

    const FileTypeManager: React.FC<{
        title: string;
        description: string;
        type: 'mods' | 'resourcepacks' | 'config' | 'shaderpacks' | 'extras';
        files: ModpackVersionFile[];
        icon: React.ReactNode;
        versionStatus: string;
        onDeleteFile: (fileHash: string, fileType: string) => void;
        onUpdateSide: (fileHash: string, fileType: string, side: 'client' | 'server' | 'both') => void;
    }> = ({ title, description, type, files, icon, versionStatus, onDeleteFile, onUpdateSide }) => {
        const [expandedFolders, setExpandedFolders] = useState<{ [key: string]: boolean }>({});

        const filteredFiles = files.filter(file => {
            // Prefer fileType from ModpackVersionFile, fallback to file.type for backward compatibility
            const fileType = file.fileType || file.file?.type;
            return fileType === type;
        });

        const fileTree = useMemo(() => {
            const buildFileTree = (filesToProcess: ModpackVersionFile[]): { [key: string]: TreeNode } => {
                const tree: { [key: string]: TreeNode } = {};
                filesToProcess.forEach(fileData => {
                    const pathParts = fileData.path.split('/');
                    let currentLevel: any = tree;
                    pathParts.forEach((part, index) => {
                        if (index === pathParts.length - 1) {
                            currentLevel[part] = { type: 'file', data: fileData };
                        } else {
                            if (!currentLevel[part]) {
                                currentLevel[part] = { type: 'folder', children: {} };
                            }
                            currentLevel = currentLevel[part].children;
                        }
                    });
                });
                return tree;
            };
            return buildFileTree(filteredFiles);
        }, [filteredFiles]);

        useEffect(() => {
            setExpandedFolders(prev => {
                const newState = { ...prev };
                let hasChanges = false;

                Object.keys(fileTree).forEach(key => {
                    if (fileTree[key].type === 'folder' && !(key in newState)) {
                        newState[key] = true; // Default to expanded for new folders
                        hasChanges = true;
                    }
                });

                return hasChanges ? newState : prev;
            });
        }, [fileTree]);

        return (
            <div
                className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, type)}
            >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            {icon}
                            <h3 className="text-lg font-semibold text-white">{title}</h3>
                        </div>
                        <p className="text-sm text-gray-400">{description}</p>
                    </div>
                    {versionStatus === 'draft' && (
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => openReuseDialog(type)} disabled={uploadingFile} className="h-9">
                                <LucidePackage className="h-4 w-4 mr-2" /> Reutilizar
                            </Button>
                            <Button size="sm" onClick={() => openUploadDialog(type)} disabled={uploadingFile} className="h-9">
                                <LucideUpload className="h-4 w-4 mr-2" /> Subir ZIP
                            </Button>
                        </div>
                    )}
                </div>

                <div className="bg-black/20 rounded-xl border border-white/5 p-4 min-h-[400px]">
                    {filteredFiles.length > 0 ? (
                        <div className="space-y-1 font-mono text-xs overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                            {Object.entries(fileTree)
                                .sort(([aName, aNode], [bName, bNode]) => {
                                    if (aNode.type === 'folder' && bNode.type !== 'folder') return -1;
                                    if (aNode.type !== 'folder' && bNode.type === 'folder') return 1;
                                    return aName.localeCompare(bName);
                                })
                                .map(([name, node]) => (
                                    <FileTreeNode
                                        key={name}
                                        name={name}
                                        node={node}
                                        expandedFolders={expandedFolders}
                                        setExpandedFolders={setExpandedFolders}
                                        path={name}
                                        versionStatus={versionStatus}
                                        onDelete={onDeleteFile}
                                        onUpdateSide={onUpdateSide}
                                    />
                                ))}
                        </div>
                    ) : (
                        <div className="h-[400px] flex flex-col items-center justify-center text-center p-8">
                            <div className="bg-white/5 p-6 rounded-full mb-4">
                                <LucideUpload className="h-10 w-10 text-gray-500" />
                            </div>
                            <h4 className="text-gray-300 font-medium mb-1">No hay archivos aún</h4>
                            <p className="text-sm text-gray-500 max-w-[250px]">
                                {versionStatus !== 'published'
                                    ? "Sube un archivo ZIP o reutiliza archivos de versiones anteriores para comenzar."
                                    : "Esta versión no contiene archivos en esta categoría."}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!version) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-200 mb-2">Versión no encontrada</h2>
                    <p className="text-gray-500">La versión que buscas no existe o no tienes permisos para verla.</p>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* AlertDialog for Delete File Confirmation */}
            <AlertDialog open={deleteFileDialog.open} onOpenChange={(open) => setDeleteFileDialog(prev => ({ ...prev, open }))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará permanentemente el archivo "{deleteFileDialog.fileName}" de esta versión.
                            No podrás deshacer esta operación.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteFile} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Eliminar Archivo
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* AlertDialog for Archive Confirmation */}
            <AlertDialog open={archiveDialog} onOpenChange={setArchiveDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Archivar esta versión?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Archivar la versión {version.version} la retirará de la lista pública pero conservará los datos.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={publishing}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmArchiveVersion} className="bg-primary text-primary-foreground hover:bg-primary/90">
                            Archivar Versión
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* AlertDialog for Publish Confirmation */}
            <AlertDialog open={publishDialog} onOpenChange={setPublishDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Publicar esta versión?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción hará que la versión {version.version} esté disponible públicamente.
                            Una vez publicada, no podrás editar archivos o el changelog hasta que la despubliques.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={publishing}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmPublishVersion}
                            disabled={publishing}
                            className="bg-green-600 text-white hover:bg-green-700"
                        >
                            {publishing ? 'Publicando...' : 'Confirmar y Publicar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>



            {/* AlertDialog for Delete Version Confirmation */}
            <AlertDialog open={deleteVersionDialog} onOpenChange={setDeleteVersionDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar esta versión?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esto marcará la versión {version.version} como eliminada de forma permanente. No se podrá restaurar.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={publishing}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteVersion} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Eliminar Versión
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Upload Dialog */}
            <Dialog open={uploadDialog.open} onOpenChange={(open) => setUploadDialog(prev => ({ ...prev, open }))}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Subir archivo ZIP</DialogTitle>
                        <DialogDescription>
                            Selecciona un archivo ZIP para subir a la sección de {uploadDialog.type}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {!uploadDialog.file ? (
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                                <Input
                                    type="file"
                                    accept=".zip,.rar,.7z"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            setUploadDialog(prev => ({ ...prev, file }));
                                        }
                                    }}
                                    className="hidden"
                                    id="file-upload"
                                />
                                <label htmlFor="file-upload" className="cursor-pointer">
                                    <LucideUpload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                                    <p className="text-sm text-gray-600">Selecciona un archivo ZIP</p>
                                    <p className="text-xs text-gray-400 mt-1">O haz clic aquí para seleccionar</p>
                                </label>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                                    <LucideFile className="h-5 w-5 text-gray-500" />
                                    <span className="text-sm font-medium text-gray-700">{uploadDialog.file.name}</span>
                                    <span className="text-xs text-gray-500 ml-auto">
                                        {formatFileSize(uploadDialog.file.size)}
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <LucideMonitor className="h-3.5 w-3.5" /> Entorno de instalación
                                    </label>
                                    <Select value={uploadSide} onValueChange={(v: any) => setUploadSide(v)}>
                                        <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                                            <SelectValue placeholder="Seleccionar entorno" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="both">
                                                <div className="flex items-center gap-2">
                                                    <LucideGlobe className="h-4 w-4" /> Ambos (Cliente y Servidor)
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="client">
                                                <div className="flex items-center gap-2">
                                                    <LucideMonitor className="h-4 w-4" /> Solo Cliente
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="server">
                                                <div className="flex items-center gap-2">
                                                    <LucideServer className="h-4 w-4" /> Solo Servidor
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-gray-400">
                                        Define dónde se instalarán los archivos contenidos en este ZIP.
                                    </p>
                                </div>

                                {uploadingFile && (
                                    <div className="space-y-2">
                                        <Progress value={uploadDialog.progress} />
                                        <p className="text-xs text-center text-gray-500">
                                            Subiendo... {uploadDialog.progress}%
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setUploadDialog(prev => ({ ...prev, open: false, file: null }))}
                            disabled={uploadingFile}
                        >
                            Cancelar
                        </Button>
                        {uploadDialog.file && !uploadingFile && (
                            <Button onClick={() => handleFileUpload(uploadDialog.file!, uploadDialog.type)}>
                                <LucideUpload className="h-4 w-4 mr-2" />
                                Subir Archivo
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* File Reuse Dialog */}
            <Dialog open={reuseDialog.open} onOpenChange={(open) => setReuseDialog(prev => ({ ...prev, open }))}>
                <DialogContent className="sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Reutilizar archivos de versiones anteriores</DialogTitle>
                        <DialogDescription>
                            Selecciona archivos de versiones anteriores para reutilizar en la sección de {reuseDialog.type}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 max-h-96 overflow-y-auto">
                        {reuseDialog.loading ? (
                            <p className="text-center text-gray-500">Cargando versiones anteriores...</p>
                        ) : reuseDialog.previousFiles.length === 0 ? (
                            <p className="text-center text-gray-500">
                                No hay archivos de tipo {reuseDialog.type} en versiones anteriores.
                            </p>
                        ) : (
                            reuseDialog.previousFiles.map(versionData => {
                                const fileTree = buildFileTree(versionData.files, reuseDialog.type);
                                return (
                                    <div key={versionData.versionId} className="border rounded-lg p-4">
                                        <h4 className="font-medium text-sm mb-3 text-gray-700">
                                            Versión {versionData.version} ({versionData.files.length} archivos)
                                        </h4>
                                        <div className="space-y-1 font-mono text-xs max-h-48 overflow-y-auto">
                                            {Object.entries(fileTree)
                                                .sort(([aName, aNode], [bName, bNode]) => {
                                                    if (aNode.type === 'folder' && bNode.type !== 'folder') return -1;
                                                    if (aNode.type !== 'folder' && bNode.type === 'folder') return 1;
                                                    return aName.localeCompare(bName);
                                                })
                                                .map(([name, node]) => (
                                                    <SelectableFileTreeNode
                                                        key={`${versionData.versionId}-${name}`}
                                                        name={name}
                                                        node={node}
                                                        expandedFolders={reuseExpandedFolders}
                                                        setExpandedFolders={setReuseExpandedFolders}
                                                        path={`${versionData.versionId}-${name}`}
                                                        selectedFiles={reuseDialog.selectedFiles}
                                                        onToggleSelection={toggleFileSelection}
                                                        onToggleFolderSelection={toggleFolderSelection}
                                                        versionId={versionData.versionId} // Pass versionId for identification
                                                    />
                                                ))
                                            }
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <DialogFooter className="flex-wrap justify-between items-center gap-2 pt-4 border-t">
                        <div className="flex items-center space-x-4">
                            <div className="text-sm text-gray-600">
                                {reuseDialog.selectedFiles.length} archivo(s) seleccionado(s)
                            </div>
                            {(() => {
                                const noneSelected = reuseDialog.selectedFiles.length === 0;
                                return (
                                    <>
                                        {!noneSelected && (
                                            <Button variant="outline" size="sm" onClick={deselectAllFiles}>
                                                Deseleccionar todo
                                            </Button>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                        <div className="space-x-2">
                            <Button
                                variant="outline"
                                onClick={() => setReuseDialog(prev => ({ ...prev, open: false }))}
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={confirmFileReuse}
                                disabled={reuseDialog.selectedFiles.length === 0}
                            >
                                Reutilizar {reuseDialog.selectedFiles.length} archivo(s)
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="space-y-6">
                {/* Header with improved hierarchy */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold text-white tracking-tight">{version.modpack.name}</h1>
                            <Badge variant={getStatusBadgeVariant(version.status)} className="px-3 py-0.5">
                                {getStatusLabel(version.status)}
                            </Badge>
                        </div>
                        <p className="text-gray-400 flex items-center gap-2">
                            Versión <code className="bg-white/5 px-1.5 py-0.5 rounded text-sky-400 font-mono text-sm">{version.version}</code>
                            <span className="text-gray-600">•</span>
                            <span className="text-sm">Enviada el {new Date(version.createdAt).toLocaleDateString()}</span>
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {version.status === 'draft' && (
                            <Button
                                onClick={() => setPublishDialog(true)}
                                disabled={publishing}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20"
                            >
                                <LucideSend className="h-4 w-4 mr-2" />
                                {publishing ? 'Publicando...' : 'Publicar Versión'}
                            </Button>
                        )}

                        {version.status === 'published' && (
                            <Button
                                onClick={() => setArchiveDialog(true)}
                                disabled={publishing}
                                variant="outline"
                                className="border-sky-500/30 text-sky-400 hover:bg-sky-500/10"
                            >
                                <LucideFolder className="h-4 w-4 mr-2" />
                                Archivar
                            </Button>
                        )}

                        {version.status === 'archived' && (
                            <Button
                                onClick={() => setDeleteVersionDialog(true)}
                                disabled={publishing}
                                variant="destructive"
                                className="shadow-lg shadow-red-900/20"
                            >
                                <LucideTrash2 className="h-4 w-4 mr-2" />
                                Eliminar Permanentemente
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Sidebar / Info Column - Moved to Left for better attention to settings */}
                    <div className="lg:col-span-4 space-y-6 order-2 lg:order-1">
                        {/* Processing Status - Always visible on top of sidebar */}
                        <ModpackProcessingStatus
                            modpackId={modpackId!}
                            versionId={versionId!}
                            token={sessionTokens?.accessToken}
                            showConnectionStatus={true}
                            onCompleted={() => {
                                toast.success('Procesamiento completado exitosamente');
                                fetchVersionDetails(); // Refresh version data
                            }}
                            onError={(error) => {
                                toast.error(`Error en el procesamiento: ${error}`);
                            }}
                        />

                        {/* Version Info Card */}
                        <Card className="bg-white/5 border-white/10 overflow-hidden">
                            <CardHeader className="pb-3 border-b border-white/5">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-400 uppercase tracking-wider">
                                    <LucideInfo className="h-4 w-4" /> Detalles Técnicos
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Minecraft</p>
                                        <p className="text-lg font-medium text-white">{version.mcVersion}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Loader</p>
                                        <p className="text-lg font-medium text-white">{version.forgeVersion || 'Vanilla'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Archivos</p>
                                        <p className="text-lg font-medium text-white">{version.files?.length || 0}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Estado</p>
                                        <p className="text-lg font-medium text-white capitalize">{version.status}</p>
                                    </div>
                                </div>
                                <Separator className="bg-white/5" />
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500">Creado</span>
                                        <span className="text-gray-300 font-medium">{new Date(version.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    {version.releaseDate && (
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-500">Publicado</span>
                                            <span className="text-gray-300 font-medium">{new Date(version.releaseDate).toLocaleDateString()}</span>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Changelog Card */}
                        <Card className="bg-white/5 border-white/10">
                            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-400 uppercase tracking-wider">
                                    <LucideFileText className="h-4 w-4" /> Changelog
                                </CardTitle>
                                {version.status === 'draft' && !editingChangelog && (
                                    <Button variant="ghost" size="icon" onClick={() => setEditingChangelog(true)} className="h-6 w-6 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10">
                                        <LucideEdit2 className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent>
                                {editingChangelog ? (
                                    <div className="space-y-3">
                                        <Textarea
                                            value={changelog}
                                            onChange={(e) => setChangelog(e.target.value)}
                                            placeholder="¿Qué ha cambiado?"
                                            rows={8}
                                            className="bg-black/40 border-white/10 focus:ring-sky-500 text-sm"
                                        />
                                        <div className="flex gap-2 justify-end">
                                            <Button variant="ghost" size="sm" onClick={() => { setEditingChangelog(false); setChangelog(version.changelog || ''); }}>
                                                Cancelar
                                            </Button>
                                            <Button size="sm" onClick={updateChangelog} className="bg-sky-600 hover:bg-sky-700">
                                                <LucideSave className="h-3 w-3 mr-2" /> Guardar
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-300 whitespace-pre-wrap font-sans bg-black/20 p-4 rounded-lg border border-white/5 max-h-60 overflow-auto custom-scrollbar italic leading-relaxed">
                                        {version.changelog || 'No se ha proporcionado un registro de cambios.'}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Main Content Column (Tabs) */}
                    <div className="lg:col-span-8 space-y-6 order-1 lg:order-2">
                        <Card className="border-white/10 bg-white/5 overflow-hidden">
                            <Tabs defaultValue="mods" className="w-full">
                                <div className="px-6 pt-6 pb-2 border-b border-white/5 bg-black/20">
                                    <TabsList className="bg-white/5 border border-white/10 p-1 w-full justify-start overflow-x-auto h-auto no-scrollbar">
                                        <TabsTrigger value="mods" className="flex items-center gap-2 py-2 data-[state=active]:bg-sky-600 data-[state=active]:text-white transition-all">
                                            <LucidePackage className="h-4 w-4" /> Mods
                                        </TabsTrigger>
                                        <TabsTrigger value="resourcepacks" className="flex items-center gap-2 py-2 data-[state=active]:bg-sky-600 data-[state=active]:text-white transition-all">
                                            <LucideImage className="h-4 w-4" /> Resources
                                        </TabsTrigger>
                                        <TabsTrigger value="config" className="flex items-center gap-2 py-2 data-[state=active]:bg-sky-600 data-[state=active]:text-white transition-all">
                                            <LucideSettings className="h-4 w-4" /> Config
                                        </TabsTrigger>
                                        <TabsTrigger value="shaderpacks" className="flex items-center gap-2 py-2 data-[state=active]:bg-sky-600 data-[state=active]:text-white transition-all">
                                            <LucidePalette className="h-4 w-4" /> Shaders
                                        </TabsTrigger>
                                        <TabsTrigger value="extras" className="flex items-center gap-2 py-2 data-[state=active]:bg-sky-600 data-[state=active]:text-white transition-all">
                                            <LucideFolder className="h-4 w-4" /> Extras
                                        </TabsTrigger>
                                    </TabsList>
                                </div>

                                <CardContent className="pt-8">
                                    <TabsContent value="mods" className="mt-0 outline-none">
                                        <FileTypeManager
                                            title="Mods"
                                            description="Modificaciones de jugabilidad (.jar)"
                                            type="mods"
                                            files={version.files || []}
                                            icon={<LucidePackage className="h-5 w-5 text-sky-400" />}
                                            versionStatus={version.status}
                                            onDeleteFile={deleteFile}
                                            onUpdateSide={handleUpdateSide}
                                        />
                                    </TabsContent>
                                    <TabsContent value="resourcepacks" className="mt-0 outline-none">
                                        <FileTypeManager
                                            title="Resource Packs"
                                            description="Paquetes de texturas y sonidos (.zip)"
                                            type="resourcepacks"
                                            files={version.files || []}
                                            icon={<LucideImage className="h-5 w-5 text-sky-400" />}
                                            versionStatus={version.status}
                                            onDeleteFile={deleteFile}
                                            onUpdateSide={handleUpdateSide}
                                        />
                                    </TabsContent>
                                    <TabsContent value="config" className="mt-0 outline-none">
                                        <FileTypeManager
                                            title="Configs"
                                            description="Archivos de configuración del servidor y mods"
                                            type="config"
                                            files={version.files || []}
                                            icon={<LucideSettings className="h-5 w-5 text-sky-400" />}
                                            versionStatus={version.status}
                                            onDeleteFile={deleteFile}
                                            onUpdateSide={handleUpdateSide}
                                        />
                                    </TabsContent>
                                    <TabsContent value="shaderpacks" className="mt-0 outline-none">
                                        <FileTypeManager
                                            title="Shader Packs"
                                            description="Mejoras visuales y sombreadores"
                                            type="shaderpacks"
                                            files={version.files || []}
                                            icon={<LucidePalette className="h-5 w-5 text-sky-400" />}
                                            versionStatus={version.status}
                                            onDeleteFile={deleteFile}
                                            onUpdateSide={handleUpdateSide}
                                        />
                                    </TabsContent>
                                    <TabsContent value="extras" className="mt-0 outline-none">
                                        <FileTypeManager
                                            title="Extras"
                                            description="Archivos adicionales en la raíz (.minecraft)"
                                            type="extras"
                                            files={version.files || []}
                                            icon={<LucideFolder className="h-5 w-5 text-sky-400" />}
                                            versionStatus={version.status}
                                            onDeleteFile={deleteFile}
                                            onUpdateSide={handleUpdateSide}
                                        />
                                    </TabsContent>
                                </CardContent>
                            </Tabs>
                        </Card>
                    </div>
                </div>
            </div>
        </>
    );
};

export default PublisherModpackVersionDetailView;