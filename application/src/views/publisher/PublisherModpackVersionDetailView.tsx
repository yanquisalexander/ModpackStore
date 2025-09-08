import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    LucideFileImage
} from 'lucide-react';
import { toast } from 'sonner';
import { API_ENDPOINT } from '@/consts';
import { useAuthentication } from '@/stores/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { handleApiError } from '@/lib/utils';
import { ModpackProcessingStatus } from '@/components/modpack/ModpackProcessingStatus';

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
    file: {
        type: 'mods' | 'resourcepacks' | 'config' | 'shaderpacks' | 'extras';
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
}> = ({ name, node, expandedFolders, setExpandedFolders, path, versionStatus, onDelete }) => {
    if (node.type === 'folder') {
        const isExpanded = expandedFolders[path];
        const toggleExpand = () => setExpandedFolders(prev => ({ ...prev, [path]: !isExpanded }));

        return (
            <div>
                <div onClick={toggleExpand} className="flex items-center cursor-pointer hover:bg-gray-100 p-1 rounded transition-colors">
                    {isExpanded ? <LucideChevronDown className="h-4 w-4 mr-2 text-gray-600 flex-shrink-0" /> : <LucideChevronRight className="h-4 w-4 mr-2 text-gray-600 flex-shrink-0" />}
                    <LucideFolder className="h-4 w-4 mr-2 text-sky-600 flex-shrink-0" />
                    <span className="text-gray-200 font-medium">{name}</span>
                </div>
                {isExpanded && (
                    <div className="pl-6 border-l border-gray-200 ml-2">
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
        <div className="flex items-center justify-between p-1 ml-4 group hover:bg-gray-100 rounded">
            <div className="flex items-center min-w-0">
                <div className="w-4 mr-2 flex-shrink-0"></div> {/* Indent spacer */}
                {getFileIcon(name)}
                <span className="text-gray-400 truncate" title={fileData.path}>{name}</span>
            </div>
            {versionStatus !== 'published' && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(fileData.fileHash, fileData.file.type)}
                    className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-100 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                >
                    <LucideTrash2 className="h-4 w-4" />
                </Button>
            )}
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
            const res = await fetch(`${API_ENDPOINT}/creators/publishers/${publisherId}/modpacks/${modpackId}/versions/${versionId}`, {
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

    const updateChangelog = async () => {
        if (!version) return;

        try {
            const res = await fetch(
                `${API_ENDPOINT}/creators/publishers/${publisherId}/modpacks/${modpackId}/versions/${versionId}`,
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
                `${API_ENDPOINT}/creators/publishers/${publisherId}/modpacks/${modpackId}/versions/${versionId}/publish`,
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
                `${API_ENDPOINT}/creators/publishers/${publisherId}/modpacks/${modpackId}/versions/${versionId}`,
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
                `${API_ENDPOINT}/creators/publishers/${publisherId}/modpacks/${modpackId}/versions/${versionId}/archive`,
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

        if (!file.name.toLowerCase().endsWith('.zip')) {
            toast.error('Solo se permiten archivos ZIP');
            return;
        }

        setUploadingFile(true);
        setUploadDialog(prev => ({ ...prev, progress: 0 }));

        return new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const percentComplete = Math.round((event.loaded / event.total) * 100);
                    setUploadDialog(prev => ({ ...prev, progress: percentComplete }));
                }
            });

            xhr.addEventListener('load', () => {
                const isSuccess = xhr.status >= 200 && xhr.status < 300;
                let parsed: any = null;
                try {
                    if (xhr.responseText) {
                        parsed = JSON.parse(xhr.responseText);
                    }
                } catch (e) { /* ignore parse errors */ }

                if (isSuccess) {
                    setUploadDialog(prev => ({ ...prev, progress: 100 }));
                    toast.success('Archivo subido correctamente');
                    fetchVersionDetails();
                    resolve();
                } else {
                    let message = `Error ${xhr.status}`;
                    if (parsed && parsed.errors && Array.isArray(parsed.errors) && parsed.errors.length > 0) {
                        message = parsed.errors.map((err: any) => err.detail || err.title || err.code || JSON.stringify(err)).join('; ');
                    } else if (xhr.statusText) {
                        message = `${message}: ${xhr.statusText}`;
                    }
                    reject(new Error(message));
                }
            });

            xhr.addEventListener('error', () => reject(new Error('Error de red al subir el archivo')));
            xhr.addEventListener('abort', () => reject(new Error('Subida cancelada')));

            const formData = new FormData();
            formData.append('file', file);

            xhr.open('POST', `${API_ENDPOINT}/creators/publishers/${publisherId}/modpacks/${modpackId}/versions/${versionId}/files/${type}`);
            xhr.setRequestHeader('Authorization', `Bearer ${sessionTokens?.accessToken}`);
            xhr.send(formData);
        }).catch((error) => {
            console.error('Error uploading file:', error);
            toast.error(error.message || 'Error al subir el archivo');
        }).finally(() => {
            setUploadingFile(false);
            setUploadDialog(prev => ({ ...prev, open: false, file: null, progress: 0 }));
        });
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
                `${API_ENDPOINT}/creators/publishers/${publisherId}/modpacks/${modpackId}/versions/${versionId}/files/${fileType}/${fileHash}`,
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
            const res = await fetch(`${API_ENDPOINT}/creators/publishers/${publisherId}/modpacks/${modpackId}/versions/${versionId}/previous-files/${type}`, {
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
                        f.path === ff.path
                    )
                )];

            return { ...prev, selectedFiles: newSelected };
        });
    };


    const deselectAllFiles = () => {
        setReuseDialog(prev => ({ ...prev, selectedFiles: [] }));
    };

    const buildFileTree = (files: Array<{ fileHash: string; path: string; size: number }>, type: string): { [key: string]: TreeNode } => {
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
                        file: { type: type as any },
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
            const res = await fetch(`${API_ENDPOINT}/creators/publishers/${publisherId}/modpacks/${modpackId}/versions/${versionId}/reuse-files/${reuseDialog.type}`, {
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
                    <div className="flex items-center cursor-pointer hover:bg-gray-100 p-1 rounded transition-colors">
                        <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => {
                                if (el) el.indeterminate = someSelected && !allSelected;
                            }}
                            onChange={handleFolderCheckboxChange}
                            className="mr-2 rounded border-gray-300"
                        />
                        <div onClick={toggleExpand} className="flex items-center flex-1">
                            {isExpanded ? <LucideChevronDown className="h-4 w-4 mr-2 text-gray-200 flex-shrink-0" /> : <LucideChevronRight className="h-4 w-4 mr-2 text-gray-600 flex-shrink-0" />}
                            <LucideFolder className="h-4 w-4 mr-2 text-sky-600 flex-shrink-0" />
                            <span className="text-gray-800 font-medium">{name}</span>
                            <span className="text-xs text-gray-500 ml-2">({folderFileHashes.length} archivos)</span>
                        </div>
                    </div>
                    {isExpanded && (
                        <div className="pl-6 border-l border-gray-200 ml-2">
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
            <div className="flex items-center justify-between p-1 ml-4 group hover:bg-gray-100 rounded">
                <div className="flex items-center min-w-0 flex-1">
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelection(versionId!, fileData.fileHash, fileData.path)}
                        className="mr-2 rounded border-gray-300 flex-shrink-0"
                    />
                    <div className="w-4 mr-2 flex-shrink-0"></div> {/* Indent spacer */}
                    {getFileIcon(name)}
                    <span
                        className="text-gray-500 truncate"
                        title={`Versión: ${versionId} - Path: ${fileData.path}`} // Show versionId and full path on hover
                    >
                        {name}
                    </span>
                </div>
                <div className="text-xs text-gray-500 flex-shrink-0 ml-2">
                    {formatFileSize(fileData.size || 0)}
                </div>
            </div>
        );
    };

    const FileSection: React.FC<{
        title: string;
        description: string;
        type: 'mods' | 'resourcepacks' | 'config' | 'shaderpacks' | 'extras';
        files: ModpackVersionFile[];
        icon: React.ReactNode;
        versionStatus: string;
        onDeleteFile: (fileHash: string, fileType: string) => void;
    }> = ({ title, description, type, files, icon, versionStatus, onDeleteFile }) => {
        const [expandedFolders, setExpandedFolders] = useState<{ [key: string]: boolean }>({});

        const filteredFiles = files.filter(file => file.file.type === type);

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
            <Card
                className="transition-all duration-200 hover:shadow-md"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, type)}
            >
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        {icon} {title}
                        {versionStatus !== 'published' && (
                            <span className="text-xs text-gray-400 ml-auto font-normal">
                                Arrastra ZIP aquí
                            </span>
                        )}
                    </CardTitle>
                    <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {versionStatus === 'draft' && (
                            <div className="flex flex-col items-center space-y-2">
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => openUploadDialog(type)} disabled={uploadingFile}>
                                        <LucideUpload className="h-4 w-4 mr-2" />
                                        {uploadingFile ? 'Subiendo...' : 'Subir ZIP'}
                                    </Button>
                                    <Button variant="secondary" size="sm" onClick={() => openReuseDialog(type)} disabled={uploadingFile}>
                                        <LucidePackage className="h-4 w-4 mr-2" /> Reutilizar
                                    </Button>
                                </div>
                            </div>
                        )}
                        {filteredFiles.length > 0 ? (
                            <div className="space-y-1 mt-4 max-h-60 overflow-y-auto font-mono text-xs border-t pt-4">
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
                                        />
                                    ))}
                            </div>
                        ) : (
                            versionStatus !== 'published' && (
                                <p className="text-xs text-center text-gray-500 mt-2">
                                    Sube nuevos archivos o reutiliza de versiones anteriores.
                                </p>
                            )
                        )}
                    </div>
                </CardContent>
            </Card>
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
                                    accept=".zip"
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
                                    <span className="text-sm font-medium">{uploadDialog.file.name}</span>
                                    <span className="text-xs text-gray-500 ml-auto">
                                        {formatFileSize(uploadDialog.file.size)}
                                    </span>
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
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white">{version.modpack.name}</h1>
                        <p className="text-gray-400">Versión {version.version}</p>
                    </div>
                    <div className="flex items-center space-x-4">
                        {version.status === 'draft' && (
                            <Button
                                onClick={() => setPublishDialog(true)}
                                disabled={publishing}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                <LucideSend className="h-4 w-4 mr-2" />
                                {publishing ? 'Publicando...' : 'Publicar'}
                            </Button>
                        )}



                        {/* Action buttons depending on status: draft -> Publish, published -> Archive, archived -> Delete. No actions when deleted */}
                        {version.status === 'draft' && (
                            <Button
                                onClick={() => setPublishDialog(true)}
                                disabled={publishing}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                <LucideSend className="h-4 w-4 mr-2" />
                                {publishing ? 'Publicando...' : 'Publicar'}
                            </Button>
                        )}

                        {version.status === 'published' && (
                            <Button
                                onClick={() => setArchiveDialog(true)}
                                disabled={publishing}
                                variant="outline"
                                className="border-sky-300 text-sky-700 hover:bg-sky-50"
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
                            >
                                <LucideTrash2 className="h-4 w-4 mr-2" />
                                Eliminar Versión
                            </Button>
                        )}

                        <Badge variant={getStatusBadgeVariant(version.status)}>
                            {getStatusLabel(version.status)}
                        </Badge>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Version Info */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Información de la Versión</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Versión</label>
                                        <p className="text-lg font-semibold">{version.version}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Minecraft</label>
                                        <p className="text-lg">{version.mcVersion}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Forge</label>
                                        <p className="text-lg">{version.forgeVersion || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Estado</label>
                                        <p className="text-lg capitalize">{version.status === 'published' ? 'Publicado' : 'Borrador'}</p>
                                    </div>
                                </div>
                                <Separator />
                                <div className='grid grid-cols-2 gap-4'>
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Creado</label>
                                        <p>{new Date(version.createdAt).toLocaleString()}</p>
                                    </div>
                                    {version.releaseDate && (
                                        <div>
                                            <label className="text-sm font-medium text-gray-500">Publicado</label>
                                            <p>{new Date(version.releaseDate).toLocaleString()}</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Processing Status */}
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

                        {/* Changelog */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>Changelog</CardTitle>
                                        <CardDescription>
                                            Describe los cambios en esta versión
                                        </CardDescription>
                                    </div>
                                    {!editingChangelog && version.status === 'draft' ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setEditingChangelog(true)}
                                        >
                                            <LucideEdit2 className="h-4 w-4 mr-2" />
                                            Editar
                                        </Button>
                                    ) : editingChangelog ? (
                                        <div className="flex space-x-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setEditingChangelog(false);
                                                    setChangelog(version.changelog || '');
                                                }}
                                            >
                                                Cancelar
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={updateChangelog}
                                            >
                                                <LucideSave className="h-4 w-4 mr-2" />
                                                Guardar
                                            </Button>
                                        </div>
                                    ) : null}
                                </div>
                            </CardHeader>
                            <CardContent>
                                {editingChangelog ? (
                                    <Textarea
                                        value={changelog}
                                        onChange={(e) => setChangelog(e.target.value)}
                                        placeholder="Describe los cambios en esta versión..."
                                        rows={8}
                                        className="w-full"
                                    />
                                ) : (
                                    <div className="prose max-w-none text-sm p-4 bg-gray-500/10 rounded-md border max-h-60 overflow-auto">
                                        <pre className="whitespace-pre-wrap font-sans text-gray-100">
                                            {version.changelog || 'No hay changelog disponible.'}
                                        </pre>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar with File Sections */}
                    <div className="space-y-6">
                        <FileSection
                            title="Mods"
                            description="Archivos para la carpeta /mods"
                            type="mods"
                            files={version.files || []}
                            icon={<LucidePackage className="h-5 w-5" />}
                            versionStatus={version.status}
                            onDeleteFile={deleteFile}
                        />
                        <FileSection
                            title="Resource Packs"
                            description="Archivos para la carpeta /resourcepacks"
                            type="resourcepacks"
                            files={version.files || []}
                            icon={<LucideImage className="h-5 w-5" />}
                            versionStatus={version.status}
                            onDeleteFile={deleteFile}
                        />
                        <FileSection
                            title="Config"
                            description="Archivos para la carpeta /config"
                            type="config"
                            files={version.files || []}
                            icon={<LucideSettings className="h-5 w-5" />}
                            versionStatus={version.status}
                            onDeleteFile={deleteFile}
                        />
                        <FileSection
                            title="Shader Packs"
                            description="Archivos para la carpeta /shaderpacks"
                            type="shaderpacks"
                            files={version.files || []}
                            icon={<LucidePalette className="h-5 w-5" />}
                            versionStatus={version.status}
                            onDeleteFile={deleteFile}
                        />
                        <FileSection
                            title="Extras"
                            description="Archivos para la raíz de .minecraft"
                            type="extras"
                            files={version.files || []}
                            icon={<LucideFolder className="h-5 w-5" />}
                            versionStatus={version.status}
                            onDeleteFile={deleteFile}
                        />
                    </div>
                </div>
            </div>
        </>
    );
};

export default PublisherModpackVersionDetailView;