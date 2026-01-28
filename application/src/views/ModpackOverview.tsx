import { useGlobalContext } from "@/stores/GlobalContext";
import {
    LucideLoader, LucideVerified, LucideVolume2, LucideVolumeX,
    LucideFolderOpen, LucideFileJson, LucideFileText, LucideFileArchive,
    LucideFileImage, LucideBox, LucideCpu, LucideDownload,
    LucideChevronDown, LucideChevronRight, LucideFolder, LucideFile, LucideClock
} from "lucide-react";
import { useEffect, useState, useRef, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, useScroll, useTransform, AnimatePresence } from "motion/react";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";

// Componentes y Servicios
import { InstallButton } from "../components/install-modpacks/ModpackInstallButton";
import { TwitchRequirements } from "@/components/TwitchRequirements";
import { VoteButtons } from "@/components/modpack/VoteButtons";
import { RelatedModpacks } from "@/components/modpack/RelatedModpacks";
import { ExternalLinkHandler } from '@/components/ExternalLinkHandler';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthentication } from "@/stores/AuthContext";
import { getModpackById } from "@/services/getModpacks";
import { getModpackVersions, getLatestVersion, getNonArchivedVersions, ModpackVersionPublic } from "@/services/getModpackVersions";
import { getVoteCounts, getUserVotes, VoteCounts } from "@/services/votes";

// --- UTILS ---
const formatLoaderInfo = (version: ModpackVersionPublic): string => {
    const loaderType = version.loaderType || version.modLoader || "unknown";
    const loaderVersion = version.loaderVersion || "";
    return `${loaderType.charAt(0).toUpperCase() + loaderType.slice(1)} ${loaderVersion}`;
};

// --- FILE EXPLORER ---
interface FileNodeData { type: 'file'; data: any; }
interface FolderNodeData { type: 'folder'; children: { [key: string]: TreeNode }; }
type TreeNode = FileNodeData | FolderNodeData;

const FileIcon = ({ name }: { name: string }) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (['json', 'toml'].includes(ext!)) return <LucideFileJson className="size-4 text-yellow-400" />;
    if (['jar', 'zip'].includes(ext!)) return <LucideFileArchive className="size-4 text-orange-400" />;
    if (['txt', 'md', 'cfg', 'properties'].includes(ext!)) return <LucideFileText className="size-4 text-blue-400" />;
    if (['png', 'jpg', 'webp'].includes(ext!)) return <LucideFileImage className="size-4 text-purple-400" />;
    return <LucideFile className="size-4 text-neutral-500" />;
};

