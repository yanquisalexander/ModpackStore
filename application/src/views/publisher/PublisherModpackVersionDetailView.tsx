import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
    LucideLoader2,
    LucideRefreshCw,
    LucideCheckCircle2,
    LucideAlertCircle,
    LucideClock,
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
import { Badge } from '@/components/ui/badge';
import { handleApiError, cn } from '@/lib/utils';
import { getModLoaderDisplayName } from '@/utils/modloaderVersions';

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
    modpackName: string;
    files: ModpackVersionFile[];
}

interface ModpackVersionFile {
    fileHash: string;
    path: string;
    fileType?: 'mods' | 'resourcepacks' | 'config' | 'shaderpacks' | 'extras';
    side: 'client' | 'server' | 'both';
    file: {
        type: 'mods' | 'resourcepacks' | 'config' | 'shaderpacks' | 'extras'; // DEPRECATED: kept for backward compatibility
        size?: number; // bytes — comes from modpack_files table via JOIN
    };
    size?: number; // may also come directly in some responses
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
            return <LucideFile className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />;
    }
};

const formatFileSize = (bytes?: number): string => {
    if (!bytes || bytes <= 0 || !isFinite(bytes)) return '0 B';
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
    mode: 'manage' | 'select';
    // manage mode:
    versionStatus?: string;
    onDelete?: (fileHash: string, fileType: string) => void;
    onUpdateSide?: (fileHash: string, fileType: string, side: 'client' | 'server' | 'both') => void;
    // select mode:
    selectedFiles?: Array<{ versionId: string; fileHash: string; path: string }>;
    onToggleSelection?: (versionId: string, fileHash: string, path: string) => void;
    onToggleFolderSelection?: (folderPath: string, fileHashes: string[], versionId?: string) => void;
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
                selectedFiles?.some(f => f.fileHash === hash && f.versionId === versionId)
            );
            const someSelected = folderFileHashes.some(hash =>
                selectedFiles?.some(f => f.fileHash === hash && f.versionId === versionId)
            );

            return (
                <div>
                    <div className="flex items-center cursor-pointer hover:bg-muted/30 p-1 rounded transition-colors group">
                        <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                            onChange={() => onToggleFolderSelection?.(path, folderFileHashes, versionId)}
                            className="mr-2 rounded border-border bg-transparent"
                        />
                        <div onClick={toggleExpand} className="flex items-center flex-1">
                            {isExpanded ? <LucideChevronDown className="h-4 w-4 mr-2 text-muted-foreground group-hover:text-foreground flex-shrink-0" /> : <LucideChevronRight className="h-4 w-4 mr-2 text-muted-foreground group-hover:text-foreground flex-shrink-0" />}
                            <LucideFolder className="h-4 w-4 mr-2 text-sky-500 flex-shrink-0" />
                            <span className="text-foreground font-medium">{name}</span>
                            <span className="text-xs text-muted-foreground ml-2">({folderFileHashes.length})</span>
                        </div>
                    </div>
                    {isExpanded && (
                        <div className="pl-6 border-l border-border ml-2">
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
                <div onClick={toggleExpand} className="flex items-center cursor-pointer hover:bg-muted/30 p-1 rounded transition-colors group">
                    {isExpanded ? <LucideChevronDown className="h-4 w-4 mr-2 text-muted-foreground group-hover:text-foreground flex-shrink-0" /> : <LucideChevronRight className="h-4 w-4 mr-2 text-muted-foreground group-hover:text-foreground flex-shrink-0" />}
                    <LucideFolder className="h-4 w-4 mr-2 text-sky-500 flex-shrink-0" />
                    <span className="text-foreground font-medium">{name}</span>
                </div>
                {isExpanded && (
                    <div className="pl-6 border-l border-border ml-2 mt-0.5">
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
                                />
                            ))}
                    </div>
                )}
            </div>
        );
    }

    const fileData = node.data;

    if (mode === 'select') {
        const isSelected = selectedFiles?.some(f =>
            f.versionId === versionId &&
            f.fileHash === fileData.fileHash &&
            f.path === fileData.path
        );

        return (
            <div className="flex items-center justify-between p-1 ml-4 group hover:bg-muted/30 rounded transition-colors">
                <div className="flex items-center min-w-0 flex-1">
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelection?.(versionId!, fileData.fileHash, fileData.path)}
                        className="mr-2 rounded border-border bg-transparent flex-shrink-0"
                    />
                    <div className="w-4 mr-2 flex-shrink-0"></div>
                    {getFileIcon(name)}
                    <span className="text-foreground truncate text-sm" title={`Versión: ${versionId} - Path: ${fileData.path}`}>{name}</span>
                </div>
                <div className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">
                    {formatFileSize(fileData.file?.size ?? fileData.size)}
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-between p-1 ml-4 group hover:bg-muted/30 rounded transition-colors">
            <div className="flex items-center min-w-0 flex-1">
                <div className="w-4 mr-2 flex-shrink-0"></div>
                {getFileIcon(name)}
                <span className="text-foreground truncate text-sm" title={fileData.path}>{name}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {(fileData.file?.size ?? fileData.size) ? (
                    <span className="text-[10px] text-muted-foreground font-mono tabular-nums opacity-60 group-hover:opacity-100 transition-opacity">
                        {formatFileSize(fileData.file?.size ?? fileData.size)}
                    </span>
                ) : null}
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center">
                                <Select
                                    value={fileData.side || 'both'}
                                    onValueChange={(value: any) => onUpdateSide?.(fileData.fileHash, fileData.fileType || fileData.file.type, value)}
                                    disabled={versionStatus === 'published'}
                                >
                                    <SelectTrigger className="h-7 w-[90px] text-[10px] px-2 bg-muted/30 border-border focus:ring-0">
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
                        onClick={() => onDelete?.(fileData.fileHash, fileData.fileType || fileData.file.type)}
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    >
                        <LucideTrash2 className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
};

