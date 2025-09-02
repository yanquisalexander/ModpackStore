import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

export type TaskStatus = "Pending" | "Running" | "Completed" | "Failed" | "Cancelled";

export type BootstrapStep =
    | "CreatingDirectories"
    | "DownloadingManifest"
    | "DownloadingVersionJson"
    | "DownloadingClientJar"
    | "CheckingJavaVersion"
    | "InstallingJava"
    | "DownloadingLibraries"
    | "ValidatingAssets"
    | "ExtractingNatives"
    | "DownloadingForgeInstaller"
    | "RunningForgeInstaller"
    | "CreatingLauncherProfiles";

export type ErrorCategory = "Network" | "Filesystem" | "Java" | "Forge" | "Configuration" | "Other";

export type BootstrapError = {
    step: BootstrapStep;
    category: ErrorCategory;
    message: string;
    suggestion?: string;
    technical_details?: string;
};

export type TaskInfo = {
    id: string;
    label: string;
    status: TaskStatus;
    progress: number;
    message: string;
    data?: any;
    created_at?: string;
};

type TaskContextType = {
    tasks: TaskInfo[];
    setTasks: React.Dispatch<React.SetStateAction<TaskInfo[]>>;
    hasRunningTasks: boolean;
    taskCount: number;
    instancesBootstraping: string[]; // Array de instanceId de tareas en "Running"
    isModpackInstalling: (modpackId: string) => boolean;
    syncTasks: () => Promise<void>;
    lastSyncTime: number;
};

const TasksContext = createContext<TaskContextType | undefined>(undefined);

