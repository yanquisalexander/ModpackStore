import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as tauriOpen } from "@tauri-apps/plugin-dialog";
import { Import, Loader2, Check, AlertCircle, Package, FileUp, Box, Cpu, Layers } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { MrpackManifest, MrpackCompatibility } from "@/types/mrpack";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface ImportMrpackDialogProps {
  onInstanceCreated: () => void;
  disabled?: boolean;
  defaultPath?: string;
  onDefaultPathConsumed?: () => void;
}

export const ImportMrpackDialog = ({ onInstanceCreated, disabled = false, defaultPath, onDefaultPathConsumed }: ImportMrpackDialogProps) => {
  const [open, setOpen] = useState(false);
  const [mrpackPath, setMrpackPath] = useState<string | null>(null);
  const [manifest, setManifest] = useState<MrpackManifest | null>(null);
  const [compatibility, setCompatibility] = useState<MrpackCompatibility | null>(null);
  const [instanceName, setInstanceName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);

  useEffect(() => {
    if (defaultPath) {
      setOpen(true);
    }
  }, [defaultPath]);

  useEffect(() => {
    if (open && defaultPath) {
      loadFile(defaultPath);
    }
  }, [open, defaultPath]);

  const loadFile = async (path: string) => {
    setLoadingFile(true);
    setMrpackPath(path);
    try {
      const manifestData = await invoke<MrpackManifest>("validate_mrpack_file", { mrpackPath: path });
      setManifest(manifestData);
      setInstanceName(manifestData.name);

      const compatibilityData = await invoke<MrpackCompatibility>("check_mrpack_compatibility", { manifest: manifestData });
      setCompatibility(compatibilityData);

      if (!compatibilityData.is_compatible) {
        toast.error("Modpack no compatible", { description: compatibilityData.errors.join("\n") });
      }
    } catch (error) {
      console.error("Error al leer archivo:", error);
      toast.error("Error al leer el archivo .mrpack");
      setMrpackPath(null);
    } finally {
      setLoadingFile(false);
      onDefaultPathConsumed?.();
    }
  };

  const handleSelectFile = async () => {
    try {
      const selected = await tauriOpen({
        filters: [{ name: "Modrinth Modpack", extensions: ["mrpack"] }],
      });

      if (selected) {
        const path = Array.isArray(selected) ? selected[0] : selected;
        await loadFile(path);
      }
    } catch (error) {
      console.error("Error al seleccionar archivo:", error);
      toast.error("Error al leer el archivo .mrpack");
    }
  };

  const handleImport = async () => {
    if (!mrpackPath || !manifest || !compatibility?.is_compatible || !instanceName.trim()) return;

    setIsImporting(true);
    try {
      await invoke<string>("create_instance_from_mrpack", {
        mrpackPath: mrpackPath,
        instanceName: instanceName,
      });

      toast.success("Modpack importado exitosamente");
      handleClose();
      onInstanceCreated();
    } catch (error) {
      toast.error("Error al importar modpack", { description: String(error) });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setMrpackPath(null);
      setManifest(null);
      setCompatibility(null);
      setInstanceName("");
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
              <Import className={cn(
                "h-6 w-6 text-neutral-500 transition-colors",
                !disabled && "group-hover:text-white"
              )} />
            </div>
            <div className="text-center">
              <span className={cn(
                "block text-sm font-semibold text-neutral-400",
                !disabled && "group-hover:text-white"
              )}>Importar .mrpack</span>
              <span className="text-xs text-neutral-600">Desde archivo local</span>
            </div>
          </div>
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px] bg-[#0e0e10] border-white/[0.06] p-0 gap-0">

        <div className="p-6 pb-4 border-b border-white/[0.04]">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-teal-400" />
              Importar Modpack
            </DialogTitle>
            <DialogDescription className="text-sm text-neutral-500">
              Crea una instancia a partir de un archivo de Modrinth.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 overflow-y-auto max-h-[55vh] custom-scrollbar">
          <AnimatePresence mode="wait">
            {loadingFile ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-8 gap-3 text-neutral-600"
              >
                <Loader2 className="animate-spin size-6" />
                <span className="text-xs font-medium tracking-wider uppercase">Leyendo archivo...</span>
              </motion.div>
            ) : !mrpackPath ? (
              <motion.div
                key="select"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div
                  onClick={handleSelectFile}
                  className="border-2 border-dashed border-white/[0.06] rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-white/20 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="p-3 rounded-full bg-white/[0.04] mb-3">
                    <FileUp className="w-7 h-7 text-neutral-500" />
                  </div>
                  <p className="text-sm font-medium text-neutral-400 mb-1">Haz clic para buscar</p>
                  <p className="text-xs text-neutral-600">Soporta archivos .mrpack</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {manifest && (
                  <div className="bg-black/20 border border-white/[0.04] rounded-lg p-3 space-y-3">
                    <div className="flex items-start justify-between border-b border-white/[0.04] pb-3">
                      <div>
                        <h3 className="text-sm font-semibold text-white leading-tight">{manifest.name}</h3>
                        <p className="text-[11px] text-neutral-500 font-mono mt-0.5">{manifest.versionId}</p>
                      </div>
                      <div className="p-1.5 bg-teal-500/10 rounded-md text-teal-400">
                        <Package className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded-md bg-black/20 border border-white/[0.04] flex items-center gap-2">
                        <Box className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                        <div>
                          <p className="text-[10px] text-neutral-600 uppercase font-medium">Minecraft</p>
                          <p className="text-sm text-white font-medium">{manifest.dependencies.minecraft}</p>
                        </div>
                      </div>
                      <div className="p-2 rounded-md bg-black/20 border border-white/[0.04] flex items-center gap-2">
                        <Cpu className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                        <div>
                          <p className="text-[10px] text-neutral-600 uppercase font-medium">Loader</p>
                          <p className="text-sm text-white font-medium capitalize">{compatibility?.loader || "Vanilla"}</p>
                        </div>
                      </div>
                      <div className="p-2 rounded-md bg-black/20 border border-white/[0.04] flex items-center gap-2 col-span-2">
                        <Layers className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                        <div>
                          <p className="text-[10px] text-neutral-600 uppercase font-medium">Contenido</p>
                          <p className="text-sm text-white font-medium">{manifest.files.length} archivos incluidos</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {compatibility && (
                  <div className="space-y-1.5">
                    {!compatibility.is_compatible && (
                      <Alert className="bg-red-500/10 border-red-500/20 text-red-300 text-sm py-2">
                        <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                        <AlertTitle className="text-red-400 text-xs font-semibold">Incompatible</AlertTitle>
                        <AlertDescription className="text-red-300/80 text-[11px] mt-0.5">
                          {compatibility.errors[0] || "Este modpack tiene errores críticos."}
                        </AlertDescription>
                      </Alert>
                    )}

                    {compatibility.warnings.length > 0 && (
                      <Alert className="bg-yellow-500/10 border-yellow-500/20 text-yellow-300 text-sm py-2">
                        <AlertCircle className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
                        <AlertTitle className="text-yellow-400 text-xs font-semibold">Advertencia</AlertTitle>
                        <AlertDescription className="text-yellow-300/80 text-[11px] mt-0.5">
                          {compatibility.warnings.length} advertencias detectadas (puedes continuar).
                        </AlertDescription>
                      </Alert>
                    )}

                    {compatibility.is_compatible && compatibility.warnings.length === 0 && (
                      <div className="flex items-center gap-2 text-emerald-400 text-[11px] bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                        <Check className="w-3.5 h-3.5" />
                        Verificación exitosa. Listo para importar.
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs font-medium text-neutral-500 ml-1">Nombre de la Instancia</Label>
                  <Input
                    value={instanceName}
                    onChange={(e) => setInstanceName(e.target.value)}
                    className="h-9 bg-black/20 border-white/[0.06] text-white placeholder:text-neutral-700 focus:border-white/10 rounded-lg transition-colors text-sm"
                    disabled={!compatibility?.is_compatible}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="p-6 pt-2 bg-[#0e0e10] sm:justify-between gap-3 border-t border-white/[0.04]">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={isImporting}
            className="text-neutral-500 hover:text-white hover:bg-white/[0.04] text-sm"
          >
            Cancelar
          </Button>

          {mrpackPath && (
            <Button
              onClick={handleImport}
              disabled={!compatibility?.is_compatible || !instanceName.trim() || isImporting}
              className="bg-white text-black hover:bg-white/90 font-semibold min-w-[120px] text-sm"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando
                </>
              ) : (
                <>
                  <Import className="mr-2 h-4 w-4" />
                  Instalar
                </>
              )}
            </Button>
          )}
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
};
