import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { LucideDownload, LucideRefreshCw, LucideAlertTriangle, LucideLogIn } from "lucide-react"
import { InstallOptionsDialog } from "./InstallOptionsDialog"
import { UpdateInstanceDialog } from "./UpdateInstanceDialog"
import { CreateInstanceDialog } from "./CreateInstanceDialog"
import { ModpackAcquisitionDialog } from "./ModpackAcquisitionDialog"
import { TauriCommandReturns } from "@/types/TauriCommandReturns"
import { useTasksContext } from "@/stores/TasksContext"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"
import { useAuthentication } from "@/stores/AuthContext"
import { API_ENDPOINT } from "@/consts"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface InstallButtonProps {
    modpackId: string;
    modpackName: string;
    localInstances: TauriCommandReturns["get_instances_by_modpack_id"];
    acquisitionMethod?: 'free' | 'paid' | 'password' | 'twitch_sub';
    isPasswordProtected?: boolean;
    isPaid?: boolean;
    isFree?: boolean;
    price?: string;
    requiresTwitchSubscription?: boolean;
    requiredTwitchChannels?: string[];
    selectedVersionId?: string;
    disabled?: boolean;
}

interface ModpackAccess {
    requiresPassword?: boolean;
    isPaid?: boolean;
    isFree?: boolean;
    price?: string;
    requiresTwitchSubscription?: boolean;
    requiredTwitchChannels?: string[];
}

