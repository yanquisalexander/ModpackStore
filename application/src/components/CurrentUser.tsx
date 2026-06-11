import { useAuthentication } from "@/stores/AuthContext";
import {
    LucideAppWindowMac,
    LucideLogOut,
    LucidePackageOpen,
    LucideSettings2,
    LucideUser,
    LucideShieldCheck,
    LucideSparkles,
    LucideLayoutDashboard
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useConfigDialog } from "@/stores/ConfigDialogContext";
import { useReloadApp } from "@/stores/ReloadContext";
import { useConnection } from "@/utils/ConnectionContext";
import { CreatorInviteDialog } from "@/components/CreatorInviteDialog";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/utils"; // Asumo que tienes una utilidad cn (clsx + tailwind-merge)

export const CurrentUser = ({ titleBarOpaque }: { titleBarOpaque?: boolean }) => {
    const { session, logout, isAuthenticated } = useAuthentication();
    const { isConnected } = useConnection();
    const { openConfigDialog } = useConfigDialog();
    const { showReloadDialog } = useReloadApp();
    const { t } = useI18n();

    console.log({ session })

    // Estados
    const [openMenu, setOpenMenu] = useState(false);
    const [showMoreOptions, setShowMoreOptions] = useState(false);
    const [isCreatorDialogOpen, setIsCreatorDialogOpen] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);

    // Permisos y Roles
    const isCreator = session?.creatorMemberships && session.creatorMemberships.length > 0;
    const isAdmin = session?.hasRole?.("admin") || session?.hasRole?.("super_admin");
    const isBanned = session?.isBanned;

    // Handlers
    const toggleMenu = (event: React.MouseEvent) => {
        const isOpening = !openMenu;
        setOpenMenu(isOpening);

        // Easter egg: Shift + Click para opciones avanzadas
        if (isOpening && event.shiftKey) {
            setShowMoreOptions(true);
        } else if (!isOpening) {
            setShowMoreOptions(false); // Reset al cerrar
        }
    };

    const closeMenu = () => {
        setOpenMenu(false);
        setShowMoreOptions(false);
    };

    const handleAction = (action: () => void) => {
        closeMenu();
        action();
    };

    // Click Outside Listener
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                closeMenu();
            }
        };

        if (openMenu) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [openMenu]);

    if (!isAuthenticated || !session || isBanned) return null;

    return (
        <div className="relative h-full flex items-center" ref={containerRef}>

            {/* --- TRIGGER BUTTON --- */}
            <div
                onClick={toggleMenu}
                className={cn(
                    "flex items-center gap-3 px-3 py-1.5 rounded-md cursor-pointer transition-all duration-200 select-none group",
                    // Estilos base
                    "hover:bg-white/10 active:scale-95",
                    // Condicional según opacidad del header (si aplica)
                    titleBarOpaque ? "text-white" : "text-white/90 hover:text-white"
                )}
                title={t('user.currentUser')}
            >
                {/* Avatar con Badge de Rol */}
                <div className="relative">
                    <img
                        draggable={false}
                        src={session.avatarUrl}
                        alt={session.username}
                        className="size-6 rounded-md object-cover ring-1 ring-white/10 group-hover:ring-white/30 transition-all"
                    />

                </div>

                <span className="text-sm font-medium max-w-[100px] truncate hidden sm:block">
                    {session.username}
                </span>
            </div>

            {/* --- DROPDOWN MENU --- */}
            <div
                className={cn(
                    "absolute top-full right-2 mt-2 w-64 origin-top-right",
                    "bg-[#121217]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden",
                    "transition-all duration-200 ease-out",
                    openMenu
                        ? "opacity-100 translate-y-0 scale-100 visible"
                        : "opacity-0 -translate-y-2 scale-95 invisible pointer-events-none"
                )}
            >
                {/* Header del Menú (UserInfo) */}
                <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                    <p className="text-sm font-bold text-white truncate">{session.username}</p>
                    <p className="text-xs text-white/50 truncate font-mono mt-0.5">{session.email || "Usuario"}</p>
                </div>

                <div className="p-1.5 space-y-0.5">

                    {/* SECCIÓN 1: PERSONAL */}
                    <Link
                        to="/profile"
                        onClick={closeMenu}
                        className="flex items-center gap-3 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors group"
                    >
                        <LucideUser size={16} className="text-white/50 group-hover:text-white transition-colors" />
                        {t('user.viewProfile')}
                    </Link>

                    <button
                        onClick={() => handleAction(openConfigDialog)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors group text-left"
                    >
                        <LucideSettings2 size={16} className="text-white/50 group-hover:text-white transition-colors" />
                        {t('user.settings')}
                    </button>

                    {/* SECCIÓN 2: ROLES ESPECIALES */}
                    {(isCreator || isAdmin) && (
                        <>
                            <div className="h-px bg-white/5 my-1.5 mx-2" />

                            {isCreator && (
                                <Link
                                    to="/creators"
                                    onClick={closeMenu}
                                    className="flex items-center gap-3 px-3 py-2 text-sm text-purple-200 hover:text-white hover:bg-purple-500/20 rounded-lg transition-colors"
                                >
                                    <LucideLayoutDashboard size={16} className="text-purple-400" />
                                    {t('user.creatorsCenter')}
                                </Link>
                            )}

                            {isAdmin && (
                                <Link
                                    to="/admin"
                                    onClick={closeMenu}
                                    className="flex items-center gap-3 px-3 py-2 text-sm text-red-200 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors"
                                >
                                    <LucideShieldCheck size={16} className="text-red-400" />
                                    {t('user.adminPanel')}
                                </Link>
                            )}
                        </>
                    )}

                    {/* SECCIÓN 3: OPCIONES AVANZADAS (Shift) */}
                    {showMoreOptions && (
                        <>
                            <div className="h-px bg-white/5 my-1.5 mx-2" />
                            <div className="px-2 py-1 text-[10px] uppercase font-bold text-white/20 tracking-wider">Debug</div>
                            <button
                                onClick={() => handleAction(() => showReloadDialog({ fromOffline: !isConnected }))}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-yellow-200 hover:text-white hover:bg-yellow-500/20 rounded-lg transition-colors text-left"
                            >
                                <LucideAppWindowMac size={16} className="text-yellow-400" />
                                {t('user.reloadApp')}
                            </button>
                        </>
                    )}

                    <div className="h-px bg-white/5 my-1.5 mx-2" />

                    {/* SECCIÓN 4: ACCIONES FINALES */}
                    {!isCreator && (
                        <button
                            onClick={() => handleAction(() => setIsCreatorDialogOpen(true))}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-lg transition-all group text-left mb-1"
                        >
                            <LucideSparkles size={16} className="text-indigo-400 group-hover:text-indigo-300" />
                            {t('user.becomeCreator')}
                        </button>
                    )}

                    <button
                        onClick={() => handleAction(logout)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-300/80 hover:text-red-200 hover:bg-red-500/10 rounded-lg transition-colors text-left"
                    >
                        <LucideLogOut size={16} />
                        {t('user.logout')}
                    </button>

                </div>
            </div>

            {/* Dialogo Externo */}
            <CreatorInviteDialog
                isOpen={isCreatorDialogOpen}
                onClose={() => setIsCreatorDialogOpen(false)}
            />

        </div>
    );
};