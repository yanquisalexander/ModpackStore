// src/hooks/usePrelaunchInstance.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { merge } from 'lodash-es';
import { useGlobalContext } from "@/stores/GlobalContext";
import { useInstances } from "@/stores/InstancesContext";
import { useTasksContext } from "@/stores/TasksContext";
import { getDefaultAppeareance } from "@/utils/prelaunch";
import { playSound, SOUNDS } from "@/utils/sounds";
import { trackEvent } from "@aptabase/web";
import { Activity, Timestamps } from "tauri-plugin-drpc/activity";
import { setActivity } from "tauri-plugin-drpc";
import { LucideUnplug } from "lucide-react";
import { PreLaunchAppearance } from "@/types/PreLaunchAppeareance";
import { MinecraftInstance, TauriCommandReturns } from "@/types/TauriCommandReturns";
import { InstallationStage } from "@/types/InstallationStage";
import { formatStageMessage } from "@/utils/stageFormatter";
import { info } from "@tauri-apps/plugin-log";

const DEFAULT_LOADING_STATE = {
    isLoading: false,
    message: "Descargando archivos necesarios...",
    stage: undefined as InstallationStage | undefined,
};

const RANDOM_MESSAGES = [
    "Descargando archivos necesarios...",
    "Muy pronto estarás jugando...",
    "Seguro que te va a encantar...",
    "Preparando todo para ti...",
    "Steve está esperando a que te unas...",
    "No te preocupes, todo está bajo control...",
    "Casi listo para jugar...",
    "Preparando las minas...",
    "Crafteando tu experiencia..."
];

