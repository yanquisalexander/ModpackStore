import { useState, useEffect, memo, useCallback } from "react";
import { readFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { open as tauriOpen, save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LucideDownload, LucideEdit, LucideMoreVertical, LucideTrash2, LucideUpload, LucideFolderOpen, LucideGamepad2, LucideCalendar } from "lucide-react";
import { World, WorldEditData, ImportConflict, GameType, Difficulty, GAME_TYPE_LABELS, DIFFICULTY_LABELS } from "@/types/world";

// --- UTILS ---
const formatSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const formatDate = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleDateString("es-ES", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
};

// --- COMPONENTS ---

// 1. World Icon (Memoized to prevent re-reading file on parent renders)
const WorldIcon = memo(({ iconPath, worldName }: { iconPath: string | null; worldName: string }) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!iconPath) { setImageSrc(null); return; }

    const loadImage = async () => {
      try {
        const bytes = await readFile(iconPath);
        const blob = new Blob([bytes]);
        const url = URL.createObjectURL(blob);
        if (active) setImageSrc(url);
        return () => URL.revokeObjectURL(url);
      } catch {
        if (active) setImageSrc(null);
      }
    };
    loadImage();
    return () => { active = false; };
  }, [iconPath]);

  if (!imageSrc) {
    return (
      <div className="size-14 rounded-lg bg-neutral-800 border border-white/5 flex items-center justify-center shrink-0">
        <LucideFolderOpen className="size-6 text-neutral-500" />
      </div>
    );
  }

  return (
    <img src={imageSrc} alt={worldName} className="size-14 rounded-lg object-cover shrink-0 border border-white/5" />
  );
});

