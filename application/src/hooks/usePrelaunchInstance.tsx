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
import { playSound } from "@/utils/sounds";
import { trackEvent } from "@aptabase/web";
import { Activity, ActivityType, Assets, Timestamps } from "tauri-plugin-drpc/activity";
import { setActivity } from "tauri-plugin-drpc";
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
] as const;

export const usePrelaunchInstance = (instanceId: string) => {
    const { setTitleBarState } = useGlobalContext();
    const { instances } = useInstances();
    const { instancesBootstraping } = useTasksContext();
    const navigate = useNavigate();

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const messageIntervalRef = useRef<number | null>(null);
    const lastMessageRef = useRef<string | null>(null);
    const messageTimeoutRef = useRef<number | null>(null);
    const mountedRef = useRef(true);
    const currentInstanceIdRef = useRef(instanceId);

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

    const currentInstanceRunning = instances.find(inst => inst.id === instanceId) || null;
    const isPlaying = currentInstanceRunning?.status === "running";
    const hasInstancesRunning = instances.some(i => i.status === "running");
    const isInstanceBootstraping = instancesBootstraping.includes(instanceId);
    const IS_FORGE = prelaunchState.instance?.forgeVersion != null;

    const getRandomMessage = useCallback(() =>
        RANDOM_MESSAGES[Math.floor(Math.random() * RANDOM_MESSAGES.length)],
        []);

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

    const clearLoadingState = useCallback(() => {
        clearAllTimers();
        lastMessageRef.current = null;
        setLoadingStatus({
            isLoading: false,
            message: "Preparando instancia...",
            stage: undefined
        });
    }, [clearAllTimers]);

    const stopAudio = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.src = '';
            audioRef.current = null;
        }
    }, []);

    const resetState = useCallback(() => {
        stopAudio();
        clearLoadingState();
        setAppearance(undefined);
        setPrelaunchState({
            isLoading: true,
            error: null,
            instance: null,
        });
        setCrashErrorState({
            exitCode: -1,
            message: "",
            showModal: false,
            data: null,
        });
        setShowConfig(false);
        setShowAccountSelection(false);
    }, [stopAudio, clearLoadingState]);

    const handleResourceError = useCallback((resourceName: string, errorDetails: string) => {
        console.warn(`Error loading prelaunch resource: ${resourceName}`, errorDetails);
        toast.warning("Error de recurso", {
            description: `No se pudo cargar el recurso '${resourceName}' de la apariencia. Se usará uno por defecto.`,
        });
    }, []);

    const fetchInstanceData = useCallback(async () => {
        if (!mountedRef.current || currentInstanceIdRef.current !== instanceId) return null;

        setPrelaunchState(prev => ({ ...prev, isLoading: true, error: null }));
        try {
            const instance = await invoke<TauriCommandReturns['get_instance_by_id']>("get_instance_by_id", { instanceId });
            if (!instance) throw new Error("Instance not found");

            if (!mountedRef.current || currentInstanceIdRef.current !== instanceId) return null;

            setPrelaunchState({ isLoading: false, error: null, instance });
            setTitleBarState(prev => ({
                ...prev,
                title: instance.instanceName,
                canGoBack: true,
                customIconClassName: "",
                opaque: true
            }));
            return instance;
        } catch (error) {
            console.error("Error fetching instance data:", error);
            if (mountedRef.current && currentInstanceIdRef.current === instanceId) {
                setPrelaunchState({
                    isLoading: false,
                    error: "Ocurrió un error al cargar la instancia",
                    instance: null
                });
            }
            return null;
        }
    }, [instanceId, setTitleBarState]);

    const loadAppearance = useCallback(async () => {
        if (!mountedRef.current || currentInstanceIdRef.current !== instanceId) return;

        try {
            const defaultAppearance = getDefaultAppeareance({ logoUrl: "/images/mc_logo.svg" });
            const appearanceData = await invoke<PreLaunchAppearance>("get_prelaunch_appearance", { instanceId });

            if (!mountedRef.current || currentInstanceIdRef.current !== instanceId) return;

            const mergedAppearance = merge(defaultAppearance, appearanceData || {});
            setAppearance(mergedAppearance);
        } catch (err) {
            console.error("Error loading appearance:", err);
            if (mountedRef.current && currentInstanceIdRef.current === instanceId) {
                handleResourceError("Apariencia General", err instanceof Error ? err.message : String(err));
                setAppearance(getDefaultAppeareance({ logoUrl: "/images/mc_logo.svg" }));
            }
        }
    }, [instanceId, handleResourceError]);

    const updateAppearance = useCallback(async () => {
        if (!mountedRef.current || currentInstanceIdRef.current !== instanceId) return;

        try {
            const updated = await invoke<boolean>("update_prelaunch_appearance", { instanceId });
            if (updated && mountedRef.current && currentInstanceIdRef.current === instanceId) {
                await loadAppearance();
                info(`Apariencia actualizada para la instancia: ${instanceId}`);
            }
        } catch (err) {
            console.warn("Failed to update prelaunch appearance:", err);
            if (mountedRef.current && currentInstanceIdRef.current === instanceId) {
                await loadAppearance();
            }
        }
    }, [instanceId, loadAppearance]);

    const startMessageInterval = useCallback(() => {
        if (messageIntervalRef.current) clearInterval(messageIntervalRef.current);
        messageIntervalRef.current = window.setInterval(() => {
            setLoadingStatus(prev => ({ ...prev, message: getRandomMessage() }));
        }, 5000);
    }, [getRandomMessage]);

    const launchInstance = useCallback(async () => {
        if (loadingStatus.isLoading || isPlaying || isInstanceBootstraping) return;

        const { instance } = prelaunchState;
        if (!instance) {
            playSound('ERROR_NOTIFICATION');
            toast.error("Error al iniciar la instancia", {
                description: "No se encontró la información de la instancia."
            });
            return;
        }

        if (instance.accountUuid && instance.accountUuid.trim() !== "") {
            console.log("Verificando existencia de cuenta con UUID:", instance.accountUuid);
            const accountExists = await invoke<boolean>("ensure_account_exists", { uuid: instance.accountUuid });
            if (!accountExists) {
                playSound('ERROR_NOTIFICATION');
                toast.error("Cuenta no encontrada", {
                    description: "La cuenta asociada no existe. Revísala en la configuración."
                });
                return;
            }
        }

        try {
            trackEvent("play_instance_clicked", {
                name: "Play Minecraft Instance Clicked",
                modpackId: "null",
                timestamp: new Date().toISOString()
            });

            clearLoadingState();
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
            toast.error("Error al iniciar la instancia", {
                description: "Ocurrió un problema al intentar lanzar Minecraft."
            });
            setLoadingStatus(DEFAULT_LOADING_STATE);
        }
    }, [instanceId, loadingStatus.isLoading, isPlaying, isInstanceBootstraping, prelaunchState, clearLoadingState, startMessageInterval]);

    const handlePlayButtonClick = useCallback(async () => {
        if (loadingStatus.isLoading || isPlaying || isInstanceBootstraping) return;

        const { instance } = prelaunchState;
        if (!instance) {
            playSound('ERROR_NOTIFICATION');
            toast.error("Error al iniciar la instancia", {
                description: "No se encontró la información de la instancia."
            });
            return;
        }

        // Si hay accountUuid, verificar que la cuenta existe
        if (instance.accountUuid && instance.accountUuid.trim() !== "") {
            console.log("Verificando existencia de cuenta con UUID:", instance.accountUuid);
            const accountExists = await invoke<boolean>("ensure_account_exists", { uuid: instance.accountUuid });
            if (!accountExists) {
                playSound('ERROR_NOTIFICATION');
                toast.error("Cuenta no encontrada", {
                    description: "La cuenta asociada no existe. Revísala en la configuración."
                });
                return;
            }
        }

        await launchInstance();
    }, [loadingStatus.isLoading, isPlaying, isInstanceBootstraping, prelaunchState, launchInstance]);

    const handleAccountSelected = useCallback(async () => {
        setShowAccountSelection(false);
        const updatedInstance = await fetchInstanceData();
        if (updatedInstance?.accountUuid) {
            setTimeout(() => launchInstance(), 100);
        }
    }, [fetchInstanceData, launchInstance]);

    // Reset completo cuando cambia instanceId
    useEffect(() => {
        currentInstanceIdRef.current = instanceId;
        mountedRef.current = true;
        resetState();

        return () => {
            mountedRef.current = false;
        };
    }, [instanceId, resetState]);

    // Cargar datos iniciales
    useEffect(() => {
        const loadInitialData = async () => {
            const instance = await fetchInstanceData();
            if (!mountedRef.current || currentInstanceIdRef.current !== instanceId) return;

            if (instance?.modpackId) {
                await loadAppearance();
                updateAppearance();
            } else {
                await loadAppearance();
            }
        };
        loadInitialData();
    }, [instanceId, fetchInstanceData, loadAppearance, updateAppearance]);

    // Manejar audio de fondo
    useEffect(() => {
        if (currentInstanceIdRef.current !== instanceId) return;

        if (!appearance?.audio?.url) {
            stopAudio();
            return;
        }

        if (!audioRef.current || audioRef.current.src !== appearance.audio.url) {
            stopAudio();
            audioRef.current = new Audio(appearance.audio.url);
            audioRef.current.loop = true;
        }

        if (audioRef.current) {
            const volumeValue = typeof appearance.audio.volume === "number"
                ? appearance.audio.volume
                : typeof appearance.audio.volume === "string"
                    ? parseFloat(appearance.audio.volume)
                    : 0.5;
            audioRef.current.volume = Math.max(0, Math.min(1, volumeValue));
        }

        const audio = audioRef.current;
        (isPlaying || hasInstancesRunning) ? audio.pause() : audio.play().catch(e => console.error("Audio playback error:", e));

        return () => {
            if (currentInstanceIdRef.current !== instanceId) {
                stopAudio();
            }
        };
    }, [appearance?.audio?.url, appearance?.audio?.volume, isPlaying, hasInstancesRunning, instanceId, stopAudio]);

    // Manejar estado de carga
    useEffect(() => {
        if (currentInstanceIdRef.current !== instanceId) return;

        if (currentInstanceRunning) {
            const isLoading = ["preparing", "downloading-assets", "downloading-modpack-assets"]
                .includes(currentInstanceRunning.status);

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
                const messageKey = `${instanceId}-${formattedMessage}`;
                if (lastMessageRef.current !== messageKey) {
                    lastMessageRef.current = messageKey;
                    if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
                    messageTimeoutRef.current = window.setTimeout(() => {
                        if (!messageIntervalRef.current && loadingStatus.isLoading) {
                            messageIntervalRef.current = window.setInterval(() => {
                                setLoadingStatus(prev => ({ ...prev, message: getRandomMessage() }));
                            }, 5000);
                        }
                    }, 5000);
                }
            } else {
                clearAllTimers();
                setLoadingStatus(DEFAULT_LOADING_STATE);
            }
        } else {
            clearAllTimers();
            if (loadingStatus.isLoading) setLoadingStatus(DEFAULT_LOADING_STATE);
        }
    }, [currentInstanceRunning, getRandomMessage, instanceId, loadingStatus.isLoading, clearAllTimers]);

    // Cleanup final
    useEffect(() => {
        return () => {
            stopAudio();
            clearAllTimers();
            lastMessageRef.current = null;
        };
    }, [stopAudio, clearAllTimers]);

    // Discord RPC
    useEffect(() => {
        if (!prelaunchState.instance || currentInstanceIdRef.current !== instanceId) return;

        const activity = new Activity()
            .setActivity(ActivityType.Playing)
            .setState(isPlaying ? "Jugando" : "Preparando instancia")
            .setDetails(prelaunchState.instance.instanceName)
            .setTimestamps(new Timestamps(Date.now()))
            .setAssets(new Assets()
                .setLargeImage(prelaunchState.instance.modpackId ? `https://cdn-mstore.saltouruguayserver.com/modpacks/${prelaunchState.instance.modpackId}/icon` : "explore")
                .setLargeText(prelaunchState.instance.instanceName)
                .setSmallImage("exploring")
                .setSmallText(isPlaying ? "Jugando Minecraft" : "En el lanzador")
            );
        setActivity(activity).catch(e => console.error("DRPC Error:", e));
    }, [isPlaying, prelaunchState.instance, instanceId]);

    // Manejar eventos de crash
    useEffect(() => {
        const handleInstanceCrash = (event: CustomEvent<{
            instanceId: string;
            message?: string;
            data?: any;
            exitCode: number
        }>) => {
            if (event.detail.instanceId === instanceId && currentInstanceIdRef.current === instanceId) {
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

    // Leer parámetros de URL
    useEffect(() => {
        setTitleBarState(prev => ({ ...prev, canGoBack: true }));
        const params = new URLSearchParams(window.location.search);
        if (params.get("showSettings") === "true") {
            setShowConfig(true);
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [setTitleBarState]);

    return {
        prelaunchState,
        appearance,
        loadingStatus,
        isPlaying,
        hasInstancesRunning,
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
        navigate,
    };
};