import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

export type TaskStatus = "Pending" | "Running" | "Completed" | "Failed" | "Cancelled";

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
    
    // Filtrar tareas en "Running" y que tengan un instanceId en su data, y solo devolver un array de id de instancia
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
                // Update existing task - merge only defined fields
                const existingTask = newTasks[idx];
                newTasks[idx] = {
                    ...existingTask,
                    ...taskUpdate,
                    // Ensure progress is within bounds
                    progress: Math.max(0, Math.min(100, taskUpdate.progress))
                };
                console.log(`Updated task: ${taskUpdate.id}`, newTasks[idx]);
            } else {
                // Add new task
                newTasks.push({
                    ...taskUpdate,
                    progress: Math.max(0, Math.min(100, taskUpdate.progress))
                });
                console.log(`Added new task: ${taskUpdate.id}`, taskUpdate);
            }
            
            return newTasks;
        });
    }, []);

    // Function to sync tasks from backend
    const syncTasks = useCallback(async (): Promise<void> => {
        try {
            console.log("Syncing tasks from backend...");
            const backendTasks: TaskInfo[] = await invoke("get_all_tasks_command");
            
            if (Array.isArray(backendTasks)) {
                const validTasks = backendTasks.filter(validateTaskInfo);
                if (validTasks.length !== backendTasks.length) {
                    console.warn(`Filtered out ${backendTasks.length - validTasks.length} invalid tasks`);
                }
                
                setTasks(validTasks);
                setLastSyncTime(Date.now());
                console.log(`Synced ${validTasks.length} tasks from backend`);
            } else {
                console.error("Invalid tasks data received from backend:", backendTasks);
            }
        } catch (error) {
            console.error("Failed to sync tasks from backend:", error);
        }
    }, []);

    // Función para verificar si un modpack está siendo instalado
    const isModpackInstalling = useCallback((modpackId: string) => {
        const result = tasks.some(
            (task) =>
                task.status === "Running" &&
                (task.data?.type === "modpack_instance_creation" || task.data?.type === "modpack_update") &&
                task.data?.modpackId === modpackId
        );
        console.log("isModpackInstalling check for", modpackId, "result:", result, "tasks:", tasks.filter(t => t.status === "Running"));
        return result;
    }, [tasks]);

    useEffect(() => {
        let mounted = true;
        
        // Initial sync when component mounts
        syncTasks();
        
        // Set up event listeners with better error handling
        const setupListeners = async () => {
            try {
                const unlisten1 = await listen<TaskInfo>("task-created", (event) => {
                    if (!mounted) return;
                    console.log("Nueva tarea creada:", event.payload);
                    updateTaskSafely(event.payload);
                });

                const unlisten2 = await listen<TaskInfo>("task-updated", (event) => {
                    if (!mounted) return;
                    console.log("Tarea actualizada:", event.payload);
                    updateTaskSafely(event.payload);
                });

                const unlisten3 = await listen<string>("task-removed", (event) => {
                    if (!mounted) return;
                    console.log("Tarea removida:", event.payload);
                    setTasks((prev) => prev.filter((task) => task.id !== event.payload));
                });

                unlistenRef.current = [unlisten1, unlisten2, unlisten3];
            } catch (error) {
                console.error("Failed to set up task event listeners:", error);
            }
        };

        setupListeners();

        // Set up periodic sync to prevent desynchronization
        const syncInterval = setInterval(() => {
            if (mounted) {
                const timeSinceLastSync = Date.now() - lastSyncTime;
                // Sync every 30 seconds if there are running tasks, or every 5 minutes otherwise
                const syncIntervalMs = hasRunningTasks ? 30000 : 300000;
                
                if (timeSinceLastSync >= syncIntervalMs) {
                    console.log("Periodic task sync triggered");
                    syncTasks();
                }
            }
        }, 10000); // Check every 10 seconds

        return () => {
            mounted = false;
            clearInterval(syncInterval);
            
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
    }, [syncTasks, updateTaskSafely, lastSyncTime, hasRunningTasks]);

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