export const TasksProvider = ({ children }: { children: React.ReactNode }) => {
    const [tasks, setTasks] = useState<TaskInfo[]>([]);
    const [lastSyncTime, setLastSyncTime] = useState<number>(0);
    const unlistenRef = useRef<UnlistenFn[]>([]);

    const hasRunningTasks = tasks.some((task) => task.status === "Running");
    const taskCount = tasks.length;

    const instancesBootstraping = tasks.filter(
        (task) => task.status === "Running" && task.data?.instanceId
    ).map((task) => task.data.instanceId);

    // Helper function to validate task data
    const validateTaskInfo = (task: any): task is TaskInfo => {
        return (
            typeof task === 'object' &&
            task !== null &&
            typeof task.id === 'string' &&
            typeof task.label === 'string' &&
            typeof task.status === 'string' &&
            typeof task.progress === 'number' &&
            typeof task.message === 'string' &&
            ['Pending', 'Running', 'Completed', 'Failed', 'Cancelled'].includes(task.status)
        );
    };

    // Safe state update function that validates task data
    const updateTaskSafely = useCallback((taskUpdate: TaskInfo) => {
        if (!validateTaskInfo(taskUpdate)) {
            console.error("Invalid task data received:", taskUpdate);
            return;
        }

        setTasks((prev) => {
            const newTasks = [...prev];
            const idx = newTasks.findIndex((t) => t.id === taskUpdate.id);

            if (idx !== -1) {
                const existingTask = newTasks[idx];
                newTasks[idx] = {
                    ...existingTask,
                    ...taskUpdate,
                    progress: Math.max(0, Math.min(100, taskUpdate.progress))
                };
            } else {
                newTasks.push({
                    ...taskUpdate,
                    progress: Math.max(0, Math.min(100, taskUpdate.progress))
                });
            }

            return newTasks;
        });
    }, []);

    // Function to sync tasks from backend
    const syncTasks = useCallback(async (): Promise<void> => {
        try {
            const backendTasks: TaskInfo[] = await invoke("get_all_tasks_command");

            if (Array.isArray(backendTasks)) {
                const validTasks = backendTasks.filter(validateTaskInfo);
                if (validTasks.length !== backendTasks.length) {
                    console.warn(`Filtered out ${backendTasks.length - validTasks.length} invalid tasks`);
                }

                setTasks(validTasks);
                setLastSyncTime(Date.now());
            } else {
                console.error("Invalid tasks data received from backend:", backendTasks);
            }
        } catch (error) {
            console.error("Failed to sync tasks from backend:", error);
            try {
                const resyncSuccess = await invoke("resync_tasks_command");
                if (resyncSuccess) {
                    console.log("Backend resync triggered successfully");
                } else {
                    console.warn("Backend resync failed");
                }
            } catch (resyncError) {
                console.error("Failed to trigger backend resync:", resyncError);
            }
        }
    }, []);

    const isModpackInstalling = useCallback((modpackId: string) => {
        return tasks.some(
            (task) =>
                task.status === "Running" &&
                (task.data?.type === "modpack_instance_creation" || task.data?.type === "modpack_update") &&
                task.data?.modpackId === modpackId
        );
    }, [tasks]);

    const displayBootstrapError = useCallback((error: BootstrapError, instanceName: string) => {
        const stepMessages: Record<BootstrapStep, string> = {
            CreatingDirectories: "creando directorios",
            DownloadingManifest: "descargando manifiesto de versión",
            DownloadingVersionJson: "descargando configuración de versión",
            DownloadingClientJar: "descargando cliente de Minecraft",
            CheckingJavaVersion: "verificando versión de Java",
            InstallingJava: "instalando Java",
            DownloadingLibraries: "descargando librerías",
            ValidatingAssets: "validando assets",
            ExtractingNatives: "extrayendo librerías nativas",
            DownloadingForgeInstaller: "descargando instalador de Forge",
            RunningForgeInstaller: "ejecutando instalador de Forge",
            CreatingLauncherProfiles: "creando perfiles del launcher"
        };

        const stepName = stepMessages[error.step] || "realizando operación";
        const title = `Error ${stepName} en "${instanceName}"`;

        let description = error.message;
        if (error.suggestion) {
            description += `\n\nSugerencia: ${error.suggestion}`;
        }

        toast.error(title, {
            description,
            duration: 10000,
            action: error.technical_details ? {
                label: "Ver detalles",
                onClick: () => toast.info("Detalles técnicos", {
                    description: error.technical_details,
                    duration: 15000
                })
            } : undefined
        });
    }, []);
    
    // Refs to hold the latest values of state without causing effect to re-run
    const lastSyncTimeRef = useRef(lastSyncTime);
    lastSyncTimeRef.current = lastSyncTime;

    const hasRunningTasksRef = useRef(hasRunningTasks);
    hasRunningTasksRef.current = hasRunningTasks;

    useEffect(() => {
        let mounted = true;

        // Initial sync when component mounts
        syncTasks();

        // Set up event listeners
        const setupListeners = async () => {
            try {
                const unlisten1 = await listen<TaskInfo>("task-created", (event) => {
                    if (!mounted) return;
                    updateTaskSafely(event.payload);
                });

                const unlisten2 = await listen<TaskInfo>("task-updated", (event) => {
                    if (!mounted) return;
                    updateTaskSafely(event.payload);
                });

                const unlisten3 = await listen<string>("task-removed", (event) => {
                    if (!mounted) return;
                    setTasks((prev) => prev.filter((task) => task.id !== event.payload));
                });

                const unlisten4 = await listen<any>("bootstrap-error", (event) => {
                    if (!mounted) return;
                    const { name: instanceName, error } = event.payload;
                    if (error && instanceName) {
                        displayBootstrapError(error, instanceName);
                    }
                });

                unlistenRef.current = [unlisten1, unlisten2, unlisten3, unlisten4];
            } catch (error) {
                console.error("Failed to set up task event listeners:", error);
            }
        };

        setupListeners();

        // Set up visibility change handler for sync
        const handleVisibilityChange = () => {
            if (!document.hidden && mounted) {
                console.log("Window became visible, syncing tasks");
                syncTasks();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Set up periodic sync to prevent desynchronization
        const syncInterval = setInterval(() => {
            if (mounted) {
                // Use refs to get current values without re-triggering the effect
                const timeSinceLastSync = Date.now() - lastSyncTimeRef.current;
                const syncIntervalMs = hasRunningTasksRef.current ? 30000 : 300000;

                if (timeSinceLastSync >= syncIntervalMs) {
                    console.log("Periodic task sync triggered");
                    syncTasks();
                }
            }
        }, 10000); // Check every 10 seconds

        return () => {
            mounted = false;
            clearInterval(syncInterval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);

            // Clean up event listeners
            unlistenRef.current.forEach((unlisten) => {
                try {
                    unlisten();
                } catch (error) {
                    console.error("Error cleaning up event listener:", error);
                }
            });
            unlistenRef.current = [];
        };
    // The dependency array is now stable, so this effect runs only on mount
    }, [syncTasks, updateTaskSafely, displayBootstrapError]);

    return (
        <TasksContext.Provider value={{
            tasks,
            setTasks,
            hasRunningTasks,
            taskCount,
            instancesBootstraping,
            isModpackInstalling,
            syncTasks,
            lastSyncTime
        }}>
            {children}
        </TasksContext.Provider>
    );
};

export const useTasksContext = () => {
    const ctx = useContext(TasksContext);
    if (!ctx) throw new Error("useTaskContext must be used within a TaskProvider");
    return ctx;
};