const FileTreeItem = ({ name, node, depth = 0 }: { name: string, node: TreeNode, depth?: number }) => {
    const [isOpen, setIsOpen] = useState(depth < 1);
    const isFolder = node.type === 'folder';

    return (
        <div className="select-none">
            <div
                className={cn(
                    "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors text-sm hover:bg-white/5",
                    isOpen ? "text-neutral-200" : "text-neutral-400"
                )}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
                onClick={() => isFolder && setIsOpen(!isOpen)}
            >
                {isFolder ? (
                    <span className="opacity-50">
                        {isOpen ? <LucideChevronDown size={14} /> : <LucideChevronRight size={14} />}
                    </span>
                ) : <span className="w-[14px]" />}
                {isFolder ? <LucideFolder size={16} className="text-blue-400/80" /> : <FileIcon name={name} />}
                <span className="truncate">{name}</span>
            </div>
            {isFolder && isOpen && (
                <div>
                    {Object.entries(node.children).map(([childName, childNode]) => (
                        <FileTreeItem key={childName} name={childName} node={childNode} depth={depth + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};

export const ModpackOverview = ({ modpackId }: { modpackId: string }) => {
    const { session } = useAuthentication();
    const { setTitleBarState } = useGlobalContext();
    const videoRef = useRef<HTMLVideoElement>(null);
    const { scrollY } = useScroll();
    const bannerY = useTransform(scrollY, [0, 500], [0, 100]);

    // State
    const [loading, setLoading] = useState(true);
    const [modpack, setModpack] = useState<any>(null);
    const [versions, setVersions] = useState<ModpackVersionPublic[]>([]);
    const [selectedVersionId, setSelectedVersionId] = useState("latest");
    const [localInstances, setLocalInstances] = useState([]);
    const [voteCounts, setVoteCounts] = useState<VoteCounts | null>(null);
    const [userVote, setUserVote] = useState<'like' | 'dislike' | 'none'>('none');
    const [showVideo, setShowVideo] = useState(false);
    const [videoLoaded, setVideoLoaded] = useState(false);
    const [isMuted, setIsMuted] = useState(true);

    // Scroll to top on mount/modpackId change
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [modpackId]);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const [mp, vers, inst, votes] = await Promise.all([
                    getModpackById(modpackId),
                    getModpackVersions(modpackId),
                    invoke<any>("get_instances_by_modpack_id", { modpackId }),
                    getVoteCounts(modpackId)
                ]);
                setModpack(mp);
                setVersions(getNonArchivedVersions(vers));
                setLocalInstances(inst);
                setVoteCounts(votes);
                if (mp.trailerUrl) setTimeout(() => setShowVideo(true), 2000);
            } catch (e) { console.error(e); } finally { setLoading(false); }
        };
        load();
    }, [modpackId]);

    useEffect(() => {
        setTitleBarState((prev: any) => ({ ...prev, opaque: false, title: modpack?.name || "" }));
    }, [modpack]);

    const selectedVersion = useMemo(() =>
        selectedVersionId === "latest" ? getLatestVersion(versions) : versions.find(v => v.id === selectedVersionId),
        [selectedVersionId, versions]);

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

    if (loading) return <div className="h-screen flex items-center justify-center bg-[#050505]"><LucideLoader className="animate-spin text-white" /></div>;

    return (
        <div className="relative w-full min-h-screen bg-[#050505] text-white overflow-x-hidden">

            {/* 1. HERO CON VIDEO EN BANNER */}
            <div className="relative w-full h-[45vh] bg-neutral-900 overflow-hidden">
                <motion.div style={{ y: bannerY }} className="absolute inset-0 w-full h-full">
                    <div
                        className={cn(
                            "absolute inset-0 bg-cover bg-center transition-opacity duration-1000",
                            showVideo && videoLoaded ? 'opacity-0' : 'opacity-100'
                        )}
                        style={{ backgroundImage: `url(${modpack.bannerUrl})` }}
                    />
                    {modpack.trailerUrl && showVideo && (
                        <video
                            ref={videoRef}
                            src={modpack.trailerUrl}
                            className={cn(
                                "absolute inset-0 w-full h-full object-cover transition-opacity duration-1000",
                                videoLoaded ? 'opacity-100' : 'opacity-0'
                            )}
                            autoPlay muted={isMuted} playsInline
                            onLoadedData={() => setVideoLoaded(true)}
                            onEnded={() => {
                                setShowVideo(false);
                                setVideoLoaded(false);
                            }}
                        />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent" />
                </motion.div>

                {showVideo && videoLoaded && (
                    <button
                        onClick={() => setIsMuted(!isMuted)}
                        className="absolute bottom-6 right-6 p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 hover:bg-white/20 transition-all z-20"
                    >
                        {isMuted ? <LucideVolumeX size={18} /> : <LucideVolume2 size={18} />}
                    </button>
                )}
            </div>

            {/* 2. CONTENT */}
            <div className="relative z-10 max-w-5xl mx-auto px-6 -mt-24 pb-24">

                {/* Header Info */}
                <div className="flex flex-col sm:flex-row gap-8 items-start sm:items-end mb-10">
                    <img
                        src={modpack.iconUrl || "/images/modpack-fallback.webp"}
                        className="w-36 h-36 sm:w-44 sm:h-44 rounded-3xl shadow-2xl border-4 border-[#050505] bg-[#121212] object-cover shrink-0"
                    />
                    <div className="flex-1 pb-2">
                        <div className="flex items-center gap-2 mb-2 text-neutral-400 font-medium text-sm">
                            <span>{modpack.publisher?.publisherName || "Community"}</span>
                            {modpack.publisher?.verified && <LucideVerified className="size-4 text-blue-400" />}
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-black mb-6 tracking-tight">{modpack.name}</h1>
                        <div className="flex flex-wrap items-center gap-3">
                            <InstallButton
                                modpackId={modpackId}
                                modpackName={modpack.name}
                                localInstances={localInstances}
                                acquisitionMethod={modpack.acquisitionMethod || 'free'}
                                selectedVersionId={selectedVersionId}
                                className="h-12 px-8 shadow-lg"
                            />
                            <VoteButtons modpackId={modpackId} showCounts initialCounts={voteCounts || undefined} initialVote={userVote} />
                        </div>
                    </div>
                </div>

                {/* Quick Stats Strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                    {[
                        { label: "Versión", value: selectedVersion?.version, icon: LucideBox },
                        { label: "Loader", value: selectedVersion ? formatLoaderInfo(selectedVersion) : "N/A", icon: LucideCpu },
                        { label: "Minecraft", value: selectedVersion?.mcVersion, icon: LucideBox },
                        { label: "Fecha", value: selectedVersion?.releaseDate ? new Date(selectedVersion.releaseDate).toLocaleDateString() : "N/A", icon: LucideClock },
                    ].map((s, i) => (
                        <div key={i} className="bg-[#121212] border border-white/5 rounded-2xl p-4 flex items-center gap-4">
                            <div className="p-2 bg-white/5 rounded-lg text-neutral-400"><s.icon size={18} /></div>
                            <div className="min-w-0">
                                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">{s.label}</p>
                                <p className="text-sm font-semibold truncate">{s.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="w-full justify-start bg-transparent border-b border-white/5 rounded-none p-0 h-auto mb-8 gap-8">
                        {["overview", "files", "changelog", "versions"].map(t => (
                            <TabsTrigger
                                key={t} value={t}
                                className="px-0 py-4 rounded-none bg-transparent border-b-2 border-transparent data-[state=active]:border-purple-500 data-[state=active]:text-white text-neutral-500 text-sm font-bold transition-all"
                            >
                                {t.toUpperCase()}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {/* OVERVIEW */}
                    <TabsContent value="overview" className="focus-visible:outline-none">
                        <div className="bg-[#0A0A0A] border border-white/5 rounded-3xl p-8 shadow-xl">
                            <ExternalLinkHandler className="prose prose-invert prose-purple max-w-none prose-p:text-neutral-400 prose-p:leading-relaxed">
                                {modpack.description || "Sin descripción disponible."}
                            </ExternalLinkHandler>
                        </div>
                    </TabsContent>

                    {/* FILES */}
                    <TabsContent value="files">
                        <div className="bg-[#0A0A0A] border border-white/5 rounded-3xl overflow-hidden h-[500px] flex flex-col">
                            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                                <Select value={selectedVersionId} onValueChange={setSelectedVersionId}>
                                    <SelectTrigger className="w-[180px] h-8 text-xs bg-black/40 border-white/10 italic">
                                        <SelectValue placeholder="Seleccionar versión" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#121212] border-white/10 text-white">
                                        <SelectItem value="latest">Latest Release</SelectItem>
                                        {versions.map(v => <SelectItem key={v.id} value={v.id}>{v.version}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <span className="text-[10px] font-bold text-neutral-500 uppercase">{selectedVersion?.files?.length || 0} Archivos</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                {Object.entries(fileTree).map(([name, node]) => (
                                    <FileTreeItem key={name} name={name} node={node as TreeNode} />
                                ))}
                            </div>
                        </div>
                    </TabsContent>

                    {/* CHANGELOG */}
                    <TabsContent value="changelog">
                        <div className="bg-[#0A0A0A] border border-white/5 rounded-3xl overflow-hidden min-h-[400px] flex flex-col">
                            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                                <Select value={selectedVersionId} onValueChange={setSelectedVersionId}>
                                    <SelectTrigger className="w-[180px] h-8 text-xs bg-black/40 border-white/10 italic">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#121212] border-white/10 text-white">
                                        <SelectItem value="latest">Latest Version</SelectItem>
                                        {versions.map(v => <SelectItem key={v.id} value={v.id}>{v.version}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <div className="flex items-center gap-2 text-neutral-500">
                                    <LucideClock size={14} />
                                    <span className="text-[10px] font-bold uppercase">
                                        Actualizado: {selectedVersion?.releaseDate ? new Date(selectedVersion.releaseDate).toLocaleDateString() : 'N/A'}
                                    </span>
                                </div>
                            </div>
                            <div className="p-8">
                                <ExternalLinkHandler className="prose prose-invert prose-purple max-w-none">
                                    {selectedVersion?.changelog || "No se han proporcionado notas de cambios para esta versión."}
                                </ExternalLinkHandler>
                            </div>
                        </div>
                    </TabsContent>

                    {/* VERSIONS LIST */}
                    <TabsContent value="versions">
                        <div className="grid gap-3">
                            {versions.map((v) => (
                                <div
                                    key={v.id}
                                    onClick={() => setSelectedVersionId(v.id)}
                                    className={cn(
                                        "group flex items-center justify-between p-4 bg-[#0A0A0A] border border-white/5 rounded-2xl transition-all hover:border-purple-500/50 cursor-pointer",
                                        selectedVersionId === v.id && "border-purple-500 bg-purple-500/5"
                                    )}
                                >
                                    <div className="flex items-center gap-6">
                                        <div className="flex flex-col">
                                            <span className="text-lg font-bold">{v.version}</span>
                                            <span className="text-[10px] text-neutral-500 font-bold uppercase">{v.mcVersion}</span>
                                        </div>
                                        <div className="hidden md:flex items-center gap-4 text-sm text-neutral-400">
                                            <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-full">
                                                <LucideCpu size={14} />
                                                <span>{formatLoaderInfo(v)}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <LucideClock size={14} />
                                                <span>{new Date(v.releaseDate).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {selectedVersionId === v.id && (
                                        <div className="flex items-center gap-2 text-purple-500 text-sm font-bold">
                                            <span>SELECCIONADA</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </TabsContent>
                </Tabs>

                {/* Footer Related */}
                <div className="mt-20 pt-10 border-t border-white/5">
                    <h3 className="text-xl font-bold mb-8">Modpacks recomendados</h3>
                    <RelatedModpacks modpackId={modpackId} limit={4} className="px-0" />
                </div>

            </div>
        </div>
    );
};