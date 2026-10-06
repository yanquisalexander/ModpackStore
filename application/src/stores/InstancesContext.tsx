import { createContext, useContext, useEffect, useState, useMemo, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { trackEvent } from "@aptabase/web";
import { toast } from "sonner";
import { playSound } from "@/utils/sounds";
import { InstallationStage, StageEventPayload } from "@/types/InstallationStage";

type InstanceState = {
    id: string;
    name: string;
    status: "idle" | "preparing" | "running" | "exited" | "error" | "downloading-assets";
    message: string;
    stage?: InstallationStage;
    pid?: number;
};

// El contexto solo expone las instancias
const InstancesContext = createContext<{
    instances: InstanceState[];
}>({
    instances: [],
});

export const InstancesProvider = ({ children }: { children: React.ReactNode }) => {
    const [instances, setInstances] = useState<InstanceState[]>([]);
    const instancesRef = useRef(instances);
    instancesRef.current = instances;

    // Throttle map: last update timestamp per instance+event key
    const lastUpdateRef = useRef<Map<string, number>>(new Map());
    const pendingUpdateRef = useRef<Map<string, { updates: Partial<InstanceState>; timer: ReturnType<typeof setTimeout> }>>(new Map());
    const THROTTLE_MS = 150;

    // Armored-instance violations: instance id -> timestamp. Used to suppress
    // the generic crash toast/dialog when the exit was a forced armored kill.
    const armoredViolationRef = useRef<Map<string, number>>(new Map());

    const throttledUpdate = (id: string, eventKey: string, updates: Partial<InstanceState>) => {
        const key = `${id}:${eventKey}`;
        const now = Date.now();
        const last = lastUpdateRef.current.get(key) ?? 0;

        if (now - last >= THROTTLE_MS) {
            lastUpdateRef.current.set(key, now);
            updateInstance(id, updates);
        } else {
            // Replace any pending update for this key with the latest one
            const existing = pendingUpdateRef.current.get(key);
            if (existing) clearTimeout(existing.timer);

            const timer = setTimeout(() => {
                pendingUpdateRef.current.delete(key);
                lastUpdateRef.current.set(key, Date.now());
                updateInstance(id, updates);
            }, THROTTLE_MS - (now - last));

            pendingUpdateRef.current.set(key, { updates, timer });
        }
    };

    const cancelPendingUpdates = (id: string) => {
        for (const [key, pending] of pendingUpdateRef.current.entries()) {
            if (key.startsWith(`${id}:`)) {
                clearTimeout(pending.timer);
                pendingUpdateRef.current.delete(key);
            }
        }
    };

    // Estas funciones son internas al provider y no se exponen
    const addInstance = (instance: InstanceState) => {
        setInstances(prev => {
            // Si ya existe una instancia con este ID, la actualizamos en lugar de añadir una nueva
            const exists = prev.some(inst => inst.id === instance.id);
            if (exists) {
                return prev.map(inst =>
                    inst.id === instance.id ? { ...inst, ...instance } : inst
                );
            }
            return [...prev, instance];
        });
    };

    const updateInstance = (id: string, updates: Partial<InstanceState>) => {
        setInstances(prev => {
            const instanceExists = prev.some(instance => instance.id === id);
            if (instanceExists) {
                return prev.map(instance =>
                    instance.id === id ? { ...instance, ...updates } : instance
                );
            } else {
                return [...prev, { id, ...updates } as InstanceState];
            }
        });
    };

    const removeInstance = (id: string) => {
        setInstances(prev => prev.filter(instance => instance.id !== id));
    };

    useEffect(() => {
        const unlistenList: (() => void)[] = [];

        const setupListeners = async () => {
            // Evento para cuando se inicia la preparación de una instancia
            const launchStartUnlisten = await listen("instance-launch-start", (e: any) => {
                const { id, name, message } = e.payload;
                cancelPendingUpdates(id);

                addInstance({
                    id,
                    name: name || `Instance ${id}`,
                    status: "preparing",
                    message: message || "Iniciando la instancia..."
                });
            });
            unlistenList.push(launchStartUnlisten);

            // NOTA: el progreso de descarga de assets lo maneja el listener
            // throttled de más abajo ("downloadingAssetsStageUnlisten"). No
            // agregar otro listener de "instance-downloading-assets" aquí:
            // duplicarlo congela la UI (un setState sin throttle por archivo).

            const finishAssetsDownloadUnlisten = await listen("instance-finish-assets-download", (e: any) => {
                const { id, message } = e.payload;
                cancelPendingUpdates(id);
                updateInstance(id, {
                    status: "idle",
                    message: message || "Descarga completada",
                    stage: undefined
                });
            })
            unlistenList.push(finishAssetsDownloadUnlisten);

            // Evento para cuando la instancia ha sido lanzada
            const launchedUnlisten = await listen("instance-launched", (e: any) => {
                const { id, message, data } = e.payload;
                cancelPendingUpdates(id);
                trackEvent("instance_launched", {
                    instanceId: id,
                    message: message || "Minecraft se está ejecutando"
                });

                updateInstance(id, {
                    status: "running",
                    message: message || "Minecraft está ejecutándose",
                    pid: data?.pid
                });

                // Minima ventana de la aplicación
                const window = getCurrentWindow();
                window.minimize();
            });
            unlistenList.push(launchedUnlisten);

            // Evento para cuando la instancia ha salido
            const exitedUnlisten = await listen("instance-exited", (e: any) => {
                const { id, message, data, name: instanceName } = e.payload;
                const { exitCode, detectedError } = data || { exitCode: "desconocido" };
                const possibleErrorCode = detectedError?.code;
                cancelPendingUpdates(id);

                trackEvent("instance_exited", {
                    instanceId: id,
                    message: message || "Minecraft se ha cerrado"
                });

                updateInstance(id, {
                    status: "exited",
                    message: message || "Minecraft se ha cerrado"
                });

                // Unminima la ventana de la aplicación
                const window = getCurrentWindow();
                window.unminimize();
                window.setFocus();

                if (exitCode !== 0) {
                    const wasArmoredKill = (Date.now() - (armoredViolationRef.current.get(id) ?? 0)) < 60_000;
                    if (wasArmoredKill) {
                        armoredViolationRef.current.delete(id);
                    } else {
                    const errorDesc = (possibleErrorCode === "GENERIC_ERROR" || possibleErrorCode === "UNKNOWN_ERROR")
                        ? `Esto puede ser causado por un error en la configuración de la instancia o un problema con tu instalación de Java.`
                        : `Código de error: ${exitCode}`;
                    toast.error(`La instancia "${instanceName}" se ha cerrado con el código de error ${exitCode}`, {
                        duration: 10000,
                        description: errorDesc,
                    });
                    playSound("ERROR_NOTIFICATION")
                    trackEvent("instance_crash", {
                        instanceId: id,
                        message: message || "Minecraft se ha cerrado inesperadamente",
                        exitCode,
                        data,
                    });

                    document.dispatchEvent(
                        new CustomEvent("instance-crash", {
                            detail: {
                                instanceId: id,
                                message: message || "Minecraft se ha cerrado inesperadamente",
                                data,
                                exitCode,
                            }
                        })
                    );
                    }
                }

                // Opcional: quitar la instancia después de un tiempo
                setTimeout(() => removeInstance(id), 5000);
            });
            unlistenList.push(exitedUnlisten);

            // Evento para cuando una instancia blindada detecta una modificación no autorizada.
            // Marca la instancia para suprimir el diálogo genérico de crash (el kill
            // forzado también genera un instance-exited con código != 0) y reenvía
            // el evento al DOM para que la vista prelaunch muestre el modal específico.
            const armoredViolationUnlisten = await listen("instance-armored-violation", (e: any) => {
                const { id, name, message, data } = e.payload;
                armoredViolationRef.current.set(id, Date.now());
                cancelPendingUpdates(id);

                trackEvent("instance_armored_violation", {
                    instanceId: id,
                    message: message || "Modificación no autorizada en instancia blindada",
                });

                playSound("ERROR_NOTIFICATION");
                toast.error(`La instancia blindada "${name || id}" se ha cerrado forzosamente`, {
                    duration: 10000,
                    description: "Esta instancia está blindada y no se permiten modificaciones no autorizadas.",
                });

                document.dispatchEvent(
                    new CustomEvent("instance-armored-violation", {
                        detail: {
                            instanceId: id,
                            message: message || "Esta instancia está blindada y no se permiten modificaciones no autorizadas.",
                            data,
                        }
                    })
                );
            });
            unlistenList.push(armoredViolationUnlisten);

            // Evento para cuando se bloquea una salida total del launcher
            // (o se omite closeOnLaunch) porque hay una instancia blindada
            // en ejecución que necesita el watcher vivo.
            const armoredExitBlockedUnlisten = await listen("instance-armored-exit-blocked", (e: any) => {
                const { message } = e.payload ?? {};
                playSound("INFO_NOTIFICATION");
                toast.warning("Salida bloqueada: instancia blindada en ejecución", {
                    duration: 8000,
                    description: message || "El launcher seguirá en segundo plano para protegerla.",
                });
            });
            unlistenList.push(armoredExitBlockedUnlisten);

            // Evento para cuando hay un error en la instancia
            const errorUnlisten = await listen("instance-error", (e: any) => {
                const { id, message } = e.payload;
                cancelPendingUpdates(id);
                trackEvent("instance_error", {
                    instanceId: id,
                    message: message || "Error al iniciar la instancia"
                });

                updateInstance(id, {
                    status: "error",
                    message: message || "Ha ocurrido un error"
                });

                const instance = instancesRef.current.find(inst => inst.id === id);

                toast.error(`Error al iniciar la instancia "${instance?.name || id}"`, {
                    duration: 10000,
                    description: message || "Revisa los logs para más detalles.",
                });

                playSound("ERROR_NOTIFICATION");

                // Unminima la ventana de la aplicación
                const window = getCurrentWindow();
                window.unminimize();
                window.setFocus();
            });
            unlistenList.push(errorUnlisten);

            // New stage-based event listeners
            const downloadingLibrariesUnlisten = await listen("instance-downloading-libraries", (e: any) => {
                const { id, message, stage } = e.payload as StageEventPayload;
                throttledUpdate(id, "downloading-libraries", {
                    status: "downloading-assets",
                    message: message || "Descargando librerías...",
                    stage
                });
            });
            unlistenList.push(downloadingLibrariesUnlisten);

            const extractingNativesUnlisten = await listen("instance-extracting-natives-progress", (e: any) => {
                const { id, message, stage } = e.payload as StageEventPayload;
                throttledUpdate(id, "extracting-natives", {
                    status: "downloading-assets",
                    message: message || "Extrayendo librerías...",
                    stage
                });
            });
            unlistenList.push(extractingNativesUnlisten);

            const installingForgeUnlisten = await listen("instance-installing-forge", (e: any) => {
                const { id, message, stage } = e.payload as StageEventPayload;
                console.log("Installing Forge event:", { id, message, stage });

                updateInstance(id, {
                    status: "downloading-assets",
                    message: message || "Instalando Forge...",
                    stage
                });
            });
            unlistenList.push(installingForgeUnlisten);

            // Update the existing downloading assets listener to handle stages
            const downloadingAssetsStageUnlisten = await listen("instance-downloading-assets", (e: any) => {
                const { id, message, stage } = e.payload as StageEventPayload;
                throttledUpdate(id, "downloading-assets", {
                    status: "downloading-assets",
                    message: message || "Validando assets...",
                    stage
                });
            });
            unlistenList.push(downloadingAssetsStageUnlisten);

            // Listener for downloading Forge libraries with stage information
            const downloadingForgeUnlisten = await listen("instance-downloading-forge", (e: any) => {
                const { id, message, stage } = e.payload as StageEventPayload;
                throttledUpdate(id, "downloading-forge", {
                    status: "downloading-assets",
                    message: message || "Descargando librerías de Forge...",
                    stage
                });
            });
            unlistenList.push(downloadingForgeUnlisten);

            // Listener for downloading modpack files with stage information
            const downloadingModpackFilesUnlisten = await listen("instance-downloading-modpack-files", (e: any) => {
                const { id, message, stage } = e.payload as StageEventPayload;
                throttledUpdate(id, "downloading-modpack-files", {
                    status: "downloading-assets",
                    message: message || "Descargando archivos del modpack...",
                    stage,
                });
            });
            unlistenList.push(downloadingModpackFilesUnlisten);

            // Listeners for bootstrap completion so UI doesn't stay stuck in a stage like "Instalando Forge..."


            const instanceBootstrappedUnlisten = await listen("instance-bootstrapped", (e: any) => {
                const { id, message } = e.payload;
                cancelPendingUpdates(id);
                updateInstance(id, {
                    status: "idle",
                    message: message || "Instancia instalada correctamente",
                    stage: undefined
                });
            });
            unlistenList.push(instanceBootstrappedUnlisten);
        };

        setupListeners();
        return () => unlistenList.forEach(unlisten => unlisten());
    }, []); // Sin dependencias para evitar problemas de recreación

    const value = useMemo(() => ({ instances }), [instances]);

    return (
        <InstancesContext.Provider value={value}>
            {children}
        </InstancesContext.Provider>
    );
};

export const useInstances = () => useContext(InstancesContext);