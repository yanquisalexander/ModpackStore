import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { World, WorldEditData, ImportConflict, GameType, Difficulty, GAME_TYPE_LABELS, DIFFICULTY_LABELS } from "@/types/world";
import { LucideDownload, LucideEdit, LucideMoreVertical, LucideTrash2, LucideUpload, LucideLoaderCircle, LucideFolderOpen } from "lucide-react";

interface WorldManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
}

export function WorldManagerDialog({ open, onOpenChange, instanceId }: WorldManagerDialogProps) {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteWorld, setDeleteWorld] = useState<World | null>(null);
  const [editWorld, setEditWorld] = useState<World | null>(null);
  const [editData, setEditData] = useState<WorldEditData | null>(null);
  const [importConflict, setImportConflict] = useState<ImportConflict | null>(null);
  const [pendingImport, setPendingImport] = useState<{ path: string; } | null>(null);

  useEffect(() => {
    if (open) {
      loadWorlds();
    }
  }, [open, instanceId]);

  const loadWorlds = async () => {
    setLoading(true);
    try {
      const worldsList = await invoke<World[]>("list_worlds", { instanceId });
      setWorlds(worldsList);
    } catch (error) {
      console.error("Failed to load worlds:", error);
      toast.error("Error al cargar los mundos", {
        description: typeof error === "string" ? error : "No se pudieron cargar los mundos",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "World ZIP", extensions: ["zip"] }],
      });

      if (!selected) return;

      const zipPath = selected;

      // Validate the import first
      const conflict = await invoke<ImportConflict | null>("validate_world_import", {
        instanceId,
        zipPath,
      });

      if (conflict) {
        setImportConflict(conflict);
        setPendingImport({ path: zipPath });
      } else {
        // No conflict, proceed with import
        await performImport(zipPath, false);
      }
    } catch (error) {
      console.error("Import failed:", error);
      toast.error("Error al importar el mundo", {
        description: typeof error === "string" ? error : "No se pudo importar el mundo",
      });
    }
  };

  const performImport = async (zipPath: string, overwrite: boolean) => {
    try {
      await invoke("import_world", {
        instanceId,
        zipPath,
        overwrite,
      });

      toast.success("Mundo importado correctamente");
      await loadWorlds();
      setImportConflict(null);
      setPendingImport(null);
    } catch (error) {
      console.error("Import failed:", error);
      toast.error("Error al importar el mundo", {
        description: typeof error === "string" ? error : "No se pudo importar el mundo",
      });
    }
  };

  const handleDelete = async (world: World) => {
    try {
      await invoke("delete_world", {
        instanceId,
        worldName: world.name,
      });

      toast.success("Mundo eliminado correctamente");
      await loadWorlds();
      setDeleteWorld(null);
    } catch (error) {
      console.error("Delete failed:", error);
      toast.error("Error al eliminar el mundo", {
        description: typeof error === "string" ? error : "No se pudo eliminar el mundo",
      });
    }
  };

  const handleExport = async (world: World) => {
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const suggestedName = `${world.name}_${timestamp}.zip`;

      const savePath = await save({
        defaultPath: suggestedName,
        filters: [{ name: "World ZIP", extensions: ["zip"] }],
      });

      if (!savePath) return;

      toast.loading("Exportando mundo...", { id: "export-world" });

      await invoke("export_world", {
        instanceId,
        worldName: world.name,
        destinationPath: savePath,
      });

      toast.success("Mundo exportado correctamente", { id: "export-world" });
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Error al exportar el mundo", {
        id: "export-world",
        description: typeof error === "string" ? error : "No se pudo exportar el mundo",
      });
    }
  };

  const handleEditClick = (world: World) => {
    setEditWorld(world);
    setEditData({
      game_type: world.game_type ?? GameType.Survival,
      difficulty: world.difficulty ?? Difficulty.Normal,
      allow_commands: world.allow_commands ?? false,
      hardcore: world.hardcore ?? false,
    });
  };

  const handleSaveEdit = async () => {
    if (!editWorld || !editData) return;

    try {
      await invoke("edit_world_settings", {
        instanceId,
        worldName: editWorld.name,
        settings: editData,
      });

      toast.success("Configuración del mundo guardada");
      await loadWorlds();
      setEditWorld(null);
      setEditData(null);
    } catch (error) {
      console.error("Edit failed:", error);
      toast.error("Error al guardar la configuración", {
        description: typeof error === "string" ? error : "No se pudo guardar la configuración",
      });
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Administrar Mundos</span>
              <Button onClick={handleImport} size="sm" className="gap-2">
                <LucideUpload className="size-4" />
                Importar Mundo
              </Button>
            </DialogTitle>
            <DialogDescription>
              Gestiona los mundos de esta instancia
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LucideLoaderCircle className="size-8 animate-spin text-primary" />
            </div>
          ) : worlds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <LucideFolderOpen className="size-12 mb-4" />
              <p>No hay mundos en esta instancia</p>
              <p className="text-sm">Importa un mundo para comenzar</p>
            </div>
          ) : (
            <div className="space-y-2">
              {worlds.map((world) => (
                <div
                  key={world.path}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/50 transition"
                >
                  {world.icon_path ? (
                    <img
                      src={`file://${world.icon_path}`}
                      alt={world.name}
                      className="size-16 rounded object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/images/default-world-icon.png";
                      }}
                    />
                  ) : (
                    <div className="size-16 rounded bg-accent flex items-center justify-center">
                      <LucideFolderOpen className="size-8 text-muted-foreground" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">
                      {world.level_name || world.name}
                    </h3>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Última modificación: {formatDate(world.last_modified)}</p>
                      <p>Tamaño: {formatSize(world.size_bytes)}</p>
                      {world.version && <p>Versión: {world.version}</p>}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <LucideMoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditClick(world)}>
                        <LucideEdit className="size-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport(world)}>
                        <LucideDownload className="size-4 mr-2" />
                        Exportar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeleteWorld(world)}
                        className="text-destructive"
                      >
                        <LucideTrash2 className="size-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteWorld} onOpenChange={() => setDeleteWorld(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar mundo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El mundo "{deleteWorld?.level_name || deleteWorld?.name}" será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteWorld && handleDelete(deleteWorld)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Conflict Dialog */}
      <AlertDialog open={!!importConflict} onOpenChange={() => {
        setImportConflict(null);
        setPendingImport(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conflicto al importar</AlertDialogTitle>
            <AlertDialogDescription>
              {importConflict?.message}
              {importConflict?.conflict_type === "name_exists" && (
                <p className="mt-2">¿Deseas sobrescribir el mundo existente?</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {importConflict?.conflict_type === "name_exists" && (
              <AlertDialogAction
                onClick={() => pendingImport && performImport(pendingImport.path, true)}
              >
                Sobrescribir
              </AlertDialogAction>
            )}
            {importConflict?.conflict_type === "version_mismatch" && (
              <AlertDialogAction
                onClick={() => pendingImport && performImport(pendingImport.path, true)}
                className="bg-orange-500 hover:bg-orange-600"
              >
                Continuar de todos modos
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit World Sheet */}
      <Sheet open={!!editWorld} onOpenChange={(open) => {
        if (!open) {
          setEditWorld(null);
          setEditData(null);
        }
      }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Editar Mundo</SheetTitle>
          </SheetHeader>

          {editData && (
            <div className="space-y-6 mt-6">
              <div className="space-y-2">
                <Label htmlFor="game-type">Modo de Juego</Label>
                <Select
                  value={editData.game_type.toString()}
                  onValueChange={(value) =>
                    setEditData({ ...editData, game_type: parseInt(value) })
                  }
                >
                  <SelectTrigger id="game-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(GAME_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="difficulty">Dificultad</Label>
                <Select
                  value={editData.difficulty.toString()}
                  onValueChange={(value) =>
                    setEditData({ ...editData, difficulty: parseInt(value) })
                  }
                >
                  <SelectTrigger id="difficulty">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="allow-commands">Permitir Comandos</Label>
                <Switch
                  id="allow-commands"
                  checked={editData.allow_commands}
                  onCheckedChange={(checked) =>
                    setEditData({ ...editData, allow_commands: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="hardcore">Modo Hardcore</Label>
                <Switch
                  id="hardcore"
                  checked={editData.hardcore}
                  onCheckedChange={(checked) =>
                    setEditData({ ...editData, hardcore: checked })
                  }
                />
              </div>

              <Button onClick={handleSaveEdit} className="w-full">
                Guardar Cambios
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
