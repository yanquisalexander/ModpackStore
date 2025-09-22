import { useGlobalContext } from "@/stores/GlobalContext";
import {
    LucideLoader,
    LucideVerified,
    LucideVolume2,
    LucideVolumeX,
    LucideChevronDown,
    LucideFolder,
    LucideFile,
    LucideChevronRight,
    LucideFileJson,
    LucideFileText,
    LucideFileArchive,
    LucideFileImage,
    LucideRotateCcw
} from "lucide-react";
import { useEffect, useState, useRef, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, useScroll, useTransform } from "motion/react";
import { TauriCommandReturns } from "@/types/TauriCommandReturns";
import { invoke } from "@tauri-apps/api/core";
import { InstallButton } from "../components/install-modpacks/ModpackInstallButton";
import { TwitchRequirements } from "@/components/TwitchRequirements";
import { ModpackDataOverview } from "@/types/ApiResponses";
import { getModpackVersions, ModpackVersionPublic, getLatestVersion, getNonArchivedVersions } from "@/services/getModpackVersions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthentication } from "@/stores/AuthContext";
import { getModpackById } from "@/services/getModpacks";
import { API_ENDPOINT } from "@/consts";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

// Hook personalizado para verificar el acceso del usuario a un modpack
const useModpackAccess = (modpackId: string, requiresTwitchSubscription: boolean) => {
    const [accessState, setAccessState] = useState<{
        canAccess: boolean;
        loading: boolean;
        reason?: string;
        requiredChannels?: string[];
    }>({
        canAccess: false,
        loading: true
    });
    const { session, sessionTokens } = useAuthentication();

    useEffect(() => {
        if (!requiresTwitchSubscription) {
            setAccessState({
                canAccess: true,
                loading: false
            });
            return;
        }

        const checkAccess = async () => {
            try {
                const response = await fetch(`${API_ENDPOINT}/explore/modpacks/${modpackId}/check-access`, {
                    method: 'GET',
                    headers: sessionTokens ? {
                        'Authorization': `Bearer ${sessionTokens.accessToken}`,
                    } : {},
                });

                if (!response.ok) {
                    throw new Error('Failed to check access');
                }

                const data = await response.json();
                // Debug: log API response to help diagnose mismatches
                console.debug('check-access response', data);

                // Normalize server response: support { canAccess } or { hasAccess }
                let canAccess = typeof data.canAccess !== 'undefined' ? data.canAccess : (typeof data.hasAccess !== 'undefined' ? data.hasAccess : false);

                // If server returned a list of subscribedChannels, infer access when it's non-empty
                const hasSubscribedChannels = Array.isArray(data.subscribedChannels) && data.subscribedChannels.length > 0;
                if (!canAccess && hasSubscribedChannels) {
                    // If user is subscribed to any required channel, consider they have access
                    canAccess = true;
                }

                const requiredChannels = data.requiredChannels ?? (Array.isArray(data.subscribedChannels) ? data.subscribedChannels.map((c: any) => c.username || c.displayName || c.id) : undefined);
                const reason = data.reason ?? data.message;

                setAccessState({
                    canAccess,
                    loading: false,
                    reason,
                    requiredChannels
                });
            } catch (error) {
                console.error('Error checking modpack access:', error);
                setAccessState({
                    canAccess: false,
                    loading: false,
                    reason: 'Error checking access'
                });
            }
        };

        checkAccess();
    }, [modpackId, requiresTwitchSubscription, session, sessionTokens]);

    return accessState;
};

// --- Helper Components & Types for File Tree ---

// Types for our tree structure
interface FileNodeData {
    type: 'file';
    data: ModpackVersionPublic['files'][0];
}

interface FolderNodeData {
    type: 'folder';
    children: { [key: string]: TreeNode };
}

type TreeNode = FileNodeData | FolderNodeData;

// Helper function to get a specific icon based on file extension
const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'json':
            return <LucideFileJson className="size-4 mr-2 text-yellow-400 flex-shrink-0" />;
        case 'jar':
        case 'zip':
            return <LucideFileArchive className="size-4 mr-2 text-orange-400 flex-shrink-0" />;
        case 'txt':
        case 'md':
        case 'cfg':
        case 'properties':
            return <LucideFileText className="size-4 mr-2 text-blue-400 flex-shrink-0" />;
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'webp':
            return <LucideFileImage className="size-4 mr-2 text-purple-400 flex-shrink-0" />;
        default:
            return <LucideFile className="size-4 mr-2 text-gray-400 flex-shrink-0" />;
    }
};

