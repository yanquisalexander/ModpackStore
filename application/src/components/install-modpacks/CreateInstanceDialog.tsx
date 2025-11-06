import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState, useEffect } from "react"
import { Loader as LucideLoader } from 'lucide-react'

interface CreateInstanceDialogProps {
    isOpen: boolean;
    onClose: () => void;
    modpackName: string;
    // Puede devolver una promesa para operaciones async
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

    // Establecer nombre por defecto cuando se abre el diálogo
    useEffect(() => {
        if (isOpen) {
            setInstanceName(modpackName)
        }
    }, [isOpen, modpackName])

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-white">
                <DialogHeader>
                    <DialogTitle>Crear nueva instancia de {modpackName}</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Ingresa un nombre para la nueva instancia.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-4">
                    <Input
                        value={instanceName}
                        onChange={(e) => setInstanceName(e.target.value)}
                        placeholder="Nombre de la instancia"
                        className="bg-zinc-800 border-zinc-700 text-white"
                        disabled={isCreating}
                    />
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        className="bg-zinc-800 text-white hover:bg-zinc-700"
                        onClick={onClose}
                    >
                        Cancelar
                    </Button>
                    <Button
                        variant="default"
                        className="bg-indigo-600 hover:bg-indigo-700"
                        onClick={async () => {
                            if (!instanceName.trim() || isCreating) return
                            try {
                                setIsCreating(true)
                                await onConfirmCreate(instanceName)
                            } catch (err) {
                                // Dejar que el padre maneje errores visuales; aquí solo restauramos estado
                                console.error('Error creating instance:', err)
                            } finally {
                                setIsCreating(false)
                            }
                        }}
                        disabled={!instanceName.trim() || isCreating}
                    >
                        {isCreating ? (
                            <>
                                <LucideLoader className="h-4 w-4 mr-2 animate-spin" />
                                Creando...
                            </>
                        ) : (
                            'Crear'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}