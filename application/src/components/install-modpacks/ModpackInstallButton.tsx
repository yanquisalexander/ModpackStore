import { Button } from "@/components/ui/button"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { LucideDownload, LucideRefreshCw } from "lucide-react"
import { InstallOptionsDialog } from "./InstallOptionsDialog"
import { UpdateInstanceDialog } from "./UpdateInstanceDialog"
import { CreateInstanceDialog } from "./CreateInstanceDialog"
import { TauriCommandReturns } from "@/types/TauriCommandReturns"
import { useTasksContext } from "@/stores/TasksContext"
import { toast } from "sonner"
import { PasswordDialog } from "./ModpackPasswordDialog"

interface InstallButtonProps {
    modpackId: string;
    modpackName: string;
    localInstances: TauriCommandReturns["get_instances_by_modpack_id"];
    isPasswordProtected?: boolean;
}

export const InstallButton = ({
    modpackId,
    modpackName,
    localInstances,
    isPasswordProtected = false
}: InstallButtonProps) => {
    const [isInstallOptionsOpen, setIsInstallOptionsOpen] = useState<boolean>(false)
    const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState<boolean>(false)
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState<boolean>(false)
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState<boolean>(false)
    const [isInstalling, setIsInstalling] = useState<boolean>(false)

    // Para almacenar temporalmente la acción pendiente que requiere contraseña
    const [pendingAction, setPendingAction] = useState<{
        type: 'update' | 'create';
        instanceId?: string;
        instanceName?: string;
    } | null>(null)

    const { isModpackInstalling } = useTasksContext()
    const isCurrentlyInstalling = isModpackInstalling(modpackId) || isInstalling

    const hasLocalInstances = localInstances.length > 0

    const handleInstallClick = () => {
        if (hasLocalInstances) {
            setIsInstallOptionsOpen(true)
        } else {
            setIsCreateDialogOpen(true)
        }
    }

    const handleUpdateExisting = () => {
        setIsInstallOptionsOpen(false)
        setIsUpdateDialogOpen(true)
    }

    const handleInstallNew = () => {
        setIsInstallOptionsOpen(false)
        setIsCreateDialogOpen(true)
    }

    const handleConfirmUpdate = async (instanceId: string) => {
        // Si el modpack está protegido, solicitar contraseña antes de actualizar
        if (isPasswordProtected) {
            setPendingAction({
                type: 'update',
                instanceId
            });
            setIsUpdateDialogOpen(false);
            setIsPasswordDialogOpen(true);
            return;
        }

        // Si no está protegido, proceder directamente con la actualización
        await executeUpdate(instanceId);
    }

    const executeUpdate = async (instanceId: string) => {
        setIsInstalling(true);
        try {
            await invoke("update_modpack_instance", {
                instanceId,
                modpackId,
                password: null
            });
            console.log(`Instancia ${instanceId} actualizada exitosamente`);
        } catch (err) {
            console.error("Error al actualizar la instancia:", err);
            // Manejar otros errores que no sean de contraseña
        } finally {
            setIsInstalling(false);
            setIsUpdateDialogOpen(false);
            setPendingAction(null);
        }
    }

    const handleConfirmCreate = async (instanceName: string) => {
        // Si el modpack está protegido, solicitar contraseña antes de crear
        if (isPasswordProtected) {
            setPendingAction({
                type: 'create',
                instanceName
            });
            setIsCreateDialogOpen(false);
            setIsPasswordDialogOpen(true);
            return;
        }

        // Si no está protegido, proceder directamente con la creación
        await executeCreate(instanceName);
    }

    const executeCreate = async (instanceName: string) => {
        setIsInstalling(true);
        try {
            await invoke("create_modpack_instance", {
                instanceName,
                modpackId,
                password: null
            });

            toast.success("Creando instancia...", {
                description: `Tu instancia "${instanceName}" del modpack "${modpackName}" está siendo instalada. Verifica el progreso en el Task Manager.`,
            });

        } catch (err) {
            console.error("Error al crear la instancia:", err);
            // Manejar otros errores que no sean de contraseña
        } finally {
            setIsInstalling(false);
            setIsCreateDialogOpen(false);
            setPendingAction(null);
        }
    }

    return (
        <>
            <Button
                variant="default"
                className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"
                onClick={handleInstallClick}
                disabled={isCurrentlyInstalling}
            >
                {isCurrentlyInstalling ? (
                    <>
                        <LucideRefreshCw className="w-4 h-4 animate-spin" />
                        Instalando...
                    </>
                ) : (
                    <>
                        <LucideDownload className="w-4 h-4" />
                        Instalar
                    </>
                )}
            </Button>

            <InstallOptionsDialog
                isOpen={isInstallOptionsOpen}
                onClose={() => setIsInstallOptionsOpen(false)}
                modpackId={modpackId}
                modpackName={modpackName}
                localInstances={localInstances}
                onUpdateExisting={handleUpdateExisting}
                onInstallNew={handleInstallNew}
            />

            <UpdateInstanceDialog
                isOpen={isUpdateDialogOpen}
                onClose={() => setIsUpdateDialogOpen(false)}
                modpackId={modpackId}
                modpackName={modpackName}
                localInstances={localInstances}
                onConfirmUpdate={handleConfirmUpdate}
            />

            <CreateInstanceDialog
                isOpen={isCreateDialogOpen}
                onClose={() => setIsCreateDialogOpen(false)}
                modpackId={modpackId}
                modpackName={modpackName}
                onConfirmCreate={handleConfirmCreate}
            />

            <PasswordDialog
                isOpen={isPasswordDialogOpen}
                onClose={() => {
                    setIsPasswordDialogOpen(false)
                    setPendingAction(null)
                }}
                onSuccess={() => {
                    // Ejecutar la acción pendiente después de validación exitosa
                    if (pendingAction?.type === 'update' && pendingAction.instanceId) {
                        executeUpdate(pendingAction.instanceId);
                    } else if (pendingAction?.type === 'create' && pendingAction.instanceName) {
                        executeCreate(pendingAction.instanceName);
                    }
                }}
                modpackId={modpackId}
                modpackName={modpackName}
            />
        </>
    )
}