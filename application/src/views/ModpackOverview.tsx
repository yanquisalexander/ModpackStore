import { useGlobalContext } from "@/stores/GlobalContext";
import {
    LucideLoader,
    LucideVerified,
    LucideVolume2,
    LucideVolumeX,
    LucideFolderOpen,
    LucideFileJson,
    LucideFileText,
    LucideFileArchive,
    LucideFileImage,
    LucideCalendar,
    LucideBox,
    LucideCpu,
    LucideInfo,
    LucideDownload,
    LucideChevronDown,
    LucideChevronRight,
    LucideFolder,
    LucideFile,
    LucideClock
} from "lucide-react";
import { useEffect, useState, useRef, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, useScroll, useTransform, AnimatePresence } from "motion/react";
import { TauriCommandReturns } from "@/types/TauriCommandReturns";
import { ExternalLinkHandler } from '@/components/ExternalLinkHandler';
import { invoke } from "@tauri-apps/api/core";
import { InstallButton } from "../components/install-modpacks/ModpackInstallButton";
import { TwitchRequirements } from "@/components/TwitchRequirements";
import { VoteButtons } from "@/components/modpack/VoteButtons";
import { RelatedModpacks } from "@/components/modpack/RelatedModpacks";
import { ModpackDataOverview } from "@/types/ApiResponses";
import { getModpackVersions, ModpackVersionPublic, getLatestVersion, getNonArchivedVersions } from "@/services/getModpackVersions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthentication } from "@/stores/AuthContext";
import { getModpackById } from "@/services/getModpacks";
import { getVoteCounts, getUserVotes, VoteCounts } from "@/services/votes";
import { API_ENDPOINT } from "@/consts";
import { cn } from "@/lib/utils";

// --- UTILS ---
const formatLoaderInfo = (version: ModpackVersionPublic): string => {
    const loaderType = version.loaderType || version.modLoader || "unknown";
    const loaderVersion = version.loaderVersion || "";
    return `${loaderType.charAt(0).toUpperCase() + loaderType.slice(1)} ${loaderVersion}`;
};

// --- FILE EXPLORER COMPONENTS ---
interface FileNodeData { type: 'file'; data: any; }
interface FolderNodeData { type: 'folder'; children: { [key: string]: TreeNode }; }
type TreeNode = FileNodeData | FolderNodeData;

const FileIcon = ({ name }: { name: string }) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (['json', 'toml'].includes(ext!)) return <LucideFileJson className="size-4 text-yellow-400 shrink-0" />;
    if (['jar', 'zip'].includes(ext!)) return <LucideFileArchive className="size-4 text-orange-400 shrink-0" />;
    if (['txt', 'md', 'cfg', 'properties'].includes(ext!)) return <LucideFileText className="size-4 text-blue-400 shrink-0" />;
    if (['png', 'jpg', 'webp'].includes(ext!)) return <LucideFileImage className="size-4 text-purple-400 shrink-0" />;
    return <LucideFile className="size-4 text-neutral-500 shrink-0" />;
};

