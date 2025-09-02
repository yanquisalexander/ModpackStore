import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
                    <span className="text-gray-800 font-medium">{name}</span>
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
                <span className="text-gray-700 truncate" title={fileData.path}>{name}</span>
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

const ModpackVersionDetailView: React.FC = () => {
    const { orgId: publisherId, modpackId, versionId } = useParams<{
        orgId: string;
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
        selectedFiles: string[];
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

    const publishVersion = async () => {
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
        } catch (error) {
            console.error('Error publishing version:', error);
            toast.error('Error al publicar la versión');
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

    const deleteFile = async (fileHash: string, fileType: string) => {
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
        } catch (error) {
            console.error('Error deleting file:', error);
            toast.error(error instanceof Error ? error.message : 'Error al eliminar el archivo');
        }
    };

    const openUploadDialog = (type: string) => {
        setUploadDialog({
            open: true,
            type,
            file: null,
            progress: 0
        });
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setUploadDialog(prev => ({ ...prev, file }));
        }
    };

    const confirmUpload = async () => {
        if (uploadDialog.file) {
            await handleFileUpload(uploadDialog.file, uploadDialog.type);
        }
    };

    const fetchPreviousFiles = async (type: string) => {
        setReuseDialog(prev => ({ ...prev, loading: true }));
        try {
            const res = await fetch(`${API_ENDPOINT}/creators/publishers/${publisherId}/modpacks/${modpackId}/versions/${versionId}/previous-files/${type}`, {
                headers: {
                    'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                },
            });

            if (!res.ok) {
                await handleApiError(res);
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
            setReuseDialog(prev => ({ ...prev, loading: false }));
        }
    };

    const openReuseDialog = async (type: string) => {
        setReuseDialog({
            open: true,
            type,
            previousFiles: [],
            selectedFiles: [],
            loading: false
        });
        await fetchPreviousFiles(type);
    };

    const toggleFileSelection = (fileHash: string) => {
        setReuseDialog(prev => ({
            ...prev,
            selectedFiles: prev.selectedFiles.includes(fileHash)
                ? prev.selectedFiles.filter(h => h !== fileHash)
                : [...prev.selectedFiles, fileHash]
        }));
    };

    const selectAllFiles = () => {
        const allFileHashes = reuseDialog.previousFiles.flatMap(version => version.files.map(file => file.fileHash));
        setReuseDialog(prev => ({
            ...prev,
            selectedFiles: allFileHashes
        }));
    };

    const deselectAllFiles = () => {
        setReuseDialog(prev => ({
            ...prev,
            selectedFiles: []
        }));
    };

    const selectAllFilesForVersion = (versionId: string) => {
        const version = reuseDialog.previousFiles.find(v => v.versionId === versionId);
        if (!version) return;

        const versionFileHashes = version.files.map(file => file.fileHash);
        setReuseDialog(prev => ({
            ...prev,
            selectedFiles: [...new Set([...prev.selectedFiles, ...versionFileHashes])]
        }));
    };

    const deselectAllFilesForVersion = (versionId: string) => {
        const version = reuseDialog.previousFiles.find(v => v.versionId === versionId);
        if (!version) return;

        const versionFileHashes = version.files.map(file => file.fileHash);
        setReuseDialog(prev => ({
            ...prev,
            selectedFiles: prev.selectedFiles.filter(hash => !versionFileHashes.includes(hash))
        }));
    };

    const toggleFolderSelection = (folderPath: string, fileHashes: string[]) => {
        const allSelected = fileHashes.every(hash => reuseDialog.selectedFiles.includes(hash));
        setReuseDialog(prev => ({
            ...prev,
            selectedFiles: allSelected
                ? prev.selectedFiles.filter(hash => !fileHashes.includes(hash))
                : [...new Set([...prev.selectedFiles, ...fileHashes])]
        }));
    };

    const buildReuseFileTree = (files: Array<{ fileHash: string; path: string; size: number; type: string }>): { [key: string]: TreeNode } => {
        const tree: { [key: string]: TreeNode } = {};
        files.forEach(fileData => {
            const pathParts = fileData.path.split('/');
            let currentLevel: any = tree;
            pathParts.forEach((part, index) => {
                if (index === pathParts.length - 1) {
                    // Convert to ModpackVersionFile format for the tree
                    const modpackFile: ModpackVersionFile = {
                        fileHash: fileData.fileHash,
                        path: fileData.path,
                        file: {
                            type: fileData.type as 'mods' | 'resourcepacks' | 'config' | 'shaderpacks' | 'extras'
                        },
                        size: fileData.size
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
        if (reuseDialog.selectedFiles.length === 0) {
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
                body: JSON.stringify({
                    fileHashes: reuseDialog.selectedFiles
                })
            });

            if (!res.ok) {
                await handleApiError(res);
                return;
            }

            const data = await res.json();
            toast.success(data.message || 'Archivos reutilizados correctamente');
            fetchVersionDetails();
            setReuseDialog(prev => ({ ...prev, open: false }));
        } catch (error) {
            console.error('Error reusing files:', error);
            toast.error(error instanceof Error ? error.message : 'Error al reutilizar archivos');
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleDragOver = (e: React.DragEvent) => e.preventDefault();

    const handleDrop = async (e: React.DragEvent, type: string) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            await handleFileUpload(files[0], type);
        }
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
            const initialExpansionState: { [key: string]: boolean } = {};
            Object.keys(fileTree).forEach(key => {
                if (fileTree[key].type === 'folder') {
                    initialExpansionState[key] = true;
                }
            });
            setExpandedFolders(initialExpansionState);
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
                        {versionStatus !== 'published' && (
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
                                    ))
                                }
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

    const SelectableFileTreeNode: React.FC<{
        name: string;
        node: TreeNode;
        expandedFolders: { [key: string]: boolean };
        setExpandedFolders: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
        path: string;
        selectedFiles: string[];
        onToggleSelection: (fileHash: string) => void;
        onToggleFolderSelection: (folderPath: string, fileHashes: string[]) => void;
    }> = ({ name, node, expandedFolders, setExpandedFolders, path, selectedFiles, onToggleSelection, onToggleFolderSelection }) => {
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
            const allSelected = folderFileHashes.length > 0 && folderFileHashes.every(hash => selectedFiles.includes(hash));
            const someSelected = folderFileHashes.some(hash => selectedFiles.includes(hash));

            const handleFolderCheckboxChange = () => {
                onToggleFolderSelection(path, folderFileHashes);
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
                        {isExpanded ? <LucideChevronDown className="h-4 w-4 mr-2 text-gray-600 flex-shrink-0" /> : <LucideChevronRight className="h-4 w-4 mr-2 text-gray-600 flex-shrink-0" />}
                        <LucideFolder className="h-4 w-4 mr-2 text-sky-600 flex-shrink-0" />
                        <span className="text-gray-800 font-medium">{name}</span>
                        <span className="text-xs text-gray-500 ml-2">({folderFileHashes.length} archivos)</span>
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
                                    />
                                ))}
                        </div>
                    )}
                </div>
            );
        }

        // It's a file
        const fileData = node.data;
        const isSelected = selectedFiles.includes(fileData.fileHash);

        return (
            <div className="flex items-center justify-between p-1 ml-4 group hover:bg-gray-100 rounded">
                <div className="flex items-center min-w-0 flex-1">
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelection(fileData.fileHash)}
                        className="mr-2 rounded border-gray-300 flex-shrink-0"
                    />
                    <div className="w-4 mr-2 flex-shrink-0"></div> {/* Indent spacer */}
                    {getFileIcon(name)}
                    <span className="text-gray-700 truncate" title={fileData.path}>{name}</span>
                </div>
                <div className="text-xs text-gray-500 flex-shrink-0 ml-2">
                    {formatFileSize(fileData.size || 0)}
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
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Versión no encontrada</h2>
                    <p className="text-gray-600">La versión que buscas no existe o no tienes permisos para verla.</p>
                </div>
            </div>
        );
    }

    return (
        <>
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
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    id="dialog-file-upload"
                                />
                                <label htmlFor="dialog-file-upload" className="cursor-pointer">
                                    <LucideUpload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                    <p className="text-sm text-gray-600">
                                        Haz clic para seleccionar un archivo ZIP
                                    </p>
                                </label>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                                    <LucideFile className="h-8 w-8 text-gray-500" />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900">
                                            {uploadDialog.file.name}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {formatFileSize(uploadDialog.file.size)}
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setUploadDialog(prev => ({ ...prev, file: null }))}
                                        className="text-red-600 hover:text-red-700"
                                    >
                                        <LucideTrash2 className="h-4 w-4" />
                                    </Button>
                                </div>

                                {uploadingFile && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span>Subiendo...</span>
                                            <span>{uploadDialog.progress}%</span>
                                        </div>
                                        <Progress value={uploadDialog.progress} className="w-full" />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setUploadDialog(prev => ({ ...prev, open: false, file: null }))}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={confirmUpload}
                            disabled={!uploadDialog.file || uploadingFile}
                        >
                            {uploadingFile ? 'Subiendo...' : 'Subir archivo'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* File Reuse Dialog */}
            <Dialog open={reuseDialog.open} onOpenChange={(open) => setReuseDialog(prev => ({ ...prev, open }))}>
                <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Reutilizar archivos de versiones anteriores</DialogTitle>
                        <DialogDescription>
                            Selecciona archivos de tipo "{reuseDialog.type}" de versiones anteriores para reutilizar
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-1">
                        {reuseDialog.loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                                    <p className="mt-2 text-sm text-gray-600">Cargando archivos anteriores...</p>
                                </div>
                            </div>
                        ) : reuseDialog.previousFiles.length === 0 ? (
                            <div className="text-center py-8">
                                <LucidePackage className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                                <p className="text-gray-600">No hay archivos de tipo "{reuseDialog.type}" en versiones anteriores</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {reuseDialog.previousFiles.map((version) => {
                                    const versionFileHashes = version.files.map(file => file.fileHash);
                                    const allVersionSelected = versionFileHashes.every(hash => reuseDialog.selectedFiles.includes(hash));
                                    const someVersionSelected = versionFileHashes.some(hash => reuseDialog.selectedFiles.includes(hash));

                                    return (
                                        <div key={version.versionId} className="border rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <h3 className="font-medium text-gray-900">
                                                    Versión {version.version} ({version.files.length} archivos)
                                                </h3>
                                                <div className="flex space-x-2">
                                                    {!allVersionSelected && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => selectAllFilesForVersion(version.versionId)}
                                                        >
                                                            Seleccionar todo
                                                        </Button>
                                                    )}
                                                    {someVersionSelected && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => deselectAllFilesForVersion(version.versionId)}
                                                        >
                                                            Deseleccionar todo
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="space-y-2 max-h-96 overflow-y-auto font-mono text-xs border-t pt-4">
                                                {(() => {
                                                    const fileTree = buildReuseFileTree(version.files);
                                                    return Object.entries(fileTree)
                                                        .sort(([aName, aNode], [bName, bNode]) => {
                                                            if (aNode.type === 'folder' && bNode.type !== 'folder') return -1;
                                                            if (aNode.type !== 'folder' && bNode.type === 'folder') return 1;
                                                            return aName.localeCompare(bName);
                                                        })
                                                        .map(([name, node]) => (
                                                            <SelectableFileTreeNode
                                                                key={name}
                                                                name={name}
                                                                node={node}
                                                                expandedFolders={reuseExpandedFolders}
                                                                setExpandedFolders={setReuseExpandedFolders}
                                                                path={name}
                                                                selectedFiles={reuseDialog.selectedFiles}
                                                                onToggleSelection={toggleFileSelection}
                                                                onToggleFolderSelection={toggleFolderSelection}
                                                            />
                                                        ));
                                                })()}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex-wrap justify-between items-center gap-2 pt-4 border-t">
                        <div className="flex items-center space-x-4">
                            <div className="text-sm text-gray-600">
                                {reuseDialog.selectedFiles.length} archivo(s) seleccionado(s)
                            </div>
                            {(() => {
                                const allFileHashes = reuseDialog.previousFiles.flatMap(version => version.files.map(file => file.fileHash));
                                const allSelected = allFileHashes.length > 0 && allFileHashes.every(hash => reuseDialog.selectedFiles.includes(hash));
                                const noneSelected = reuseDialog.selectedFiles.length === 0;
                                return (
                                    <>
                                        {!allSelected && (
                                            <Button variant="outline" size="sm" onClick={selectAllFiles}>
                                                Seleccionar todo
                                            </Button>
                                        )}
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

            <div className="min-h-screen">
                <div className="max-w-6xl mx-auto px-4 py-8">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-zinc-800">{version.modpack.name}</h1>
                            <p className="text-zinc-500">Versión {version.version}</p>
                        </div>
                        <div className="flex items-center space-x-4">
                            {version.status !== 'published' && (
                                <Button
                                    onClick={publishVersion}
                                    disabled={publishing}
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                    <LucideSend className="h-4 w-4 mr-2" />
                                    {publishing ? 'Publicando...' : 'Publicar'}
                                </Button>
                            )}
                            <Badge
                                variant={version.status === 'published' ? 'default' : 'secondary'}
                                className={version.status === 'published' ? 'bg-green-100 text-green-800' : ''}
                            >
                                {version.status}
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
                                            <p className="text-lg capitalize">{version.status || 'Desconocido'}</p>
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
                                        {!editingChangelog && version.status !== 'published' ? (
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
                                        <div className="prose max-w-none text-sm p-4 bg-gray-50 rounded-md border max-h-60 overflow-auto">
                                            <pre className="whitespace-pre-wrap font-sans text-gray-800">
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
            </div>
        </>
    );
};

export default ModpackVersionDetailView;