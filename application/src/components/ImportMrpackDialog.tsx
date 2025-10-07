import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { LucidePackageImport, LucideLoader2, LucideCheck, LucideAlertCircle, LucidePackage } from "lucide-react";
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
      const selected = await open({
        filters: [
          {
            name: "Modrinth Modpack",
            extensions: ["mrpack"],
          },
        ],
      });

      if (selected) {
        const path = Array.isArray(selected) ? selected[0] : selected;
        setMrpackPath(path);

        // Validate and read manifest
        const manifestData = await invoke<MrpackManifest>("validate_mrpack_file", {
          mrpackPath: path,
        });

        setManifest(manifestData);
        setInstanceName(manifestData.name);

        // Check compatibility
        const compatibilityData = await invoke<MrpackCompatibility>(
          "check_mrpack_compatibility",
          { manifest: manifestData }
        );

        setCompatibility(compatibilityData);

        if (!compatibilityData.is_compatible) {
          toast.error("Modpack no compatible", {
            description: compatibilityData.errors.join("\n"),
          });
        }
      }
    } catch (error) {
      console.error("Error al seleccionar archivo:", error);
      toast.error("Error al leer el archivo .mrpack", {
        description: String(error),
      });
    }
  };

  const handleImport = async () => {
    if (!mrpackPath || !manifest || !compatibility?.is_compatible) {
      toast.error("No se puede importar el modpack");
      return;
    }

    if (!instanceName.trim()) {
      toast.error("El nombre de la instancia no puede estar vacío");
      return;
    }

    setIsImporting(true);

    try {
      // TODO: Implement actual import logic
      // This would call a Tauri command to create instance from mrpack
      // For now, we'll show a success message
      toast.info("Importación en desarrollo", {
        description: "La funcionalidad de importación completa está en desarrollo. Por ahora, puedes visualizar la información del modpack.",
      });

      // Reset form
      handleClose();
      onInstanceCreated();
    } catch (error) {
      toast.error("Error al importar modpack", {
        description: String(error),
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setMrpackPath(null);
    setManifest(null);
    setCompatibility(null);
    setInstanceName("");
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      handleClose();
    } else {
      setOpen(isOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          className="cursor-pointer aspect-video z-10 group relative overflow-hidden rounded-xl border border-dashed border-white/20 h-auto flex flex-col items-center justify-center
                    transition duration-300 hover:border-purple-400/50 hover:bg-gray-800/30"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 rounded-full bg-gray-800/80 group-hover:bg-purple-900/40 transition">
              <LucidePackageImport className="h-8 w-8 text-gray-400 group-hover:text-purple-300" />
            </div>
            <span className="text-gray-400 group-hover:text-purple-300 font-medium">
              Importar .mrpack
            </span>
          </div>
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[600px] dark max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="from-[#9f4eff] to-[#542fff] bg-clip-text text-transparent bg-gradient-to-b">
            Importar Modpack de Modrinth
          </DialogTitle>
          <DialogDescription>
            Selecciona un archivo .mrpack para crear una nueva instancia
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {!mrpackPath ? (
            <Button onClick={handleSelectFile} className="w-full">
              Seleccionar archivo .mrpack
            </Button>
          ) : (
            <>
              {/* Display manifest info */}
              <div className="space-y-2">
                <Label>Archivo seleccionado</Label>
                <div className="text-sm text-muted-foreground break-all">
                  {mrpackPath}
                </div>
              </div>

              {manifest && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Modpack</Label>
                      <div className="text-sm font-medium">{manifest.name}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Versión</Label>
                      <div className="text-sm font-medium">{manifest.versionId}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Minecraft</Label>
                      <div className="text-sm font-medium">
                        {manifest.dependencies.minecraft}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Loader</Label>
                      <div className="text-sm font-medium capitalize">
                        {compatibility?.loader || "vanilla"}
                      </div>
                    </div>
                  </div>

                  {manifest.summary && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Descripción</Label>
                      <p className="text-sm text-muted-foreground">{manifest.summary}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Archivos</Label>
                    <div className="text-sm font-medium">
                      {manifest.files.length} mod(s)
                    </div>
                  </div>
                </>
              )}

              {compatibility && (
                <>
                  {/* Compatibility warnings */}
                  {compatibility.warnings.length > 0 && (
                    <Alert className="bg-yellow-900/20 border-yellow-700/50">
                      <LucideAlertCircle className="h-4 w-4 text-yellow-300" />
                      <AlertTitle className="text-yellow-300">Advertencias</AlertTitle>
                      <AlertDescription className="text-yellow-200">
                        <ul className="list-disc list-inside space-y-1">
                          {compatibility.warnings.map((warning, index) => (
                            <li key={index} className="text-sm">
                              {warning}
                            </li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Compatibility errors */}
                  {compatibility.errors.length > 0 && (
                    <Alert className="bg-red-900/20 border-red-700/50">
                      <LucideAlertCircle className="h-4 w-4 text-red-300" />
                      <AlertTitle className="text-red-300">Errores</AlertTitle>
                      <AlertDescription className="text-red-200">
                        <ul className="list-disc list-inside space-y-1">
                          {compatibility.errors.map((error, index) => (
                            <li key={index} className="text-sm">
                              {error}
                            </li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Success indicator */}
                  {compatibility.is_compatible && (
                    <Alert className="bg-green-900/20 border-green-700/50">
                      <LucideCheck className="h-4 w-4 text-green-300" />
                      <AlertTitle className="text-green-300">Compatible</AlertTitle>
                      <AlertDescription className="text-green-200">
                        Este modpack es compatible con ModpackStore
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}

              {/* Instance name input */}
              <div className="space-y-2">
                <Label htmlFor="instanceName">Nombre de la instancia</Label>
                <Input
                  id="instanceName"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  placeholder="Mi instancia"
                  disabled={!compatibility?.is_compatible}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            Cancelar
          </Button>
          {mrpackPath && (
            <Button
              onClick={handleImport}
              disabled={
                !compatibility?.is_compatible || !instanceName.trim() || isImporting
              }
            >
              {isImporting ? (
                <>
                  <LucideLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <LucidePackage className="mr-2 h-4 w-4" />
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