const FileTreeItem = ({ name, node, depth = 0 }: { name: string, node: TreeNode, depth?: number }) => {
    const [isOpen, setIsOpen] = useState(depth < 1);

    if (node.type === 'folder') {
        return (
            <div className="select-none">
                <div
                    className={cn(
                        "flex items-center gap-1.5 py-1.5 px-2 rounded-md cursor-pointer transition-colors text-sm hover:bg-white/5",
                        isOpen ? "text-neutral-200" : "text-neutral-400"
                    )}
                    style={{ paddingLeft: `${depth * 16 + 8}px` }}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <span className="opacity-50">
                        {isOpen ? <LucideChevronDown size={14} /> : <LucideChevronRight size={14} />}
                    </span>
                    <LucideFolder className={cn("size-4 shrink-0", isOpen ? "text-blue-400" : "text-blue-400/70")} />
                    <span className="truncate">{name}</span>
                </div>

                {isOpen && (
                    <div>
                        {Object.entries(node.children)
                            .sort(([aName, aNode]: any, [bName, bNode]: any) => {
                                if (aNode.type === 'folder' && bNode.type !== 'folder') return -1;
                                if (aNode.type !== 'folder' && bNode.type === 'folder') return 1;
                                return aName.localeCompare(bName);
                            })
                            .map(([childName, childNode]) => (
                                <FileTreeItem key={childName} name={childName} node={childNode} depth={depth + 1} />
                            ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div
            className="flex items-center gap-2 py-1.5 px-2 text-sm text-neutral-400 hover:text-white hover:bg-white/5 rounded-md cursor-default"
            style={{ paddingLeft: `${depth * 16 + 28}px` }}
        >
            <FileIcon name={name} />
            <span className="truncate">{name}</span>
        </div>
    );
};

// --- MAIN COMPONENT ---

export const ModpackOverview = ({ modpackId }: { modpackId: string }) => {
    const { session, sessionTokens } = useAuthentication();
    const { titleBarState, setTitleBarState } = useGlobalContext();

    // UI Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const { scrollY } = useScroll();
    const bannerY = useTransform(scrollY, [0, 500], [0, 100]);

    // Data State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modpack, setModpack] = useState<ModpackDataOverview | null>(null);
    const [versions, setVersions] = useState<ModpackVersionPublic[]>([]);
    const [selectedVersionId, setSelectedVersionId] = useState<string>("latest");
    const [localInstances, setLocalInstances] = useState<TauriCommandReturns["get_instances_by_modpack_id"]>([]);
    const [voteCounts, setVoteCounts] = useState<VoteCounts | null>(null);
    const [userVote, setUserVote] = useState<'like' | 'dislike' | 'none'>('none');

    // Media State
    const [showVideo, setShowVideo] = useState(false);
    const [videoLoaded, setVideoLoaded] = useState(false);
    const [isMuted, setIsMuted] = useState(true);

    const [canAccess, setCanAccess] = useState(true);
    const [accessLoading, setAccessLoading] = useState(false);

    // --- SCROLL HANDLING ---
    useEffect(() => {
        // Force scroll to top when modpackId changes or loading finishes
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [modpackId]);

    useEffect(() => {
        if (!loading) {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }
    }, [loading]);

    // --- FETCH DATA ---
    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const [mpData, vData, iData, votes] = await Promise.all([
                    getModpackById(modpackId),
                    getModpackVersions(modpackId),
                    invoke<TauriCommandReturns["get_instances_by_modpack_id"]>("get_instances_by_modpack_id", { modpackId }),
                    getVoteCounts(modpackId)
                ]);

                setModpack(mpData as unknown as ModpackDataOverview);
                const validVersions = getNonArchivedVersions(vData);
                setVersions(validVersions);
                if (validVersions.length > 0) setSelectedVersionId("latest");

                setLocalInstances(iData);
                setVoteCounts(votes);

                if (session) {
                    const uVotes = await getUserVotes();
                    setUserVote(uVotes.votes[modpackId] || 'none');
                }

                if ((mpData as any).trailerUrl) setTimeout(() => setShowVideo(true), 2500);

            } catch (e: any) {
                setError(e.message || "Error cargando modpack");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [modpackId, session]);

    // Access Check
    useEffect(() => {
        if (!modpack?.requiresTwitchSubscription) return;
        const check = async () => {
            setAccessLoading(true);
            try {
                const res = await fetch(`${API_ENDPOINT}/explore/modpacks/${modpackId}/check-access`, {
                    headers: sessionTokens ? { 'Authorization': `Bearer ${sessionTokens.accessToken}` } : {}
                });
                const data = await res.json();
                setCanAccess(data.canAccess || data.hasAccess || false);
            } catch { setCanAccess(false); } finally { setAccessLoading(false); }
        };
        check();
    }, [modpack, sessionTokens]);

    // Titlebar
    useEffect(() => {
        setTitleBarState({ ...titleBarState, opaque: false, title: modpack?.name || "", canGoBack: { history: true }, icon: undefined });
    }, [modpack]);

    // Computed
    const selectedVersion = useMemo(() => {
        if (selectedVersionId === "latest") return getLatestVersion(versions);
        return versions.find(v => v.id === selectedVersionId);
    }, [selectedVersionId, versions]);

    const fileTree = useMemo(() => {
        if (!selectedVersion?.files) return {};
        const tree: any = {};
        selectedVersion.files.forEach((f: any) => {
            const parts = f.path.split('/');
            let current = tree;
            parts.forEach((part: string, i: number) => {
                if (i === parts.length - 1) current[part] = { type: 'file', data: f };
                else {
                    if (!current[part]) current[part] = { type: 'folder', children: {} };
                    current = current[part].children;
                }
            });
        });
        return tree;
    }, [selectedVersion]);

    if (loading) return <div className="h-screen flex items-center justify-center"><LucideLoader className="animate-spin text-white" /></div>;
    if (error || !modpack) return <div className="h-screen flex items-center justify-center text-red-400">Error: {error}</div>;

    const publisherName = modpack.showUserAsPublisher && modpack.creatorUser ? modpack.creatorUser.username : modpack.publisher?.publisherName || "Desconocido";

    return (
        <div className="relative w-full min-h-screen bg-[#050505] text-white overflow-x-hidden">

            {/* 1. HERO SECTION (BANNER + HEADER) */}
            <div className="relative w-full h-[40vh] bg-neutral-900 overflow-hidden">
                <motion.div style={{ y: bannerY }} className="absolute inset-0 w-full h-full">
                    <div
                        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-700 ${showVideo && videoLoaded ? 'opacity-0' : 'opacity-100'}`}
                        style={{ backgroundImage: `url(${modpack.bannerUrl})` }}
                    />
                    {modpack.trailerUrl && showVideo && (
                        <video
                            ref={videoRef}
                            src={modpack.trailerUrl}
                            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${videoLoaded ? 'opacity-100' : 'opacity-0'}`}
                            autoPlay muted={isMuted} loop playsInline
                            onLoadedData={() => setVideoLoaded(true)}
                        />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/50 to-transparent" />
                </motion.div>

                {/* Mute Button */}
                {showVideo && videoLoaded && (
                    <button onClick={() => { setIsMuted(!isMuted); if (videoRef.current) videoRef.current.muted = !isMuted; }} className="absolute top-20 right-6 p-2.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors z-20">
                        {isMuted ? <LucideVolumeX size={20} /> : <LucideVolume2 size={20} />}
                    </button>
                )}
            </div>

            {/* 2. CONTENT CONTAINER (Single Column) */}
            <div className="relative z-10 max-w-5xl mx-auto px-6 -mt-20 pb-24">

                {/* HEADER INFO */}
                <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-end mb-8">
                    <motion.img
                        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        src={modpack.iconUrl || "/images/modpack-fallback.webp"}
                        className="w-28 h-28 sm:w-40 sm:h-40 rounded-2xl shadow-2xl border-4 border-[#050505] bg-[#121212] object-cover shrink-0"
                    />

                    <div className="flex-1 pb-1 w-full">
                        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
                            <div className="flex items-center gap-2 mb-1 text-neutral-300 font-medium text-sm">
                                <span>{publisherName}</span>
                                {modpack.publisher?.verified && <LucideVerified className="size-3.5 text-blue-400" />}
                            </div>
                            {/* Titulo moderado */}
                            <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight drop-shadow-xl mb-4 truncate">
                                {modpack.name}
                            </h1>
                        </motion.div>

                        <motion.div
                            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
                            className="flex flex-wrap items-center gap-3"
                        >
                            {versions.length > 0 && (
                                <InstallButton
                                    modpackId={modpackId}
                                    modpackName={modpack.name!}
                                    localInstances={localInstances}
                                    acquisitionMethod={modpack.acquisitionMethod || 'free'}
                                    isPasswordProtected={modpack.isPasswordProtected}
                                    isPaid={modpack.isPaid}
                                    isFree={modpack.isFree}
                                    price={modpack.price}
                                    requiresTwitchSubscription={modpack.requiresTwitchSubscription}
                                    requiredTwitchChannels={modpack.requiredTwitchChannels}
                                    selectedVersionId={selectedVersionId}
                                    disabled={modpack.requiresTwitchSubscription && !accessLoading && !canAccess}
                                />
                            )}
                            <VoteButtons modpackId={modpackId} showCounts initialCounts={voteCounts || undefined} initialVote={userVote} />
                        </motion.div>
                    </div>
                </div>

                {/* 3. STATS STRIP (Horizontal) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    {[
                        { label: "Versión", value: selectedVersion?.version || "N/A", icon: LucideBox },
                        { label: "Loader", value: selectedVersion ? formatLoaderInfo(selectedVersion) : "N/A", icon: LucideCpu },
                        { label: "Minecraft", value: selectedVersion?.mcVersion || "N/A", icon: LucideBox },
                        { label: "Actualizado", value: selectedVersion?.releaseDate ? new Date(selectedVersion.releaseDate).toLocaleDateString() : "N/A", icon: LucideClock },
                    ].map((item, i) => (
                        <div key={i} className="bg-[#121212]/50 backdrop-blur-md border border-white/5 rounded-xl p-3 flex items-center gap-3">
                            <div className="p-2 bg-white/5 rounded-lg text-neutral-400">
                                <item.icon size={16} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">{item.label}</p>
                                <p className="text-sm font-medium text-white truncate">{item.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Twitch Warning */}
                {modpack.requiresTwitchSubscription && !modpack.isPasswordProtected && (
                    <div className="mb-8">
                        <TwitchRequirements
                            requiresTwitchSubscription={true}
                            requiredTwitchChannels={modpack.requiredTwitchChannels || []}
                            userHasTwitchLinked={Boolean(session?.twitchId)}
                            modpackId={modpackId}
                        />
                    </div>
                )}

                {/* 4. TABS & CONTENT */}
                <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="w-full justify-start bg-transparent border-b border-white/10 rounded-none p-0 h-auto mb-6 gap-6">
                        {["overview", "files", "changelog", "versions"].map(tab => (
                            <TabsTrigger
                                key={tab}
                                value={tab}
                                className="px-0 py-3 rounded-none bg-transparent border-b-2 border-transparent data-[state=active]:border-purple-500 data-[state=active]:text-white text-neutral-400 text-sm font-medium transition-all hover:text-neutral-200 data-[state=active]:shadow-none"
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    <div className="min-h-[300px]">
                        {/* OVERVIEW */}
                        <TabsContent value="overview" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 md:p-8">
                                <ExternalLinkHandler className="prose prose-invert prose-p:text-neutral-300 prose-headings:text-white prose-a:text-purple-400 max-w-none">
                                    {modpack.description || "Sin descripción disponible."}
                                </ExternalLinkHandler>
                            </div>
                        </TabsContent>

                        {/* FILES */}
                        <TabsContent value="files" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl overflow-hidden flex flex-col h-[600px]">
                                <div className="bg-[#181818] border-b border-white/5 p-3 flex justify-between items-center px-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-full max-w-[200px]">
                                            <Select value={selectedVersionId} onValueChange={setSelectedVersionId}>
                                                <SelectTrigger className="h-8 text-xs bg-black/40 border-white/10"><SelectValue /></SelectTrigger>
                                                <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                                                    <SelectItem value="latest">Última versión</SelectItem>
                                                    {versions.map(v => <SelectItem key={v.id} value={v.id}>{v.version}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <span className="text-xs text-neutral-500">{selectedVersion?.files?.length || 0} archivos</span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar bg-[#0a0a0a]">
                                    {selectedVersion?.files && selectedVersion.files.length > 0 ? (
                                        <div className="flex flex-col">
                                            {Object.entries(fileTree)
                                                .sort(([aName, aNode]: any, [bName, bNode]: any) => {
                                                    if (aNode.type === 'folder' && bNode.type !== 'folder') return -1;
                                                    if (aNode.type !== 'folder' && bNode.type === 'folder') return 1;
                                                    return aName.localeCompare(bName);
                                                })
                                                .map(([name, node]) => (
                                                    <FileTreeItem key={name} name={name} node={node as TreeNode} />
                                                ))
                                            }
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-2">
                                            <LucideFolderOpen size={40} className="opacity-20" />
                                            <p>No hay archivos listados.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TabsContent>

                        {/* CHANGELOG */}
                        <TabsContent value="changelog" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 md:p-8">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                    <h2 className="text-lg font-bold text-white">Cambios en v{selectedVersion?.version}</h2>
                                    <Select value={selectedVersionId} onValueChange={setSelectedVersionId}>
                                        <SelectTrigger className="w-[180px] bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                                        <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                                            <SelectItem value="latest">Última versión</SelectItem>
                                            {versions.map(v => <SelectItem key={v.id} value={v.id}>{v.version}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="prose prose-invert prose-sm max-w-none p-4 rounded-xl bg-black/20 border border-white/5">
                                    <ExternalLinkHandler>
                                        {selectedVersion?.changelog || "Sin registro de cambios para esta versión."}
                                    </ExternalLinkHandler>
                                </div>
                            </div>
                        </TabsContent>

                        {/* VERSIONS */}
                        <TabsContent value="versions" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="space-y-2">
                                {versions.map(v => {
                                    const isSelected = selectedVersionId === v.id || (selectedVersionId === "latest" && getLatestVersion(versions)?.id === v.id);
                                    return (
                                        <div
                                            key={v.id}
                                            onClick={() => setSelectedVersionId(v.id)}
                                            className={`group flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${isSelected
                                                ? 'bg-purple-500/10 border-purple-500/50'
                                                : 'bg-[#121212] border-white/5 hover:border-white/20'
                                                }`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`p-2.5 rounded-lg ${isSelected ? 'bg-purple-500 text-white' : 'bg-white/5 text-neutral-400 group-hover:bg-white/10'}`}>
                                                    <LucideBox size={20} />
                                                </div>
                                                <div>
                                                    <h3 className={`font-bold ${isSelected ? 'text-purple-300' : 'text-white'}`}>{v.version}</h3>
                                                    <p className="text-xs text-neutral-500 font-mono mt-0.5">MC {v.mcVersion} • {formatLoaderInfo(v)}</p>
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <span className="text-xs text-neutral-500 block mb-1">
                                                    {v.releaseDate ? new Date(v.releaseDate).toLocaleDateString() : 'N/A'}
                                                </span>
                                                {v.status === 'published' && (
                                                    <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-400 text-[10px] font-bold uppercase tracking-wider">
                                                        Estable
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>

                {/* 5. FOOTER RECOMMENDED */}
                <div className="mt-16 pt-8 border-t border-white/5">
                    <h3 className="text-lg font-bold mb-6 text-white">También te podría interesar</h3>
                    <RelatedModpacks modpackId={modpackId} limit={4} className="px-0" />
                </div>

            </div>
        </div>
    );
};