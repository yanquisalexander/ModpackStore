import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { LucideDownload, LucideRefreshCw, LucidePlus, LucideHardDrive, LucideX } from "lucide-react"
import { TauriCommandReturns } from "@/types/TauriCommandReturns"
import { cn } from "@/lib/utils"

interface InstallOptionsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    modpackId: string;
    modpackName: string;
    localInstances: TauriCommandReturns["get_instances_by_modpack_id"];
    onInstallNew: () => void;
    onUpdateExisting: () => void;
}

export const InstallOptionsDialog = ({
    isOpen,
    onClose,
    modpackId,
    modpackName,
    localInstances,
    onInstallNew,
    onUpdateExisting
}: InstallOptionsDialogProps) => {

    const instanceCount = localInstances?.length || 0;

    return (
        <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="sm:max-w-md bg-[#0a0a0a] border-white/10 p-0 gap-0 shadow-2xl overflow-hidden">

                {/* Header Estilizado */}
                <div className="relative p-6 pb-4 border-b border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                            <LucideDownload className="w-5 h-5 text-neutral-400" />
                            Instalar {modpackName}
                        </DialogTitle>
                        <DialogDescription className="text-neutral-400">
                            Este modpack ya está instalado. ¿Qué te gustaría hacer?
                        </DialogDescription>
                    </DialogHeader>

                    {/* Badge de contador de instancias */}
                    <div className="absolute top-6 right-6">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 bg-white/5 px-2 py-1 rounded border border-white/5 flex items-center gap-1.5">
                            <LucideHardDrive className="w-3 h-3" />
                            {instanceCount} {instanceCount === 1 ? 'Instancia' : 'Instancias'}
                        </span>
                    </div>
                </div>

                {/* Cuerpo con Opciones tipo Tarjeta */}
                <div className="p-6 space-y-3">

                    {/* Opción 1: Crear Nueva */}
                    <button
                        onClick={onInstallNew}
                        className="w-full group relative flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-[#121212] hover:bg-[#1a1a1a] hover:border-emerald-500/30 transition-all duration-200 text-left"
                    >
                        <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                            <LucidePlus className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-white group-hover:text-emerald-400 transition-colors">Crear nueva instancia</h3>
                            <p className="text-xs text-neutral-500 mt-0.5">Instalar una copia separada y limpia.</p>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 text-emerald-500">
                            <LucideDownload className="w-5 h-5" />
                        </div>
                    </button>

                    {/* Separador Visual con Texto */}
                    <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-white/5" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-[#0a0a0a] px-2 text-neutral-600 font-bold tracking-widest">O</span>
                        </div>
                    </div>

                    {/* Opción 2: Actualizar Existente */}
                    <button
                        onClick={onUpdateExisting}
                        className="w-full group relative flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-[#121212] hover:bg-[#1a1a1a] hover:border-blue-500/30 transition-all duration-200 text-left"
                    >
                        <div className="p-3 rounded-lg bg-blue-500/10 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                            <LucideRefreshCw className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-white group-hover:text-blue-400 transition-colors">Actualizar existente</h3>
                            <p className="text-xs text-neutral-500 mt-0.5">Modificar una de tus instalaciones actuales.</p>
                        </div>
                    </button>

                </div>

                {/* Footer simple para cancelar */}
                <DialogFooter className="p-4 bg-white/[0.02] border-t border-white/5 sm:justify-center">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="text-neutral-500 hover:text-white hover:bg-white/5 text-xs uppercase tracking-wide font-bold"
                    >
                        Cancelar
                    </Button>
                </DialogFooter>

            </DialogContent>
        </Dialog>
    )
}