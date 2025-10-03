import { LucideLogOut, LucideMessageCircle } from "lucide-react";
import { useAuthentication } from "@/stores/AuthContext";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

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
        invoke('open_external_url', { 
            url: 'https://discord.gg/zXHhjExy92' 
        }).catch(console.error);
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
            <div className="max-w-2xl mx-auto p-8 text-center">
                <div className="mb-8">
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-red-500/20 mb-6">
                        <svg 
                            className="w-12 h-12 text-red-500" 
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
                    <h1 className="text-4xl font-bold text-white mb-4">
                        Cuenta Suspendida
                    </h1>
                    <p className="text-xl text-gray-300 mb-8">
                        Tu cuenta ha sido baneada y no puedes acceder a Modpack Store.
                    </p>
                </div>

                <div className="bg-black/50 backdrop-blur-sm rounded-lg p-6 mb-8 border border-red-500/30">
                    <h2 className="text-lg font-semibold text-white mb-3">
                        Detalles del Ban
                    </h2>
                    <div className="space-y-3 text-left">
                        <div>
                            <span className="text-gray-400 text-sm">Razón:</span>
                            <p className="text-white mt-1">{banReason}</p>
                        </div>
                        <div>
                            <span className="text-gray-400 text-sm">Fecha del ban:</span>
                            <p className="text-white mt-1">{banDate}</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <p className="text-gray-300 mb-6">
                        Si crees que esto es un error o deseas apelar el ban, puedes contactarnos en nuestro servidor de Discord.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button
                            onClick={handleOpenDiscord}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700"
                        >
                            <LucideMessageCircle className="w-5 h-5" />
                            Contactar Soporte en Discord
                        </Button>

                        <Button
                            onClick={handleLogout}
                            variant="outline"
                            className="flex items-center gap-2 border-gray-700 hover:bg-gray-800"
                        >
                            <LucideLogOut className="w-5 h-5" />
                            Cerrar Sesión
                        </Button>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-800">
                    <p className="text-sm text-gray-500">
                        Usuario: <span className="text-gray-400 font-medium">{session?.username}</span>
                    </p>
                </div>
            </div>
        </div>
    );
};