export const InstallButton = ({
    modpackId,
    modpackName,
    localInstances,
    acquisitionMethod = 'free',
    isPasswordProtected = false,
    isPaid = false,
    isFree = true,
    price,
    requiresTwitchSubscription = false,
    requiredTwitchChannels = [],
    selectedVersionId,
    disabled = false
}: InstallButtonProps) => {
    const [isInstallOptionsOpen, setIsInstallOptionsOpen] = useState<boolean>(false)
    const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState<boolean>(false)
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState<boolean>(false)
    const [isAcquisitionDialogOpen, setIsAcquisitionDialogOpen] = useState<boolean>(false)
    const [isAuthAlertOpen, setIsAuthAlertOpen] = useState<boolean>(false)
    const [isInstalling, setIsInstalling] = useState<boolean>(false)
    const [hasAccess, setHasAccess] = useState<boolean>(false)
    const [isCheckingAccess, setIsCheckingAccess] = useState<boolean>(true)

    const navigate = useNavigate();
    const { sessionTokens, isAuthenticated, startDiscordAuth } = useAuthentication();

    // Para almacenar temporalmente la acción pendiente después de adquirir acceso
    const [pendingAction, setPendingAction] = useState<{
        type: 'update' | 'create';
        instanceId?: string;
        instanceName?: string;
    } | null>(null)

    const { isModpackInstalling } = useTasksContext()
    const isCurrentlyInstalling = isModpackInstalling(modpackId) || isInstalling

    const hasLocalInstances = localInstances.length > 0

    // Check if user has access to the modpack
    useEffect(() => {
        checkModpackAccess();
    }, [modpackId, sessionTokens]);

    const checkModpackAccess = async () => {
        if (!sessionTokens?.accessToken) {
            setIsCheckingAccess(false);
            return;
        }

        try {
            const response = await fetch(`${API_ENDPOINT}/explore/modpacks/${modpackId}/check-access`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${sessionTokens.accessToken}`,
                },
            });

            if (response.ok) {
                setHasAccess(true);
            } else {
                setHasAccess(false);
            }
        } catch (error) {
            console.error('Error checking modpack access:', error);
            setHasAccess(false);
        } finally {
            setIsCheckingAccess(false);
        }
    };

    const requiresAcquisition = acquisitionMethod !== 'free';

    const handleInstallClick = () => {
        // If requires acquisition and user doesn't have access
        if (requiresAcquisition && !hasAccess) {
            // Check if user is authenticated first
            if (!isAuthenticated) {
                setIsAuthAlertOpen(true);
                return;
            }
            setIsAcquisitionDialogOpen(true);
            return;
        }

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
        // Check access before updating
        if (requiresAcquisition && !hasAccess) {
            setPendingAction({
                type: 'update',
                instanceId
            });
            setIsUpdateDialogOpen(false);
            setIsAcquisitionDialogOpen(true);
            return;
        }

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
        } finally {
            setIsInstalling(false);
            setIsUpdateDialogOpen(false);
            setPendingAction(null);
        }
    }

    const handleConfirmCreate = async (instanceName: string) => {
        // Check access before creating
        if (requiresAcquisition && !hasAccess) {
            setPendingAction({
                type: 'create',
                instanceName
            });
            setIsCreateDialogOpen(false);
            setIsAcquisitionDialogOpen(true);
            return;
        }

        await executeCreate(instanceName);
    }

    const executeCreate = async (instanceName: string) => {
        setIsInstalling(true);
        try {
            await invoke("create_modpack_instance", {
                instanceName,
                modpackId,
                versionId: selectedVersionId,
                password: null
            });

            toast.success("Creando instancia...", {
                description: `Tu instancia "${instanceName}" del modpack "${modpackName}" está siendo instalada. Verifica el progreso en el Task Manager.`,
            });

            navigate("/my-instances");

        } catch (err) {
            console.error("Error al crear la instancia:", err);
        } finally {
            setIsInstalling(false);
            setIsCreateDialogOpen(false);
            setPendingAction(null);
        }
    }

    const handleAcquisitionSuccess = () => {
        setHasAccess(true);
        setIsAcquisitionDialogOpen(false);

        // Execute pending action if any
        if (pendingAction) {
            if (pendingAction.type === 'update' && pendingAction.instanceId) {
                executeUpdate(pendingAction.instanceId);
            } else if (pendingAction.type === 'create' && pendingAction.instanceName) {
                executeCreate(pendingAction.instanceName);
            }
        }
    };

    const getButtonText = () => {
        if (isCheckingAccess) return "Verificando acceso...";
        if (isCurrentlyInstalling) return "Instalando...";

        // If user doesn't have access to a protected modpack, show "Adquirir"
        if (requiresAcquisition && !hasAccess) {

            switch (acquisitionMethod) {
                case 'paid': return `Comprar ($${price})`;
                case 'password': return "Acceder";
                case 'twitch_sub': return "Verificar Suscripción";
                default: return "Obtener Acceso";
            }
        }

        // If user has access or no acquisition required, show "Instalar"
        return "Instalar";
    };

    return (
        <>
            <Button
                variant="default"
                className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"
                disabled={disabled || isCurrentlyInstalling || isCheckingAccess}
                onClick={handleInstallClick}
            >
                {isCurrentlyInstalling ? (
                    <>
                        <LucideRefreshCw className="animate-spin" size={18} />
                        {getButtonText()}
                    </>
                ) : (
                    <>
                        <LucideDownload size={18} />
                        {getButtonText()}
                    </>
                )}
            </Button>

            <InstallOptionsDialog
                isOpen={isInstallOptionsOpen}
                onClose={() => setIsInstallOptionsOpen(false)}
                onUpdateExisting={handleUpdateExisting}
                onInstallNew={handleInstallNew}
                modpackName={modpackName}
                localInstances={localInstances}
                modpackId={modpackId}
            />

            <UpdateInstanceDialog
                isOpen={isUpdateDialogOpen}
                onClose={() => setIsUpdateDialogOpen(false)}
                onConfirmUpdate={handleConfirmUpdate}
                modpackName={modpackName}
                localInstances={localInstances}
                modpackId={modpackId}
            />

            <CreateInstanceDialog
                isOpen={isCreateDialogOpen}
                onClose={() => setIsCreateDialogOpen(false)}
                onConfirmCreate={handleConfirmCreate}
                modpackName={modpackName}
                modpackId={modpackId}
            />

            <ModpackAcquisitionDialog
                isOpen={isAcquisitionDialogOpen}
                onClose={() => setIsAcquisitionDialogOpen(false)}
                onSuccess={handleAcquisitionSuccess}
                modpack={{
                    id: modpackId,
                    name: modpackName,
                    acquisitionMethod: acquisitionMethod,
                    requiresPassword: isPasswordProtected,
                    isPaid: isPaid,
                    isFree: isFree,
                    price: price,
                    requiresTwitchSubscription: requiresTwitchSubscription,
                    requiredTwitchChannels: requiredTwitchChannels,
                }}
            />

            {/* Authentication Alert Dialog */}
            <AlertDialog open={isAuthAlertOpen} onOpenChange={setIsAuthAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <LucideAlertTriangle className="w-5 h-5 text-amber-500" />
                            Autenticación Requerida
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Para adquirir el modpack "{modpackName}" necesitas iniciar sesión en tu cuenta.
                            {isPaid && !isFree && (
                                <span className="block mt-2 font-medium">
                                    Este modpack cuesta ${price} y requiere autenticación para completar la compra.
                                </span>
                            )}
                            {isPasswordProtected && (
                                <span className="block mt-2 font-medium">
                                    Este modpack está protegido con contraseña.
                                </span>
                            )}
                            {requiresTwitchSubscription && (
                                <span className="block mt-2 font-medium">
                                    Este modpack requiere una suscripción activa de Twitch.
                                </span>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setIsAuthAlertOpen(false)}>
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                setIsAuthAlertOpen(false);
                                startDiscordAuth();
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700"
                        >
                            <LucideLogIn className="w-4 h-4 mr-2" />
                            Iniciar Sesión
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};