// Recursive component to render a node in the file tree
const FileTreeNode = ({ name, node, expandedFolders, setExpandedFolders, path }: {
    name: string;
    node: TreeNode;
    expandedFolders: { [key: string]: boolean };
    setExpandedFolders: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
    path: string;
}) => {
    if (node.type === 'folder') {
        const isExpanded = expandedFolders[path];
        const toggleExpand = () => {
            setExpandedFolders(prev => ({ ...prev, [path]: !isExpanded }));
        };

        return (
            <div>
                <div onClick={toggleExpand} className="flex items-center cursor-pointer hover:bg-white/5 p-1 rounded transition-colors">
                    {isExpanded
                        ? <LucideChevronDown className="size-4 mr-2 text-white/70 flex-shrink-0" />
                        : <LucideChevronRight className="size-4 mr-2 text-white/70 flex-shrink-0" />
                    }
                    <LucideFolder className="size-4 mr-2 text-sky-400 flex-shrink-0" />
                    <span className="text-white/90">{name}</span>
                </div>
                {isExpanded && (
                    <div className="pl-6 border-l border-white/10 ml-2">
                        {Object.entries(node.children)
                            .sort(([aName, aNode], [bName, bNode]) => {
                                // Sort folders before files, then alphabetically
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
                                />
                            ))}
                    </div>
                )}
            </div>
        );
    }

    // It's a file
    return (
        <div className="flex items-center p-1 ml-4">
            <div className='w-4 mr-2'></div> {/* Indent spacer */}
            {getFileIcon(name)}
            <span className="text-white/80">{name}</span>
        </div>
    );
};

// --- Main Component ---

