import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { LucidePlus, Loader2, LucidePackage, LucideHammer, LucideFeather, Box } from "lucide-react"
import { TauriCommandReturns } from "@/types/TauriCommandReturns"
import { fetchMinecraftManifestWithFailover } from "@/utils/minecraftManifestFailover"
import { fetchForgeVersions, fetchLoaderVersions as fetchLoaderVersionsShared, type ModLoaderType } from "@/utils/modloaderVersions"

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

interface MinecraftVersion { id: string; type: string; url: string; time?: string; releaseTime?: string; }
type InstanceType = "vanilla" | "forge" | "fabric" | "neoforge" | "quilt";
interface CreateInstanceDialogProps {
    onInstanceCreated: () => void;
    instanceNames: string[];
    disabled?: boolean;
}


export const CreateInstanceDialog = ({ onInstanceCreated, instanceNames, disabled = false }: CreateInstanceDialogProps) => {
    const [open, setOpen] = useState(false);
    const [instanceName, setInstanceName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [minecraftVersions, setMinecraftVersions] = useState<MinecraftVersion[]>([]);
    const [forgeVersionsMap, setForgeVersionsMap] = useState<Record<string, string[]>>({});
    const [loaderVersionsMap, setLoaderVersionsMap] = useState<Record<string, string[]>>({});

    const [selectedType, setSelectedType] = useState<InstanceType>("vanilla");
    const [selectedMinecraftVersion, setSelectedMinecraftVersion] = useState<string>("");
    const [selectedForgeVersion, setSelectedForgeVersion] = useState<string>("");
    const [selectedLoaderVersion, setSelectedLoaderVersion] = useState<string>("");

    const [loadingVersions, setLoadingVersions] = useState(false);
    const [compatibleForgeVersions, setCompatibleForgeVersions] = useState<string[]>([]);
    const [compatibleLoaderVersions, setCompatibleLoaderVersions] = useState<string[]>([]);
    const [showSnapshots, setShowSnapshots] = useState(false);

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

        let cancelled = false;
        if (selectedType !== "vanilla" && selectedType !== "forge" && selectedMinecraftVersion) {
            fetchLoaderVersionsShared(selectedType as ModLoaderType, selectedMinecraftVersion).then(versions => {
                if (!cancelled) {
                    setLoaderVersionsMap(prev => ({ ...prev, [selectedMinecraftVersion]: versions }));
                }
            });
        }
        return () => { cancelled = true; };
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
            const forgeMap = await fetchForgeVersions();
            setForgeVersionsMap(forgeMap);
        } catch (error) {
            toast.error("No se pudieron cargar las versiones de Minecraft");
        } finally {
            setLoadingVersions(false);
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

    const TypeCard = ({ type, label, icon: Icon, color }: any) => (
        <div
            onClick={() => setSelectedType(type)}
            className={cn(
                "relative flex flex-col items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors",
                selectedType === type
                    ? "bg-white/[0.06] border-white/20"
                    : "border-white/[0.06] hover:border-white/10 hover:bg-white/[0.02]"
            )}
        >
            <Icon className={cn("h-7 w-7 transition-colors", selectedType === type ? "text-white" : "text-neutral-500")} />
            <span className={cn("text-xs font-medium", selectedType === type ? "text-white" : "text-neutral-500")}>{label}</span>
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <button
                    disabled={disabled}
                    className={cn(
                        "group relative h-[160px] w-full overflow-hidden rounded-xl border border-dashed transition-colors bg-[#0e0e10]",
                        disabled ? "opacity-50 cursor-not-allowed border-white/[0.04] grayscale" : "border-white/[0.06] hover:bg-white/[0.02] hover:border-white/20"
                    )}
                >
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                        <div className={cn(
                            "p-3 rounded-full bg-white/[0.04] border border-white/[0.06] transition-colors",
                            !disabled && "group-hover:bg-white/[0.06]"
                        )}>
                            <LucidePlus className={cn(
                                "h-6 w-6 text-neutral-500 transition-colors",
                                !disabled && "group-hover:text-white"
                            )} />
                        </div>
                        <div className="text-center">
                            <span className={cn(
                                "block text-sm font-semibold text-neutral-400",
                                !disabled && "group-hover:text-white"
                            )}>Nueva Instancia</span>
                            <span className="text-xs text-neutral-600">Vanilla o Modded</span>
                        </div>
                    </div>
                </button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md bg-[#0e0e10] border-white/[0.06] p-0 gap-0" onInteractOutside={(e) => { if (instanceName) e.preventDefault(); }}>

                <div className="p-6 pb-4 border-b border-white/[0.04]">
                    <DialogHeader className="space-y-1">
                        <DialogTitle className="text-lg font-semibold text-white flex items-center gap-2">
                            <Box className="w-5 h-5 text-teal-400" />
                            Crear Instancia
                        </DialogTitle>
                        <DialogDescription className="text-sm text-neutral-500">
                            Configura una nueva instalación de Minecraft.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar">

                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-neutral-500 ml-1">Nombre</Label>
                        <Input
                            value={instanceName}
                            onChange={(e) => setInstanceName(e.target.value)}
                            placeholder="Ej: Mi Mundo Survival 1.20"
                            className="h-10 bg-black/20 border-white/[0.06] text-white placeholder:text-neutral-700 focus:border-white/10 rounded-lg transition-colors"
                        />
                        {instanceNames.includes(instanceName.trim()) && (
                            <p className="text-red-400 text-xs mt-1">Este nombre ya está en uso.</p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-neutral-500 ml-1">Tipo de Loader</Label>
                        <div className="grid grid-cols-3 gap-2">
                            <TypeCard type="vanilla" label="Vanilla" icon={CreeperIcon} color="emerald" />
                            <TypeCard type="forge" label="Forge" icon={LucideHammer} color="orange" />
                            <TypeCard type="fabric" label="Fabric" icon={LucideFeather} color="cyan" />
                            <TypeCard type="neoforge" label="NeoForge" icon={LucideHammer} color="purple" />
                            <TypeCard type="quilt" label="Quilt" icon={LucidePackage} color="pink" />
                        </div>
                    </div>

                    {selectedType === "forge" && (
                        <div className="flex gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-300 text-xs">
                            <LucideHammer className="w-4 h-4 shrink-0 mt-0.5" />
                            <div className="leading-relaxed">
                                <span className="font-semibold block mb-0.5 text-orange-200">Soporte Experimental</span>
                                Las versiones antiguas de Forge (pre-1.12.2) pueden ser inestables.
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-neutral-500 ml-1">Versión de Juego</Label>
                            <Select value={selectedMinecraftVersion} onValueChange={setSelectedMinecraftVersion}>
                                <SelectTrigger className="h-10 bg-black/20 border-white/[0.06] text-white focus:ring-0 focus:border-white/10 rounded-lg">
                                    <SelectValue placeholder="Seleccionar" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#121214] border-white/[0.06] text-white max-h-60 rounded-lg">
                                    {loadingVersions ? (
                                        <div className="p-2 flex justify-center"><Loader2 className="animate-spin w-4 h-4" /></div>
                                    ) : (
                                        minecraftVersions.map((v) => <SelectItem key={v.id} value={v.id} className="focus:bg-white/[0.04] cursor-pointer">{v.id}</SelectItem>)
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {selectedType !== "vanilla" && (
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-neutral-500 ml-1">Versión del Loader</Label>
                                {selectedType === "forge" ? (
                                    <Select value={selectedForgeVersion} onValueChange={setSelectedForgeVersion} disabled={compatibleForgeVersions.length === 0}>
                                        <SelectTrigger className="h-10 bg-black/20 border-white/[0.06] text-white focus:ring-0 focus:border-white/10 rounded-lg">
                                            <SelectValue placeholder="Seleccionar" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#121214] border-white/[0.06] text-white max-h-60 rounded-lg">
                                            {compatibleForgeVersions.map(v => <SelectItem key={v} value={v} className="focus:bg-white/[0.04] cursor-pointer">{v}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Select value={selectedLoaderVersion} onValueChange={setSelectedLoaderVersion} disabled={compatibleLoaderVersions.length === 0}>
                                        <SelectTrigger className="h-10 bg-black/20 border-white/[0.06] text-white focus:ring-0 focus:border-white/10 rounded-lg">
                                            <SelectValue placeholder="Seleccionar" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#121214] border-white/[0.06] text-white max-h-60 rounded-lg">
                                            {compatibleLoaderVersions.map(v => <SelectItem key={v} value={v} className="focus:bg-white/[0.04] cursor-pointer">{v}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="p-6 pt-2 bg-[#0e0e10] sm:justify-between gap-3 border-t border-white/[0.04]">
                    <Button variant="ghost" onClick={() => setOpen(false)} className="text-neutral-500 hover:text-white hover:bg-white/[0.04] text-sm">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleCreateInstance}
                        disabled={isCreateButtonDisabled}
                        className="bg-white text-black hover:bg-white/90 font-semibold min-w-[120px] text-sm"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LucidePlus className="w-4 h-4 mr-2" />}
                        Crear
                    </Button>
                </DialogFooter>

            </DialogContent>
        </Dialog>
    );
};
