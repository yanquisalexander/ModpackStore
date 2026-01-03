import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { LucidePlus, Loader2, LucidePackage, LucideHammer, LucideFeather, LucideTestTube, Box } from "lucide-react"
import { TauriCommandReturns } from "@/types/TauriCommandReturns"
import { fetchMinecraftManifestWithFailover } from "@/utils/minecraftManifestFailover"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { trackEvent } from "@aptabase/web"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { CreeperIcon } from "@/icons/CreeperIcon"
import { cn } from "@/lib/utils"
import { AnvilIcon } from "@/icons/AnvilIcon" // Asumiendo que tienes este o usa LucideHammer

// --- TYPES ---
interface MinecraftVersion { id: string; type: string; url: string; time?: string; releaseTime?: string; }
type InstanceType = "vanilla" | "forge" | "fabric" | "neoforge" | "quilt";
interface CreateInstanceDialogProps { onInstanceCreated: () => void; instanceNames: string[]; }

const FORGE_VERSIONS_URL = "https://mc-versions-api.net/api/forge";

export const CreateInstanceDialog = ({ onInstanceCreated, instanceNames }: CreateInstanceDialogProps) => {
    const [open, setOpen] = useState(false);
    const [instanceName, setInstanceName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [minecraftVersions, setMinecraftVersions] = useState<MinecraftVersion[]>([]);
    const [forgeVersionsMap, setForgeVersionsMap] = useState<Record<string, string[]>>({});
    const [loaderVersionsMap, setLoaderVersionsMap] = useState<Record<string, string[]>>({});

    // Form State
    const [selectedType, setSelectedType] = useState<InstanceType>("vanilla");
    const [selectedMinecraftVersion, setSelectedMinecraftVersion] = useState<string>("");
    const [selectedForgeVersion, setSelectedForgeVersion] = useState<string>("");
    const [selectedLoaderVersion, setSelectedLoaderVersion] = useState<string>("");

    const [loadingVersions, setLoadingVersions] = useState(false);
    const [compatibleForgeVersions, setCompatibleForgeVersions] = useState<string[]>([]);
    const [compatibleLoaderVersions, setCompatibleLoaderVersions] = useState<string[]>([]);
    const [showSnapshots, setShowSnapshots] = useState(false);

    // --- LOGIC ---
    // (Mantengo la lógica original intacta, solo limpio el código visualmente)
    const checkShowSnapshots = async () => {
        try {
            const value = await invoke<boolean>('get_config_value', { key: 'showSnapshots' });
            setShowSnapshots(value);
        } catch (error) {
            console.error("Error checking show snapshots:", error);
        }
    };

    useEffect(() => {
        if (open) {
            checkShowSnapshots().then(fetchMinecraftVersions);
        }
    }, [open]);

    useEffect(() => {
        const forgeVersions = forgeVersionsMap[selectedMinecraftVersion] || [];
        setCompatibleForgeVersions(forgeVersions);
        if (forgeVersions.length > 0 && !selectedForgeVersion) setSelectedForgeVersion(forgeVersions[0]);
        else if (forgeVersions.length === 0) setSelectedForgeVersion("");

        if (selectedType !== "vanilla" && selectedType !== "forge" && selectedMinecraftVersion) {
            fetchLoaderVersions(selectedType, selectedMinecraftVersion);
        }
    }, [selectedMinecraftVersion, forgeVersionsMap, selectedForgeVersion, selectedType]);

    useEffect(() => {
        if (selectedType !== "vanilla" && selectedType !== "forge") {
            const loaderVersions = loaderVersionsMap[selectedMinecraftVersion] || [];
            setCompatibleLoaderVersions(loaderVersions);
            if (loaderVersions.length > 0 && !selectedLoaderVersion) setSelectedLoaderVersion(loaderVersions[0]);
            else if (loaderVersions.length === 0) setSelectedLoaderVersion("");
        }
    }, [loaderVersionsMap, selectedMinecraftVersion, selectedType]);

    const fetchMinecraftVersions = async (): Promise<void> => {
        setLoadingVersions(true);
        try {
            const data = await fetchMinecraftManifestWithFailover();
            const releaseVersions = data.versions.filter((version: MinecraftVersion) =>
                version.type === "release" || (showSnapshots && version.type === "snapshot")
            );
            setMinecraftVersions(releaseVersions);
            if (releaseVersions.length > 0) setSelectedMinecraftVersion(releaseVersions[0].id);
            await fetchForgeVersions();
        } catch (error) {
            toast.error("No se pudieron cargar las versiones de Minecraft");
        } finally {
            setLoadingVersions(false);
        }
    };

    const fetchForgeVersions = async (): Promise<void> => {
        try {
            const response = await fetch(FORGE_VERSIONS_URL);
            const data = await response.json();
            const rawData = data.result?.[0] || {};
            const processedData: Record<string, string[]> = {};
            for (const mcVersion in rawData) {
                if (Object.prototype.hasOwnProperty.call(rawData, mcVersion)) {
                    processedData[mcVersion] = rawData[mcVersion].filter((version: string) => {
                        const versionParts = version.split('.');
                        return versionParts.length > 1 && (parseInt(versionParts[0]) > 1 || (parseInt(versionParts[0]) === 1 && parseInt(versionParts[1]) >= 5));
                    });
                }
            }
            setForgeVersionsMap(processedData);
        } catch (error) {
            toast.error("No se pudieron cargar las versiones de Forge");
        }
    };

    const fetchLoaderVersions = async (loaderType: InstanceType, mcVersion: string): Promise<void> => {
        try {
            let versions: string[] = [];
            let url = "";
            if (loaderType === "fabric") url = `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`;
            else if (loaderType === "quilt") url = `https://meta.quiltmc.org/v3/versions/loader/${mcVersion}`;
            else if (loaderType === "neoforge") url = "https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge";

            if (loaderType === "neoforge") {
                const response = await fetch(url);
                const data = await response.json();
                versions = data.versions || [];
            } else {
                const response = await fetch(url);
                const data = await response.json();
                versions = data.map((item: any) => item.loader.version);
            }

            setLoaderVersionsMap(prev => ({ ...prev, [mcVersion]: versions }));
        } catch (error) {
            toast.error(`No se pudieron cargar las versiones de ${loaderType}`);
        }
    };

    const handleCreateInstance = async (): Promise<void> => {
        if (!instanceName.trim()) return toast.error("El nombre no puede estar vacío");
        if (!selectedMinecraftVersion) return toast.error("Selecciona una versión de Minecraft");
        if (selectedType === "forge" && !selectedForgeVersion) return toast.error("Selecciona una versión de Forge");
        if (["fabric", "neoforge", "quilt"].includes(selectedType) && !selectedLoaderVersion) return toast.error(`Selecciona una versión de ${selectedType}`);

        setIsLoading(true);
        try {
            const instanceData = {
                instanceName: instanceName.trim(),
                mcVersion: selectedMinecraftVersion,
                type: selectedType,
                forgeVersion: selectedType === "forge" ? selectedForgeVersion : undefined,
                loaderType: selectedType,
                loaderVersion: selectedType === "forge" ? selectedForgeVersion : selectedLoaderVersion
            };

            await invoke<TauriCommandReturns['create_instance']>('create_local_instance', instanceData);

            toast.success("Creando instancia...", { description: `Tu instancia "${instanceName}" está en proceso.` });
            trackEvent("instance_created", { name: "Instance Created", type: selectedType });

            setInstanceName("");
            setOpen(false);
            onInstanceCreated();
        } catch (error) {
            console.error("Error al crear la instancia:", error);
            toast.error("No se pudo crear la instancia");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (!isOpen) {
            setSelectedMinecraftVersion("");
            setSelectedForgeVersion("");
            setInstanceName("");
            setSelectedType("vanilla");
        }
    };

    const isCreateButtonDisabled = isLoading || !instanceName.trim() || !selectedMinecraftVersion || (selectedType === "forge" && !selectedForgeVersion) || (["fabric", "neoforge", "quilt"].includes(selectedType) && !selectedLoaderVersion) || instanceNames.includes(instanceName.trim());

    // --- RENDER HELPERS ---
    const TypeCard = ({ type, label, icon: Icon, color }: any) => (
        <div
            onClick={() => setSelectedType(type)}
            className={cn(
                "relative flex flex-col items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all duration-200 overflow-hidden group",
                selectedType === type
                    ? `border-${color}-500/50 bg-${color}-500/10 ring-1 ring-${color}-500/20`
                    : "border-white/10 hover:border-white/20 hover:bg-white/5"
            )}
        >
            <Icon className={cn("h-8 w-8 transition-colors", selectedType === type ? `text-${color}-400` : "text-neutral-500 group-hover:text-neutral-300")} />
            <span className={cn("text-xs font-medium", selectedType === type ? "text-white" : "text-neutral-400")}>{label}</span>
            {type !== "vanilla" && selectedType === type && (
                <div className={`absolute top-0 right-0 p-1 bg-${color}-500/20 rounded-bl-lg`}>
                    <div className={`w-1.5 h-1.5 rounded-full bg-${color}-400 animate-pulse`} />
                </div>
            )}
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <button className="group relative h-[160px] w-full overflow-hidden rounded-xl border border-dashed border-white/10 bg-[#0a0a0a] hover:bg-white/[0.02] hover:border-white/20 transition-all duration-200">
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                        <div className="p-3 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors border border-white/5">
                            <LucidePlus className="h-6 w-6 text-neutral-400 group-hover:text-white transition-colors" />
                        </div>
                        <div className="text-center">
                            <span className="block text-sm font-semibold text-neutral-300 group-hover:text-white">Nueva Instancia</span>
                            <span className="text-xs text-neutral-500">Vanilla o Modded</span>
                        </div>
                    </div>
                </button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md bg-[#0a0a0a] border-white/10 p-0 gap-0 shadow-2xl" onInteractOutside={(e) => { if (instanceName) e.preventDefault(); }}>

                {/* HEADER */}
                <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                            <Box className="w-5 h-5 text-purple-400" />
                            Crear Instancia
                        </DialogTitle>
                        <DialogDescription className="text-neutral-400">
                            Configura una nueva instalación de Minecraft.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">

                    {/* 1. NOMBRE */}
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Nombre</Label>
                        <Input
                            value={instanceName}
                            onChange={(e) => setInstanceName(e.target.value)}
                            placeholder="Ej: Mi Mundo Survival 1.20"
                            className="bg-[#151515] border-white/10 focus:border-purple-500/50 text-white placeholder:text-neutral-600"
                        />
                        {instanceNames.includes(instanceName.trim()) && (
                            <p className="text-red-400 text-xs mt-1">Este nombre ya está en uso.</p>
                        )}
                    </div>

                    {/* 2. TIPO DE INSTANCIA */}
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Tipo de Loader</Label>
                        <div className="grid grid-cols-3 gap-2">
                            <TypeCard type="vanilla" label="Vanilla" icon={CreeperIcon} color="emerald" />
                            <TypeCard type="forge" label="Forge" icon={LucideHammer} color="orange" />{/* O AnvilIcon */}
                            <TypeCard type="fabric" label="Fabric" icon={LucideFeather} color="cyan" />
                            <TypeCard type="neoforge" label="NeoForge" icon={LucideHammer} color="purple" />
                            <TypeCard type="quilt" label="Quilt" icon={LucidePackage} color="pink" />
                        </div>
                    </div>

                    {/* ALERTA FORGE */}
                    {selectedType === "forge" && (
                        <div className="bg-orange-900/10 border border-orange-500/20 p-3 rounded-lg flex gap-3 items-start">
                            <LucideTestTube className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                            <div className="text-xs text-orange-200/80">
                                <span className="font-bold block mb-0.5">Soporte Experimental</span>
                                Las versiones antiguas de Forge (pre-1.12.2) pueden ser inestables.
                            </div>
                        </div>
                    )}

                    {/* 3. SELECTORES DE VERSIÓN */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Versión de Juego</Label>
                            <Select value={selectedMinecraftVersion} onValueChange={setSelectedMinecraftVersion}>
                                <SelectTrigger className="bg-[#151515] border-white/10 text-white">
                                    <SelectValue placeholder="Seleccionar" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1a1a1a] border-white/10 text-white max-h-60">
                                    {loadingVersions ? (
                                        <div className="p-2 flex justify-center"><Loader2 className="animate-spin w-4 h-4" /></div>
                                    ) : (
                                        minecraftVersions.map((v) => <SelectItem key={v.id} value={v.id}>{v.id}</SelectItem>)
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {selectedType !== "vanilla" && (
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Versión del Loader</Label>
                                {selectedType === "forge" ? (
                                    <Select value={selectedForgeVersion} onValueChange={setSelectedForgeVersion} disabled={compatibleForgeVersions.length === 0}>
                                        <SelectTrigger className="bg-[#151515] border-white/10 text-white">
                                            <SelectValue placeholder="Seleccionar" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#1a1a1a] border-white/10 text-white max-h-60">
                                            {compatibleForgeVersions.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Select value={selectedLoaderVersion} onValueChange={setSelectedLoaderVersion} disabled={compatibleLoaderVersions.length === 0}>
                                        <SelectTrigger className="bg-[#151515] border-white/10 text-white">
                                            <SelectValue placeholder="Seleccionar" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#1a1a1a] border-white/10 text-white max-h-60">
                                            {compatibleLoaderVersions.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* FOOTER */}
                <DialogFooter className="p-6 pt-2 bg-[#0a0a0a] sm:justify-between gap-3 border-t border-white/5">
                    <Button variant="ghost" onClick={() => setOpen(false)} className="text-neutral-500 hover:text-white hover:bg-white/5">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleCreateInstance}
                        disabled={isCreateButtonDisabled}
                        className="bg-white text-black hover:bg-neutral-200 font-bold min-w-[120px]"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LucidePlus className="w-4 h-4 mr-2" />}
                        Crear
                    </Button>
                </DialogFooter>

            </DialogContent>
        </Dialog>
    );
};