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

const DEFAULT_LOADING_STATE = {
    isLoading: false,
    message: "Descargando archivos necesarios...",
    stage: undefined as InstallationStage | undefined,
};

const RANDOM_MESSAGES = [
    "Descargando archivos necesarios...",
    "Cargando modpack...",
    "Muy pronto estarás jugando...",
    "Seguro que te va a encantar...",
    "Preparando todo para ti...",
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

    const startMessageInterval = useCallback(() => {
        if (messageIntervalRef.current) clearInterval(messageIntervalRef.current);
        messageIntervalRef.current = window.setInterval(() => {
            setLoadingStatus(prev => ({ ...prev, message: getRandomMessage() }));
        }, 5000);
    }, [getRandomMessage]);

    const handlePlayButtonClick = useCallback(async () => {
        if (loadingStatus.isLoading || isPlaying || isInstanceBootstraping) return;

        const { instance } = prelaunchState;
        if (!instance) {
            playSound('ERROR_NOTIFICATION');
            toast.error("Error al iniciar la instancia", { description: "No se encontró la información de la instancia." });
            return;
        }
        if (!instance.accountUuid) {
            playSound('ERROR_NOTIFICATION');
            toast.error("Sin cuenta seleccionada", { description: "Selecciona una cuenta de Minecraft en la configuración.", icon: <LucideUnplug /> });
            return;
        }

        const accountExists = await invoke<boolean>("ensure_account_exists", { uuid: instance.accountUuid });
        if (!accountExists) {
            playSound('ERROR_NOTIFICATION');
            toast.error("Cuenta no encontrada", { description: "La cuenta asociada no existe. Revísala en la configuración." });
            return;
        }

        try {
            trackEvent("play_instance_clicked", { name: "Play Minecraft Instance Clicked", modpackId: "null", timestamp: new Date().toISOString() });
            setLoadingStatus(prev => ({ ...prev, isLoading: true }));
            await invoke("launch_mc_instance", { instanceId });
            startMessageInterval();
        } catch (error) {
            console.error("Error launching instance:", error);
            playSound('ERROR_NOTIFICATION');
            toast.error("Error al iniciar la instancia", { description: "Ocurrió un problema al intentar lanzar Minecraft." });
            setLoadingStatus(DEFAULT_LOADING_STATE);
        }
    }, [instanceId, loadingStatus.isLoading, isPlaying, isInstanceBootstraping, prelaunchState.instance, startMessageInterval]);

    // --- EFECTOS SECUNDARIOS ---

    // Efecto para cargar datos iniciales
    useEffect(() => {
        fetchInstanceData();
        loadAppearance();
    }, [fetchInstanceData, loadAppearance]);

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

    // Efecto para manejar los intervalos de mensajes y el estado de carga
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
                // Always update lastMessageRef to the current formatted message
                lastMessageRef.current = formattedMessage;

                // If we don't already have a rotating interval, start one
                if (!messageIntervalRef.current) {
                    messageIntervalRef.current = window.setInterval(() => {
                        setLoadingStatus(prev => ({ ...prev, message: getRandomMessage() }));
                    }, 5000);
                }
            } else {
                // Not loading: clear rotating interval and any pending timeout
                if (messageIntervalRef.current) {
                    clearInterval(messageIntervalRef.current);
                    messageIntervalRef.current = null;
                }

                if (messageTimeoutRef.current) {
                    clearTimeout(messageTimeoutRef.current);
                    messageTimeoutRef.current = null;
                }

                // Ensure loadingStatus reflects non-loading default state (keep message if provided)
                setLoadingStatus(prev => ({ ...prev, isLoading: false }));
            }
        }
    }, [currentInstanceRunning, getRandomMessage, startMessageInterval]);


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
        crashErrorState,
        setCrashErrorState,
        handlePlayButtonClick,
        fetchInstanceData,
        handleResourceError,
        navigate, // Exportamos navigate para el botón de error
    };
};