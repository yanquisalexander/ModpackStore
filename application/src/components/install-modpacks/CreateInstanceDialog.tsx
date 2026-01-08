import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useState, useEffect } from "react"
import { Loader2, Box, Plus, Server, Gamepad2 } from 'lucide-react'
import { cn } from "@/lib/utils"

interface CreateInstanceDialogProps {
    isOpen: boolean;
    onClose: () => void;
    modpackName: string;
    onConfirmCreate: (instanceName: string, isServer: boolean) => void | Promise<void>;
    allowServerDownload?: boolean;
}

export const CreateInstanceDialog = ({
    isOpen,
    onClose,
    modpackName,
    onConfirmCreate,
    allowServerDownload = false
}: CreateInstanceDialogProps) => {
    const [instanceName, setInstanceName] = useState<string>("")
    const [isCreating, setIsCreating] = useState<boolean>(false)
    const [isServer, setIsServer] = useState<boolean>(false)

    // Resetear y establecer nombre por defecto
    useEffect(() => {
        if (isOpen) {
            setInstanceName(modpackName)
            setIsServer(false)
            setIsCreating(false)
        }
    }, [isOpen, modpackName])

    const handleCreate = async () => {
        if (!instanceName.trim() || isCreating) return

        try {
            setIsCreating(true)
            await onConfirmCreate(instanceName, isServer)
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
                            {isServer ? <Server className="w-5 h-5 text-indigo-400" /> : <Box className="w-5 h-5 text-purple-400" />}
                            {isServer ? "Nuevo Servidor" : "Nueva Instancia"}
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
                                placeholder={isServer ? "Ej: Servidor Survival" : "Ej: Mi Mundo Survival"}
                                className={cn(
                                    "bg-[#121212] border-white/10 text-white placeholder:text-neutral-700 h-12 pl-4 transition-all",
                                    isServer ? "focus:border-indigo-500/50 focus:ring-indigo-500/20" : "focus:border-purple-500/50 focus:ring-purple-500/20"
                                )}
                                disabled={isCreating}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                                autoFocus
                            />
                        </div>
                        <p className="text-xs text-neutral-600 ml-1">
                            Se guardará en tu carpeta local de instancias.
                        </p>
                    </div>

                    {allowServerDownload && (
                        <div className="flex items-center space-x-2 bg-white/5 p-3 rounded-lg border border-white/5">
                            <Switch id="server-mode" checked={isServer} onCheckedChange={setIsServer} />
                            <div className="flex-1">
                                <Label htmlFor="server-mode" className="text-sm font-medium text-white cursor-pointer">Instalar como Servidor</Label>
                                <p className="text-xs text-neutral-400 mt-0.5">
                                    Descarga los archivos necesarios para ejecutar un servidor dedicado.
                                </p>
                            </div>
                            {isServer ? <Server className="w-4 h-4 text-indigo-400" /> : <Gamepad2 className="w-4 h-4 text-neutral-600" />}
                        </div>
                    )}
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
                            "min-w-[120px] text-white font-semibold shadow-lg transition-all",
                            isServer ? "bg-indigo-600 hover:bg-indigo-500" : "bg-purple-600 hover:bg-purple-500",
                            isCreating ? "opacity-80 cursor-not-allowed" : "hover:scale-[1.02]"
                        )}
                    >
                        {isCreating ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                {isServer ? "Instalando..." : "Creando..."}
                            </>
                        ) : (
                            <>
                                <Plus className="h-4 w-4 mr-2" />
                                {isServer ? "Instalar Servidor" : "Crear"}
                            </>
                        )}
                    </Button>
                </DialogFooter>

            </DialogContent>
        </Dialog>
    )
}