// --- FileTypeManager Component ---

interface FileTypeManagerProps {
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
}

const FileTypeManager: React.FC<FileTypeManagerProps> = ({ title, description, type, files, icon, versionStatus, onDeleteFile, onUpdateSide, uploadingFile, onOpenUpload, onOpenReuse, onDragOver, onDrop }) => {
    const [expandedFolders, setExpandedFolders] = useState<{ [key: string]: boolean }>({});

    const filteredFiles = files.filter(file => {
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
                    newState[key] = true;
                    hasChanges = true;
                }
            });

            return hasChanges ? newState : prev;
        });
    }, [fileTree]);

    return (
        <div
            className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, type)}
        >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        {icon}
                        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                {versionStatus === 'draft' && (
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => onOpenReuse(type)} disabled={uploadingFile} className="h-9 border-border text-muted-foreground hover:text-foreground hover:bg-muted/30">
                            <LucidePackage className="h-4 w-4 mr-2" /> Reutilizar
                        </Button>
                        <Button size="sm" onClick={() => onOpenUpload(type)} disabled={uploadingFile} className="h-9 bg-white text-black hover:bg-neutral-200">
                            <LucideUpload className="h-4 w-4 mr-2" /> Subir ZIP
                        </Button>
                    </div>
                )}
            </div>

            <div className="bg-background rounded-lg border border-border p-4 min-h-[400px]">
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
                                    mode="manage"
                                    versionStatus={versionStatus}
                                    onDelete={onDeleteFile}
                                    onUpdateSide={onUpdateSide}
                                />
                            ))}
                    </div>
                ) : (
                    <div className="h-[400px] flex flex-col items-center justify-center text-center p-8">
                        <div className="bg-muted/30 p-6 rounded-full mb-4">
                            <LucideUpload className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h4 className="text-foreground font-medium mb-1">No hay archivos aún</h4>
                        <p className="text-sm text-muted-foreground max-w-[250px]">
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

// --- Virtualized File Tree for Reuse Dialog ---

interface FlatFileItem {
    key: string;
    name: string;
    depth: number;
    type: 'file' | 'folder';
    isExpanded?: boolean;
    fileHash?: string;
    filePath?: string;
    fileSize?: number;
    childCount?: number;
}

const flattenFileTree = (
    tree: { [key: string]: TreeNode },
    expandedFolders: { [key: string]: boolean },
    basePath: string,
    depth: number
): FlatFileItem[] => {
    const items: FlatFileItem[] = [];
    const entries = Object.entries(tree).sort(([aName, aNode], [bName, bNode]) => {
        if (aNode.type === 'folder' && bNode.type !== 'folder') return -1;
        if (aNode.type !== 'folder' && bNode.type === 'folder') return 1;
        return aName.localeCompare(bName);
    });

    for (const [name, node] of entries) {
        const itemPath = `${basePath}/${name}`;
        if (node.type === 'folder') {
            const isExpanded = !!expandedFolders[itemPath];
            const childCount = countFiles(node);
            items.push({ key: itemPath, name, depth, type: 'folder', isExpanded, childCount });
            if (isExpanded) {
                items.push(...flattenFileTree(node.children, expandedFolders, itemPath, depth + 1));
            }
        } else {
            items.push({
                key: `${itemPath}::${node.data.fileHash}`,
                name,
                depth,
                type: 'file',
                fileHash: node.data.fileHash,
                filePath: node.data.path,
                fileSize: node.data.file?.size ?? node.data.size,
            });
        }
    }
    return items;
};

const countFiles = (node: FolderNodeData): number => {
    let count = 0;
    for (const child of Object.values(node.children)) {
        if (child.type === 'file') count++;
        else count += countFiles(child);
    }
    return count;
};

const VirtualizedFileTree: React.FC<{
    tree: { [key: string]: TreeNode };
    expandedFolders: { [key: string]: boolean };
    setExpandedFolders: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
    basePath: string;
    versionId: string;
    selectedFilesSet: Set<string>;
    onToggleSelection: (versionId: string, fileHash: string, path: string) => void;
    onToggleFolderSelection: (folderPath: string, fileHashes: string[], versionId?: string) => void;
    maxHeight?: number;
}> = ({ tree, expandedFolders, setExpandedFolders, basePath, versionId, selectedFilesSet, onToggleSelection, onToggleFolderSelection, maxHeight = 192 }) => {
    const parentRef = useRef<HTMLDivElement>(null);

    const flatItems = useMemo(
        () => flattenFileTree(tree, expandedFolders, basePath, 0),
        [tree, expandedFolders, basePath]
    );

    const virtualizer = useVirtualizer({
        count: flatItems.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 28,
        overscan: 10,
    });

    const toggleExpand = (path: string) => {
        setExpandedFolders(prev => ({ ...prev, [path]: !prev[path] }));
    };

    const getAllFileHashes = (folderNode: FolderNodeData): string[] => {
        const hashes: string[] = [];
        Object.values(folderNode.children).forEach(child => {
            if (child.type === 'file') hashes.push(child.data.fileHash);
            else hashes.push(...getAllFileHashes(child));
        });
        return hashes;
    };

    const getAllFiles = (folderNode: FolderNodeData): Array<{ fileHash: string; path: string }> => {
        const files: Array<{ fileHash: string; path: string }> = [];
        Object.values(folderNode.children).forEach(child => {
            if (child.type === 'file') files.push({ fileHash: child.data.fileHash, path: child.data.path });
            else files.push(...getAllFiles(child));
        });
        return files;
    };

    const findNodeByPath = (t: { [key: string]: TreeNode }, fullPath: string): TreeNode | undefined => {
        const basePathParts = basePath.split('/').filter(Boolean);
        const fullPathParts = fullPath.split('/').filter(Boolean);
        const relativeParts = fullPathParts.slice(basePathParts.length);
        let current: TreeNode | undefined;
        let level = t;
        for (const part of relativeParts) {
            current = level[part];
            if (!current || current.type === 'file') return current;
            level = (current as FolderNodeData).children;
        }
        return current;
    };

    const checkFileSelected = (fileHash: string, path: string) => {
        return selectedFilesSet.has(`${versionId}::${fileHash}::${path}`);
    };

    return (
        <div
            ref={parentRef}
            style={{ height: `${maxHeight}px`, overflow: 'auto' }}
            className="font-mono text-xs custom-scrollbar"
        >
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
                {virtualizer.getVirtualItems().map(virtualRow => {
                    const item = flatItems[virtualRow.index];
                    return (
                        <div
                            key={item.key}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: `${virtualRow.size}px`,
                                transform: `translateY(${virtualRow.start}px)`,
                            }}
                        >
                            <div
                                className="flex items-center p-1 hover:bg-muted/30 rounded transition-colors group"
                                style={{ paddingLeft: `${item.depth * 16 + 4}px` }}
                            >
                                {item.type === 'folder' ? (
                                    <>
                                        <input
                                            type="checkbox"
                                            checked={(() => {
                                                const node = findNodeByPath(tree, item.key);
                                                if (!node || node.type !== 'folder') return false;
                                                const files = getAllFiles(node);
                                                return files.length > 0 && files.every(f => checkFileSelected(f.fileHash, f.path));
                                            })()}
                                            ref={(el) => {
                                                if (!el) return;
                                                const node = findNodeByPath(tree, item.key);
                                                if (node && node.type === 'folder') {
                                                    const files = getAllFiles(node);
                                                    const allSelected = files.length > 0 && files.every(f => checkFileSelected(f.fileHash, f.path));
                                                    const someSelected = files.some(f => checkFileSelected(f.fileHash, f.path));
                                                    el.indeterminate = someSelected && !allSelected;
                                                }
                                            }}
                                            onChange={() => {
                                                const node = findNodeByPath(tree, item.key);
                                                if (node && node.type === 'folder') {
                                                    onToggleFolderSelection(item.key, getAllFileHashes(node), versionId);
                                                }
                                            }}
                                            className="mr-2 rounded border-border bg-transparent"
                                        />
                                        <div onClick={() => toggleExpand(item.key)} className="flex items-center flex-1 cursor-pointer">
                                            {item.isExpanded
                                                ? <LucideChevronDown className="h-4 w-4 mr-2 text-muted-foreground group-hover:text-foreground flex-shrink-0" />
                                                : <LucideChevronRight className="h-4 w-4 mr-2 text-muted-foreground group-hover:text-foreground flex-shrink-0" />
                                            }
                                            <LucideFolder className="h-4 w-4 mr-2 text-sky-500 flex-shrink-0" />
                                            <span className="text-foreground font-medium">{item.name}</span>
                                            <span className="text-xs text-muted-foreground ml-2">({item.childCount})</span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <input
                                            type="checkbox"
                                            checked={checkFileSelected(item.fileHash!, item.filePath!)}
                                            onChange={() => onToggleSelection(versionId, item.fileHash!, item.filePath!)}
                                            className="mr-2 rounded border-border bg-transparent flex-shrink-0"
                                        />
                                        {getFileIcon(item.name)}
                                        <span className="text-foreground truncate text-sm" title={item.filePath}>{item.name}</span>
                                        {item.fileSize ? (
                                            <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0 font-mono tabular-nums">
                                                {formatFileSize(item.fileSize)}
                                            </span>
                                        ) : null}
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

interface ProcessingJob {
    id: string;
    versionId: string;
    fileType: string;
    jobId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: string;
    error: string | null;
    createdAt: string;
    updatedAt: string;
}

const processingStatusConfig: Record<string, { icon: React.ReactNode; className: string; label: string }> = {
    pending: {
        icon: <LucideClock className="size-3" />,
        className: 'bg-muted text-muted-foreground border-border',
        label: 'En cola',
    },
    processing: {
        icon: <LucideLoader2 className="size-3 animate-spin" />,
        className: 'bg-sky-600/20 text-sky-400 border-sky-600/30',
        label: 'Procesando',
    },
    completed: {
        icon: <LucideCheckCircle2 className="size-3" />,
        className: 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30',
        label: 'Completado',
    },
    failed: {
        icon: <LucideAlertCircle className="size-3" />,
        className: 'bg-destructive/10 text-destructive border-destructive/30',
        label: 'Error',
    },
};

const ProcessingJobChip: React.FC<{ job: ProcessingJob; onRetry?: (jobId: string) => void }> = ({ job, onRetry }) => {
    const cfg = processingStatusConfig[job.status] || processingStatusConfig.pending;
    return (
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium ${cfg.className}`}>
            {cfg.icon}
            <span>{job.fileType}: {cfg.label}</span>
            {job.status === 'failed' && onRetry && (
                <button
                    onClick={() => onRetry(job.jobId)}
                    className="ml-1 hover:text-foreground transition-colors"
                    title="Reintentar"
                >
                    <LucideRefreshCw className="size-3" />
                </button>
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
    const [changelogExpanded, setChangelogExpanded] = useState(false);

    // Derived Set for O(1) selection lookups
    const selectedFilesSet = useMemo(() => {
        const s = new Set<string>();
        for (const f of reuseDialog.selectedFiles) {
            s.add(`${f.versionId}::${f.fileHash}::${f.path}`);
        }
        return s;
    }, [reuseDialog.selectedFiles]);

    const isSelectedFile = useCallback((versionId: string, fileHash: string, path: string) => {
        return selectedFilesSet.has(`${versionId}::${fileHash}::${path}`);
    }, [selectedFilesSet]);

    // Compute files breakdown by type and total size
    const fileCountsByType = useMemo(() => {
        const counts = {
            mods: 0,
            config: 0,
            resourcepacks: 0,
            shaderpacks: 0,
            extras: 0,
            total: 0,
            totalSizeBytes: 0,
        };
        if (!version?.files) return counts;
        counts.total = version.files.length;
        for (const file of version.files) {
            const type = (file.fileType || file.file?.type || 'extras') as 'mods' | 'config' | 'resourcepacks' | 'shaderpacks' | 'extras';
            if (counts[type] !== undefined) {
                counts[type]++;
            } else {
                counts.extras++;
            }
            const sizeBytes = file.file?.size ?? file.size;
            if (sizeBytes && isFinite(sizeBytes)) {
                counts.totalSizeBytes += sizeBytes;
            }
        }
        return counts;
    }, [version?.files]);

    // Format modloader label with version
    const getFormattedLoader = useCallback(() => {
        if (!version) return 'Vanilla';
        const rawType = (version.loaderType || (version.forgeVersion ? 'forge' : 'vanilla')) as any;
        const displayName = getModLoaderDisplayName(rawType);
        if (!displayName || displayName.toLowerCase() === 'vanilla') return 'Vanilla';
        if (version.loaderVersion) {
            return `${displayName} ${version.loaderVersion}`;
        }
        return displayName;
    }, [version]);

    // Processing jobs polling
    const [processingJobs, setProcessingJobs] = useState<ProcessingJob[]>([]);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopPollingProcessingJobs = useCallback(() => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    }, []);

    const fetchProcessingJobs = useCallback(async () => {
        if (!publisherId || !modpackId || !versionId || !sessionTokens?.accessToken) return;
        try {
            const res = await fetch(
                `${API_ENDPOINT}/creators/${publisherId}/modpacks/${modpackId}/versions/${versionId}/processing-jobs`,
                { headers: { 'Authorization': `Bearer ${sessionTokens.accessToken}` } },
            );
            if (!res.ok) return;
            const jobs: ProcessingJob[] = await res.json();
            setProcessingJobs(jobs);
            const allDone = jobs.every(j => j.status === 'completed' || j.status === 'failed');
            if (allDone && pollingRef.current) {
                stopPollingProcessingJobs();
                fetchVersionDetails();
                if (jobs.some(j => j.status === 'failed')) {
                    toast.error('Algunos archivos no pudieron procesarse');
                }
            }
        } catch (err) {
            console.error('Error polling processing jobs:', err);
        }
    }, [publisherId, modpackId, versionId, sessionTokens?.accessToken]);

    const startPollingProcessingJobs = useCallback(() => {
        stopPollingProcessingJobs();
        fetchProcessingJobs();
        pollingRef.current = setInterval(fetchProcessingJobs, 3000);
    }, [fetchProcessingJobs, stopPollingProcessingJobs]);

    const handleRetryProcessingJob = useCallback(async (jobId: string) => {
        if (!publisherId || !modpackId || !versionId || !sessionTokens?.accessToken) return;
        try {
            const res = await fetch(
                `${API_ENDPOINT}/creators/${publisherId}/modpacks/${modpackId}/versions/${versionId}/processing-jobs/${jobId}/retry`,
                {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${sessionTokens.accessToken}` },
                },
            );
            if (!res.ok) { await handleApiError(res); return; }
            toast.success('Reintentando procesamiento...');
            startPollingProcessingJobs();
        } catch (err) {
            console.error('Error retrying job:', err);
            toast.error('Error al reintentar el procesamiento');
        }
    }, [publisherId, modpackId, versionId, sessionTokens?.accessToken]);

    // Poll for existing processing jobs on mount (e.g., after page refresh)
    useEffect(() => {
        fetchProcessingJobs();
    }, []);

    // Cleanup polling on unmount
    useEffect(() => {
        return () => stopPollingProcessingJobs();
    }, [stopPollingProcessingJobs]);

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
            setVersion(data);
            setChangelog(data.changelog || '');
        } catch (error) {
            console.error('Error fetching version details:', error);
            toast.error(error instanceof Error ? error.message : 'Error al cargar los detalles de la versión');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateSide = async (fileHash: string, _fileType: string, side: 'client' | 'server' | 'both') => {
        if (!version) return;

        try {
            const res = await fetch(
                `${API_ENDPOINT}/creators/${publisherId}/modpacks/${modpackId}/versions/${versionId}/files/${fileHash}/side`,
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
                    f.fileHash === fileHash && (f.fileType === _fileType || f.file.type === _fileType)
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

        if (!file.name.toLowerCase().endsWith('.zip')) {
            toast.error('Solo se permiten archivos ZIP');
            return;
        }

        setUploadingFile(true);
        setUploadDialog(prev => ({ ...prev, progress: 0 }));

        try {
            const urlRes = await fetch(
                `${API_ENDPOINT}/creators/${publisherId}/modpacks/${modpackId}/versions/${versionId}/upload-url/${type}`,
                {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${sessionTokens?.accessToken}` },
                },
            );
            if (!urlRes.ok) { await handleApiError(urlRes); return; }
            const { uploadUrl } = await urlRes.json();

            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        setUploadDialog(prev => ({ ...prev, progress: Math.round((e.loaded / e.total) * 90) }));
                    }
                });
                xhr.addEventListener('load', () => resolve());
                xhr.addEventListener('error', () => reject(new Error('Error al subir el archivo a R2')));
                xhr.open('PUT', uploadUrl);
                xhr.setRequestHeader('Content-Type', 'application/octet-stream');
                xhr.send(file);
            });

            setUploadDialog(prev => ({ ...prev, progress: 95 }));

            const confirmRes = await fetch(
                `${API_ENDPOINT}/creators/${publisherId}/modpacks/${modpackId}/versions/${versionId}/confirm-upload/${type}`,
                {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${sessionTokens?.accessToken}` },
                },
            );
            if (!confirmRes.ok) { await handleApiError(confirmRes); return; }

            setUploadDialog(prev => ({ ...prev, progress: 100 }));
            toast.success('Archivo subido correctamente');
            startPollingProcessingJobs();
        } catch (error) {
            console.error('Error uploading file:', error);
            toast.error(error instanceof Error ? error.message : 'Error al subir el archivo');
        } finally {
            setUploadingFile(false);
            setUploadDialog(prev => ({ ...prev, open: false, file: null, progress: 0 }));
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
        const { fileHash } = deleteFileDialog;
        try {
            const res = await fetch(
                `${API_ENDPOINT}/creators/${publisherId}/modpacks/${modpackId}/versions/${versionId}/files/${fileHash}`,
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
            const filesByVersion: Record<string, typeof data> = {};
            for (const f of data) {
                if (!filesByVersion[f.versionId]) filesByVersion[f.versionId] = [];
                filesByVersion[f.versionId].push(f);
            }
            const versionIds = [...new Set(data.map((f: any) => f.versionId))];
            const previousFiles = await Promise.all(versionIds.map(async (vid) => {
                const vRes = await fetch(`${API_ENDPOINT}/creators/${publisherId}/modpacks/${modpackId}/versions/${vid}`, {
                    headers: { 'Authorization': `Bearer ${sessionTokens?.accessToken}` },
                });
                const vData = await vRes.json();
                return {
                    version: (vData || {}).version || vid,
                    versionId: vid,
                    files: filesByVersion[vid] || [],
                };
            }));
            setReuseDialog(prev => ({
                ...prev,
                previousFiles,
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
        const key = `${versionId}::${fileHash}::${path}`;
        setReuseDialog(prev => {
            const currentSet = new Set(prev.selectedFiles.map(f => `${f.versionId}::${f.fileHash}::${f.path}`));
            if (currentSet.has(key)) {
                return { ...prev, selectedFiles: prev.selectedFiles.filter(f => `${f.versionId}::${f.fileHash}::${f.path}` !== key) };
            }
            return { ...prev, selectedFiles: [...prev.selectedFiles, { versionId, fileHash, path }] };
        });
    };

    const toggleFolderSelection = (_folderPath: string, fileHashes: string[], versionId?: string) => {
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
            const currentSet = new Set(prev.selectedFiles.map(f => `${f.versionId}::${f.fileHash}::${f.path}`));
            const folderKeys = folderFiles.map(f => `${f.versionId}::${f.fileHash}::${f.path}`);
            const isAllSelected = folderKeys.length > 0 && folderKeys.every(k => currentSet.has(k));

            let newSelected;
            if (isAllSelected) {
                const folderKeySet = new Set(folderKeys);
                newSelected = prev.selectedFiles.filter(f => !folderKeySet.has(`${f.versionId}::${f.fileHash}::${f.path}`));
            } else {
                const newFiles = folderFiles.filter(f => !currentSet.has(`${f.versionId}::${f.fileHash}::${f.path}`));
                newSelected = [...prev.selectedFiles, ...newFiles];
            }

            return { ...prev, selectedFiles: newSelected };
        });
    };


    const deselectAllFiles = () => {
        setReuseDialog(prev => ({ ...prev, selectedFiles: [] }));
    };

    const noneSelected = useMemo(() =>
        reuseDialog.selectedFiles.length === 0,
        [reuseDialog.selectedFiles.length]
    );

    const selectAllFilesForVersion = useCallback((versionId: string) => {
        const versionData = reuseDialog.previousFiles.find(v => v.versionId === versionId);
        if (!versionData) return;
        const versionFiles = versionData.files.map(f => ({ versionId: versionData.versionId, fileHash: f.fileHash, path: f.path }));
        setReuseDialog(prev => {
            const currentSet = new Set(prev.selectedFiles.map(f => `${f.versionId}::${f.fileHash}::${f.path}`));
            const newFiles = versionFiles.filter(vf => !currentSet.has(`${vf.versionId}::${vf.fileHash}::${vf.path}`));
            return { ...prev, selectedFiles: [...prev.selectedFiles, ...newFiles] };
        });
    }, [reuseDialog.previousFiles]);

    const deselectAllFilesForVersion = useCallback((versionId: string) => {
        setReuseDialog(prev => ({
            ...prev,
            selectedFiles: prev.selectedFiles.filter(f => f.versionId !== versionId)
        }));
    }, []);

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
        const uniquePairsMap = new Map<string, { versionId: string; fileHash: string; path: string }>();
        reuseDialog.selectedFiles.forEach(f => {
            const key = `${f.versionId}::${f.fileHash}::${f.path}`;
            if (!uniquePairsMap.has(key)) uniquePairsMap.set(key, { versionId: f.versionId, fileHash: f.fileHash, path: f.path });
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

            const result = await res.json();
            const reusedCount = result.reused ?? fileRefs.length;
            toast.success(`Añadidos ${reusedCount} archivo(s) de versiones anteriores (sin reemplazar existentes)`);
            fetchVersionDetails();
            setReuseDialog(prev => ({ ...prev, open: false, selectedFiles: [] }));
        } catch (error) {
            console.error('Error reusing files:', error);
            toast.error(error instanceof Error ? error.message : 'Error al reutilizar archivos');
        }
    };



    if (loading) {
        return (
            <div className="min-h-full h-full flex items-center justify-center bg-background">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-muted-foreground"></div>
            </div>
        );
    }

    if (!version) {
        return (
            <div className="min-h-full h-full flex items-center justify-center bg-background">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-foreground mb-2">Versión no encontrada</h2>
                    <p className="text-sm text-muted-foreground">La versión que buscas no existe o no tienes permisos para verla.</p>
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
                            className="bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                            {publishing ? 'Publicando...' : 'Confirmar y Publicar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>



            {/* Upload Dialog */}
            <Dialog open={uploadDialog.open} onOpenChange={(open) => setUploadDialog(prev => ({ ...prev, open }))}>
                <DialogContent className="sm:max-w-md bg-background border border-border">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">Subir archivo ZIP</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Selecciona un archivo ZIP para subir a la sección de {uploadDialog.type}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {!uploadDialog.file ? (
                            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
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
                                    <LucideUpload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground">Selecciona un archivo ZIP</p>
                                    <p className="text-xs text-muted-foreground mt-1">O haz clic aquí para seleccionar</p>
                                </label>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                                    <LucideFile className="h-5 w-5 text-muted-foreground" />
                                    <span className="text-sm font-medium text-foreground">{uploadDialog.file.name}</span>
                                    <span className="text-xs text-muted-foreground ml-auto">
                                        {formatFileSize(uploadDialog.file.size)}
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-[10px] text-muted-foreground">
                                        Define dónde se instalarán los archivos contenidos en este ZIP.
                                    </p>
                                </div>

                                {uploadingFile && (
                                    <div className="space-y-2">
                                        <Progress value={uploadDialog.progress} />
                                        <p className="text-xs text-center text-muted-foreground">
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
                            className="border-border text-muted-foreground hover:text-foreground hover:bg-muted/30"
                        >
                            Cancelar
                        </Button>
                        {uploadDialog.file && !uploadingFile && (
                            <Button onClick={() => handleFileUpload(uploadDialog.file!, uploadDialog.type)} className="bg-white text-black hover:bg-neutral-200">
                                <LucideUpload className="h-4 w-4 mr-2" />
                                Subir Archivo
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* File Reuse Dialog */}
            <Dialog open={reuseDialog.open} onOpenChange={(open) => setReuseDialog(prev => ({ ...prev, open }))}>
                <DialogContent className="sm:max-w-4xl bg-background border border-border">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">Reutilizar archivos de versiones anteriores</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Selecciona archivos de versiones anteriores para reutilizar en la sección de {reuseDialog.type}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 max-h-96 overflow-y-auto">
                        {reuseDialog.loading ? (
                            <p className="text-center text-muted-foreground">Cargando versiones anteriores...</p>
                        ) : reuseDialog.previousFiles.length === 0 ? (
                            <p className="text-center text-muted-foreground">
                                No hay archivos de tipo {reuseDialog.type} en versiones anteriores.
                            </p>
                        ) : (
                            reuseDialog.previousFiles.map(versionData => {
                                const fileTree = buildFileTree(versionData.files, reuseDialog.type);
                                const allVersionSelected = versionData.files.length > 0 && versionData.files.every(f => isSelectedFile(versionData.versionId, f.fileHash, f.path));
                                const someVersionSelected = versionData.files.some(f => isSelectedFile(versionData.versionId, f.fileHash, f.path));

                                return (
                                    <div key={versionData.versionId} className="bg-card border border-border rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="font-medium text-sm text-foreground">
                                                Versión {versionData.version} ({versionData.files.length} archivos)
                                            </h4>
                                            <div className="flex gap-2">
                                                {!allVersionSelected && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => selectAllFilesForVersion(versionData.versionId)}
                                                        className="border-border text-muted-foreground hover:text-foreground hover:bg-muted/30 h-7 text-xs"
                                                    >
                                                        Seleccionar todo
                                                    </Button>
                                                )}
                                                {someVersionSelected && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => deselectAllFilesForVersion(versionData.versionId)}
                                                        className="border-border text-muted-foreground hover:text-foreground hover:bg-muted/30 h-7 text-xs"
                                                    >
                                                        Deseleccionar
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        <VirtualizedFileTree
                                            tree={fileTree}
                                            expandedFolders={reuseExpandedFolders}
                                            setExpandedFolders={setReuseExpandedFolders}
                                            basePath={versionData.versionId}
                                            versionId={versionData.versionId}
                                            selectedFilesSet={selectedFilesSet}
                                            onToggleSelection={toggleFileSelection}
                                            onToggleFolderSelection={toggleFolderSelection}
                                            maxHeight={192}
                                        />
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <DialogFooter className="flex-wrap justify-between items-center gap-2 pt-4 border-t border-border">
                        <div className="flex items-center space-x-4">
                            <div className="text-sm text-muted-foreground">
                                {reuseDialog.selectedFiles.length} archivo(s) seleccionado(s)
                            </div>
                            {!noneSelected && (
                                <Button variant="outline" size="sm" onClick={deselectAllFiles} className="border-border text-muted-foreground hover:text-foreground hover:bg-muted/30">
                                    Deseleccionar todo
                                </Button>
                            )}
                        </div>
                        <div className="space-x-2">
                            <Button
                                variant="outline"
                                onClick={() => setReuseDialog(prev => ({ ...prev, open: false }))}
                                className="border-border text-muted-foreground hover:text-foreground hover:bg-muted/30"
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={confirmFileReuse}
                                disabled={reuseDialog.selectedFiles.length === 0}
                                className="bg-white text-black hover:bg-neutral-200"
                            >
                                Reutilizar {reuseDialog.selectedFiles.length} archivo(s)
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="space-y-6">
                {/* Compact Header Card */}
                <div className="bg-card border border-border rounded-xl p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-3xl font-bold text-foreground tracking-tight">{version.modpackName}</h1>
                                <span className={cn(
                                    "text-[10px] font-medium px-2 py-0.5 rounded-md",
                                    version.status === "published" ? "bg-emerald-500/10 text-emerald-400" :
                                        version.status === "draft" ? "bg-amber-500/10 text-amber-400" :
                                            version.status === "archived" ? "bg-neutral-500/10 text-muted-foreground" :
                                                "bg-destructive/10 text-destructive"
                                )}>
                                    {getStatusLabel(version.status)}
                                </span>
                            </div>
                            <p className="text-muted-foreground flex items-center gap-2 text-sm">
                                Versión <code className="bg-muted/30 px-1.5 py-0.5 rounded text-muted-foreground font-mono text-sm">{version.version}</code>
                                <span className="text-border">•</span>
                                <span>Enviada el {new Date(version.createdAt).toLocaleDateString()}</span>
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {version.status === 'draft' && (
                                <Button
                                    onClick={() => setPublishDialog(true)}
                                    disabled={publishing}
                                    className="bg-white text-black hover:bg-neutral-200"
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
                                    className="border-border text-muted-foreground hover:text-foreground hover:bg-muted/30"
                                >
                                    <LucideFolder className="h-4 w-4 mr-2" />
                                    Archivar
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Stat chips + inline ProcessingStatus */}
                    <div className="flex flex-wrap items-center gap-3 mt-5 pt-5 border-t border-border">
                        <div className="bg-muted/30 border border-border rounded-lg px-3 py-2 min-w-[100px]">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Minecraft</p>
                            <p className="text-sm font-medium text-foreground">{version.mcVersion}</p>
                        </div>
                        <div className="bg-muted/30 border border-border rounded-lg px-3 py-2 min-w-[110px]">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Loader</p>
                            <p className="text-sm font-medium text-foreground">{getFormattedLoader()}</p>
                        </div>
                        <div className="bg-muted/30 border border-border rounded-lg px-3 py-2 min-w-[120px]">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Archivos</p>
                            <p className="text-sm font-medium text-foreground">
                                {fileCountsByType.total}
                                {fileCountsByType.totalSizeBytes > 0 && (
                                    <span className="text-xs text-muted-foreground font-normal ml-1.5">
                                        ({formatFileSize(fileCountsByType.totalSizeBytes)})
                                    </span>
                                )}
                            </p>
                        </div>
                        <div className="bg-muted/30 border border-border rounded-lg px-3 py-2 min-w-[100px]">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Creado</p>
                            <p className="text-sm font-medium text-foreground">{new Date(version.createdAt).toLocaleDateString()}</p>
                        </div>
                        {version.releaseDate && (
                            <div className="bg-muted/30 border border-border rounded-lg px-3 py-2 min-w-[100px]">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Publicado</p>
                                <p className="text-sm font-medium text-foreground">{new Date(version.releaseDate).toLocaleDateString()}</p>
                            </div>
                        )}
                        {processingJobs.length > 0 && (
                            <div className="flex flex-wrap gap-2 col-span-full">
                                {processingJobs.map(job => (
                                    <ProcessingJobChip key={job.jobId} job={job} onRetry={handleRetryProcessingJob} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* File breakdown summary card */}
                <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Distribución de Archivos
                        </h3>
                        <span className="text-xs text-muted-foreground">
                            {fileCountsByType.total} {fileCountsByType.total === 1 ? 'archivo' : 'archivos'}
                            {fileCountsByType.totalSizeBytes > 0 && ` • ${formatFileSize(fileCountsByType.totalSizeBytes)}`}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/20 border border-border">
                            <div className="p-2 rounded-md bg-blue-500/10 text-blue-400">
                                <LucidePackage className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-medium">Mods</p>
                                <p className="text-sm font-bold text-foreground">{fileCountsByType.mods}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/20 border border-border">
                            <div className="p-2 rounded-md bg-purple-500/10 text-purple-400">
                                <LucideImage className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-medium">Resources</p>
                                <p className="text-sm font-bold text-foreground">{fileCountsByType.resourcepacks}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/20 border border-border">
                            <div className="p-2 rounded-md bg-amber-500/10 text-amber-400">
                                <LucideSettings className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-medium">Configs</p>
                                <p className="text-sm font-bold text-foreground">{fileCountsByType.config}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/20 border border-border">
                            <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-400">
                                <LucidePalette className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-medium">Shaders</p>
                                <p className="text-sm font-bold text-foreground">{fileCountsByType.shaderpacks}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/20 border border-border">
                            <div className="p-2 rounded-md bg-neutral-500/10 text-neutral-400">
                                <LucideFolder className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-medium">Extras</p>
                                <p className="text-sm font-bold text-foreground">{fileCountsByType.extras}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Expandable Changelog */}
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <button
                        onClick={() => setChangelogExpanded(!changelogExpanded)}
                        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            {changelogExpanded ? <LucideChevronDown className="h-4 w-4 text-muted-foreground" /> : <LucideChevronRight className="h-4 w-4 text-muted-foreground" />}
                            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                <LucideFileText className="h-4 w-4" /> Changelog
                            </h3>
                        </div>
                        {version.status === 'draft' && !editingChangelog && (
                            <button onClick={(e) => { e.stopPropagation(); setEditingChangelog(true); }} className="text-muted-foreground hover:text-foreground transition-colors">
                                <LucideEdit2 className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </button>
                    {changelogExpanded && (
                        <div className="px-5 pb-5 border-t border-border">
                            <div className="pt-4">
                                {editingChangelog ? (
                                    <div className="space-y-3">
                                        <Textarea
                                            value={changelog}
                                            onChange={(e) => setChangelog(e.target.value)}
                                            placeholder="¿Qué ha cambiado?"
                                            rows={8}
                                            className="bg-muted/30 border-border focus:ring-0 text-sm rounded-lg"
                                        />
                                        <div className="flex gap-2 justify-end">
                                            <Button variant="ghost" size="sm" onClick={() => { setEditingChangelog(false); setChangelog(version.changelog || ''); }} className="text-muted-foreground hover:text-foreground">
                                                Cancelar
                                            </Button>
                                            <Button size="sm" onClick={updateChangelog} className="bg-white text-black hover:bg-neutral-200">
                                                <LucideSave className="h-3 w-3 mr-2" /> Guardar
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 p-4 rounded-lg border border-border max-h-60 overflow-auto custom-scrollbar italic leading-relaxed">
                                        {version.changelog || 'No se ha proporcionado un registro de cambios.'}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* File Explorer (full-width) */}
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <Tabs defaultValue="mods" className="w-full">
                        <div className="px-6 pt-5 pb-0">
                            <TabsList className="bg-muted/30 border border-border rounded-lg p-1 w-full justify-start overflow-x-auto h-auto no-scrollbar gap-1">
                                <TabsTrigger value="mods" className="flex items-center gap-2 py-2 data-[state=active]:bg-[#252525] data-[state=active]:text-foreground text-muted-foreground text-sm rounded-md transition-all">
                                    <LucidePackage className="h-4 w-4" />
                                    <span>Mods</span>
                                    <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-muted/60 text-muted-foreground border-0 font-mono">
                                        {fileCountsByType.mods}
                                    </Badge>
                                </TabsTrigger>
                                <TabsTrigger value="resourcepacks" className="flex items-center gap-2 py-2 data-[state=active]:bg-[#252525] data-[state=active]:text-foreground text-muted-foreground text-sm rounded-md transition-all">
                                    <LucideImage className="h-4 w-4" />
                                    <span>Resources</span>
                                    <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-muted/60 text-muted-foreground border-0 font-mono">
                                        {fileCountsByType.resourcepacks}
                                    </Badge>
                                </TabsTrigger>
                                <TabsTrigger value="config" className="flex items-center gap-2 py-2 data-[state=active]:bg-[#252525] data-[state=active]:text-foreground text-muted-foreground text-sm rounded-md transition-all">
                                    <LucideSettings className="h-4 w-4" />
                                    <span>Config</span>
                                    <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-muted/60 text-muted-foreground border-0 font-mono">
                                        {fileCountsByType.config}
                                    </Badge>
                                </TabsTrigger>
                                <TabsTrigger value="shaderpacks" className="flex items-center gap-2 py-2 data-[state=active]:bg-[#252525] data-[state=active]:text-foreground text-muted-foreground text-sm rounded-md transition-all">
                                    <LucidePalette className="h-4 w-4" />
                                    <span>Shaders</span>
                                    <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-muted/60 text-muted-foreground border-0 font-mono">
                                        {fileCountsByType.shaderpacks}
                                    </Badge>
                                </TabsTrigger>
                                <TabsTrigger value="extras" className="flex items-center gap-2 py-2 data-[state=active]:bg-[#252525] data-[state=active]:text-foreground text-muted-foreground text-sm rounded-md transition-all">
                                    <LucideFolder className="h-4 w-4" />
                                    <span>Extras</span>
                                    <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-muted/60 text-muted-foreground border-0 font-mono">
                                        {fileCountsByType.extras}
                                    </Badge>
                                </TabsTrigger>
                            </TabsList>
                        </div>
                        <div className="p-6">
                            <TabsContent value="mods" className="mt-0 outline-none">
                                <FileTypeManager
                                    title="Mods"
                                    description="Modificaciones de jugabilidad (.jar)"
                                    type="mods"
                                    files={version.files || []}
                                    icon={<LucidePackage className="h-5 w-5 text-muted-foreground" />}
                                    versionStatus={version.status}
                                    onDeleteFile={deleteFile}
                                    onUpdateSide={handleUpdateSide}
                                    uploadingFile={uploadingFile}
                                    onOpenUpload={openUploadDialog}
                                    onOpenReuse={openReuseDialog}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                />
                            </TabsContent>
                            <TabsContent value="resourcepacks" className="mt-0 outline-none">
                                <FileTypeManager
                                    title="Resource Packs"
                                    description="Paquetes de texturas y sonidos (.zip)"
                                    type="resourcepacks"
                                    files={version.files || []}
                                    icon={<LucideImage className="h-5 w-5 text-muted-foreground" />}
                                    versionStatus={version.status}
                                    onDeleteFile={deleteFile}
                                    onUpdateSide={handleUpdateSide}
                                    uploadingFile={uploadingFile}
                                    onOpenUpload={openUploadDialog}
                                    onOpenReuse={openReuseDialog}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                />
                            </TabsContent>
                            <TabsContent value="config" className="mt-0 outline-none">
                                <FileTypeManager
                                    title="Configs"
                                    description="Archivos de configuración del servidor y mods"
                                    type="config"
                                    files={version.files || []}
                                    icon={<LucideSettings className="h-5 w-5 text-muted-foreground" />}
                                    versionStatus={version.status}
                                    onDeleteFile={deleteFile}
                                    onUpdateSide={handleUpdateSide}
                                    uploadingFile={uploadingFile}
                                    onOpenUpload={openUploadDialog}
                                    onOpenReuse={openReuseDialog}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                />
                            </TabsContent>
                            <TabsContent value="shaderpacks" className="mt-0 outline-none">
                                <FileTypeManager
                                    title="Shader Packs"
                                    description="Mejoras visuales y sombreadores"
                                    type="shaderpacks"
                                    files={version.files || []}
                                    icon={<LucidePalette className="h-5 w-5 text-muted-foreground" />}
                                    versionStatus={version.status}
                                    onDeleteFile={deleteFile}
                                    onUpdateSide={handleUpdateSide}
                                    uploadingFile={uploadingFile}
                                    onOpenUpload={openUploadDialog}
                                    onOpenReuse={openReuseDialog}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                />
                            </TabsContent>
                            <TabsContent value="extras" className="mt-0 outline-none">
                                <FileTypeManager
                                    title="Extras"
                                    description="Archivos adicionales en la raíz (.minecraft)"
                                    type="extras"
                                    files={version.files || []}
                                    icon={<LucideFolder className="h-5 w-5 text-muted-foreground" />}
                                    versionStatus={version.status}
                                    onDeleteFile={deleteFile}
                                    onUpdateSide={handleUpdateSide}
                                    uploadingFile={uploadingFile}
                                    onOpenUpload={openUploadDialog}
                                    onOpenReuse={openReuseDialog}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                />
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>
            </div>
        </>
    );
};

export default PublisherModpackVersionDetailView;