// 2. World Item Row
const WorldItem = ({ world, onEdit, onExport, onDelete }: {
  world: World,
  onEdit: (w: World) => void,
  onExport: (w: World) => void,
  onDelete: (w: World) => void
}) => {
  return (
    <div className="group flex items-center gap-4 p-3 border border-white/5 rounded-xl bg-neutral-900/50 hover:bg-neutral-800/80 transition-all duration-200">
      <WorldIcon iconPath={world.icon_path} worldName={world.name} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-white truncate">{world.level_name || world.name}</h3>
          {world.hardcore && <Badge variant="destructive" className="text-[10px] px-1.5 h-5">Hardcore</Badge>}
          {world.version && <Badge variant="outline" className="text-[10px] px-1.5 h-5 border-white/10 text-neutral-400">{world.version}</Badge>}
        </div>

        <div className="flex items-center gap-4 text-xs text-neutral-400">
          <span className="flex items-center gap-1">
            <LucideCalendar className="size-3" />
            {formatDate(world.last_modified)}
          </span>
          <span className="flex items-center gap-1">
            <LucideGamepad2 className="size-3" />
            {formatSize(world.size_bytes)}
          </span>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="text-neutral-400 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
            <LucideMoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-[#1a1a1a] border-white/10 text-white">
          <DropdownMenuItem onClick={() => onEdit(world)} className="cursor-pointer focus:bg-white/10">
            <LucideEdit className="size-4 mr-2 text-blue-400" /> Editar Ajustes
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport(world)} className="cursor-pointer focus:bg-white/10">
            <LucideDownload className="size-4 mr-2 text-green-400" /> Exportar .ZIP
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem onClick={() => onDelete(world)} className="text-red-400 cursor-pointer focus:bg-red-500/10 focus:text-red-400">
            <LucideTrash2 className="size-4 mr-2" /> Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

// 3. Edit Dialog Component (Isolated logic)
const WorldEditDialog = ({ open, world, instanceId, onClose, onSaved }: {
  open: boolean; world: World | null; instanceId: string; onClose: () => void; onSaved: () => void
}) => {
  const [data, setData] = useState<WorldEditData | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (world) {
      setData({
        game_type: world.game_type ?? GameType.Survival,
        difficulty: world.difficulty ?? Difficulty.Normal,
        allow_commands: world.allow_commands ?? false,
        hardcore: world.hardcore ?? false,
        name: world.name,
      });
    }
  }, [world]);

  const handleSave = async () => {
    if (!data || !world) return;
    setSaving(true);
    try {
      await invoke("edit_world_settings", { instanceId, worldName: world.name, settings: data });
      toast.success("Configuración guardada");
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#121212] border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustes de Mundo</DialogTitle>
          <DialogDescription className="text-neutral-400">Modifica las reglas base de "{world?.level_name}".</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-neutral-500">Modo de Juego</Label>
              <Select
                value={data.game_type.toString()}
                onValueChange={(v) => setData({ ...data, game_type: parseInt(v) })}
              >
                <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                  {Object.entries(GAME_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="focus:bg-white/10 cursor-pointer">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-neutral-500">Dificultad</Label>
              <Select
                value={data.difficulty.toString()}
                onValueChange={(v) => setData({ ...data, difficulty: parseInt(v) })}
              >
                <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                  {Object.entries(DIFFICULTY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="focus:bg-white/10 cursor-pointer">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
              <div className="space-y-0.5">
                <Label>Permitir Comandos</Label>
                <p className="text-xs text-neutral-400">Habilita trucos (/gamemode, etc)</p>
              </div>
              <Switch checked={data.allow_commands} onCheckedChange={(c) => setData({ ...data, allow_commands: c })} />
            </div>
            <div className="flex items-center justify-between p-3 bg-red-500/5 rounded-lg border border-red-500/10">
              <div className="space-y-0.5">
                <Label className="text-red-300">Modo Hardcore</Label>
                <p className="text-xs text-red-400/60">Una sola vida, dificultad difícil.</p>
              </div>
              <Switch checked={data.hardcore} onCheckedChange={(c) => setData({ ...data, hardcore: c })} className="data-[state=checked]:bg-red-600" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="hover:bg-white/10">Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-500 text-white">
            {saving ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// --- MAIN COMPONENT ---

export function WorldManagerDialog({ open, onOpenChange, instanceId }: {
  open: boolean; onOpenChange: (open: boolean) => void; instanceId: string;
}) {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog States
  const [activeDialog, setActiveDialog] = useState<{
    type: 'edit' | 'delete' | 'conflict' | null;
    world?: World;
    conflict?: ImportConflict;
    pendingPath?: string;
  }>({ type: null });

  const loadWorlds = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await invoke<World[]>("list_worlds", { instanceId });
      setWorlds(list);
    } catch (e) {
      console.error(e);
      toast.error("Error cargando mundos");
    } finally {
      setIsLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    if (open) loadWorlds();
  }, [open, loadWorlds]);

  // --- HANDLERS ---

  const handleImport = async () => {
    try {
      const zipPath = await tauriOpen({ multiple: false, filters: [{ name: "World ZIP", extensions: ["zip"] }] });
      if (!zipPath) return;

      const conflict = await invoke<ImportConflict | null>("validate_world_import", { instanceId, zipPath });

      if (conflict) {
        setActiveDialog({ type: 'conflict', conflict, pendingPath: zipPath });
      } else {
        await executeImport(zipPath, false);
      }
    } catch (e) {
      console.error(e);
      toast.error("Fallo al iniciar importación");
    }
  };

  const executeImport = async (path: string, overwrite: boolean) => {
    try {
      // Dismiss conflict dialog immediately
      setActiveDialog({ type: null });

      const promise = invoke("import_world", { instanceId, zipPath: path, overwrite });
      toast.promise(promise, {
        loading: 'Importando mundo...',
        success: 'Mundo importado correctamente',
        error: 'Error al importar mundo'
      });
      await promise;
      loadWorlds();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async () => {
    if (activeDialog.type !== 'delete' || !activeDialog.world) return;
    try {
      await invoke("delete_world", { instanceId, worldName: activeDialog.world.name });
      toast.success("Mundo eliminado");
      loadWorlds();
    } catch (e) {
      console.error(e);
      toast.error("Error al eliminar");
    } finally {
      setActiveDialog({ type: null });
    }
  };

  const handleExport = async (world: World) => {
    try {
      const defaultName = `${world.name}_${new Date().toISOString().split('T')[0]}.zip`;
      const path = await save({ defaultPath: defaultName, filters: [{ name: "World ZIP", extensions: ["zip"] }] });
      if (!path) return;

      const promise = invoke("export_world", { instanceId, worldName: world.name, destinationPath: path });
      toast.promise(promise, {
        loading: 'Exportando mundo...',
        success: 'Exportación completada',
        error: 'Error al exportar'
      });
    } catch (e) { console.error(e); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] bg-[#0c0c0c] border-white/10 text-white flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">Gestor de Mundos</DialogTitle>
              <DialogDescription className="text-neutral-400">Importa, exporta o configura tus partidas guardadas.</DialogDescription>
            </div>
            <Button onClick={handleImport} className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium gap-2">
              <LucideUpload className="size-4" /> Importar
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-2">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-4 p-3 border border-white/5 rounded-xl">
                  <Skeleton className="size-14 rounded-lg bg-white/5" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32 bg-white/5" />
                    <Skeleton className="h-3 w-24 bg-white/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : worlds.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-neutral-500 border-2 border-dashed border-white/5 rounded-xl">
              <LucideFolderOpen className="size-12 mb-2 opacity-50" />
              <p className="font-medium">Sin mundos detectados</p>
              <p className="text-xs">Importa un .zip o inicia el juego para crear uno.</p>
            </div>
          ) : (
            <div className="space-y-3 pb-6">
              {worlds.map((world) => (
                <WorldItem
                  key={world.path}
                  world={world}
                  onEdit={(w) => setActiveDialog({ type: 'edit', world: w })}
                  onExport={handleExport}
                  onDelete={(w) => setActiveDialog({ type: 'delete', world: w })}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* --- SUB DIALOGS --- */}

        {/* 1. Edit Dialog */}
        <WorldEditDialog
          open={activeDialog.type === 'edit'}
          world={activeDialog.world || null}
          instanceId={instanceId}
          onClose={() => setActiveDialog({ type: null })}
          onSaved={loadWorlds}
        />

        {/* 2. Delete Confirmation */}
        <AlertDialog open={activeDialog.type === 'delete'} onOpenChange={() => setActiveDialog({ type: null })}>
          <AlertDialogContent className="bg-[#121212] border-white/10 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar este mundo?</AlertDialogTitle>
              <AlertDialogDescription className="text-neutral-400">
                "{activeDialog.world?.level_name}" será borrado permanentemente del disco.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-transparent border-white/10 hover:bg-white/5 text-white hover:text-white">Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 3. Conflict Dialog */}
        <AlertDialog open={activeDialog.type === 'conflict'} onOpenChange={() => setActiveDialog({ type: null })}>
          <AlertDialogContent className="bg-[#121212] border-white/10 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-orange-400">Conflicto de Importación</AlertDialogTitle>
              <AlertDialogDescription className="text-neutral-300">
                {activeDialog.conflict?.message}
                {activeDialog.conflict?.conflict_type === "name_exists" && <p className="mt-2 text-sm text-neutral-400">Ya existe un mundo con este nombre.</p>}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-transparent border-white/10 hover:bg-white/5 text-white">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => activeDialog.pendingPath && executeImport(activeDialog.pendingPath, true)}
                className="bg-orange-600 hover:bg-orange-500 text-white"
              >
                Sobrescribir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </DialogContent>
    </Dialog>
  );
}