export const ModpackOverview = ({ modpackId }: { modpackId: string }) => {
    const { session } = useAuthentication();

    const [pageState, setPageState] = useState({
        loading: true,
        error: false,
        errorMessage: "",
        modpackData: null as ModpackDataOverview | null,
    });

    const [isMuted, setIsMuted] = useState(true);
    const [showVideo, setShowVideo] = useState(false);
    const [videoLoaded, setVideoLoaded] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const bannerContainerRef = useRef<HTMLDivElement>(null);
    const [localInstancesOfModpack, setLocalInstancesOfModpack] = useState<TauriCommandReturns["get_instances_by_modpack_id"]>([]);

    // Version management state
    const [versions, setVersions] = useState<ModpackVersionPublic[]>([]);
    const [selectedVersionId, setSelectedVersionId] = useState<string>("latest");
    const [versionsLoading, setVersionsLoading] = useState(true);

    // State for the file tree view
    const [expandedFolders, setExpandedFolders] = useState<{ [key: string]: boolean }>({});

    // Hook para verificar acceso a Twitch
    const { canAccess: userCanAccess, loading: accessLoading } = useModpackAccess(modpackId, pageState.modpackData?.requiresTwitchSubscription || false);

    const { titleBarState, setTitleBarState } = useGlobalContext();
    const { scrollY } = useScroll();

    // Transformaciones basadas en el scroll para el efecto parallax
    const bannerY = useTransform(scrollY, [0, 500], [0, 150]);
    const bannerScale = useTransform(scrollY, [0, 300], [1.05, 1.15]);
    const bannerOpacity = useTransform(scrollY, [0, 300], [1, 0.3]);

    // Helper functions for version management
    const getSelectedVersion = (): ModpackVersionPublic | null => {
        if (selectedVersionId === "latest") {
            return getLatestVersion(versions);
        }
        return versions.find(v => v.id === selectedVersionId) || null;
    };

    const selectedVersion = getSelectedVersion();

    const fileTree = useMemo(() => {
        if (!selectedVersion || !selectedVersion.files) return {};

        const buildFileTree = (files: typeof selectedVersion.files): { [key: string]: TreeNode } => {
            const tree: { [key: string]: TreeNode } = {};
            files.forEach(fileData => {
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

        return buildFileTree(selectedVersion.files);
    }, [selectedVersion]);

    useEffect(() => {
        // Expand top-level folders by default when the tree changes
        const initialExpansionState: { [key: string]: boolean } = {};
        Object.keys(fileTree).forEach(key => {
            if (fileTree[key].type === 'folder') {
                initialExpansionState[key] = true;
            }
        });
        setExpandedFolders(initialExpansionState);
    }, [fileTree]);

    const extractImportantFixes = (changelog: string): string[] => {
        // Extract items that look like fixes from the changelog
        const lines = changelog?.split('\n') || [];
        const fixes: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();
            // Look for lines that start with - or * and contain fix-related keywords
            if ((trimmed.startsWith('-') || trimmed.startsWith('*')) &&
                (trimmed.toLowerCase().includes('fix') ||
                    trimmed.toLowerCase().includes('corregido') ||
                    trimmed.toLowerCase().includes('solucionado') ||
                    trimmed.toLowerCase().includes('arreglo'))) {
                fixes.push(trimmed.replace(/^[-*]\s*/, ''));
            }
        }

        // If no specific fixes found, look for general improvement items
        if (fixes.length === 0) {
            for (const line of lines) {
                const trimmed = line.trim();
                if ((trimmed.startsWith('-') || trimmed.startsWith('*')) && trimmed.length > 10) {
                    fixes.push(trimmed.replace(/^[-*]\s*/, ''));
                    if (fixes.length >= 3) break; // Limit to 3 items
                }
            }
        }

        return fixes.slice(0, 5); // Limit to 5 most important fixes
    };

    useEffect(() => {
        setTitleBarState({
            ...titleBarState,
            canGoBack: {
                history: true
            },
            opaque: true,
            title: pageState.modpackData?.name || "Modpack Overview",
            icon: pageState.modpackData?.iconUrl || "/images/modpack-fallback.webp",
            customIconClassName: "rounded-sm",
        });
    }, [pageState.modpackData]);

    useEffect(() => {
        const fetchLocalInstances = async () => {
            try {
                const instances = await invoke<TauriCommandReturns["get_instances_by_modpack_id"]>("get_instances_by_modpack_id", { modpackId });
                setLocalInstancesOfModpack(instances);
                console.log("Local instances of modpack:", instances);
            } catch (err) {
                console.error("Failed to fetch local instances:", err);
            }
        };

        fetchLocalInstances();
    }, [modpackId]);

    // Efecto para cargar el video con retraso
    useEffect(() => {
        if (pageState.loading || !pageState.modpackData?.trailerUrl) return;

        const timer = setTimeout(() => {
            setShowVideo(true);
        }, 3000);

        return () => clearTimeout(timer);
    }, [pageState.loading, pageState.modpackData]);

    // Efecto para manejar la visibilidad del video y pausarlo cuando no es visible
    useEffect(() => {
        if (!videoRef.current || !bannerContainerRef.current || !showVideo) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    if (videoLoaded) {
                        videoRef.current?.play();
                    }
                } else {
                    videoRef.current?.pause();
                }
            },
            { threshold: 0.1 }
        );

        observer.observe(bannerContainerRef.current);

        return () => {
            if (bannerContainerRef.current) {
                observer.unobserve(bannerContainerRef.current);
            }
        };
    }, [pageState.loading, showVideo, videoLoaded]);

    useEffect(() => {
        const fetchModpack = async () => {
            try {
                const modpack = await getModpackById(modpackId);
                setPageState({
                    loading: false,
                    error: false,
                    errorMessage: "",
                    modpackData: modpack as unknown as ModpackDataOverview
                });
            } catch (err: any) {
                setPageState({
                    loading: false,
                    error: true,
                    errorMessage: err?.message || "Failed to load modpack",
                    modpackData: null
                });
            }
        };

        const fetchVersions = async () => {
            try {
                setVersionsLoading(true);
                const fetchedVersions = await getModpackVersions(modpackId);
                const nonArchivedVersions = getNonArchivedVersions(fetchedVersions);
                setVersions(nonArchivedVersions);

                // Set default selection to latest if available
                if (nonArchivedVersions.length > 0) {
                    setSelectedVersionId("latest");
                }
            } catch (err) {
                console.error("Failed to fetch versions:", err);
                setVersions([]);
            } finally {
                setVersionsLoading(false);
            }
        };

        fetchModpack();
        fetchVersions();
    }, [modpackId]);

    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !videoRef.current.muted;
            setIsMuted(!isMuted);
        }
    };

    const handleVideoLoaded = () => {
        setVideoLoaded(true);
        if (videoRef.current && bannerContainerRef.current) {
            const observer = new IntersectionObserver(
                ([entry]) => {
                    if (entry.isIntersecting) {
                        videoRef.current?.play();
                    }
                },
                { threshold: 0.1 }
            );
            observer.observe(bannerContainerRef.current);
            return () => {
                if (bannerContainerRef.current) {
                    observer.unobserve(bannerContainerRef.current);
                }
            };
        }
    };

    const handleVideoEnd = () => {
        // Back again to banner image
        setShowVideo(false);
        setVideoLoaded(false);
    };

    if (pageState.loading) {
        return (
            <div className="flex items-center justify-center min-h-screen w-full">
                <LucideLoader className="size-10 animate-spin text-white" />
            </div>
        );
    }

    if (pageState.error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen w-full text-red-500">
                <p className="text-lg font-semibold">Error:</p>
                <p>{pageState.errorMessage}</p>
            </div>
        );
    }

    if (!pageState.modpackData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen w-full text-red-500">
                <p className="text-lg font-semibold">Error:</p>
                <p>Modpack no encontrado.</p>
            </div>
        );
    }

    const { modpackData } = pageState;
    const { showUserAsPublisher } = modpackData;

    // Creamos una copia del publisher para mostrar el usuario si es necesario
    let displayPublisher = { ...modpackData.publisher } as NonNullable<ModpackDataOverview["publisher"]>;
    const originalPublisherName = displayPublisher.publisherName;

    // Si debemos mostrar el usuario como publisher, cambiamos el nombre
    if (showUserAsPublisher && modpackData.creatorUser) {
        displayPublisher = {
            ...displayPublisher,
            publisherName: modpackData.creatorUser.username || "Desconocido",
        };
    }

    const hasVideo = modpackData.trailerUrl && modpackData.trailerUrl.length > 0;

    return (
        <div className="relative w-full h-full">
            {/* Banner con parallax usando Framer Motion */}
            <div
                ref={bannerContainerRef}
                className="absolute inset-0 z-11 overflow-hidden w-full h-[60vh] aspect-video"
            >
                <motion.div
                    className="absolute inset-0 w-full h-full"
                    style={{
                        y: bannerY,
                        scale: bannerScale,
                        opacity: bannerOpacity
                    }}
                >
                    {/* Banner de imagen siempre presente */}
                    <div
                        className={`w-full h-full animate-fade-in bg-cover bg-center transition-opacity duration-1000 ${showVideo && videoLoaded ? 'opacity-0' : 'opacity-100'}`}
                        style={{ backgroundImage: `url(${modpackData.bannerUrl})` }}
                    />

                    {/* Video con fade in cuando está listo */}
                    {hasVideo && showVideo && (
                        <>
                            <div className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ${videoLoaded ? 'opacity-100' : 'opacity-0'}`}>
                                <video
                                    ref={videoRef}
                                    muted
                                    playsInline
                                    autoPlay
                                    onEnded={handleVideoEnd}
                                    className="w-full h-full object-cover"
                                    src={modpackData.trailerUrl}
                                    onLoadedData={handleVideoLoaded}
                                />
                            </div>

                            {/* Botón visible siempre que haya video y esté activo */}
                            <button
                                onClick={toggleMute}
                                className="cursor-pointer absolute top-4 right-8 p-2 bg-black/50 backdrop-blur-sm rounded-full z-999"
                            >
                                {isMuted ? (
                                    <LucideVolumeX className="size-6 text-white" />
                                ) : (
                                    <LucideVolume2 className="size-6 text-white" />
                                )}
                            </button>
                        </>
                    )}

                </motion.div>

                {/* Capa de gradiente */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-[#181818] pointer-events-none" />
            </div>

            {/* Contenido principal - con scroll normal */}
            <div className="relative z-10 min-h-screen">
                <motion.main
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="px-4 py-8 md:px-12 lg:px-24"
                >
                    <div className="flex flex-col gap-6 pt-[60vh]">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            className="flex flex-col md:flex-row md:items-center gap-4"
                        >
                            <div className="flex items-center gap-4 flex-1">
                                <img
                                    src={modpackData.iconUrl ?? "/images/modpack-fallback.webp"}
                                    onError={(e) => {
                                        e.currentTarget.onerror = null; // Prevent infinite loop
                                        e.currentTarget.src = "/images/modpack-fallback.webp"; // Fallback image
                                    }}
                                    alt={`${modpackData.name} icon`}
                                    className="w-20 h-20 rounded-2xl shadow-md"
                                />
                                <div>
                                    <h1 className="text-4xl font-bold text-white">{modpackData.name}</h1>
                                    <div className="flex items-center gap-2 text-white/90 text-sm">
                                        <span>{displayPublisher.publisherName}</span>

                                        {/* Mostramos el verificado solo si no estamos mostrando el usuario como publisher */}
                                        {!showUserAsPublisher && displayPublisher.verified && (
                                            <LucideVerified className="w-4 h-4 text-blue-400" />
                                        )}

                                        {/* Badge de Partner */}
                                        {!showUserAsPublisher && displayPublisher.partnered && (
                                            <span className="bg-yellow-400 text-black text-xs font-medium px-2 py-0.5 rounded-md ml-2">
                                                Partner
                                            </span>
                                        )}

                                        {/* Badge de Afiliado cuando el publisher es un socio de hosting */}
                                        {showUserAsPublisher && displayPublisher.isHostingPartner && (
                                            <span className="bg-purple-500 text-white text-xs font-medium px-2 py-0.5 rounded-md ml-2 flex items-center">
                                                Afiliado de {originalPublisherName} {
                                                    displayPublisher.verified && (
                                                        <LucideVerified className="w-4 h-4 text-white  ml-1" />
                                                    )
                                                }
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Controles a la derecha: requisitos de Twitch + botón */}
                            <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                                {modpackData.requiresTwitchSubscription && !modpackData.isPasswordProtected && (
                                    <div className="w-full md:max-w-sm">
                                        <TwitchRequirements
                                            requiresTwitchSubscription={modpackData.requiresTwitchSubscription}
                                            requiredTwitchChannels={modpackData.requiredTwitchChannels || []}
                                            userHasTwitchLinked={Boolean(session?.twitchId)}
                                            modpackId={modpackId}
                                        />
                                    </div>
                                )}

                                {/* Botón de instalación */}
                                <div className="w-full md:w-auto">
                                    <InstallButton
                                        modpackId={modpackId}
                                        modpackName={modpackData.name!}
                                        localInstances={localInstancesOfModpack}
                                        acquisitionMethod={modpackData.acquisitionMethod || 
                                            (modpackData.isPasswordProtected ? 'password' :
                                             modpackData.requiresTwitchSubscription ? 'twitch_sub' :
                                             modpackData.isPaid ? 'paid' : 'free')
                                        }
                                        isPasswordProtected={modpackData.isPasswordProtected}
                                        isPaid={modpackData.isPaid}
                                        isFree={modpackData.isFree}
                                        price={modpackData.price}
                                        requiresTwitchSubscription={modpackData.requiresTwitchSubscription}
                                        requiredTwitchChannels={modpackData.requiredTwitchChannels}
                                        selectedVersionId={selectedVersionId}
                                        disabled={modpackData.requiresTwitchSubscription && !accessLoading && !userCanAccess}
                                    />
                                </div>
                            </div>
                        </motion.div>

                        {/* Tabs */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                        >
                            <Tabs defaultValue="overview" className="w-full pb-16">
                                <TabsList className="w-full justify-start bg-black/40 backdrop-blur-md">
                                    <TabsTrigger value="overview">Descripción</TabsTrigger>
                                    <TabsTrigger value="files">Archivos de Modpack</TabsTrigger>
                                    <TabsTrigger value="changelog">Changelog</TabsTrigger>
                                    <TabsTrigger value="versions">Versiones</TabsTrigger>
                                </TabsList>

                                <TabsContent value="overview" className="mt-6">
                                    <h2 className="text-xl font-semibold text-white mb-4">Descripción</h2>
                                    <div className="prose prose-invert max-w-none">
                                        <MarkdownRenderer 
                                            content={modpackData.description || ""}
                                            className="text-white/80"
                                        />
                                    </div>
                                </TabsContent>

                                <TabsContent value="files" className="mt-6">
                                    {selectedVersion && selectedVersion.files && selectedVersion.files.length > 0 ? (
                                        <div className="bg-black/20 rounded-lg p-4 font-mono text-sm space-y-1 border border-white/10">
                                            {Object.entries(fileTree)
                                                .sort(([aName, aNode], [bName, bNode]) => {
                                                    // Sort folders before files, then alphabetically
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
                                                    />
                                                ))}
                                        </div>
                                    ) : (
                                        <p className="text-white/80">No hay archivos disponibles para esta versión.</p>
                                    )}
                                </TabsContent>


                                <TabsContent value="changelog" className="mt-6">
                                    <div className="space-y-4">
                                        {/* Version selector */}
                                        <div className="flex items-center gap-4">
                                            <label className="text-white text-sm font-medium">Versión:</label>
                                            <Select
                                                value={selectedVersionId}
                                                onValueChange={setSelectedVersionId}
                                                disabled={versionsLoading || versions.length === 0}
                                            >
                                                <SelectTrigger className="w-48 bg-black/40 border-white/20 text-white">
                                                    <SelectValue placeholder="Seleccionar versión" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-zinc-900 border-zinc-700 text-white">
                                                    <SelectItem value="latest" className="focus:bg-zinc-800">
                                                        Última versión (latest)
                                                    </SelectItem>
                                                    {versions.map((version) => (
                                                        <SelectItem
                                                            key={version.id}
                                                            value={version.id}
                                                            className="focus:bg-zinc-800"
                                                        >
                                                            {version.version} - MC {version.mcVersion}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {versionsLoading ? (
                                            <div className="flex items-center justify-center py-8">
                                                <LucideLoader className="size-6 animate-spin text-white" />
                                                <span className="ml-2 text-white/80">Cargando changelog...</span>
                                            </div>
                                        ) : (
                                            <>
                                                {(() => {
                                                    if (!selectedVersion) {
                                                        return (
                                                            <p className="text-white/80">No hay changelog disponible para esta versión.</p>
                                                        )
                                                    }

                                                    const importantFixes = extractImportantFixes(selectedVersion.changelog)

                                                    return (
                                                        <div className="space-y-6">
                                                            {/* Selected version info */}
                                                            <div className="bg-black/20 rounded-lg p-4 border border-white/10">
                                                                <div className="flex items-center justify-between">
                                                                    <div>
                                                                        <h3 className="text-lg font-semibold text-white">
                                                                            {selectedVersion.version}
                                                                        </h3>
                                                                        <p className="text-white/60 text-sm">
                                                                            Minecraft {selectedVersion.mcVersion}
                                                                            {selectedVersion.forgeVersion && ` • Forge ${selectedVersion.forgeVersion}`}
                                                                        </p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="text-white/60 text-sm">
                                                                            {selectedVersion.releaseDate
                                                                                ? new Date(selectedVersion.releaseDate).toLocaleDateString()
                                                                                : 'Fecha no disponible'
                                                                            }
                                                                        </p>
                                                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${selectedVersion.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                                            {selectedVersion.status === 'published' ? 'Publicado' : selectedVersion.status}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Important fixes section */}
                                                            {importantFixes.length > 0 && (
                                                                <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-500/20">
                                                                    <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                                                                        <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                                                                        Arreglos Importantes
                                                                    </h4>
                                                                    <ul className="space-y-2">
                                                                        {importantFixes.map((fix, index) => (
                                                                            <li key={index} className="text-white/80 text-sm flex items-start gap-2">
                                                                                <span className="text-blue-400 mt-1">•</span>
                                                                                <span>{fix}</span>
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}

                                                            {/* Full changelog */}
                                                            <div className="bg-black/20 rounded-lg p-4 border border-white/10">
                                                                <h4 className="text-white font-medium mb-3">Changelog Completo</h4>
                                                                <div className="prose prose-invert max-w-none">
                                                                    <pre className="whitespace-pre-wrap text-sm text-white/80 bg-black/30 p-4 rounded border border-white/10 overflow-x-auto">
                                                                        {selectedVersion.changelog || "No hay changelog para esta versión."}
                                                                    </pre>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })()}
                                            </>
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="versions" className="mt-6">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h2 className="text-xl font-semibold text-white">Versiones Disponibles</h2>
                                            <span className="text-white/60 text-sm">
                                                {versions.length} versión{versions.length !== 1 ? 'es' : ''} disponible{versions.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>

                                        {versionsLoading ? (
                                            <div className="flex items-center justify-center py-8">
                                                <LucideLoader className="size-6 animate-spin text-white" />
                                                <span className="ml-2 text-white/80">Cargando versiones...</span>
                                            </div>
                                        ) : versions.length === 0 ? (
                                            <div className="text-center py-8">
                                                <p className="text-white/80">No hay versiones disponibles para este modpack.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {versions
                                                    .sort((a, b) => {
                                                        // Sort by release date, most recent first
                                                        const dateA = new Date(a.releaseDate || a.createdAt)
                                                        const dateB = new Date(b.releaseDate || b.createdAt)
                                                        return dateB.getTime() - dateA.getTime()
                                                    })
                                                    .map((version) => {
                                                        const isLatest = getLatestVersion(versions)?.id === version.id
                                                        const isSelected = selectedVersionId === version.id ||
                                                            (selectedVersionId === "latest" && isLatest)
                                                        const importantFixes = extractImportantFixes(version.changelog)

                                                        return (
                                                            <div
                                                                key={version.id}
                                                                className={`bg-black/20 rounded-lg p-4 border transition-all cursor-pointer hover:bg-black/30 ${isSelected
                                                                    ? 'border-blue-500/50 bg-blue-900/10'
                                                                    : 'border-white/10'
                                                                    }`}
                                                                onClick={() => setSelectedVersionId(version.id)}
                                                            >
                                                                <div className="flex items-start justify-between">
                                                                    <div className="flex-1">
                                                                        <div className="flex items-center gap-3 mb-2">
                                                                            <h3 className="text-lg font-semibold text-white">
                                                                                {version.version}
                                                                            </h3>
                                                                            {isLatest && (
                                                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                                                    Última
                                                                                </span>
                                                                            )}
                                                                            {isSelected && (
                                                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                                                    Seleccionada
                                                                                </span>
                                                                            )}

                                                                            {
                                                                                isLatest && isSelected && (
                                                                                    <span className="ml-auto self-end flex items-center gap-1 rounded-full bg-orange-100 border text-sm border-orange-700/30 text-orange-500 font-medium px-2">
                                                                                        <LucideRotateCcw size={14} />
                                                                                        Actualizaciones automáticas
                                                                                    </span>
                                                                                )
                                                                            }
                                                                        </div>

                                                                        <div className="grid grid-cols-2 gap-4 text-sm text-white/80 mb-3">
                                                                            <div>
                                                                                <span className="text-white/60">Minecraft:</span> {version.mcVersion}
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-white/60">Forge:</span> {version.forgeVersion || 'No especificado'}
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-white/60">Publicado:</span> {
                                                                                    version.releaseDate
                                                                                        ? new Date(version.releaseDate).toLocaleDateString()
                                                                                        : 'Fecha no disponible'
                                                                                }
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-white/60">Estado:</span> {
                                                                                    version.status === 'published' ? 'Publicado' : version.status
                                                                                }
                                                                            </div>
                                                                        </div>

                                                                        {/* Show important fixes if available */}
                                                                        {importantFixes.length > 0 && (
                                                                            <div className="mt-3">
                                                                                <h4 className="text-white/80 text-sm font-medium mb-2">Arreglos principales:</h4>
                                                                                <ul className="space-y-1">
                                                                                    {importantFixes.slice(0, 3).map((fix, index) => (
                                                                                        <li key={index} className="text-white/60 text-sm flex items-start gap-2">
                                                                                            <span className="text-blue-400 mt-1 text-xs">•</span>
                                                                                            <span className="line-clamp-1">{fix}</span>
                                                                                        </li>
                                                                                    ))}
                                                                                    {importantFixes.length > 3 && (
                                                                                        <li className="text-white/40 text-xs italic">
                                                                                            +{importantFixes.length - 3} arreglos más...
                                                                                        </li>
                                                                                    )}
                                                                                </ul>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })
                                                }
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </motion.div>
                    </div>
                </motion.main>
            </div>
        </div>
    );
};