export const usePrelaunchInstance = (instanceId: string) => {
    // Contextos
    const { setTitleBarState } = useGlobalContext();
    const { instances } = useInstances();
    const { instancesBootstraping } = useTasksContext();
    const navigate = useNavigate();

    // Refs
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const messageIntervalRef = useRef<number | null>(null);
    const lastMessageRef = useRef<string | null>(null);
    const messageTimeoutRef = useRef<number | null>(null);

    // Estados
    const [appearance, setAppearance] = useState<PreLaunchAppearance | undefined>(undefined);
    const [prelaunchState, setPrelaunchState] = useState({
        isLoading: true,
        error: null as string | null,
        instance: null as MinecraftInstance | null,
    });
    const [crashErrorState, setCrashErrorState] = useState({
        exitCode: -1,
        message: "",
        showModal: false,
        data: null,
    });
    const [loadingStatus, setLoadingStatus] = useState(DEFAULT_LOADING_STATE);
    const [showConfig, setShowConfig] = useState(false);
    const [showAccountSelection, setShowAccountSelection] = useState(false);

    // Valores derivados del estado
    const currentInstanceRunning = instances.find(inst => inst.id === instanceId) || null;
    const isPlaying = currentInstanceRunning?.status === "running";
    const isInstanceBootstraping = instancesBootstraping.includes(instanceId);
    const IS_FORGE = prelaunchState.instance?.forgeVersion != null;

    // --- FUNCIONES Y CALLBACKS ---

    const getRandomMessage = useCallback(() => RANDOM_MESSAGES[Math.floor(Math.random() * RANDOM_MESSAGES.length)], []);

    const handleResourceError = useCallback((resourceName: string, errorDetails: string) => {
        console.warn(`Error loading prelaunch resource: ${resourceName}`, errorDetails);
        toast.warning("Error de recurso", {
            description: `No se pudo cargar el recurso '${resourceName}' de la apariencia. Se usará uno por defecto.`,
        });
    }, []);

    const fetchInstanceData = useCallback(async () => {
        setPrelaunchState(prev => ({ ...prev, isLoading: true, error: null }));
        try {
            const instance = await invoke<TauriCommandReturns['get_instance_by_id']>("get_instance_by_id", { instanceId });
            if (!instance) throw new Error("Instance not found");

            setPrelaunchState({ isLoading: false, error: null, instance });
            setTitleBarState(prev => ({ ...prev, title: instance.instanceName, canGoBack: true, customIconClassName: "", opaque: false }));
            return instance;
        } catch (error) {
            console.error("Error fetching instance data:", error);
            setPrelaunchState({ isLoading: false, error: "Ocurrió un error al cargar la instancia", instance: null });
            return null;
        }
    }, [instanceId, setTitleBarState]);

    const loadAppearance = useCallback(async () => {
        try {
            const defaultAppearance = getDefaultAppeareance({ logoUrl: "/images/mc_logo.svg" });
            const appearanceData = await invoke<PreLaunchAppearance>("get_prelaunch_appearance", { instanceId });
            const mergedAppearance = merge(defaultAppearance, appearanceData || {});
            setAppearance(mergedAppearance);
        } catch (err) {
            console.error("Error loading appearance:", err);
            handleResourceError("Apariencia General", err instanceof Error ? err.message : String(err));
            setAppearance(getDefaultAppeareance({ logoUrl: "/images/mc_logo.svg" }));
        }
    }, [instanceId, handleResourceError]);

    const updateAppearance = useCallback(async () => {
        try {
            console.log("Attempting to update prelaunch appearance for instance:", instanceId);
            const updated = await invoke<boolean>("update_prelaunch_appearance", { instanceId });
            if (updated) {
                console.log("Prelaunch appearance updated successfully, reloading...");
                // Reload the appearance after successful update
                await loadAppearance();
                info(`Apariencia actualizada para la instancia: ${instanceId}`);
            } else {
                console.log("No prelaunch appearance available for this instance");
            }
        } catch (err) {
            console.warn("Failed to update prelaunch appearance:", err);

            // Mostrar notificación no bloqueante de modo offline para modpacks
            if (prelaunchState.instance?.modpackId) {
                toast.warning("Modo offline", {
                    description: "No se pudo verificar actualizaciones del modpack. Usando datos locales.",
                    duration: 3000
                });
            }

            // Still load the existing appearance
            await loadAppearance();
        }
    }, [instanceId, loadAppearance, prelaunchState.instance?.modpackId]);

    const startMessageInterval = useCallback(() => {
        if (messageIntervalRef.current) clearInterval(messageIntervalRef.current);
        messageIntervalRef.current = window.setInterval(() => {
            setLoadingStatus(prev => ({ ...prev, message: getRandomMessage() }));
        }, 5000);
    }, [getRandomMessage]);

    // Enhanced function to clear loading state and prevent old messages from showing
    const clearLoadingState = useCallback(() => {
        // Clear any existing intervals
        if (messageIntervalRef.current) {
            clearInterval(messageIntervalRef.current);
            messageIntervalRef.current = null;
        }

        // Clear any existing timeouts
        if (messageTimeoutRef.current) {
            clearTimeout(messageTimeoutRef.current);
            messageTimeoutRef.current = null;
        }

        // Reset message reference
        lastMessageRef.current = null;

        // Reset loading status to clean state
        setLoadingStatus({
            isLoading: false,
            message: "Preparando instancia...", // Fresh message instead of old residual one
            stage: undefined
        });

        console.log("LoadingIndicator state cleared for new instance launch");
    }, []);

    // Helper function to clear all timers
    const clearAllTimers = useCallback(() => {
        if (messageIntervalRef.current) {
            clearInterval(messageIntervalRef.current);
            messageIntervalRef.current = null;
        }

        if (messageTimeoutRef.current) {
            clearTimeout(messageTimeoutRef.current);
            messageTimeoutRef.current = null;
        }
    }, []);

    const launchInstance = async () => {
        if (loadingStatus.isLoading || isPlaying || isInstanceBootstraping) return;

        const { instance } = prelaunchState;
        if (!instance) {
            playSound('ERROR_NOTIFICATION');
            toast.error("Error al iniciar la instancia", { description: "No se encontró la información de la instancia." });
            return;
        }

        // Check if account exists
        const accountExists = await invoke<boolean>("ensure_account_exists", { uuid: instance.accountUuid });
        if (!accountExists) {
            playSound('ERROR_NOTIFICATION');
            toast.error("Cuenta no encontrada", { description: "La cuenta asociada no existe. Revísala en la configuración." });
            return;
        }

        try {
            trackEvent("play_instance_clicked", { name: "Play Minecraft Instance Clicked", modpackId: "null", timestamp: new Date().toISOString() });

            // Clear any previous loading state and messages before starting new instance
            clearLoadingState();

            // Set initial loading state for new instance
            setLoadingStatus({
                isLoading: true,
                message: "Preparando instancia...",
                stage: undefined
            });

            await invoke("launch_mc_instance", { instanceId });
            startMessageInterval();
        } catch (error) {
            console.error("Error launching instance:", error);
            playSound('ERROR_NOTIFICATION');
            toast.error("Error al iniciar la instancia", { description: "Ocurrió un problema al intentar lanzar Minecraft." });
            setLoadingStatus(DEFAULT_LOADING_STATE);
        }
    };

    const handlePlayButtonClick = useCallback(async () => {
        if (loadingStatus.isLoading || isPlaying || isInstanceBootstraping) return;

        const { instance } = prelaunchState;
        if (!instance) {
            playSound('ERROR_NOTIFICATION');
            toast.error("Error al iniciar la instancia", { description: "No se encontró la información de la instancia." });
            return;
        }
        if (!instance.accountUuid) {
            setShowAccountSelection(true);
            return;
        }

        const accountExists = await invoke<boolean>("ensure_account_exists", { uuid: instance.accountUuid });
        if (!accountExists) {
            playSound('ERROR_NOTIFICATION');
            toast.error("Cuenta no encontrada", { description: "La cuenta asociada no existe. Revísala en la configuración." });
            return;
        }

        await launchInstance();
    }, [instanceId, loadingStatus.isLoading, isPlaying, isInstanceBootstraping, prelaunchState.instance]);

    const handleAccountSelected = async () => {
        // The AccountSelectionDialog will handle setting the account for the instance
        // After account is set, we need to refresh instance data and then launch
        setShowAccountSelection(false);

        // Refresh instance data to get the updated account info
        const updatedInstance = await fetchInstanceData();

        // Check if the account was successfully assigned and launch
        if (updatedInstance && updatedInstance.accountUuid) {
            // Re-trigger the play action with updated instance data
            setTimeout(() => {
                // We can't call handlePlayButtonClick directly as it would cause recursion
                // Instead, we'll trigger the launch directly
                launchInstance();
            }, 100);
        }
    };

    // --- EFECTOS SECUNDARIOS ---

    // Efecto para cargar datos iniciales
    useEffect(() => {
        const loadInitialData = async () => {
            const instance = await fetchInstanceData();
            if (instance && instance.modpackId) {
                // For modpack instances, load existing appearance first, then update in background
                await loadAppearance();
                // Update appearance in background without blocking
                updateAppearance();
            } else {
                // For non-modpack instances, just load existing appearance
                await loadAppearance();
            }
        };
        loadInitialData();
    }, [fetchInstanceData, loadAppearance, updateAppearance]);

    // Efecto para manejar el audio de fondo
    useEffect(() => {
        if (!appearance?.audio?.url) return;

        if (!audioRef.current) {
            audioRef.current = new Audio(appearance.audio.url);
            audioRef.current.loop = true;
            audioRef.current.volume = 0.01;
        }

        const audio = audioRef.current;
        if (isPlaying) {
            audio.pause();
        } else {
            audio.play().catch(e => console.error("Audio playback error:", e));
        }

        return () => {
            audio.pause();
            audio.currentTime = 0;
        };
    }, [appearance?.audio?.url, isPlaying]);

    // Enhanced effect to handle loading state with better cleanup and message management
    useEffect(() => {
        if (currentInstanceRunning) {
            const isLoading = ["preparing", "downloading-assets", "downloading-modpack-assets"].includes(currentInstanceRunning.status);

            // Use stage information if available, otherwise fall back to existing message
            const formattedMessage = currentInstanceRunning.stage
                ? formatStageMessage(currentInstanceRunning.stage, currentInstanceRunning.message || "Procesando...")
                : currentInstanceRunning.message || (isLoading ? getRandomMessage() : DEFAULT_LOADING_STATE.message);

            setLoadingStatus(prev => ({
                ...prev,
                isLoading,
                message: formattedMessage,
                stage: currentInstanceRunning.stage
            }));

            if (isLoading) {
                // Check if the message has changed for this specific instance
                const messageKey = `${instanceId}-${formattedMessage}`;
                if (lastMessageRef.current !== messageKey) {
                    // Message changed: update ref and reset timeout
                    lastMessageRef.current = messageKey;

                    // Clear any existing timeout
                    if (messageTimeoutRef.current) {
                        clearTimeout(messageTimeoutRef.current);
                    }

                    // Set a new timeout to start rotating after 5 seconds of stability
                    messageTimeoutRef.current = window.setTimeout(() => {
                        // Start rotating interval if not already active and still loading
                        if (!messageIntervalRef.current && loadingStatus.isLoading) {
                            messageIntervalRef.current = window.setInterval(() => {
                                setLoadingStatus(prev => ({ ...prev, message: getRandomMessage() }));
                            }, 5000);
                        }
                    }, 5000);
                }
            } else {
                // Not loading: clear all timers and reset state for clean start
                clearAllTimers();

                setLoadingStatus(DEFAULT_LOADING_STATE);

            }
        } else {
            // No instance running - ensure clean state
            clearAllTimers();
            if (loadingStatus.isLoading) {
                setLoadingStatus(DEFAULT_LOADING_STATE);
            }
        }
    }, [currentInstanceRunning, getRandomMessage, instanceId, loadingStatus.isLoading]);

    // Enhanced cleanup effect to ensure no timers leak between instances
    useEffect(() => {
        // Clear state when instance changes to prevent old messages
        clearLoadingState();

        return () => {
            clearAllTimers();
            lastMessageRef.current = null;
        };
    }, [instanceId, clearAllTimers, clearLoadingState]); // Cleanup when instanceId changes


    // Efecto para Discord RPC
    useEffect(() => {
        if (!prelaunchState.instance) return;
        const activity = new Activity()
            .setState(isPlaying ? "Jugando" : "Preparando instancia")
            .setDetails(prelaunchState.instance.instanceName)
            .setTimestamps(new Timestamps(Date.now()));
        setActivity(activity).catch(e => console.error("DRPC Error:", e));
    }, [isPlaying, prelaunchState.instance]);

    // Efecto para manejar eventos de crash
    useEffect(() => {
        const handleInstanceCrash = (event: CustomEvent<{ instanceId: string; message?: string; data?: any; exitCode: number }>) => {
            if (event.detail.instanceId === instanceId) {
                setCrashErrorState({
                    exitCode: event.detail.exitCode,
                    message: event.detail.message || "Minecraft se ha cerrado inesperadamente",
                    showModal: true,
                    data: event.detail.data,
                });
            }
        };
        document.addEventListener("instance-crash", handleInstanceCrash as EventListener);
        return () => document.removeEventListener("instance-crash", handleInstanceCrash as EventListener);
    }, [instanceId]);

    // Efecto para leer parámetros de URL y limpiar
    useEffect(() => {
        setTitleBarState(prev => ({ ...prev, canGoBack: true }));
        const params = new URLSearchParams(window.location.search);
        if (params.get("showSettings") === "true") {
            setShowConfig(true);
            // Limpia la URL para no mostrar los parámetros
            window.history.replaceState({}, '', window.location.pathname);
        }
        return () => {
            if (messageIntervalRef.current) clearInterval(messageIntervalRef.current);
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
        };
    }, [setTitleBarState]);

    // --- RETORNO DEL HOOK ---
    return {
        prelaunchState,
        appearance,
        loadingStatus,
        isPlaying,
        isInstanceBootstraping,
        IS_FORGE,
        showConfig,
        showAccountSelection,
        setShowAccountSelection,
        crashErrorState,
        setCrashErrorState,
        handlePlayButtonClick,
        handleAccountSelected,
        fetchInstanceData,
        handleResourceError,
        navigate, // Exportamos navigate para el botón de error
    };
};