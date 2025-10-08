// src/hooks/usePrelaunchInstance.ts
import { useState, useEffect, useCallback, useReducer, useRef } from "react";
import { useConnection } from "@/utils/ConnectionContext";
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
import { PreLaunchAppearance } from "@/types/PreLaunchAppeareance";
import { MinecraftInstance, TauriCommandReturns } from "@/types/TauriCommandReturns";
import { InstallationStage } from "@/types/InstallationStage";
import { formatStageMessage } from "@/utils/stageFormatter";
import { info } from "@tauri-apps/plugin-log";
import { setActivity } from "tauri-plugin-drpc";

// --- Constants and Types ---

const RANDOM_MESSAGES = [
    "Descargando archivos necesarios...",
    "Muy pronto estarás jugando...",
    "Preparando todo para ti...",
    "Steve está esperando a que te unas...",
    "Crafteando tu experiencia..."
] as const;

type State = {
    isLoading: boolean;
    error: string | null;
    instance: MinecraftInstance | null;
    appearance: PreLaunchAppearance | undefined;
    loadingMessage: string;
    loadingStage: InstallationStage | undefined;
};

type Action =
    | { type: 'FETCH_START' }
    | { type: 'FETCH_SUCCESS'; payload: { instance: MinecraftInstance; appearance: PreLaunchAppearance } }
    | { type: 'FETCH_ERROR'; payload: string }
    | { type: 'UPDATE_APPEARANCE'; payload: PreLaunchAppearance }
    | { type: 'SET_LOADING_STATUS'; payload: { message: string; stage?: InstallationStage } }
    | { type: 'CLEAR_LOADING' }
    | { type: 'RESET' };

const initialState: State = {
    isLoading: true,
    error: null,
    instance: null,
    appearance: undefined,
    loadingMessage: "Cargando...",
    loadingStage: undefined,
};

// --- Reducer ---

function prelaunchReducer(state: State, action: Action): State {
    switch (action.type) {
        case 'FETCH_START':
            return { ...initialState, isLoading: true };
        case 'FETCH_SUCCESS':
            return { ...state, isLoading: false, error: null, ...action.payload };
        case 'FETCH_ERROR':
            return { ...state, isLoading: false, error: action.payload, instance: null };
        case 'UPDATE_APPEARANCE':
            return { ...state, appearance: action.payload };
        case 'SET_LOADING_STATUS':
            return { ...state, loadingMessage: action.payload.message, loadingStage: action.payload.stage };
        case 'CLEAR_LOADING':
            return { ...state, loadingMessage: "Preparando instancia...", loadingStage: undefined };
        case 'RESET':
            return initialState;
        default:
            return state;
    }
}

// --- Custom Hook ---

