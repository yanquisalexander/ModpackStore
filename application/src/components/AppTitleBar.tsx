import { LucideArrowLeft, LucideWifiOff } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { getCurrentWindow, Window } from '@tauri-apps/api/window';
import { useGlobalContext } from "../stores/GlobalContext";
import { useNavigate } from "react-router-dom";
import { exit } from '@tauri-apps/plugin-process';
import { CurrentUser } from "./CurrentUser";
import { RunningInstances } from "./RunningInstances";
import { RunningTasks } from "./RunningTasks";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { useConnection } from "@/utils/ConnectionContext";
import { useReloadApp } from "@/stores/ReloadContext";
import { WindowControls } from "./appbar/WindowControls";
import { UpdateButton } from "./appbar/UpdateButton";
import { PatreonButton } from "./appbar/PatreonButton";
import { NativeContextMenu } from "./appbar/ContextMenu";
import { SocialButton } from '@/components/social/SocialButton';

export const AppTitleBar = () => {
    const [window, setWindow] = useState<Window | null>(null);
    const [isMaximized, setIsMaximized] = useState<boolean | undefined>(undefined);
    const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
    const { titleBarState, updateState, applyUpdate } = useGlobalContext();
    const { isLoading: isLoadingConnectionCheck, isConnected } = useConnection();
    const { showReloadDialog } = useReloadApp();
    const contextMenuTriggerRef = useRef<HTMLDivElement>(null);
    const navigateRouter = useNavigate();

    useEffect(() => {
        const initWindow = async () => {
            const currentWindow = await getCurrentWindow();
            setWindow(currentWindow);
        };

        initWindow().catch(error => {
            console.error("Error initializing window:", error);
        });
    }, []);

    useEffect(() => {
        const handleResize = async () => {
            const maximized = await window?.isMaximized();
            setIsMaximized(maximized);
        };

        const cleanup = async () => {
            const unlisten = await window?.onResized(handleResize);
            handleResize();
            return unlisten;
        };

        const unlistenPromise = cleanup();

        return () => {
            unlistenPromise.then(unlisten => {
                if (unlisten) unlisten();
            });
        };
    }, [window]);



    const handleBackClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();

        // CASO 1: Se fuerza el uso del historial del navegador.
        if (typeof titleBarState.canGoBack === 'object' && titleBarState.canGoBack.history) {
            globalThis.window.history.back();
            return;
        }

        // CASO 2: No hay historial y no estamos en la raíz.
        // Se sube un nivel en la ruta (ej: de /a/b/c a /a/b).
        // `window.history.length <= 2` es una forma de detectar que no hay un "atrás" real en la sesión.
        if (globalThis.location.pathname !== '/' && globalThis.window.history.length <= 2) {
            const parentPath = globalThis.location.pathname.substring(0, globalThis.location.pathname.lastIndexOf('/'));
            // Si el resultado es una cadena vacía (porque estábamos en '/algo'), vamos a la raíz.
            navigateRouter(parentPath || '/');
            return;
        }

        // CASO 3: Por defecto, para cualquier otra situación, ir a la raíz.
        navigateRouter("/");
    };

    const handleMaximize = async () => {
        if (isMaximized) {
            await window?.unmaximize();
            setIsMaximized(false);
        } else {
            await window?.maximize();
            setIsMaximized(true);
        }
    };

    const handleClose = () => {
        // Forzar cierre del menú contextual si está abierto
        const evt = new MouseEvent('click', { bubbles: true });
        contextMenuTriggerRef.current?.dispatchEvent(evt);
        setTimeout(() => setIsExitDialogOpen(true), 0);
    };

    const confirmClose = async () => {
        await window?.close();
        exit(0); // Close the application after closing the window
    };

    const handleMinimize = () => {
        window?.minimize();
    };

    const showReloadOnOffline = !isLoadingConnectionCheck && !isConnected;

    const handleReloadAppOffline = () => {
        showReloadDialog({ fromOffline: true });
    }

    return (
        <>
            <NativeContextMenu
                onMinimize={handleMinimize}
                onMaximize={handleMaximize}
                onRestore={handleMaximize}
                onCloseWindow={handleClose}
                isMaximized={!!isMaximized}
            >
                <div
                    ref={contextMenuTriggerRef}
                    data-tauri-drag-region
                    className={`flex z-40 top-0 h-9 transition ease-in-out w-full items-center justify-between sticky text-white select-none ${titleBarState.opaque ? 'bg-ms-primary' : 'bg-transparent'}`}
                >
                    <div className="flex items-center justify-center">
                        <div className="flex items-center gap-2">
                            <a
                                href="/"
                                onClick={handleBackClick}
                                className={`cursor-pointer transition-transform duration-500 flex size-9 aspect-square items-center justify-center hover:bg-neutral-800 ${!titleBarState.canGoBack && '-translate-x-9'}`}
                                aria-label="Back"
                            >
                                <LucideArrowLeft className="h-4 w-4 text-white" />
                            </a>


                            <div
                                data-tauri-drag-region
                                className={`flex gap-x-2 select-none duration-500 items-center justify-center text-white/80 transition ${!titleBarState.canGoBack ? '-translate-x-7' : ''}`}>
                                {
                                    titleBarState.icon && typeof titleBarState.icon === "string" ? (
                                        <img
                                            data-tauri-drag-region
                                            onError={(e) => {
                                                e.currentTarget.onerror = null; // Prevents looping
                                                e.currentTarget.src = "/images/modpack-fallback.webp"; // Fallback icon
                                            }}
                                            src={titleBarState.icon}
                                            className={`size-6 ${titleBarState.customIconClassName}`}
                                            alt="icon"
                                        />
                                    ) : (
                                        titleBarState.icon ? (
                                            <titleBarState.icon
                                                data-tauri-drag-region
                                                className={`size-6 p-0.5 rounded-md border border-solid border-white/10 ${titleBarState.customIconClassName ?? 'bg-pink-500/20'}`} />
                                        ) : null
                                    )
                                }

                                <span className="text-sm font-normal select-none pointer-events-none" data-tauri-drag-region
                                >
                                    {titleBarState.title}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex ml-auto border-r px-1 mr-1 border-white/10" onContextMenu={(e) => {
                        e.preventDefault();
                    }}>
                        {
                            showReloadOnOffline && (
                                <button
                                    onClick={handleReloadAppOffline}
                                    title="Recargar aplicación (offline)"
                                    className="cursor-pointer flex  size-9 aspect-square items-center justify-center hover:bg-neutral-800"
                                    aria-label="Reload"
                                >
                                    <LucideWifiOff className="size-4 text-yellow-400" />
                                </button>
                            )
                        }

                        <UpdateButton updateState={updateState} applyUpdate={applyUpdate} />
                        <SocialButton titleBarOpaque={titleBarState.opaque} />
                        <RunningTasks />
                        <RunningInstances />

                        <PatreonButton />

                        <CurrentUser titleBarOpaque={titleBarState.opaque} />
                    </div>

                    <WindowControls
                        window={window}
                        isMaximized={isMaximized}
                        onMinimize={handleMinimize}
                        onMaximize={handleMaximize}
                        onClose={handleClose}
                    />
                </div>
            </NativeContextMenu>
            <AlertDialog open={isExitDialogOpen} onOpenChange={setIsExitDialogOpen}>
                <AlertDialogContent className="bg-neutral-900 border border-neutral-800 text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription className="text-neutral-400">
                            ¿Realmente quieres cerrar la aplicación?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-neutral-800 hover:bg-neutral-700 text-white border-none">
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmClose}
                            className="bg-red-600 hover:bg-red-700 text-white border-none"
                        >
                            Salir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};