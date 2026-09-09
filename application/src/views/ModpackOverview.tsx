import { useGlobalContext } from "@/stores/GlobalContext";
import {
    LucideLoader, LucideVerified, LucideVolume2, LucideVolumeX,
    LucideFolderOpen, LucideFileJson, LucideFileText, LucideFileArchive,
    LucideFileImage, LucideBox, LucideCpu, LucideDownload,
    LucideChevronDown, LucideChevronRight, LucideFolder, LucideFile, LucideClock,
    AlertTriangle, LucideHome, LucideArrowLeft
} from "lucide-react";
import { Link } from "react-router-dom";
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
import { AdSlot } from "@/components/ads/AdSlot";
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

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 },
        },
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { type: "spring" as const, stiffness: 100, damping: 20 },
        },
    };

    // State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
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
                setError(null);
                const [mp, vers, inst] = await Promise.all([
                    getModpackById(modpackId),
                    getModpackVersions(modpackId),
                    invoke<any>("get_instances_by_modpack_id", { modpackId }),
                ]);

                if (!mp) {
                    setError("Modpack no encontrado");
                    return;
                }

                setModpack(mp);
                setVersions(getNonArchivedVersions(vers));
                setLocalInstances(inst);

                try {
                    const votes = await getVoteCounts(modpackId);
                    setVoteCounts(votes);
                } catch (e) {
                    console.warn("Error loading vote counts:", e);
                }
                if (mp.trailerUrl) setTimeout(() => setShowVideo(true), 2000);
            } catch (e) {
                console.error(e);
                setError("Error al cargar el modpack");
            } finally { setLoading(false); }
        };
        load();
    }, [modpackId]);

    useEffect(() => {
        setTitleBarState((prev: any) => ({ ...prev, opaque: false, title: modpack?.name || "", icon: modpack?.iconUrl || "/images/modpack-fallback.webp", canGoBack: true }));
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

    if (loading) return (
        <div className="w-full min-h-screen bg-[#050505]">
            <div className="w-full h-[45vh] bg-neutral-900 animate-pulse" />
            <div className="max-w-5xl mx-auto px-6 -mt-24 pb-24 relative z-10">
                <div className="flex flex-col sm:flex-row gap-8 items-start sm:items-end mb-10">
                    <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-3xl border-4 border-[#050505] bg-neutral-800 shrink-0 animate-pulse" />
                    <div className="flex-1 pb-2 space-y-4 w-full">
                        <div className="h-4 w-24 bg-neutral-800 rounded animate-pulse" />
                        <div className="h-10 w-72 bg-neutral-800 rounded animate-pulse" />
                        <div className="flex gap-3">
                            <div className="h-12 w-32 bg-neutral-800 rounded-lg animate-pulse" />
                            <div className="h-12 w-20 bg-neutral-800 rounded-lg animate-pulse" />
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="bg-neutral-900 border border-white/[0.06] rounded-xl p-4 flex items-center gap-4 animate-pulse">
                            <div className="size-10 bg-neutral-800 rounded-lg" />
                            <div className="space-y-2 flex-1">
                                <div className="h-3 w-16 bg-neutral-800 rounded" />
                                <div className="h-4 w-24 bg-neutral-800 rounded" />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2 mb-8">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-9 w-28 bg-neutral-800 rounded-lg animate-pulse" />
                    ))}
                </div>
            </div>
        </div>
    );

    if (error || !modpack) return (
        <div className="h-full flex flex-col items-center justify-center px-4">
            <AlertTriangle className="w-10 h-10 text-neutral-600 mb-5" />
            <h1 className="text-base font-semibold text-white/80">
                {!modpack && !error ? "Modpack no encontrado" : "Ha ocurrido un error"}
            </h1>
            <p className="text-sm text-neutral-600 mt-3 max-w-xs text-center leading-relaxed">
                {error || "El modpack que buscas no existe o ha sido eliminado."}
            </p>
            <div className="flex items-center gap-3 mt-8">
                <Link
                    to="/"
                    className="flex items-center gap-1.5 bg-white text-black text-sm font-semibold px-4 py-2 rounded-lg hover:bg-white/90 transition-colors active:scale-95"
                >
                    <LucideHome className="w-4 h-4" />
                    Ir al inicio
                </Link>
                <button
                    onClick={() => window.history.back()}
                    className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 px-4 py-2 rounded-lg hover:text-neutral-300 hover:bg-white/[0.04] transition-colors"
                >
                    <LucideArrowLeft className="w-4 h-4" />
                    Volver
                </button>
            </div>
        </div>
    );

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
                        className="absolute bottom-6 right-6 p-2 rounded-full bg-black/60 border border-white/10 hover:bg-white/20 transition-all z-20"
                    >
                        {isMuted ? <LucideVolumeX size={18} /> : <LucideVolume2 size={18} />}
                    </button>
                )}
            </div>

            {/* 2. CONTENT */}
            <motion.div
                className="relative z-10 max-w-5xl mx-auto px-6 -mt-24 pb-24"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >

                {/* Header Info */}
                <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-8 items-start sm:items-end mb-10">
                    <img
                        src={modpack.iconUrl || "/images/modpack-fallback.webp"}
                        className="w-36 h-36 sm:w-44 sm:h-44 rounded-3xl border-4 border-[#050505] bg-[#121214] object-cover shrink-0"
                    />
                    <div className="flex-1 pb-2">
                        <div className="flex items-center gap-2 mb-2 text-neutral-400 font-medium text-sm">
                            {modpack.creator?.slug ? (
                                <Link to={`/c/${modpack.creator.slug}`} className="hover:text-white transition-colors">
                                    {modpack.creator.name}
                                </Link>
                            ) : (
                                <span>{modpack.creator?.name || "Community"}</span>
                            )}
                            {modpack.creator?.verified && <LucideVerified className="size-4 text-blue-400" />}
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-black mb-6 tracking-tight">{modpack.name}</h1>
                        <div className="flex flex-wrap items-center gap-3">
                            <InstallButton
                                modpackId={modpackId}
                                modpackName={modpack.name}
                                localInstances={localInstances}
                                acquisitionMethod={modpack.acquisitionMethod || 'free'}
                                visibility={modpack.visibility || 'public'}
                                selectedVersionId={selectedVersionId}
                                className="h-12 px-8"
                            />
                            <VoteButtons modpackId={modpackId} showCounts initialCounts={voteCounts || undefined} initialVote={userVote} />
                        </div>
                    </div>
                </motion.div>

                {/* Quick Stats Strip */}
                <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                    {[
                        { label: "Versión", value: selectedVersion?.version, icon: LucideBox },
                        { label: "Loader", value: selectedVersion ? formatLoaderInfo(selectedVersion) : "N/A", icon: LucideCpu },
                        { label: "Minecraft", value: selectedVersion?.mcVersion, icon: LucideBox },
                        { label: "Fecha", value: selectedVersion?.releaseDate ? new Date(selectedVersion.releaseDate).toLocaleDateString() : "N/A", icon: LucideClock },
                    ].map((s, i) => (
                        <motion.div key={i} variants={itemVariants} className="bg-[#121214] border border-white/[0.06] rounded-xl p-4 flex items-center gap-4">
                            <div className="p-2 bg-white/5 rounded-lg text-neutral-400"><s.icon size={18} /></div>
                            <div className="min-w-0">
                                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">{s.label}</p>
                                <p className="text-sm font-semibold truncate">{s.value}</p>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>

                <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="bg-[#121214] border border-white/[0.06] rounded-xl p-1 w-full justify-start mb-8 gap-1">
                        <TabsTrigger value="overview" className="data-[state=active]:bg-[#252525] data-[state=active]:text-white text-neutral-400 text-sm font-bold rounded-lg px-4 py-2 transition-all">
                            DESCRIPCIÓN
                        </TabsTrigger>
                        <TabsTrigger value="files" className="data-[state=active]:bg-[#252525] data-[state=active]:text-white text-neutral-400 text-sm font-bold rounded-lg px-4 py-2 transition-all">
                            ARCHIVOS
                        </TabsTrigger>
                        <TabsTrigger value="changelog" className="data-[state=active]:bg-[#252525] data-[state=active]:text-white text-neutral-400 text-sm font-bold rounded-lg px-4 py-2 transition-all">
                            CAMBIOS
                        </TabsTrigger>
                        <TabsTrigger value="versions" className="data-[state=active]:bg-[#252525] data-[state=active]:text-white text-neutral-400 text-sm font-bold rounded-lg px-4 py-2 transition-all">
                            VERSIONES
                        </TabsTrigger>
                    </TabsList>

                    {/* OVERVIEW */}
                    <TabsContent value="overview" className="focus-visible:outline-none">
                        <div className="space-y-6">
                            <div className="bg-[#121214] border border-white/[0.06] rounded-xl p-6">
                                <ExternalLinkHandler className="prose prose-invert prose-purple max-w-none prose-p:text-neutral-400 prose-p:leading-relaxed">
                                    {modpack.description || "Sin descripción disponible."}
                                </ExternalLinkHandler>
                            </div>
                            <AdSlot placement="modpack_sidebar" />
                        </div>
                    </TabsContent>

                    {/* FILES */}
                    <TabsContent value="files">
                        <div className="bg-[#121214] border border-white/[0.06] rounded-xl overflow-hidden h-[500px] flex flex-col">
                            <div className="p-4 border-b border-white/[0.06] flex justify-between items-center">
                                <Select value={selectedVersionId} onValueChange={setSelectedVersionId}>
                                    <SelectTrigger className="w-[180px] h-8 text-xs bg-black/40 border-white/10 italic">
                                        <SelectValue placeholder="Seleccionar versión" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#121214] border-white/[0.06] text-white">
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
                        <div className="bg-[#121214] border border-white/[0.06] rounded-xl overflow-hidden min-h-[400px] flex flex-col">
                            <div className="p-4 border-b border-white/[0.06] flex justify-between items-center">
                                <Select value={selectedVersionId} onValueChange={setSelectedVersionId}>
                                    <SelectTrigger className="w-[180px] h-8 text-xs bg-black/40 border-white/10 italic">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#121214] border-white/[0.06] text-white">
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
                        {versions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <LucideBox className="w-10 h-10 text-neutral-700 mb-4" />
                                <p className="text-neutral-400 font-medium text-sm">No hay versiones publicadas</p>
                                <p className="text-neutral-600 text-xs mt-1">Las versiones aparecerán aquí cuando se publiquen.</p>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {versions.map((v) => (
                                    <motion.div
                                        key={v.id}
                                        initial={{ y: 12, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ type: "spring" as const, stiffness: 100, damping: 20, delay: versions.indexOf(v) * 0.05 }}
                                        onClick={() => setSelectedVersionId(v.id)}
                                        className={cn(
                                            "group flex items-center justify-between p-4 bg-[#121214] border border-white/[0.06] rounded-xl transition-all hover:border-purple-500/50 cursor-pointer",
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
                                                    <span>{new Date(v.releaseDate!).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {selectedVersionId === v.id && (
                                            <div className="flex items-center gap-2 text-purple-500 text-sm font-bold">
                                                <span>SELECCIONADA</span>
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                {/* Footer Related */}
                <motion.div variants={itemVariants} className="mt-20 pt-10 border-t border-white/[0.06]">
                    <h3 className="text-xl font-bold mb-8">Modpacks recomendados</h3>
                    <RelatedModpacks modpackId={modpackId} limit={4} className="px-0" />
                </motion.div>

            </motion.div>
        </div>
    );
};