export const usePrelaunchInstance = (instanceId: string) => {
    const { isConnected } = useConnection();
    const { setTitleBarState } = useGlobalContext();
    const { instances } = useInstances();
    const { instancesBootstraping } = useTasksContext();
    const navigate = useNavigate();

    const [state, dispatch] = useReducer(prelaunchReducer, initialState);
    const [crashErrorState, setCrashErrorState] = useState({ showModal: false, exitCode: -1, message: "", data: null });
    const [showConfig, setShowConfig] = useState(false);
    const [showAccountSelection, setShowAccountSelection] = useState(false);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const messageIntervalRef = useRef<number | null>(null);

    // --- Derived State ---
    const currentInstanceRunning = instances.find(inst => inst.id === instanceId) || null;
    const isPlaying = currentInstanceRunning?.status === "running";
    const hasInstancesRunning = instances.some(i => i.status === "running");
    const isInstanceBootstraping = instancesBootstraping.includes(instanceId);
    const isLaunchInProgress = ["preparing", "downloading-assets", "downloading-modpack-assets"].includes(currentInstanceRunning?.status || "");
    const IS_FORGE = state.instance?.forgeVersion != null;

    // --- Utility Functions ---
    const getRandomMessage = useCallback(() => RANDOM_MESSAGES[Math.floor(Math.random() * RANDOM_MESSAGES.length)], []);

    const stopAudio = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
            audioRef.current = null;
        }
    }, []);

    // --- Core Logic ---
    const fetchInstanceAndAppearance = useCallback(async (abortSignal: AbortSignal) => {
        try {
            const instance = await invoke<TauriCommandReturns['get_instance_by_id']>("get_instance_by_id", { instanceId });
            if (abortSignal.aborted || !instance) throw new Error("Instance not found or request aborted");

            setTitleBarState(prev => ({ ...prev, title: instance.instanceName, canGoBack: true, opaque: true }));

            const defaultAppearance = getDefaultAppeareance({ logoUrl: "/images/mc_logo.svg" });
            const customAppearance = await invoke<PreLaunchAppearance>("get_prelaunch_appearance", { instanceId });
            if (abortSignal.aborted) return;

            const finalAppearance = merge(defaultAppearance, customAppearance || {});

            dispatch({ type: 'FETCH_SUCCESS', payload: { instance, appearance: finalAppearance } });

            // Asynchronously update appearance if it's a modpack
            if (instance.modpackId) {
                invoke<boolean>("update_prelaunch_appearance", { instanceId })
                    .then(updated => {
                        if (updated && !abortSignal.aborted) {
                            info(`Apariencia actualizada para la instancia: ${instanceId}`);
                            // Re-fetch only appearance for a silent update
                            invoke<PreLaunchAppearance>("get_prelaunch_appearance", { instanceId })
                                .then(newAppearance => !abortSignal.aborted && dispatch({ type: 'UPDATE_APPEARANCE', payload: merge(defaultAppearance, newAppearance || {}) }));
                        }
                    })
                    .catch(err => console.warn("Failed to update prelaunch appearance:", err));
            }
        } catch (error) {
            if (!abortSignal.aborted) {
                console.error("Error fetching instance data:", error);
                dispatch({ type: 'FETCH_ERROR', payload: "Ocurrió un error al cargar la instancia" });
            }
        }
    }, [instanceId, setTitleBarState]);

    const handlePlay = useCallback(async () => {
        if (isLaunchInProgress || isPlaying || isInstanceBootstraping) return;

        const { instance } = state;
        if (!instance) {
            playSound('ERROR_NOTIFICATION');
            toast.error("No se encontró la información de la instancia.");
            return;
        }

        /*  if (!isConnected && instance.accountUuid === null && instance.ms_nickname) {
             playSound('ERROR_NOTIFICATION');
             toast.error("Cuenta no disponible", { description: "EL servicio de autenticación de Modpack Store no está disponible en modo offline. Selecciona otra cuenta para jugar." });
             setShowAccountSelection(true);
             return;
         } */

        if (instance.accountUuid) {
            const accountExists = await invoke<boolean>("ensure_account_exists", { uuid: instance.accountUuid });
            if (!accountExists) {
                playSound('ERROR_NOTIFICATION');
                toast.error("Cuenta no encontrada", { description: "La cuenta asociada ya no existe." });
                return;
            }
        } else {
            setShowAccountSelection(true);
            return;
        }

        try {
            trackEvent("play_instance_clicked", { name: "Play Minecraft Instance Clicked", modpackId: instance.modpackId ? instance.modpackId : "unknown" });
            dispatch({ type: 'SET_LOADING_STATUS', payload: { message: 'Preparando instancia...' } });
            await invoke("launch_mc_instance", { instanceId });
        } catch (error) {
            console.error("Error launching instance:", error);
            playSound('ERROR_NOTIFICATION');
            toast.error("Error al iniciar la instancia", { description: "Ocurrió un problema al lanzar Minecraft." });
            dispatch({ type: 'CLEAR_LOADING' });
        }
    }, [isLaunchInProgress, isPlaying, isInstanceBootstraping, state.instance, isConnected, instanceId]);

    const handleAccountSelected = useCallback(async (selectedAccountUuid: string) => {
        if (!state.instance || !selectedAccountUuid) {
            toast.warning("No se seleccionó una cuenta válida.");
            return;
        }

        setShowAccountSelection(false);

        // 1. Crea el objeto de la instancia actualizado en el frontend.
        const updatedInstance = {
            ...state.instance,
            accountUuid: selectedAccountUuid,
            ms_nickname: null, // Importante: Limpia la cuenta anterior para evitar conflictos.
        };

        try {
            await invoke("update_instance", { instance: updatedInstance });
            const controller = new AbortController();
            await fetchInstanceAndAppearance(controller.signal);
            // El useEffect se encargará de llamar a handlePlay() con los datos correctos.

        } catch (error) {
            console.error("Error al guardar la configuración de la instancia:", error);
            toast.error("No se pudo guardar la nueva selección de cuenta.");
        }
    }, [state.instance, fetchInstanceAndAppearance]);

    // --- Effects ---

    // Main data loading effect
    useEffect(() => {
        dispatch({ type: 'FETCH_START' });
        const controller = new AbortController();
        fetchInstanceAndAppearance(controller.signal);

        return () => {
            controller.abort();
            dispatch({ type: 'RESET' });
            stopAudio();
            if (messageIntervalRef.current) clearInterval(messageIntervalRef.current);
        };
    }, [instanceId, fetchInstanceAndAppearance, stopAudio]);

    // Audio playback effect
    useEffect(() => {
        const audioUrl = state.appearance?.audio?.url;
        if (!audioUrl) {
            stopAudio();
            return;
        }

        if (!audioRef.current || audioRef.current.src !== audioUrl) {
            stopAudio();
            audioRef.current = new Audio(audioUrl);
            audioRef.current.loop = true;
        }

        const audio = audioRef.current;
        const volume = Number(state.appearance?.audio?.volume ?? 0.5);
        audio.volume = Math.max(0, Math.min(1, isNaN(volume) ? 0.5 : volume));

        (isPlaying || hasInstancesRunning) ? audio.pause() : audio.play().catch(e => console.error("Audio playback error:", e));

    }, [state.appearance?.audio, isPlaying, hasInstancesRunning, stopAudio]);

    // Loading status and random message effect
    useEffect(() => {
        if (isLaunchInProgress) {
            const message = currentInstanceRunning?.stage
                ? formatStageMessage(currentInstanceRunning.stage, currentInstanceRunning.message || "Procesando...")
                : currentInstanceRunning?.message || getRandomMessage();

            dispatch({ type: 'SET_LOADING_STATUS', payload: { message, stage: currentInstanceRunning?.stage } });

            if (!messageIntervalRef.current) {
                messageIntervalRef.current = window.setInterval(() => {
                    dispatch({ type: 'SET_LOADING_STATUS', payload: { message: getRandomMessage() } });
                }, 5000);
            }
        } else {
            if (messageIntervalRef.current) {
                clearInterval(messageIntervalRef.current);
                messageIntervalRef.current = null;
            }
            dispatch({ type: 'CLEAR_LOADING' });
        }
    }, [isLaunchInProgress, currentInstanceRunning, getRandomMessage]);

    // Discord RPC effect
    useEffect(() => {
        if (!state.instance) return;

        const activity = new Activity()
            .setActivity(ActivityType.Playing)
            .setState(isPlaying ? "Jugando" : "En el lanzador")
            .setDetails(state.instance.instanceName)
            .setTimestamps(new Timestamps(Date.now()))
            .setAssets(new Assets()
                .setLargeImage(state.instance.modpackId ? `https://cdn-mstore.saltouruguayserver.com/modpacks/${state.instance.modpackId}/icon` : "explore")
                .setLargeText(state.instance.instanceName)
                .setSmallImage("exploring")
                .setSmallText(isPlaying ? "Minecraft" : "Modpack Store")
            );
        setActivity(activity).catch((e: any) => console.error("DRPC Error:", e));

    }, [isPlaying, state.instance]);

    // Crash handler effect
    useEffect(() => {
        const handleInstanceCrash = (event: CustomEvent<{ instanceId: string; message?: string; data?: any; exitCode: number }>) => {
            if (event.detail.instanceId === instanceId) {
                setCrashErrorState({
                    exitCode: event.detail.exitCode,
                    message: event.detail.message || "Minecraft se cerró inesperadamente",
                    showModal: true,
                    data: event.detail.data,
                });
            }
        };
        const listener = handleInstanceCrash as EventListener;
        document.addEventListener("instance-crash", listener);
        return () => document.removeEventListener("instance-crash", listener);
    }, [instanceId]);

    // URL params effect
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("showSettings") === "true") {
            setShowConfig(true);
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);


    return {
        prelaunchState: {
            isLoading: state.isLoading,
            error: state.error,
            instance: state.instance,
        },
        appearance: state.appearance,
        loadingStatus: {
            isLoading: isLaunchInProgress,
            message: state.loadingMessage,
            stage: state.loadingStage,
        },
        isPlaying,
        hasInstancesRunning,
        isInstanceBootstraping,
        IS_FORGE,
        showConfig,
        showAccountSelection,
        setShowAccountSelection,
        crashErrorState,
        setCrashErrorState,
        handlePlayButtonClick: handlePlay,
        handleAccountSelected,
        fetchInstanceData: () => fetchInstanceAndAppearance(new AbortController().signal), // Expose refetch if needed
        navigate,
    };
};