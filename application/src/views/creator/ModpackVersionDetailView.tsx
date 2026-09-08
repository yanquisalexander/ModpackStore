import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from '@/components/ui/progress';
import { handleApiError, cn } from '@/lib/utils';
import { uploadFileWithUppy } from '@/utils/uppyUpload';

// --- Interfaces & Types ---

interface ModpackVersion {
    id: string;
    version: string;
    mcVersion: string;
    loaderType?: string;
    loaderVersion?: string;
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
    fileType?: 'mods' | 'resourcepacks' | 'config' | 'shaderpacks' | 'extras'; // direct fileType on ModpackVersionFile
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
            return <LucideFile className="h-4 w-4 mr-2 text-neutral-500 flex-shrink-0" />;
    }
};

const FileTreeNode: React.FC<{
    name: string;
    node: TreeNode;
    expandedFolders: { [key: string]: boolean };
    setExpandedFolders: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
    path: string;
    mode: 'manage' | 'select';
    // manage mode:
    versionStatus?: string;
    onDelete?: (fileHash: string, fileType: string) => void;
    onUpdateSide?: (fileHash: string, fileType: string, side: 'client' | 'server' | 'both') => void;
    selectedFiles?: Set<string>;
    onToggleSelection?: (fileHash: string) => void;
    // select mode:
    onToggleFolderSelection?: (folderPath: string, fileHashes: string[]) => void;
    versionId?: string;
}> = ({ name, node, expandedFolders, setExpandedFolders, path, mode, versionStatus, onDelete, onUpdateSide, selectedFiles, onToggleSelection, onToggleFolderSelection, versionId }) => {
    if (node.type === 'folder') {
        const isExpanded = expandedFolders[path];
        const toggleExpand = () => setExpandedFolders(prev => ({ ...prev, [path]: !isExpanded }));

        if (mode === 'select') {
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
                (selectedFiles as Set<string>)?.has(hash)
            );
            const someSelected = folderFileHashes.some(hash =>
                (selectedFiles as Set<string>)?.has(hash)
            );

            return (
                <div>
                    <div className="flex items-center cursor-pointer hover:bg-white/[0.04] p-1 rounded transition-colors group">
                        <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                            onChange={() => onToggleFolderSelection?.(path, folderFileHashes)}
                            className="mr-2 rounded border-white/20 bg-transparent"
                        />
                        <div onClick={toggleExpand} className="flex items-center flex-1">
                            {isExpanded ? <LucideChevronDown className="h-4 w-4 mr-2 text-neutral-500 group-hover:text-neutral-300 flex-shrink-0" /> : <LucideChevronRight className="h-4 w-4 mr-2 text-neutral-500 group-hover:text-neutral-300 flex-shrink-0" />}
                            <LucideFolder className="h-4 w-4 mr-2 text-sky-500 flex-shrink-0" />
                            <span className="text-neutral-200 font-medium">{name}</span>
                            <span className="text-xs text-neutral-500 ml-2">({folderFileHashes.length})</span>
                        </div>
                    </div>
                    {isExpanded && (
                        <div className="pl-6 border-l border-white/[0.04] ml-2">
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
                                        mode={mode}
                                        selectedFiles={selectedFiles}
                                        onToggleSelection={onToggleSelection}
                                        onToggleFolderSelection={onToggleFolderSelection}
                                        versionId={versionId}
                                    />
                                ))}
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div>
                <div onClick={toggleExpand} className="flex items-center cursor-pointer hover:bg-white/[0.04] p-1 rounded transition-colors group">
                    {isExpanded ? <LucideChevronDown className="h-4 w-4 mr-2 text-neutral-500 group-hover:text-neutral-300 flex-shrink-0" /> : <LucideChevronRight className="h-4 w-4 mr-2 text-neutral-500 group-hover:text-neutral-300 flex-shrink-0" />}
                    <LucideFolder className="h-4 w-4 mr-2 text-sky-500 flex-shrink-0" />
                    <span className="text-neutral-200 font-medium">{name}</span>
                </div>
                {isExpanded && (
                    <div className="pl-6 border-l border-white/[0.04] ml-2 mt-0.5">
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
                                    mode={mode}
                                    versionStatus={versionStatus}
                                    onDelete={onDelete}
                                    onUpdateSide={onUpdateSide}
                                    selectedFiles={selectedFiles}
                                    onToggleSelection={onToggleSelection}
                                />
                            ))}
                    </div>
                )}
            </div>
        );
    }

    const fileData = node.data;

    if (mode === 'select') {
        const isSelected = (selectedFiles as Set<string>)?.has(fileData.fileHash) || false;

        return (
            <div className="flex items-center justify-between p-1 ml-4 group hover:bg-white/[0.04] rounded transition-colors">
                <div className="flex items-center min-w-0 flex-1">
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelection?.(fileData.fileHash)}
                        className="mr-2 rounded border-white/20 bg-transparent flex-shrink-0"
                    />
                    <div className="w-4 mr-2 flex-shrink-0"></div>
                    {getFileIcon(name)}
                    <span className="text-neutral-300 truncate text-sm" title={fileData.path}>{name}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex-shrink-0">
                                    {fileData.side === 'client' && <LucideMonitor className="h-3 w-3 text-neutral-500" />}
                                    {fileData.side === 'server' && <LucideServer className="h-3 w-3 text-neutral-500" />}
                                    {(!fileData.side || fileData.side === 'both') && <LucideGlobe className="h-3 w-3 text-neutral-500" />}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="text-[10px]">
                                    {fileData.side === 'client' ? 'Entorno: Cliente solo' :
                                        fileData.side === 'server' ? 'Entorno: Servidor solo' :
                                            'Entorno: Ambos'}
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <div className="text-[10px] text-neutral-500 flex-shrink-0">{formatFileSize(fileData.size || 0)}</div>
                </div>
            </div>
        );
    }

    const isSelected = (selectedFiles as Set<string>)?.has(fileData.fileHash) || false;

    return (
        <div className="flex items-center justify-between p-1 ml-4 group hover:bg-white/[0.04] rounded transition-colors">
            <div className="flex items-center min-w-0 flex-1">
                {selectedFiles && onToggleSelection && (
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelection(fileData.fileHash)}
                        className="mr-2 rounded border-white/20 bg-transparent flex-shrink-0"
                    />
                )}
                <div className="w-4 mr-2 flex-shrink-0"></div>
                {getFileIcon(name)}
                <span className="text-neutral-300 truncate text-sm" title={fileData.path}>{name}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center">
                                <Select
                                    value={fileData.side || 'both'}
                                    onValueChange={(value: any) => onUpdateSide?.(fileData.fileHash, fileData.file.type, value)}
                                    disabled={versionStatus === 'published'}
                                >
                                    <SelectTrigger className="h-7 w-[90px] text-[10px] px-2 bg-black/20 border-white/[0.04] focus:ring-0">
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
                        onClick={() => onDelete?.(fileData.fileHash, fileData.file.type)}
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

