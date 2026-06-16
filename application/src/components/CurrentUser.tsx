import { useAuthentication } from "@/stores/AuthContext";
import {
    LucideAppWindowMac,
    LucideLogOut,
    LucideSettings2,
    LucideUser,
    LucideShieldCheck,
    LucideSparkles,
    LucideLayoutDashboard,
    LucideChevronDown
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useConfigDialog } from "@/stores/ConfigDialogContext";
import { useReloadApp } from "@/stores/ReloadContext";
import { useConnection } from "@/utils/ConnectionContext";
import { CreatorInviteDialog } from "@/components/CreatorInviteDialog";
import { useI18n } from "@/hooks/useI18n";

export const CurrentUser = ({ titleBarOpaque }: { titleBarOpaque?: boolean }) => {
    const { session, logout, isAuthenticated } = useAuthentication();
    const { isConnected } = useConnection();
    const { openConfigDialog } = useConfigDialog();
    const { showReloadDialog } = useReloadApp();
    const { t } = useI18n();

    const [openMenu, setOpenMenu] = useState(false);
    const [showMoreOptions, setShowMoreOptions] = useState(false);
    const [isCreatorDialogOpen, setIsCreatorDialogOpen] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);

    const isCreator = session?.creatorMemberships && session.creatorMemberships.length > 0;
    const isAdmin = session?.hasRole?.("admin") || session?.hasRole?.("super_admin");
    const isBanned = session?.isBanned;

    const toggleMenu = (event: React.MouseEvent) => {
        const isOpening = !openMenu;
        setOpenMenu(isOpening);
        if (isOpening && event.shiftKey) {
            setShowMoreOptions(true);
        } else if (!isOpening) {
            setShowMoreOptions(false);
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

            <button
                onClick={toggleMenu}
                className="cursor-pointer flex items-center gap-2 h-9 px-3 hover:bg-neutral-800"
                title={t('user.currentUser')}
            >
                <img
                    draggable={false}
                    src={session.avatarUrl}
                    alt={session.username}
                    className="size-5 rounded-sm object-cover flex-shrink-0"
                />
                <span className="text-sm font-medium text-white/80 max-w-[100px] truncate hidden sm:block">
                    {session.username}
                </span>
            </button>

            <div
                className={`
                    absolute top-full right-2 mt-1 w-64 origin-top-right
                    bg-[#121214] border border-white/[0.06] rounded-lg
                    transition-all duration-150 ease-out
                    ${openMenu
                        ? "opacity-100 translate-y-0 scale-100 visible"
                        : "opacity-0 -translate-y-2 scale-95 invisible pointer-events-none"
                    }
                `}
            >
                <div className="px-3 py-2.5 border-b border-white/[0.04]">
                    <p className="text-sm font-semibold text-white/90 truncate">{session.username}</p>
                    <p className="text-[11px] text-neutral-600 truncate mt-0.5">{session.email || "Usuario"}</p>
                </div>

                <div className="p-1 space-y-0.5">

                    <Link
                        to="/profile"
                        onClick={closeMenu}
                        className="flex items-center gap-2.5 px-2.5 py-1.5 text-sm text-neutral-400 hover:text-white hover:bg-white/[0.04] rounded-md transition-colors"
                    >
                        <LucideUser size={15} />
                        {t('user.viewProfile')}
                    </Link>

                    <button
                        onClick={() => handleAction(openConfigDialog)}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-sm text-neutral-400 hover:text-white hover:bg-white/[0.04] rounded-md transition-colors text-left"
                    >
                        <LucideSettings2 size={15} />
                        {t('user.settings')}
                    </button>

                    {(isCreator || isAdmin) && (
                        <>
                            <div className="h-px bg-white/[0.04] my-1 mx-2" />

                            {isCreator && (
                                <Link
                                    to="/creators"
                                    onClick={closeMenu}
                                    className="flex items-center gap-2.5 px-2.5 py-1.5 text-sm text-neutral-400 hover:text-white hover:bg-white/[0.04] rounded-md transition-colors"
                                >
                                    <LucideLayoutDashboard size={15} />
                                    {t('user.creatorsCenter')}
                                </Link>
                            )}

                            {isAdmin && (
                                <Link
                                    to="/admin"
                                    onClick={closeMenu}
                                    className="flex items-center gap-2.5 px-2.5 py-1.5 text-sm text-neutral-400 hover:text-white hover:bg-white/[0.04] rounded-md transition-colors"
                                >
                                    <LucideShieldCheck size={15} />
                                    {t('user.adminPanel')}
                                </Link>
                            )}
                        </>
                    )}

                    {showMoreOptions && (
                        <>
                            <div className="h-px bg-white/[0.04] my-1 mx-2" />
                            <div className="px-2.5 py-1 text-[10px] font-semibold text-neutral-600 tracking-wider">Debug</div>
                            <button
                                onClick={() => handleAction(() => showReloadDialog({ fromOffline: !isConnected }))}
                                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-sm text-neutral-400 hover:text-white hover:bg-white/[0.04] rounded-md transition-colors text-left"
                            >
                                <LucideAppWindowMac size={15} />
                                {t('user.reloadApp')}
                            </button>
                        </>
                    )}

                    <div className="h-px bg-white/[0.04] my-1 mx-2" />

                    {!isCreator && (
                        <button
                            onClick={() => handleAction(() => setIsCreatorDialogOpen(true))}
                            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-sm text-neutral-400 hover:text-white hover:bg-white/[0.04] rounded-md transition-colors text-left"
                        >
                            <LucideSparkles size={15} />
                            {t('user.becomeCreator')}
                        </button>
                    )}

                    <button
                        onClick={() => handleAction(logout)}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-sm text-red-400/70 hover:text-red-300 hover:bg-white/[0.04] rounded-md transition-colors text-left"
                    >
                        <LucideLogOut size={15} />
                        {t('user.logout')}
                    </button>

                </div>
            </div>

            <CreatorInviteDialog
                isOpen={isCreatorDialogOpen}
                onClose={() => setIsCreatorDialogOpen(false)}
            />

        </div>
    );
};
