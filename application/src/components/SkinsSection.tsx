import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
    getUserTextures,
    uploadSkin,
    uploadCape,
    activateSkin,
    activateCape,
    deactivateSkin,
    deactivateCape,
    deleteSkin,
    deleteCape,
} from "@/services/skins.service";
import type { UserTextures, SkinModel } from "@/types/skins";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Upload, Trash2, Check, Shirt, X, User, Layers, Gamepad2
} from "lucide-react";
import { SkinPreview3D } from "@/components/SkinPreview3D";

export const SkinsSection = () => {
    const [textures, setTextures] = useState<UserTextures | null>(null);
    const [loading, setLoading] = useState(true);
    const [skinDialogOpen, setSkinDialogOpen] = useState(false);
    const [capeDialogOpen, setCapeDialogOpen] = useState(false);

    useEffect(() => {
        loadTextures();
    }, []);

    async function loadTextures() {
        try {
            setLoading(true);
            const data = await getUserTextures();
            setTextures(data);
        } catch (err) {
            console.error("[SKINS] Failed to load textures:", err);
            toast.error("Error al cargar las skins");
        } finally {
            setLoading(false);
        }
    }

    async function handleActivateSkin(skinId: string) {
        try {
            await activateSkin(skinId);
            toast.success("Skin activada");
            await loadTextures();
        } catch (err: any) {
            toast.error(err.message || "Error al activar skin");
        }
    }

    async function handleActivateCape(capeId: string) {
        try {
            await activateCape(capeId);
            toast.success("Capa activada");
            await loadTextures();
        } catch (err: any) {
            toast.error(err.message || "Error al activar capa");
        }
    }

    async function handleDeleteSkin(skinId: string) {
        try {
            await deleteSkin(skinId);
            toast.success("Skin eliminada");
            await loadTextures();
        } catch (err: any) {
            toast.error(err.message || "Error al eliminar skin");
        }
    }

    async function handleDeleteCape(capeId: string) {
        try {
            await deleteCape(capeId);
            toast.success("Capa eliminada");
            await loadTextures();
        } catch (err: any) {
            toast.error(err.message || "Error al eliminar capa");
        }
    }

    async function handleDeactivateSkin() {
        try {
            await deactivateSkin();
            toast.success("Skin desactivada");
            await loadTextures();
        } catch (err: any) {
            toast.error(err.message || "Error al desactivar skin");
        }
    }

    async function handleDeactivateCape() {
        try {
            await deactivateCape();
            toast.success("Capa desactivada");
            await loadTextures();
        } catch (err: any) {
            toast.error(err.message || "Error al desactivar capa");
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[200px]">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-zinc-500" />
            </div>
        );
    }

    const hasContent = textures && (textures.skins.length > 0 || textures.capes.length > 0);

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="space-y-0.5">
                <h2 className="text-lg font-semibold text-foreground">Skins de Minecraft</h2>
                <p className="text-sm text-muted-foreground">
                    Gestiona tu skin y capa para los servidores. Estas se usarán cuando tengas la autenticación de Modpack Store activada y el servidor lo soporte.
                </p>
            </div>

            {/* Active Skin */}
            {textures?.activeSkin && (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-border/70 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">Skin Activa</h3>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDeactivateSkin}
                            className="text-zinc-500 hover:text-red-400 h-7 px-2"
                        >
                            <X className="w-3.5 h-3.5 mr-1" />
                            Quitar
                        </Button>
                    </div>
                    <div className="p-5 flex items-center gap-4">
                        <div className="w-32 h-48 bg-zinc-900 rounded-lg overflow-hidden border border-border/60 shrink-0 flex items-center justify-center">
                            <SkinPreview3D
                                url={textures.activeSkin.url}
                                model={textures.activeSkin.model}
                                className="w-full h-full"
                            />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                                {textures.activeSkin.name || "Sin nombre"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {textures.activeSkin.model === "slim" ? "Slim (3px)" : "Classic (4px)"}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Active Cape */}
            {textures?.activeCape && (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-border/70 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">Capa Activa</h3>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDeactivateCape}
                            className="text-zinc-500 hover:text-red-400 h-7 px-2"
                        >
                            <X className="w-3.5 h-3.5 mr-1" />
                            Quitar
                        </Button>
                    </div>
                    <div className="p-5 flex items-center gap-4">
                        <div className="w-32 h-16 bg-zinc-900 rounded-lg overflow-hidden border border-border/60 shrink-0">
                            <img
                                src={textures.activeCape.url}
                                alt="Capa activa"
                                className="w-full h-full object-contain"
                                style={{ imageRendering: "pixelated" }}
                            />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                                {textures.activeCape.name || "Sin nombre"}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload Buttons */}
            <div className="flex gap-3">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSkinDialogOpen(true)}
                    className="border-white/[0.06] text-neutral-400 hover:text-white hover:bg-white/[0.04]"
                >
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    Subir Skin
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCapeDialogOpen(true)}
                    className="border-white/[0.06] text-neutral-400 hover:text-white hover:bg-white/[0.04]"
                >
                    <Shirt className="w-3.5 h-3.5 mr-1.5" />
                    Subir Capa
                </Button>
            </div>

            {/* Dialogs */}
            <SkinUploadDialog
                isOpen={skinDialogOpen}
                onClose={() => setSkinDialogOpen(false)}
                onSuccess={() => { loadTextures(); setSkinDialogOpen(false); }}
            />
            <CapeUploadDialog
                isOpen={capeDialogOpen}
                onClose={() => setCapeDialogOpen(false)}
                onSuccess={() => { loadTextures(); setCapeDialogOpen(false); }}
            />

            {/* Skin Gallery */}
            {textures && textures.skins.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Galería de Skins</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {textures.skins.map((skin) => (
                            <div
                                key={skin.id}
                                className={cn(
                                    "bg-card border rounded-xl p-3 transition-colors group",
                                    skin.isActive
                                        ? "border-purple-500/50 bg-purple-500/5"
                                        : "border-border hover:border-border/80"
                                )}
                            >
                                <div className="w-full h-24 bg-zinc-900 rounded-lg overflow-hidden mb-2 border border-border/40">
                                    <img
                                        src={skin.url}
                                        alt={skin.name || "Skin"}
                                        className="w-full h-full object-contain"
                                        style={{ imageRendering: "pixelated" }}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="min-w-0">
                                        <p className="text-xs font-medium text-foreground truncate">{skin.name || "Sin nombre"}</p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {skin.model === "slim" ? "Slim" : "Classic"}
                                        </p>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!skin.isActive && (
                                            <button
                                                onClick={() => handleActivateSkin(skin.id)}
                                                className="p-1 rounded hover:bg-white/[0.06] text-neutral-500 hover:text-green-400"
                                                title="Activar"
                                            >
                                                <Check className="w-3 h-3" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDeleteSkin(skin.id)}
                                            className="p-1 rounded hover:bg-red-500/10 text-neutral-500 hover:text-red-400"
                                            title="Eliminar"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Cape Gallery */}
            {textures && textures.capes.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Galería de Capas</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {textures.capes.map((cape) => (
                            <div
                                key={cape.id}
                                className={cn(
                                    "bg-card border rounded-xl p-3 transition-colors group",
                                    cape.isActive
                                        ? "border-purple-500/50 bg-purple-500/5"
                                        : "border-border hover:border-border/80"
                                )}
                            >
                                <div className="w-full h-16 bg-zinc-900 rounded-lg overflow-hidden mb-2 border border-border/40">
                                    <img
                                        src={cape.url}
                                        alt={cape.name || "Capa"}
                                        className="w-full h-full object-contain"
                                        style={{ imageRendering: "pixelated" }}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-medium text-foreground truncate min-w-0">
                                        {cape.name || "Sin nombre"}
                                    </p>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!cape.isActive && (
                                            <button
                                                onClick={() => handleActivateCape(cape.id)}
                                                className="p-1 rounded hover:bg-white/[0.06] text-neutral-500 hover:text-green-400"
                                                title="Activar"
                                            >
                                                <Check className="w-3 h-3" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDeleteCape(cape.id)}
                                            className="p-1 rounded hover:bg-red-500/10 text-neutral-500 hover:text-red-400"
                                            title="Eliminar"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {!hasContent && (
                <div className="text-center py-12">
                    <div className="size-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3 text-muted-foreground">
                        <Gamepad2 className="size-6" />
                    </div>
                    <p className="text-base font-medium mb-1">No tienes skins ni capas todavía</p>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        Sube un PNG de 64x64 para tu skin o 64x32 para tu capa. Aparecerán automáticamente en los servidores que soporten la autenticación de Modpack Store.
                    </p>
                </div>
            )}
        </motion.div>
    );
};

// ── Skin Upload Dialog ───────────────────────────────

interface SkinUploadDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const SkinUploadDialog: React.FC<SkinUploadDialogProps> = ({ isOpen, onClose, onSuccess }) => {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [model, setModel] = useState<SkinModel>("classic");
    const [uploading, setUploading] = useState(false);

    function handleClose() {
        setFile(null);
        setPreview(null);
        setName("");
        setModel("classic");
        onClose();
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0] || null;
        setFile(f);
        if (f) {
            setPreview(URL.createObjectURL(f));
        } else {
            setPreview(null);
        }
    }

    async function handleSubmit() {
        if (!file) return;
        setUploading(true);
        try {
            await uploadSkin(file, model, name || undefined);
            toast.success("Skin subida correctamente");
            onSuccess();
        } catch (err: any) {
            toast.error(err.message || "Error al subir la skin");
        } finally {
            setUploading(false);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-white p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 flex-1 overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold">Subir Skin</DialogTitle>
                        <DialogDescription className="text-sm text-zinc-500">
                            PNG de 64x64 pixels. Se validará y normalizará automáticamente.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-4 space-y-4">
                        {/* File upload */}
                        <div>
                            <input
                                id="skin-file-input"
                                type="file"
                                accept="image/png"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <label
                                htmlFor="skin-file-input"
                                className={cn(
                                    "flex flex-col items-center justify-center w-full h-32 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
                                    preview
                                        ? "border-purple-500/50 bg-purple-500/5"
                                        : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
                                )}
                            >
                                {preview ? (
                                    <SkinPreview3D
                                        url={preview}
                                        model={model}
                                        className="w-full h-full"
                                    />
                                ) : (
                                    <>
                                        <Upload className="w-6 h-6 text-zinc-500 mb-1" />
                                        <span className="text-xs text-zinc-500">Seleccionar PNG</span>
                                    </>
                                )}
                            </label>
                        </div>

                        {/* Name */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-zinc-200">Nombre</Label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Mi skin (opcional)"
                                className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-emerald-500"
                            />
                        </div>

                        {/* Model selection */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-zinc-200">Modelo de brazos</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { id: "classic" as SkinModel, label: "Classic", desc: "Brazos de 4px", icon: User },
                                    { id: "slim" as SkinModel, label: "Slim", desc: "Brazos de 3px", icon: Layers },
                                ].map((opt) => (
                                    <div
                                        key={opt.id}
                                        onClick={() => setModel(opt.id)}
                                        className={cn(
                                            "cursor-pointer rounded-lg border p-3 transition-all hover:bg-zinc-800",
                                            model === opt.id
                                                ? "bg-zinc-800 border-purple-500 ring-1 ring-purple-500"
                                                : "bg-zinc-900 border-zinc-700"
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <opt.icon className="w-4 h-4 text-zinc-400" />
                                            <span className="text-sm font-medium text-white">{opt.label}</span>
                                        </div>
                                        <p className="text-xs text-zinc-500 mt-0.5">{opt.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-4 border-t border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClose}
                        className="text-zinc-400 hover:text-white"
                    >
                        Cancelar
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleSubmit}
                        disabled={!file || uploading}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                        {uploading ? "Subiendo..." : "Subir"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// ── Cape Upload Dialog ───────────────────────────────

interface CapeUploadDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const CapeUploadDialog: React.FC<CapeUploadDialogProps> = ({ isOpen, onClose, onSuccess }) => {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [uploading, setUploading] = useState(false);

    function handleClose() {
        setFile(null);
        setPreview(null);
        setName("");
        onClose();
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0] || null;
        setFile(f);
        if (f) {
            setPreview(URL.createObjectURL(f));
        } else {
            setPreview(null);
        }
    }

    async function handleSubmit() {
        if (!file) return;
        setUploading(true);
        try {
            await uploadCape(file, name || undefined);
            toast.success("Capa subida correctamente");
            onSuccess();
        } catch (err: any) {
            toast.error(err.message || "Error al subir la capa");
        } finally {
            setUploading(false);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-white p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 flex-1 overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold">Subir Capa</DialogTitle>
                        <DialogDescription className="text-sm text-zinc-500">
                            PNG de 64x32 pixels (proporción 2:1). Se validará automáticamente.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-4 space-y-4">
                        {/* File upload */}
                        <div>
                            <input
                                id="cape-file-input"
                                type="file"
                                accept="image/png"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <label
                                htmlFor="cape-file-input"
                                className={cn(
                                    "flex flex-col items-center justify-center w-full h-24 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
                                    preview
                                        ? "border-purple-500/50 bg-purple-500/5"
                                        : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
                                )}
                            >
                                {preview ? (
                                    <img
                                        src={preview}
                                        alt="Preview"
                                        className="h-full object-contain p-2"
                                        style={{ imageRendering: "pixelated" }}
                                    />
                                ) : (
                                    <>
                                        <Upload className="w-6 h-6 text-zinc-500 mb-1" />
                                        <span className="text-xs text-zinc-500">Seleccionar PNG</span>
                                    </>
                                )}
                            </label>
                        </div>

                        {/* Name */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-zinc-200">Nombre</Label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Mi capa (opcional)"
                                className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-emerald-500"
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-4 border-t border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClose}
                        className="text-zinc-400 hover:text-white"
                    >
                        Cancelar
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleSubmit}
                        disabled={!file || uploading}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                        {uploading ? "Subiendo..." : "Subir"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
