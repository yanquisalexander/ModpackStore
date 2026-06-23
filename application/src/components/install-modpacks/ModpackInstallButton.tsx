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
import { trackModpackInstall } from "@/services/analytics"
import { useActionLimit } from "@/hooks/useUserFlags"
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
import clsx from "clsx"

interface InstallButtonProps {
    modpackId: string;
    modpackName: string;
    localInstances: TauriCommandReturns["get_instances_by_modpack_id"];
    acquisitionMethod?: 'free' | 'password' | 'twitch_sub';
    isPasswordProtected?: boolean;
    isFree?: boolean;
    requiresTwitchSubscription?: boolean;
    requiredTwitchChannels?: string[];
    selectedVersionId?: string;
    disabled?: boolean;
    allowServerDownload?: boolean;
    className?: string;
}

interface ModpackAccess {
    requiresPassword?: boolean;
    isFree?: boolean;
    requiresTwitchSubscription?: boolean;
    requiredTwitchChannels?: string[];
}

export const InstallButton = ({
    modpackId,
    modpackName,
    localInstances,
    acquisitionMethod = 'free',
    isPasswordProtected = false,
    isFree = true,
    requiresTwitchSubscription = false,
    requiredTwitchChannels = [],
    selectedVersionId,
    disabled = false,
    allowServerDownload = false,
    className,
}: InstallButtonProps) => {
    const [isInstallOptionsOpen, setIsInstallOptionsOpen] = useState<boolean>(false)
    const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState<boolean>(false)
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState<boolean>(false)
    const [isAcquisitionDialogOpen, setIsAcquisitionDialogOpen] = useState<boolean>(false)
    const [isAuthAlertOpen, setIsAuthAlertOpen] = useState<boolean>(false)
    const [isInstalling, setIsInstalling] = useState<boolean>(false)
    const [hasAccess, setHasAccess] = useState<boolean>(false)
    const [isCheckingAccess, setIsCheckingAccess] = useState<boolean>(true)

    const [acquisitionMethodState, setAcquisitionMethodState] = useState<'free' | 'password' | 'twitch_sub'>(acquisitionMethod);
    const [requiresPasswordState, setRequiresPasswordState] = useState(isPasswordProtected);
    const [requiresTwitchState, setRequiresTwitchState] = useState(requiresTwitchSubscription);
    const [isFreeState, setIsFreeState] = useState(isFree);
    const [requiredTwitchChannelsState, setRequiredTwitchChannelsState] = useState(requiredTwitchChannels);
    const [totalInstances, setTotalInstances] = useState<number>(0);

    const navigate = useNavigate();
    const { sessionTokens, isAuthenticated, startDiscordAuth } = useAuthentication();

    const { allowed: isLimitAllowed, limit: instancesLimit } = useActionLimit('max_instances_allowed', totalInstances);

    // Para almacenar temporalmente la acción pendiente después de adquirir acceso
    const [pendingAction, setPendingAction] = useState<{
        type: 'update' | 'create' | 'show_options' | 'show_create';
        instanceId?: string;
        instanceName?: string;
        isServer?: boolean;
    } | null>(null)

    const { isModpackInstalling } = useTasksContext()
    const isCurrentlyInstalling = isModpackInstalling(modpackId) || isInstalling

    const hasLocalInstances = localInstances.length > 0

    // Fetch total instance count
    useEffect(() => {
        const fetchTotalInstances = async () => {
            try {
                const allInstances = await invoke('get_all_instances') as any[];
                // Filter out servers as done in MyInstancesSection
                const clientInstances = allInstances.filter(inst => inst?.instanceType !== 'server');
                setTotalInstances(clientInstances.length);
            } catch (err) {
                console.error("Error fetching total instances:", err);
            }
        };
        fetchTotalInstances();
    }, []);

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
            const [accessRes, acqRes] = await Promise.all([
                fetch(`${API_ENDPOINT}/explore/modpacks/${modpackId}/access`, {
                    headers: { 'Authorization': `Bearer ${sessionTokens.accessToken}` },
                }),
                fetch(`${API_ENDPOINT}/explore/user/acquisitions`, {
                    headers: { 'Authorization': `Bearer ${sessionTokens.accessToken}` },
                }),
            ]);

            if (accessRes.ok) {
                const accessJson = await accessRes.json();
                const info = accessJson.data || {};
                setAcquisitionMethodState(info.acquisitionMethod || 'free');
                setRequiresPasswordState(info.requiresPassword || false);
                setRequiresTwitchState(info.requiresTwitchSubscription || false);
                setIsFreeState(info.isFree || true);
                setRequiredTwitchChannelsState(info.twitchChannels || requiredTwitchChannels);
            }

            if (acqRes.ok) {
                const acqJson = await acqRes.json();
                const acquisitions = acqJson.data || [];
                setHasAccess(acquisitions.some((a: any) => a.acquisition?.modpackId === modpackId && a.acquisition?.status === 'active'));
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


    const handleInstallClick = () => {
        // If we want to install a new instance (not update an existing one)
        // Check for instance limit
        if (!hasLocalInstances && !isLimitAllowed) {
            toast.error('Límite de instancias alcanzado', {
                description: `Has alcanzado tu límite de ${instancesLimit} instancias. Elimina alguna para poder instalar modpacks nuevos.`
            });
            return;
        }

        // If user doesn't have access, open acquisition dialog
        if (!hasAccess) {
            // Check if user is authenticated first
            if (!isAuthenticated) {
                setIsAuthAlertOpen(true);
                return;
            }

            // Set default pending action based on whether user has local instances
            // Only set if there's no pending action already
            if (!pendingAction) {
                if (hasLocalInstances) {
                    setPendingAction({ type: 'show_options' });
                } else {
                    setPendingAction({ type: 'show_create' });
                }
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
        if (!isLimitAllowed) {
            toast.error('Límite de instancias alcanzado', {
                description: `Has alcanzado tu límite de ${instancesLimit} instancias. Elimina alguna para poder instalar modpacks nuevos.`
            });
            return;
        }
        setIsInstallOptionsOpen(false)
        setIsCreateDialogOpen(true)
    }

    const handleConfirmUpdate = async (instanceId: string) => {
        // Check access before updating
        if (!hasAccess) {
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
        } catch (err) {
            console.error("Error al actualizar la instancia:", err);
        } finally {
            setIsInstalling(false);
            setIsUpdateDialogOpen(false);
            setPendingAction(null);
        }
    }

    const handleConfirmCreate = async (instanceName: string, isServer: boolean) => {
        // Check access before creating
        if (!hasAccess) {
            setPendingAction({
                type: 'create',
                instanceName,
                isServer
            });
            setIsCreateDialogOpen(false);
            setIsAcquisitionDialogOpen(true);
            return;
        }

        await executeCreate(instanceName, isServer);
    }

    const executeCreate = async (instanceName: string, isServer: boolean = false) => {
        setIsInstalling(true);
        try {
            await invoke("create_modpack_instance", {
                instanceName,
                modpackId,
                versionId: selectedVersionId,
                password: null,
                instanceType: isServer ? "server" : "client"
            });

            // Track the installation for analytics
            if (sessionTokens?.accessToken && selectedVersionId) {
                trackModpackInstall(sessionTokens.accessToken, modpackId, selectedVersionId)
                    .catch(err => console.error('Failed to track installation:', err));
            }

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
                executeCreate(pendingAction.instanceName, pendingAction.isServer);
            } else if (pendingAction.type === 'show_options') {
                setIsInstallOptionsOpen(true);
            } else if (pendingAction.type === 'show_create') {
                setIsCreateDialogOpen(true);
            }
        }

        // Clear pending action
        setPendingAction(null);
    };

    const getButtonText = () => {
        if (isCheckingAccess) return "Verificando acceso...";
        if (isCurrentlyInstalling) return "Instalando...";

        // If user doesn't have access, show "Obtener Acceso" regardless of acquisition method
        if (!hasAccess) {
            return "Obtener";
        }

        // If user has access or no acquisition required, show "Instalar"
        return "Instalar";
    };

    return (
        <>
            <Button
                variant="default"
                className={clsx(["w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"])}
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
                canInstallNew={isLimitAllowed}
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
                allowServerDownload={allowServerDownload}
            />

            <ModpackAcquisitionDialog
                isOpen={isAcquisitionDialogOpen}
                onClose={() => setIsAcquisitionDialogOpen(false)}
                onSuccess={handleAcquisitionSuccess}
                modpack={{
                    id: modpackId,
                    name: modpackName,
                    acquisitionMethod: acquisitionMethodState,
                    requiresTwitchSubscription: requiresTwitchState,
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
                            {requiresPasswordState && (
                                <span className="block mt-2 font-medium">
                                    Este modpack está protegido con contraseña.
                                </span>
                            )}
                            {requiresTwitchState && (
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