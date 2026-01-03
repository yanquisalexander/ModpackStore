import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as tauriOpen } from "@tauri-apps/plugin-dialog";
import { Import, Loader2, Check, AlertCircle, Package, FileUp, Box, Cpu, Layers, FileJson } from "lucide-react";
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
}

export const ImportMrpackDialog = ({ onInstanceCreated }: ImportMrpackDialogProps) => {
  const [open, setOpen] = useState(false);
  const [mrpackPath, setMrpackPath] = useState<string | null>(null);
  const [manifest, setManifest] = useState<MrpackManifest | null>(null);
  const [compatibility, setCompatibility] = useState<MrpackCompatibility | null>(null);
  const [instanceName, setInstanceName] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const handleSelectFile = async () => {
    try {
      const selected = await tauriOpen({
        filters: [{ name: "Modrinth Modpack", extensions: ["mrpack"] }],
      });

      if (selected) {
        const path = Array.isArray(selected) ? selected[0] : selected;
        setMrpackPath(path);

        const manifestData = await invoke<MrpackManifest>("validate_mrpack_file", { mrpackPath: path });
        setManifest(manifestData);
        setInstanceName(manifestData.name);

        const compatibilityData = await invoke<MrpackCompatibility>("check_mrpack_compatibility", { manifest: manifestData });
        setCompatibility(compatibilityData);

        if (!compatibilityData.is_compatible) {
          toast.error("Modpack no compatible", { description: compatibilityData.errors.join("\n") });
        }
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
        <button className="group relative h-[160px] w-full overflow-hidden rounded-xl border border-dashed border-white/10 bg-[#0a0a0a] hover:bg-white/[0.02] hover:border-purple-500/30 transition-all duration-200">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="p-3 rounded-full bg-white/5 group-hover:bg-purple-500/10 transition-colors border border-white/5 group-hover:border-purple-500/20">
              <Import className="h-6 w-6 text-neutral-400 group-hover:text-purple-400 transition-colors" />
            </div>
            <div className="text-center">
              <span className="block text-sm font-semibold text-neutral-300 group-hover:text-white">Importar .mrpack</span>
              <span className="text-xs text-neutral-500">Desde archivo local</span>
            </div>
          </div>
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px] bg-[#0a0a0a] border-white/10 p-0 gap-0 shadow-2xl overflow-hidden">

        {/* HEADER */}
        <div className="p-6 border-b border-white/5 bg-gradient-to-b from-purple-500/[0.05] to-transparent">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-400" />
              Importar Modpack
            </DialogTitle>
            <DialogDescription className="text-neutral-400">
              Crea una instancia a partir de un archivo de Modrinth.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {!mrpackPath ? (
              /* ESTADO 1: SELECCIONAR ARCHIVO */
              <motion.div
                key="select"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div
                  onClick={handleSelectFile}
                  className="border-2 border-dashed border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer hover:border-purple-500/50 hover:bg-purple-500/5 transition-all group"
                >
                  <div className="p-4 rounded-full bg-white/5 mb-4 group-hover:scale-110 transition-transform">
                    <FileUp className="w-8 h-8 text-neutral-400 group-hover:text-purple-400" />
                  </div>
                  <p className="text-sm font-medium text-white mb-1">Haz clic para buscar</p>
                  <p className="text-xs text-neutral-500">Soporta archivos .mrpack</p>
                </div>
              </motion.div>
            ) : (
              /* ESTADO 2: DETALLES DEL MODPACK */
              <motion.div
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {/* MANIFEST CARD */}
                {manifest && (
                  <div className="bg-[#151515] border border-white/10 rounded-xl p-4 space-y-4">
                    <div className="flex items-start justify-between border-b border-white/5 pb-4">
                      <div>
                        <h3 className="text-lg font-bold text-white leading-tight">{manifest.name}</h3>
                        <p className="text-xs text-purple-400 font-mono mt-1">{manifest.versionId}</p>
                      </div>
                      <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                        <Package className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-2.5 rounded-lg bg-black/20 border border-white/5 flex items-center gap-3">
                        <Box className="w-4 h-4 text-neutral-500" />
                        <div>
                          <p className="text-[10px] text-neutral-500 uppercase font-bold">Minecraft</p>
                          <p className="text-sm text-white font-medium">{manifest.dependencies.minecraft}</p>
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/20 border border-white/5 flex items-center gap-3">
                        <Cpu className="w-4 h-4 text-neutral-500" />
                        <div>
                          <p className="text-[10px] text-neutral-500 uppercase font-bold">Loader</p>
                          <p className="text-sm text-white font-medium capitalize">{compatibility?.loader || "Vanilla"}</p>
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/20 border border-white/5 flex items-center gap-3 col-span-2">
                        <Layers className="w-4 h-4 text-neutral-500" />
                        <div>
                          <p className="text-[10px] text-neutral-500 uppercase font-bold">Contenido</p>
                          <p className="text-sm text-white font-medium">{manifest.files.length} archivos incluidos</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ALERTS & STATUS */}
                {compatibility && (
                  <div className="space-y-3">
                    {!compatibility.is_compatible && (
                      <Alert className="bg-red-900/20 border-red-500/30">
                        <AlertCircle className="h-4 w-4 text-red-400" />
                        <AlertTitle className="text-red-400">Incompatible</AlertTitle>
                        <AlertDescription className="text-red-200/80 text-xs mt-1">
                          {compatibility.errors[0] || "Este modpack tiene errores críticos."}
                        </AlertDescription>
                      </Alert>
                    )}

                    {compatibility.warnings.length > 0 && (
                      <Alert className="bg-yellow-900/20 border-yellow-500/30">
                        <AlertCircle className="h-4 w-4 text-yellow-400" />
                        <AlertTitle className="text-yellow-400">Advertencia</AlertTitle>
                        <AlertDescription className="text-yellow-200/80 text-xs mt-1">
                          {compatibility.warnings.length} advertencias detectadas (puedes continuar).
                        </AlertDescription>
                      </Alert>
                    )}

                    {compatibility.is_compatible && compatibility.warnings.length === 0 && (
                      <div className="flex items-center gap-2 text-green-400 text-xs bg-green-500/10 px-3 py-2 rounded-lg border border-green-500/20">
                        <Check className="w-4 h-4" />
                        Verificación exitosa. Listo para importar.
                      </div>
                    )}
                  </div>
                )}

                {/* INPUT NAME */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-neutral-500 uppercase tracking-wider ml-1">Nombre de la Instancia</Label>
                  <Input
                    value={instanceName}
                    onChange={(e) => setInstanceName(e.target.value)}
                    className="bg-[#151515] border-white/10 focus:border-purple-500/50 text-white h-11"
                    disabled={!compatibility?.is_compatible}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* FOOTER */}
        <DialogFooter className="p-6 pt-2 bg-[#0a0a0a] sm:justify-between gap-3 border-t border-white/5">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={isImporting}
            className="text-neutral-500 hover:text-white hover:bg-white/5"
          >
            Cancelar
          </Button>

          {mrpackPath && (
            <Button
              onClick={handleImport}
              disabled={!compatibility?.is_compatible || !instanceName.trim() || isImporting}
              className="bg-purple-600 hover:bg-purple-500 text-white min-w-[120px] font-bold shadow-lg shadow-purple-900/20"
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