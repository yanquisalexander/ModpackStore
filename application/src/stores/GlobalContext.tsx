import { LucideIcon, LucideShoppingBag } from "lucide-react";
import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useMemo,
    useCallback,
    useRef,
} from "react";
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from '@tauri-apps/api/app';
import { useNotifications } from "@/hooks/useNotifications";



interface TitleBarState {
    title: string;
    icon?: string | LucideIcon | React.FC<React.SVGProps<SVGSVGElement>>;
    canGoBack?: boolean | {
        history: boolean;
    }
    customIconClassName?: string;
    opaque?: boolean;
    leftSlot?: React.ReactNode;
    centerSlot?: React.ReactNode;
    rightSlot?: React.ReactNode;
}

// Estado de actualización
type UpdateState =
    | "idle"
    | "checking"
    | "downloading"
    | "ready-to-install"
    | "done"
    | "error";

// Tipo del contexto
interface GlobalContextType {
    titleBarState: TitleBarState;
    setTitleBarState: React.Dispatch<React.SetStateAction<TitleBarState>>;

    isUpdating: boolean;
    updateProgress: number;
    updateVersion: string | null;
    updateState: UpdateState;
    applyUpdate: () => Promise<void>;
}

// Crear el contexto
const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export const GlobalContextProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [titleBarState, setTitleBarState] = useState<TitleBarState>({
        title: "Modpack Store",
        icon: LucideShoppingBag,
        canGoBack: false,
        opaque: true
    });

    const [update, setUpdate] = useState<Update | null>(null); // Aquí puedes definir el tipo de update si lo conoces
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateProgress, setUpdateProgress] = useState(0);
    const [updateVersion, setUpdateVersion] = useState<string | null>(null);
    const [updateState, setUpdateState] = useState<UpdateState>("idle");
    const { notifyCustom } = useNotifications();

    const applyUpdate = useCallback(async () => {
        if (updateState !== "ready-to-install") {
            console.error("No hay actualización lista para instalar.");
            return;
        }
        try {
            const currentVersion = await getVersion();
            await invoke("set_config", { key: "lastUpdatedAt", value: new Date().toISOString() });
            await invoke("set_config", { key: "updatedFrom", value: currentVersion });

            await update?.install(); // Instalar la actualización (This automatically restarts the app)
        } catch (err) {
            console.error("Error al aplicar la actualización:", err);
            setUpdateState("error");
            setIsUpdating(false);
        }
    }, [update, updateState]);


    const isCheckingUpdateRef = useRef(false);

    const checkForUpdates = useCallback(async () => {
        if (isCheckingUpdateRef.current) return;
        isCheckingUpdateRef.current = true;
        try {
            const hasUpdate = await check();
            if (hasUpdate) {
                setUpdate(hasUpdate);
                setIsUpdating(true);
                setUpdateVersion(hasUpdate.version);
                setUpdateState("downloading");
                await hasUpdate.download((event) => {
                    switch (event.event) {
                        case 'Finished':
                            setUpdateState("ready-to-install");
                            break;
                    }
                });
            }
        } catch (err) {
            // Silencioso
        } finally {
            isCheckingUpdateRef.current = false;
        }
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            checkForUpdates();
        }, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [checkForUpdates]);

    useEffect(() => {
        if (updateState === "ready-to-install") {
            notifyCustom({
                title: "Actualización lista",
                body: `La versión ${updateVersion} está lista para instalar. Reinicia la aplicación para aplicar la actualización.`,
                icon: '⬆️',
                sound: true,
                soundVolume: 0.5,
                persistent: true,
                customSound: '/sounds/instance-created.mp3',
            });
        }
    }, [updateState]);

    const value = useMemo(() => ({
        titleBarState,
        setTitleBarState,
        isUpdating,
        updateProgress,
        updateVersion,
        updateState,
        applyUpdate,
    }), [titleBarState, isUpdating, updateProgress, updateVersion, updateState, applyUpdate]);

    return (
        <GlobalContext.Provider value={value}>
            {children}
        </GlobalContext.Provider>
    );
};

// Hook para consumir el contexto
export const useGlobalContext = () => {
    const context = useContext(GlobalContext);
    if (!context) {
        throw new Error("useGlobalContext must be used within a GlobalContextProvider");
    }
    return context;
};
