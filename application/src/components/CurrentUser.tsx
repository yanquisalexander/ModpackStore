import { useAuthentication } from "@/stores/AuthContext";
import { LucideAppWindowMac, LucideLogOut, LucidePackageOpen, LucideSettings2, LucideSquareUserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useConfigDialog } from "@/stores/ConfigDialogContext";
import { useReloadApp } from "@/stores/ReloadContext"; // Importar el nuevo hook
import { useConnection } from "@/utils/ConnectionContext";

export const CurrentUser = ({ titleBarOpaque }: { titleBarOpaque?: boolean }) => {
    const { session, logout, isAuthenticated } = useAuthentication();
    const { isConnected } = useConnection();
    const { openConfigDialog } = useConfigDialog();
    const { showReloadDialog } = useReloadApp(); // Usar el hook para acceder a la funcionalidad de recarga
    const [openMenu, setOpenMenu] = useState(false);
    const [showMoreOptions, setShowMoreOptions] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const toggleMenu = (event: React.MouseEvent) => {
        const isOpening = !openMenu;
        setOpenMenu(isOpening);

        // Set showMoreOptions to true if opening menu with shift key pressed
        if (isOpening && event.shiftKey) {
            setShowMoreOptions(true);
        } else if (!isOpening) {
            // Reset showMoreOptions when closing the menu
            setShowMoreOptions(false);
        }
    };

    const closeMenu = () => {
        setOpenMenu(false);
        setShowMoreOptions(false);
    };

    const handleReloadApp = () => {
        closeMenu();
        showReloadDialog({ fromOffline: !isConnected });
    };

    const handleLogout = () => {
        closeMenu();
        logout();
    };

    const handleOpenConfig = () => {
        closeMenu();
        openConfigDialog();
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                closeMenu();
            }
        };

        if (openMenu) {
            document.addEventListener("mousedown", handleClickOutside);
        } else {
            document.removeEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [openMenu]);

    const baseClasses = "flex h-full items-center space-x-3 transition-all px-3 py-1 rounded-md cursor-pointer";
    const lightMode = "hover:bg-white/60 text-neutral-900";
    const darkMode = "hover:bg-neutral-700 text-white";

    if (!isAuthenticated) return null;

    /* publisherMemberships: [
  {
    "createdAt": "2025-05-25T01:49:47.057Z",
    "id": 2,
    "permissions": {},
    "publisherId": "ccbe46fd-2848-4224-b29e-11df619ce999",
    "role": "super_admin",
    "updatedAt": "2025-05-25T01:49:47.057Z",
    "userId": "654c7a18-6a30-48e2-a7ec-c396af0641cd"
  }
] */



    const isPublisher = session?.publisherMemberships && session.publisherMemberships.length > 0;


    if (!session) return null;

    return (
        <div className="relative" ref={containerRef}>
            <div
                onClick={toggleMenu}
                className={`${baseClasses} ${titleBarOpaque ? darkMode : lightMode}`}
                title="Usuario actual"
            >
                <img src={session?.avatarUrl} alt="Avatar" className="size-5 rounded-md object-cover" />
                <span className="text-sm font-medium whitespace-nowrap">{session?.username}</span>
            </div>

            <div
                style={{
                    opacity: openMenu ? 1 : 0,
                    visibility: openMenu ? "visible" : "hidden",
                    transform: openMenu ? "translateY(0) scale(1)" : "translateY(-6px) scale(0.98)",
                    transition: "opacity 160ms ease, visibility 160ms ease, transform 160ms ease",
                }}
                className="absolute right-0 mt-2 min-w-[220px] max-w-72 w-auto bg-neutral-900/95 backdrop-blur-sm border border-neutral-700/60 rounded-lg shadow-2xl z-50 p-3">
                {/* decorative caret */}
                <div className="absolute -top-2 right-4 w-3 h-3 rotate-45 bg-neutral-900/95 border-t border-l border-neutral-700/60"></div>
                <ul className="text-sm text-white flex flex-col gap-1">
                    <Link
                        to="/profile"
                        onClick={closeMenu}
                        className="w-full flex gap-x-3 items-center py-2 px-2 hover:bg-neutral-800/60 rounded whitespace-nowrap font-medium"
                    >
                        <LucideSquareUserRound size={16} />
                        Ver perfil
                    </Link>

                    <button
                        onClick={handleOpenConfig}
                        className="w-full flex gap-x-3 items-center py-2 px-2 hover:bg-neutral-800/60 rounded text-left cursor-pointer whitespace-nowrap font-medium"
                    >
                        <LucideSettings2 size={16} />
                        Configuración
                    </button>

                    {isPublisher && (
                        <Link
                            to="/creators"
                            onClick={closeMenu}
                            className="w-full flex gap-x-3 items-center py-2 px-2 hover:bg-neutral-800/60 rounded whitespace-nowrap font-medium"
                        >
                            <LucidePackageOpen size={16} />
                            Centro de creadores
                        </Link>
                    )}


                    {(session.hasRole?.("admin") || session.hasRole?.("superadmin")) && (
                        <Link
                            to="/admin"
                            onClick={closeMenu}
                            className="w-full shrink-0 flex gap-x-3 items-center py-2 px-2 hover:bg-neutral-800/60 rounded whitespace-nowrap font-medium"
                        >
                            <LucideSettings2 size={16} />
                            Panel de administración
                        </Link>
                    )}

                    <button
                        onClick={handleLogout}
                        className="w-full flex gap-x-3 items-center py-2 px-2 hover:bg-red-600/30 rounded text-left cursor-pointer whitespace-nowrap font-medium text-red-100"
                    >
                        <LucideLogOut size={16} />
                        Cerrar sesión
                    </button>

                    {/* Conditional rendering based on showMoreOptions */}
                    {showMoreOptions && (
                        <>
                            <div className="border-t border-neutral-700 my-1"></div>
                            {/* Additional options here when shift is pressed */}
                            <button
                                onClick={handleReloadApp}
                                className="cursor-pointer w-full flex gap-x-2 items-center py-1 px-2 hover:bg-neutral-800 rounded whitespace-nowrap"
                            >
                                <LucideAppWindowMac size={16} />
                                Recargar aplicación
                            </button>
                        </>
                    )}
                </ul>
            </div>
        </div>
    );
};