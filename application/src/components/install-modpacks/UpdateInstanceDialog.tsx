import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useEffect } from "react"
import { TauriCommandReturns } from "@/types/TauriCommandReturns";
import { RefreshCw, HardDrive, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface UpdateInstanceDialogProps {
    isOpen: boolean;
    onClose: () => void;
    modpackId: string;
    modpackName: string;
    localInstances: TauriCommandReturns["get_instances_by_modpack_id"];
    onConfirmUpdate: (instanceId: string) => void;
}

export const UpdateInstanceDialog = ({
    isOpen,
    onClose,
    modpackId,
    modpackName,
    localInstances,
    onConfirmUpdate
}: UpdateInstanceDialogProps) => {
    const [selectedInstance, setSelectedInstance] = useState<string>("")

    useEffect(() => {
        // Seleccionar la primera instancia por defecto
        if (isOpen && localInstances.length > 0 && !selectedInstance) {
            setSelectedInstance(localInstances[0].instanceId)
        }
    }, [isOpen, localInstances, selectedInstance])

    return (
        <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="sm:max-w-md bg-[#0a0a0a] border-white/10 p-0 gap-0 shadow-2xl overflow-hidden">

                {/* Header Azul (Tema Update) */}
                <div className="relative p-6 pb-4 border-b border-white/5 bg-gradient-to-b from-blue-500/[0.05] to-transparent">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                            <RefreshCw className="w-5 h-5 text-blue-400" />
                            Actualizar Instancia
                        </DialogTitle>
                        <DialogDescription className="text-neutral-400">
                            Se actualizarán los archivos de <span className="text-white font-medium">{modpackName}</span> en la instancia seleccionada.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider ml-1 flex items-center gap-1.5">
                            <HardDrive className="w-3 h-3" />
                            Instancia Objetivo
                        </label>

                        <Select
                            value={selectedInstance}
                            onValueChange={setSelectedInstance}
                        >
                            <SelectTrigger className="bg-[#121212] border-white/10 text-white h-12 focus:ring-blue-500/20 focus:border-blue-500/50">
                                <SelectValue placeholder="Seleccionar instancia..." />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                                {localInstances?.map(instance => (
                                    <SelectItem
                                        key={instance.instanceId}
                                        value={instance.instanceId}
                                        className="focus:bg-blue-500/20 focus:text-blue-100 cursor-pointer"
                                    >
                                        {instance.instanceName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <div className="p-3 rounded-lg bg-blue-900/10 border border-blue-500/10 text-xs text-blue-200/80 mt-2">
                            ⚠️ Se sobrescribirán los archivos de configuración y mods.
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <DialogFooter className="p-4 bg-white/[0.02] border-t border-white/5 sm:justify-between gap-3">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="text-neutral-500 hover:text-white hover:bg-white/5"
                    >
                        Cancelar
                    </Button>

                    <Button
                        onClick={() => onConfirmUpdate(selectedInstance)}
                        disabled={!selectedInstance}
                        className={cn(
                            "min-w-[140px] bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg transition-all flex items-center gap-2",
                            !selectedInstance ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02]"
                        )}
                    >
                        Actualizar
                        <ArrowRight className="w-4 h-4" />
                    </Button>
                </DialogFooter>

            </DialogContent>
        </Dialog>
    )
}