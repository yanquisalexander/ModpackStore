import { LucideLogOut, LucideMessageCircle, LucideShieldAlert } from "lucide-react";
import { useAuthentication } from "@/stores/AuthContext";
import { useNavigate } from "react-router-dom";
import { open } from "@tauri-apps/plugin-shell";

export const BannedScreen: React.FC = () => {
    const { session, logout } = useAuthentication();
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    const handleOpenDiscord = () => {
        open('https://discord.gg/XSRtDgJzzK').catch(console.error);
    };

    const banReason = session?.activeBan?.reason || session?.banReason;
    const banDate = session?.activeBan?.banDate
        ? new Date(session.activeBan.banDate).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
        : null;

    return (
        <div className="h-full flex flex-col items-center justify-center px-4">
            <LucideShieldAlert className="w-10 h-10 text-red-500/70 mb-5" />

            <h1 className="text-base font-semibold text-white/80">
                Cuenta suspendida
            </h1>

            <p className="text-sm text-neutral-600 mt-1 max-w-xs text-center leading-relaxed">
                Tu cuenta ha sido suspendida y no puedes acceder a Modpack Store.
            </p>

            {(banReason || banDate) && (
                <div className="mt-5 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] max-w-xs w-full space-y-1.5">
                    {banReason && (
                        <p className="text-xs text-neutral-500 leading-relaxed">
                            <span className="text-neutral-400">Razón:</span> {banReason}
                        </p>
                    )}
                    {banDate && (
                        <p className="text-xs text-neutral-500">
                            <span className="text-neutral-400">Fecha:</span> {banDate}
                        </p>
                    )}
                </div>
            )}

            <div className="flex items-center gap-3 mt-8">
                <button
                    onClick={handleOpenDiscord}
                    className="flex items-center gap-1.5 bg-white text-black text-sm font-semibold px-4 py-2 rounded-lg hover:bg-white/90 transition-colors active:scale-95"
                >
                    <LucideMessageCircle className="w-4 h-4" />
                    Soporte Discord
                </button>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 px-4 py-2 rounded-lg hover:text-neutral-300 hover:bg-white/[0.04] transition-colors"
                >
                    <LucideLogOut className="w-4 h-4" />
                    Cerrar sesión
                </button>
            </div>
        </div>
    );
};
