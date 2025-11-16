import { LucideLogOut, LucideMessageCircle } from "lucide-react";
import { useAuthentication } from "@/stores/AuthContext";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
            toast.error('Error al cerrar sesión');
        }
    };

    const handleOpenDiscord = () => {
        open('https://discord.gg/XSRtDgJzzK').catch(console.error);
    };

    const banReason = session?.activeBan?.reason || session?.banReason || 'No se proporcionó una razón';
    const banDate = session?.activeBan?.banDate
        ? new Date(session.activeBan.banDate).toLocaleString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
        : 'Desconocida';

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-red-950/95 via-black/95 to-black/95 backdrop-blur-lg">
            <div className="max-w-xl mx-auto p-4 text-center space-y-4">
                {/* Header Section */}
                <div className="space-y-3">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20">
                        <svg
                            className="w-8 h-8 text-red-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white">
                        Cuenta Suspendida
                    </h1>
                    <p className="text-base text-gray-300">
                        Tu cuenta ha sido baneada y no puedes acceder a Modpack Store.
                    </p>
                </div>

                {/* Ban Details */}
                <div className="bg-black/50 backdrop-blur-sm rounded-lg p-4 border border-red-500/30">
                    <h2 className="text-sm font-semibold text-white mb-2">
                        Detalles del Ban
                    </h2>
                    <div className="space-y-2 text-left">
                        <div>
                            <span className="text-gray-400 text-xs">Razón:</span>
                            <p className="text-white text-sm mt-0.5">{banReason}</p>
                        </div>
                        <div>
                            <span className="text-gray-400 text-xs">Fecha del ban:</span>
                            <p className="text-white text-sm mt-0.5">{banDate}</p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                    <p className="text-gray-300 text-xs">
                        Si crees que esto es un error, contacta nuestro soporte en Discord.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                        <Button
                            onClick={handleOpenDiscord}
                            size="sm"
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-sm"
                        >
                            <LucideMessageCircle className="w-4 h-4" />
                            Soporte Discord
                        </Button>

                        <Button
                            onClick={handleLogout}
                            size="sm"
                            variant="outline"
                            className="flex items-center gap-2 border-gray-700 hover:bg-gray-800 text-sm"
                        >
                            <LucideLogOut className="w-4 h-4" />
                            Cerrar Sesión
                        </Button>
                    </div>
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-gray-800">
                    <p className="text-xs text-gray-500">
                        Usuario: <span className="text-gray-400 font-medium">{session?.username}</span>
                    </p>
                </div>
            </div>
        </div>
    );
};