// --- FileSection Component ---

interface FileSectionProps {
    title: string;
    description: string;
    type: 'mods' | 'resourcepacks' | 'config' | 'shaderpacks' | 'extras';
    files: ModpackVersionFile[];
    icon: React.ReactNode;
    versionStatus: string;
    onDeleteFile: (fileHash: string, fileType: string) => void;
    onUpdateSide: (fileHash: string, fileType: string, side: 'client' | 'server' | 'both') => void;
    uploadingFile: boolean;
    onOpenUpload: (type: string) => void;
    onOpenReuse: (type: string) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, type: string) => void;
    publisherId: string;
    modpackId: string;
    versionId: string;
    accessToken: string;
    onRefresh: () => void;
}

const FileSection: React.FC<FileSectionProps> = ({ title, description, type, files, icon, versionStatus, onDeleteFile, onUpdateSide, uploadingFile, onOpenUpload, onOpenReuse, onDragOver, onDrop, publisherId, modpackId, versionId, accessToken, onRefresh }) => {
    const [expandedFolders, setExpandedFolders] = useState<{ [key: string]: boolean }>({});
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);

    const filteredFiles = files.filter(file => {
        const fileType = file.fileType || file.file?.type || 'extras';
        return fileType === type;
    });

    const toggleFileSelection = useCallback((fileHash: string) => {
        setSelectedFiles(prev => {
            const newSet = new Set(prev);
            if (newSet.has(fileHash)) {
                newSet.delete(fileHash);
            } else {
                newSet.add(fileHash);
            }
            return newSet;
        });
    }, []);

    const selectAllFiles = useCallback(() => {
        const allHashes = filteredFiles.map(f => f.fileHash);
        setSelectedFiles(new Set(allHashes));
    }, [filteredFiles]);

    const deselectAllFiles = useCallback(() => {
        setSelectedFiles(new Set());
    }, []);

    const deleteSelectedFiles = async () => {
        if (selectedFiles.size === 0) return;

        setIsDeleting(true);
        try {
            const res = await fetch(`${API_ENDPOINT}/creators/${publisherId}/modpacks/${modpackId}/versions/${versionId}/files/${type}/delete-multiple`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileHashes: Array.from(selectedFiles) })
            });

            if (!res.ok) { await handleApiError(res); return; }

            const data = await res.json();
            toast.success(data.message || 'Archivos eliminados correctamente');
            setSelectedFiles(new Set());
            onRefresh();
        } catch (error) {
            console.error('Error deleting files:', error);
            toast.error(error instanceof Error ? error.message : 'Error al eliminar archivos');
        } finally {
            setIsDeleting(false);
        }
    };

    const deleteAllFiles = async () => {
        if (!confirm(`¿Estás seguro de que quieres eliminar todos los archivos de ${title.toLowerCase()}?`)) return;

        setIsDeleting(true);
        try {
            const res = await fetch(`${API_ENDPOINT}/creators/${publisherId}/modpacks/${modpackId}/versions/${versionId}/files/${type}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!res.ok) { await handleApiError(res); return; }

            const data = await res.json();
            toast.success(data.message || 'Todos los archivos eliminados correctamente');
            onRefresh();
        } catch (error) {
            console.error('Error deleting all files:', error);
            toast.error(error instanceof Error ? error.message : 'Error al eliminar todos los archivos');
        } finally {
            setIsDeleting(false);
        }
    };

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
        <div
            className="bg-[#121214] border border-white/[0.06] rounded-xl overflow-hidden"
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, type)}
        >
            <div className="px-5 py-3.5 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                    {icon}
                    <h3 className="text-lg font-semibold text-white">{title}</h3>
                    {versionStatus !== 'published' && (
                        <span className="text-[10px] text-neutral-500 ml-auto">Arrastra ZIP aquí</span>
                    )}
                </div>
                <p className="text-sm text-neutral-500 mt-0.5">{description}</p>
            </div>
            <div className="p-5 space-y-4">
                {versionStatus !== 'published' && (
                    <>
                        <div className="flex gap-2">
                            <Button size="sm" onClick={() => onOpenUpload(type)} disabled={uploadingFile} className="bg-white text-black hover:bg-neutral-200 h-9">
                                <LucideUpload className="h-4 w-4 mr-2" />
                                {uploadingFile ? 'Subiendo...' : 'Subir ZIP'}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => onOpenReuse(type)} disabled={uploadingFile} className="h-9 border-white/[0.06] text-neutral-400 hover:text-white hover:bg-white/[0.04]">
                                <LucidePackage className="h-4 w-4 mr-2" /> Reutilizar
                            </Button>
                        </div>
                        {filteredFiles.length > 0 && (
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={selectAllFiles} disabled={selectedFiles.size === filteredFiles.length} className="border-white/[0.06] text-neutral-400 hover:text-white hover:bg-white/[0.04]">
                                    Seleccionar todo
                                </Button>
                                <Button variant="outline" size="sm" onClick={deselectAllFiles} disabled={selectedFiles.size === 0} className="border-white/[0.06] text-neutral-400 hover:text-white hover:bg-white/[0.04]">
                                    Deseleccionar todo
                                </Button>
                                <Button size="sm" onClick={deleteSelectedFiles} disabled={selectedFiles.size === 0 || isDeleting} className="bg-red-500/10 text-red-400 hover:bg-red-500/20">
                                    {isDeleting ? 'Eliminando...' : `Eliminar ${selectedFiles.size}`}
                                </Button>
                                <Button size="sm" onClick={deleteAllFiles} disabled={isDeleting} className="bg-red-500/10 text-red-400 hover:bg-red-500/20">
                                    {isDeleting ? 'Eliminando...' : 'Eliminar todo'}
                                </Button>
                            </div>
                        )}
                    </>
                )}
                {filteredFiles.length > 0 ? (
                    <div className="bg-[#0e0e10] rounded-lg border border-white/[0.04] p-4 space-y-1 font-mono text-xs max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
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
                                    mode="manage"
                                    versionStatus={versionStatus}
                                    onDelete={onDeleteFile}
                                    onUpdateSide={onUpdateSide}
                                    selectedFiles={selectedFiles}
                                    onToggleSelection={toggleFileSelection}
                                />
                            ))
                        }
                    </div>
                ) : (
                    versionStatus !== 'published' && (
                        <div className="h-[200px] flex flex-col items-center justify-center text-center p-8">
                            <div className="bg-white/[0.04] p-4 rounded-full mb-3">
                                <LucideUpload className="h-8 w-8 text-neutral-500" />
                            </div>
                            <p className="text-sm text-neutral-600">Sube nuevos archivos o reutiliza de versiones anteriores.</p>
                        </div>
                    )
                )}
            </div>
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
    const [changelogExpanded, setChangelogExpanded] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [uploadDialog, setUploadDialog] = useState<{
        open: boolean;
        type: string;
        file: File | null;
        progress: number;
        side: 'client' | 'server' | 'both';
    }>({
        open: false,
        type: '',
        file: null,
        progress: 0,
        side: 'both'
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

    const [editingSide, setEditingSide] = useState<{
        fileHash: string;
        type: string;
        side: 'client' | 'server' | 'both';
    } | null>(null);

    const updateFileSide = async (fileHash: string, type: string, side: 'client' | 'server' | 'both') => {
        try {
            const res = await fetch(
                `${API_ENDPOINT}/creators/${publisherId}/modpacks/${modpackId}/versions/${versionId}/files/${type}/${fileHash}/side`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ side })
                }
            );

            if (!res.ok) {
                await handleApiError(res);
                return;
            }

            toast.success('Entorno de archivo actualizado');
            fetchVersionDetails();
        } catch (error) {
            console.error('Error updating file side:', error);
            toast.error(error instanceof Error ? error.message : 'Error al actualizar el entorno del archivo');
        }
    };

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

    const publishVersion = async () => {
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
        } catch (error) {
            console.error('Error publishing version:', error);
            toast.error('Error al publicar la versión');
        } finally {
            setPublishing(false);
        }
    };

    const handleFileUpload = async (file: File, type: string, side: 'client' | 'server' | 'both' = 'both') => {
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.zip')) {
            toast.error('Solo se permiten archivos ZIP');
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
                    side
                },
                onProgress: (percentComplete) => {
                    setUploadDialog(prev => ({ ...prev, progress: percentComplete }));
                },
                onSuccess: (response) => {
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
        }
    };

    const deleteFile = async (fileHash: string, fileType: string) => {
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
            progress: 0,
            side: 'both'
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
            await handleFileUpload(uploadDialog.file, uploadDialog.type, uploadDialog.side);
        }
    };

    const fetchPreviousFiles = async (type: string) => {
        setReuseDialog(prev => ({ ...prev, loading: true }));
        try {
            const res = await fetch(`${API_ENDPOINT}/creators/${publisherId}/modpacks/${modpackId}/versions/${versionId}/previous-files/${type}`, {
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

    // Memoized calculations for performance
    const allFileHashes = useMemo(() =>
        reuseDialog.previousFiles.flatMap(version => version.files.map(file => file.fileHash)),
        [reuseDialog.previousFiles]
    );

    const selectedFilesSet = useMemo(() =>
        new Set(reuseDialog.selectedFiles),
        [reuseDialog.selectedFiles]
    );

    const allSelected = useMemo(() =>
        allFileHashes.length > 0 && allFileHashes.every(hash => selectedFilesSet.has(hash)),
        [allFileHashes, selectedFilesSet]
    );

    const noneSelected = useMemo(() =>
        reuseDialog.selectedFiles.length === 0,
        [reuseDialog.selectedFiles.length]
    );

    // Optimized selection functions using useCallback
    const toggleFileSelection = useCallback((fileHash: string) => {
        setReuseDialog(prev => ({
            ...prev,
            selectedFiles: prev.selectedFiles.includes(fileHash)
                ? prev.selectedFiles.filter(h => h !== fileHash)
                : [...prev.selectedFiles, fileHash]
        }));
    }, []);

    const selectAllFiles = useCallback(() => {
        const allFileHashes = reuseDialog.previousFiles.flatMap(version => version.files.map(file => file.fileHash));
        setReuseDialog(prev => ({
            ...prev,
            selectedFiles: allFileHashes
        }));
    }, [reuseDialog.previousFiles]);

    const deselectAllFiles = useCallback(() => {
        setReuseDialog(prev => ({
            ...prev,
            selectedFiles: []
        }));
    }, []);

    const selectAllFilesForVersion = useCallback((versionId: string) => {
        const version = reuseDialog.previousFiles.find(v => v.versionId === versionId);
        if (!version) return;

        const versionFileHashes = version.files.map(file => file.fileHash);
        setReuseDialog(prev => ({
            ...prev,
            selectedFiles: [...new Set([...prev.selectedFiles, ...versionFileHashes])]
        }));
    }, [reuseDialog.previousFiles]);

    const deselectAllFilesForVersion = useCallback((versionId: string) => {
        const version = reuseDialog.previousFiles.find(v => v.versionId === versionId);
        if (!version) return;

        const versionFileHashes = version.files.map(file => file.fileHash);
        setReuseDialog(prev => ({
            ...prev,
            selectedFiles: prev.selectedFiles.filter(hash => !versionFileHashes.includes(hash))
        }));
    }, [reuseDialog.previousFiles]);

    const toggleFolderSelection = useCallback((folderPath: string, fileHashes: string[]) => {
        const allSelected = fileHashes.every(hash => selectedFilesSet.has(hash));
        setReuseDialog(prev => ({
            ...prev,
            selectedFiles: allSelected
                ? prev.selectedFiles.filter(hash => !fileHashes.includes(hash))
                : [...new Set([...prev.selectedFiles, ...fileHashes])]
        }));
    }, [selectedFilesSet]);

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
                        side: (fileData as any).side || 'both',
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

        // Build fileRefs with versionId, fileHash, and path
        const fileRefs = reuseDialog.selectedFiles.map(fileHash => {
            // Find which version and path this file belongs to
            for (const version of reuseDialog.previousFiles) {
                const file = version.files.find(f => f.fileHash === fileHash);
                if (file) {
                    return {
                        versionId: version.versionId,
                        fileHash: fileHash,
                        path: file.path
                    };
                }
            }
            return null;
        }).filter(ref => ref !== null);

        setReuseDialog(prev => ({ ...prev, loading: true }));

        try {
            const res = await fetch(`${API_ENDPOINT}/creators/${publisherId}/modpacks/${modpackId}/versions/${versionId}/reuse-files/${reuseDialog.type}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fileRefs
                })
            });

            if (!res.ok) {
                await handleApiError(res);
                return;
            }

            const data = await res.json();
            toast.success(data.message || 'Archivos reutilizados correctamente');
            fetchVersionDetails();
            setReuseDialog(prev => ({ ...prev, open: false, loading: false }));
        } catch (error) {
            console.error('Error reusing files:', error);
            toast.error(error instanceof Error ? error.message : 'Error al reutilizar archivos');
        } finally {
            setReuseDialog(prev => ({ ...prev, loading: false }));
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

    if (loading) {
        return (
            <div className="min-h-full h-full flex items-center justify-center bg-[#0e0e10]">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-neutral-600"></div>
            </div>
        );
    }

    if (!version) {
        return (
            <div className="min-h-full h-full flex items-center justify-center bg-[#0e0e10]">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-white mb-2">Versión no encontrada</h2>
                    <p className="text-sm text-neutral-500">La versión que buscas no existe o no tienes permisos para verla.</p>
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

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-gray-500">Entorno de instalación</label>
                                    <Select
                                        value={uploadDialog.side}
                                        onValueChange={(value: any) => setUploadDialog(prev => ({ ...prev, side: value }))}
                                    >
                                        <SelectTrigger>
                                            <div className="flex items-center gap-2">
                                                {uploadDialog.side === 'client' && <LucideMonitor className="h-4 w-4" />}
                                                {uploadDialog.side === 'server' && <LucideServer className="h-4 w-4" />}
                                                {uploadDialog.side === 'both' && <LucideGlobe className="h-4 w-4" />}
                                                <SelectValue />
                                            </div>
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
                                        Define dónde se instalará este archivo. Los archivos marcados como solo cliente no se enviarán al servidor de hosting.
                                    </p>
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
                                                            <FileTreeNode
                                                                key={name}
                                                                name={name}
                                                                node={node}
                                                                expandedFolders={reuseExpandedFolders}
                                                                setExpandedFolders={setReuseExpandedFolders}
                                                                path={name}
                                                                mode="select"
                                                                selectedFiles={new Set(reuseDialog.selectedFiles)}
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
                            {reuseDialog.selectedFiles.length > 0 && (
                                <Button variant="outline" size="sm" onClick={deselectAllFiles}>
                                    Deseleccionar todo
                                </Button>
                            )}
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
                                disabled={reuseDialog.selectedFiles.length === 0 || reuseDialog.loading}
                            >
                                {reuseDialog.loading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                        Reutilizando...
                                    </>
                                ) : (
                                    `Reutilizar ${reuseDialog.selectedFiles.length} archivo(s)`
                                )}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="min-h-full bg-[#0e0e10]">
                <div className="max-w-6xl mx-auto p-6 space-y-6">
                    {/* Compact Header Card */}
                    <div className="bg-[#121214] border border-white/[0.06] rounded-xl p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <h1 className="text-3xl font-bold text-white tracking-tight">{version.modpack.name}</h1>
                                    <span className={cn(
                                        "text-[10px] font-medium px-2 py-0.5 rounded-md",
                                        version.status === "published" ? "bg-emerald-500/10 text-emerald-400" :
                                        version.status === "draft" ? "bg-amber-500/10 text-amber-400" :
                                        version.status === "archived" ? "bg-neutral-500/10 text-neutral-400" :
                                        "bg-red-500/10 text-red-400"
                                    )}>
                                        {version.status}
                                    </span>
                                </div>
                                <p className="text-neutral-500 flex items-center gap-2 text-sm">
                                    Versión <code className="bg-white/[0.04] px-1.5 py-0.5 rounded text-neutral-400 font-mono text-sm">{version.version}</code>
                                    <span className="text-neutral-700">•</span>
                                    <span>Enviada el {new Date(version.createdAt).toLocaleDateString()}</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                {version.status !== 'published' && (
                                    <Button onClick={publishVersion} disabled={publishing} className="bg-white text-black hover:bg-neutral-200">
                                        <LucideSend className="h-4 w-4 mr-2" />
                                        {publishing ? 'Publicando...' : 'Publicar'}
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Stat chips */}
                        <div className="flex flex-wrap items-center gap-3 mt-5 pt-5 border-t border-white/[0.06]">
                            <div className="bg-black/20 border border-white/[0.04] rounded-lg px-3 py-2 min-w-[100px]">
                                <p className="text-[10px] uppercase font-bold text-neutral-600 tracking-widest">Minecraft</p>
                                <p className="text-sm font-medium text-white">{version.mcVersion}</p>
                            </div>
                            <div className="bg-black/20 border border-white/[0.04] rounded-lg px-3 py-2 min-w-[100px]">
                                <p className="text-[10px] uppercase font-bold text-neutral-600 tracking-widest">Loader</p>
                                <p className="text-sm font-medium text-white">
                                    {version.loaderType && version.loaderType.toLowerCase() !== 'vanilla'
                                        ? `${version.loaderType.charAt(0).toUpperCase() + version.loaderType.slice(1)} ${version.loaderVersion || ''}`.trim()
                                        : (version.forgeVersion || 'Vanilla')}
                                </p>
                            </div>
                            <div className="bg-black/20 border border-white/[0.04] rounded-lg px-3 py-2 min-w-[100px]">
                                <p className="text-[10px] uppercase font-bold text-neutral-600 tracking-widest">Archivos</p>
                                <p className="text-sm font-medium text-white">{version.files?.length || 0}</p>
                            </div>
                            <div className="bg-black/20 border border-white/[0.04] rounded-lg px-3 py-2 min-w-[100px]">
                                <p className="text-[10px] uppercase font-bold text-neutral-600 tracking-widest">Creado</p>
                                <p className="text-sm font-medium text-white">{new Date(version.createdAt).toLocaleDateString()}</p>
                            </div>
                            {version.releaseDate && (
                                <div className="bg-black/20 border border-white/[0.04] rounded-lg px-3 py-2 min-w-[100px]">
                                    <p className="text-[10px] uppercase font-bold text-neutral-600 tracking-widest">Publicado</p>
                                    <p className="text-sm font-medium text-white">{new Date(version.releaseDate).toLocaleDateString()}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Expandable Changelog */}
                    <div className="bg-[#121214] border border-white/[0.06] rounded-xl overflow-hidden">
                        <button
                            onClick={() => setChangelogExpanded(!changelogExpanded)}
                            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                {changelogExpanded ? <LucideChevronDown className="h-4 w-4 text-neutral-500" /> : <LucideChevronRight className="h-4 w-4 text-neutral-500" />}
                                <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
                                    <LucideFileText className="h-4 w-4" /> Changelog
                                </h3>
                            </div>
                            {version.status !== 'published' && !editingChangelog && (
                                <button onClick={(e) => { e.stopPropagation(); setEditingChangelog(true); }} className="text-neutral-600 hover:text-neutral-300 transition-colors">
                                    <LucideEdit2 className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </button>
                        {changelogExpanded && (
                            <div className="px-5 pb-5 border-t border-white/[0.06]">
                                <div className="pt-4">
                                    {editingChangelog ? (
                                        <div className="space-y-3">
                                            <Textarea
                                                value={changelog}
                                                onChange={(e) => setChangelog(e.target.value)}
                                                placeholder="¿Qué ha cambiado?"
                                                rows={8}
                                                className="bg-black/20 border-white/[0.06] focus:ring-0 text-sm rounded-lg"
                                            />
                                            <div className="flex gap-2 justify-end">
                                                <Button variant="ghost" size="sm" onClick={() => { setEditingChangelog(false); setChangelog(version.changelog || ''); }} className="text-neutral-500 hover:text-white">
                                                    Cancelar
                                                </Button>
                                                <Button size="sm" onClick={updateChangelog} className="bg-white text-black hover:bg-neutral-200">
                                                    <LucideSave className="h-3 w-3 mr-2" /> Guardar
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-sm text-neutral-300 whitespace-pre-wrap bg-black/20 p-4 rounded-lg border border-white/[0.04] max-h-60 overflow-auto custom-scrollbar italic leading-relaxed">
                                            {version.changelog || 'No se ha proporcionado un registro de cambios.'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Full-width File Sections */}
                    <div className="space-y-6">
                        <FileSection
                            title="Mods"
                            description="Archivos para la carpeta /mods"
                            type="mods"
                            files={version.files || []}
                            icon={<LucidePackage className="h-5 w-5 text-neutral-400" />}
                            versionStatus={version.status}
                            onDeleteFile={deleteFile}
                            onUpdateSide={updateFileSide}
                            uploadingFile={uploadingFile}
                            onOpenUpload={openUploadDialog}
                            onOpenReuse={openReuseDialog}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            publisherId={publisherId}
                            modpackId={modpackId}
                            versionId={versionId}
                            accessToken={sessionTokens?.accessToken || ''}
                            onRefresh={fetchVersionDetails}
                        />
                        <FileSection
                            title="Resource Packs"
                            description="Archivos para la carpeta /resourcepacks"
                            type="resourcepacks"
                            files={version.files || []}
                            icon={<LucideImage className="h-5 w-5 text-neutral-400" />}
                            versionStatus={version.status}
                            onDeleteFile={deleteFile}
                            onUpdateSide={updateFileSide}
                            uploadingFile={uploadingFile}
                            onOpenUpload={openUploadDialog}
                            onOpenReuse={openReuseDialog}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            publisherId={publisherId}
                            modpackId={modpackId}
                            versionId={versionId}
                            accessToken={sessionTokens?.accessToken || ''}
                            onRefresh={fetchVersionDetails}
                        />
                        <FileSection
                            title="Config"
                            description="Archivos para la carpeta /config"
                            type="config"
                            files={version.files || []}
                            icon={<LucideSettings className="h-5 w-5 text-neutral-400" />}
                            versionStatus={version.status}
                            onDeleteFile={deleteFile}
                            onUpdateSide={updateFileSide}
                            uploadingFile={uploadingFile}
                            onOpenUpload={openUploadDialog}
                            onOpenReuse={openReuseDialog}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            publisherId={publisherId}
                            modpackId={modpackId}
                            versionId={versionId}
                            accessToken={sessionTokens?.accessToken || ''}
                            onRefresh={fetchVersionDetails}
                        />
                        <FileSection
                            title="Shader Packs"
                            description="Archivos para la carpeta /shaderpacks"
                            type="shaderpacks"
                            files={version.files || []}
                            icon={<LucidePalette className="h-5 w-5 text-neutral-400" />}
                            versionStatus={version.status}
                            onDeleteFile={deleteFile}
                            onUpdateSide={updateFileSide}
                            uploadingFile={uploadingFile}
                            onOpenUpload={openUploadDialog}
                            onOpenReuse={openReuseDialog}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            publisherId={publisherId}
                            modpackId={modpackId}
                            versionId={versionId}
                            accessToken={sessionTokens?.accessToken || ''}
                            onRefresh={fetchVersionDetails}
                        />
                        <FileSection
                            title="Extras"
                            description="Archivos para la raíz de .minecraft"
                            type="extras"
                            files={version.files || []}
                            icon={<LucideFolder className="h-5 w-5 text-neutral-400" />}
                            versionStatus={version.status}
                            onDeleteFile={deleteFile}
                            onUpdateSide={updateFileSide}
                            uploadingFile={uploadingFile}
                            onOpenUpload={openUploadDialog}
                            onOpenReuse={openReuseDialog}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            publisherId={publisherId}
                            modpackId={modpackId}
                            versionId={versionId}
                            accessToken={sessionTokens?.accessToken || ''}
                            onRefresh={fetchVersionDetails}
                        />
                    </div>
                </div>
            </div>
        </>
    );
};

export default ModpackVersionDetailView;