import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState, useEffect } from "react"
import { Loader2, Box, Plus } from 'lucide-react'
import { cn } from "@/lib/utils"

interface CreateInstanceDialogProps {
    isOpen: boolean;
    onClose: () => void;
    modpackName: string;
    onConfirmCreate: (instanceName: string) => void | Promise<void>;
}

export const CreateInstanceDialog = ({
    isOpen,
    onClose,
    modpackName,
    onConfirmCreate,
}: CreateInstanceDialogProps) => {
    const [instanceName, setInstanceName] = useState<string>("")
    const [isCreating, setIsCreating] = useState<boolean>(false)

    // Resetear y establecer nombre por defecto
    useEffect(() => {
        if (isOpen) {
            setInstanceName(modpackName)
            setIsCreating(false)
        }
    }, [isOpen, modpackName])

    const handleCreate = async () => {
        if (!instanceName.trim() || isCreating) return

        try {
            setIsCreating(true)
            await onConfirmCreate(instanceName)
        } catch (err) {
            console.error('Error creating instance:', err)
            // Aquí podrías mostrar un toast de error si lo deseas
        } finally {
            setIsCreating(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(val) => !val && !isCreating && onClose()}>
            <DialogContent className="sm:max-w-md bg-[#0a0a0a] border-white/10 p-0 gap-0 shadow-2xl overflow-hidden">

                {/* Header Estilizado */}
                <div className="relative p-6 pb-4 border-b border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                            <Box className="w-5 h-5 text-purple-400" />
                            Nueva Instancia
                        </DialogTitle>
                        <DialogDescription className="text-neutral-400">
                            Creando una copia aislada de <span className="text-white font-medium">{modpackName}</span>.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider ml-1">
                            Nombre de la Instancia
                        </label>
                        <div className="relative group">
                            <Input
                                value={instanceName}
                                onChange={(e) => setInstanceName(e.target.value)}
                                placeholder="Ej: Mi Mundo Survival"
                                className="bg-[#121212] border-white/10 text-white placeholder:text-neutral-700 focus:border-purple-500/50 focus:ring-purple-500/20 h-12 pl-4 transition-all"
                                disabled={isCreating}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                                autoFocus
                            />
                        </div>
                        <p className="text-xs text-neutral-600 ml-1">
                            Se guardará en tu carpeta local de instancias.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <DialogFooter className="p-4 bg-white/[0.02] border-t border-white/5 sm:justify-between gap-3">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={isCreating}
                        className="text-neutral-500 hover:text-white hover:bg-white/5"
                    >
                        Cancelar
                    </Button>

                    <Button
                        onClick={handleCreate}
                        disabled={!instanceName.trim() || isCreating}
                        className={cn(
                            "min-w-[120px] bg-purple-600 hover:bg-purple-500 text-white font-semibold shadow-lg transition-all",
                            isCreating ? "opacity-80 cursor-not-allowed" : "hover:scale-[1.02]"
                        )}
                    >
                        {isCreating ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Creando...
                            </>
                        ) : (
                            <>
                                <Plus className="h-4 w-4 mr-2" />
                                Crear
                            </>
                        )}
                    </Button>
                </DialogFooter>

            </DialogContent>
        </Dialog>
    )
}