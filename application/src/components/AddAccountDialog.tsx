import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { open } from "@tauri-apps/plugin-shell" // <--- IMPORTANTE: Para abrir enlaces en Tauri
import { LucideUser, Loader2, CheckCircle2, Copy, ExternalLink, ShieldCheck, Gamepad2, WifiOff, X } from "lucide-react"
import { TauriCommandReturns } from "@/types/TauriCommandReturns"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription
} from "@/components/ui/dialog"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { MicrosoftIcon } from "@/icons/MicrosoftIcon"
import { Progress } from "@/components/ui/progress"
import { trackEvent } from "@aptabase/web"
import { playSound } from "@/utils/sounds"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "motion/react"

// --- TIPOS ---
interface AuthProgressEvent {
    step: 'device_code' | 'waiting_auth' | 'microsoft_token' | 'xbox_auth' | 'xsts_token' | 'minecraft_auth' | 'profile' | 'complete';
    message: string;
    percentage: number;
    user_code?: string;
    verification_url?: string;
}

interface MicrosoftAccount {
    username: string;
    uuid: string;
    access_token: string;
    refresh_token: string;
    token_expiration: number;
    account_type: string;
}

export const AddAccountDialog = ({ onAccountAdded }: { onAccountAdded: () => void }) => {
    const [openDialog, setOpenDialog] = useState(false)
    const [username, setUsername] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    // Estado Microsoft
    const [microsoftLoading, setMicrosoftLoading] = useState(false)
    const [authProgress, setAuthProgress] = useState<AuthProgressEvent | null>(null)
    const [authCode, setAuthCode] = useState<string | null>(null)
    const [verificationUrl, setVerificationUrl] = useState<string | null>(null)

    // --- LOGICA DE EVENTOS (Igual que antes) ---
    useEffect(() => {
        const unlistenProgress = listen<AuthProgressEvent>("microsoft-auth-progress", (event) => {
            setAuthProgress(event.payload);
            if (event.payload.step === 'waiting_auth' && event.payload.user_code) {
                setAuthCode(event.payload.user_code);
                setVerificationUrl(event.payload.verification_url || null);
            }
        });

        const unlistenSuccess = listen<MicrosoftAccount>("microsoft-auth-account-saved", async (event) => {
            setMicrosoftLoading(false);
            setAuthProgress(null);
            toast.success(`Cuenta conectada: ${event.payload.username}`);
            playSound("SUCCESS");
            onAccountAdded();
            setOpenDialog(false);
        });

        const unlistenError = listen<string>("microsoft-auth-error", (event) => {
            playSound("ERROR_NOTIFICATION");
            toast.error(event.payload);
            setMicrosoftLoading(false);
            setAuthProgress(null);
        });

        return () => {
            unlistenProgress.then(f => f());
            unlistenSuccess.then(f => f());
            unlistenError.then(f => f());
        };
    }, [onAccountAdded]);

    // --- ACCIONES ---
    const handleOpenLink = async (url: string) => {
        try {
            await open(url); // Usamos la API de Tauri
        } catch (e) {
            console.error("Error abriendo link:", e);
            toast.error("No se pudo abrir el navegador. Copia el enlace manualmente.");
        }
    };

    const handleAddOffline = async () => {
        if (!username.trim()) return;
        setIsLoading(true);
        try {
            await invoke('add_offline_account', { username: username.trim() });
            toast.success("Cuenta offline añadida");
            onAccountAdded();
            setOpenDialog(false);
            setUsername("");
        } catch (e) {
            toast.error("Error al crear cuenta");
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartMicrosoft = async () => {
        setAuthCode(null);
        setMicrosoftLoading(true);
        setAuthProgress(null);
        try {
            await invoke("start_microsoft_auth");
        } catch {
            setMicrosoftLoading(false);
            toast.error("No se pudo iniciar el servicio de autenticación");
        }
    };

    const copyCode = () => {
        if (authCode) {
            navigator.clipboard.writeText(authCode);
            toast.success("Código copiado al portapapeles");
        }
    };

    return (
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
                <button className="group relative h-[160px] w-full overflow-hidden rounded-xl border border-dashed border-white/10 bg-[#0a0a0a] hover:bg-white/[0.02] hover:border-white/20 transition-all duration-200">
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                        <div className="p-3 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors border border-white/5">
                            <LucideUser className="h-6 w-6 text-neutral-400 group-hover:text-white transition-colors" />
                        </div>
                        <div className="text-center">
                            <span className="block text-sm font-semibold text-neutral-300 group-hover:text-white">Añadir Cuenta</span>
                            <span className="text-xs text-neutral-500">Microsoft o Offline</span>
                        </div>
                    </div>
                </button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md bg-[#0a0a0a] border-white/10 p-0 gap-0 shadow-2xl">

                {/* Header Clásico y Ordenado */}
                <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                            Añadir Cuenta
                        </DialogTitle>
                        <DialogDescription className="text-neutral-400">
                            Conecta tu cuenta para acceder a los servidores y skins.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-6">
                    <Tabs defaultValue="offline" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-[#151515] border border-white/5 mb-6">
                            <TabsTrigger value="offline" className="data-[state=active]:bg-[#252525] data-[state=active]:text-white transition-all">
                                <WifiOff className="w-4 h-4 mr-2" /> Offline
                            </TabsTrigger>
                            <TabsTrigger value="microsoft" className="data-[state=active]:bg-[#252525] data-[state=active]:text-white transition-all">
                                <MicrosoftIcon className="w-4 h-4 mr-2" /> Microsoft
                            </TabsTrigger>
                        </TabsList>

                        {/* --- MICROSOFT --- */}
                        <TabsContent value="microsoft" className="mt-0 focus-visible:outline-none min-h-[220px]">
                            <AnimatePresence mode="wait">
                                {!microsoftLoading && !authProgress ? (
                                    <motion.div
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                        className="flex flex-col items-center text-center space-y-5 py-2"
                                    >
                                        <div className="p-4 rounded-full bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20">
                                            <MicrosoftIcon className="w-8 h-8" />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="text-base font-semibold text-white">Iniciar Sesión Segura</h3>
                                            <p className="text-sm text-neutral-400 px-4">
                                                Usaremos el navegador para autenticarte con los servidores de Microsoft.
                                            </p>
                                        </div>
                                        <Button
                                            onClick={handleStartMicrosoft}
                                            className="w-full bg-[#00a4ef] hover:bg-[#0078d4] text-white font-medium"
                                        >
                                            Iniciar Sesión
                                        </Button>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                        className="space-y-5"
                                    >
                                        {/* ETAPA DE CODIGO */}
                                        {authCode && authProgress?.step !== 'complete' ? (
                                            <div className="bg-[#151515] border border-white/10 rounded-xl p-5 text-center shadow-inner">
                                                <p className="text-xs text-neutral-400 mb-3 uppercase tracking-wider font-bold">Código de Dispositivo</p>

                                                <div
                                                    onClick={copyCode}
                                                    className="group flex items-center justify-center gap-3 text-3xl font-mono font-bold text-white bg-black/30 py-3 rounded-lg border border-white/5 cursor-pointer hover:border-blue-500/50 hover:text-blue-400 transition-all mb-4 relative overflow-hidden"
                                                >
                                                    {authCode}
                                                    <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>

                                                <p className="text-sm text-neutral-400 mb-4">
                                                    Ingresa este código en la página de Microsoft.
                                                </p>

                                                <Button
                                                    variant="outline"
                                                    className="w-full border-blue-500/20 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                                                    onClick={() => handleOpenLink(verificationUrl!)}
                                                >
                                                    Abrir Página de Login <ExternalLink className="w-3 h-3 ml-2" />
                                                </Button>
                                            </div>
                                        ) : (
                                            // ETAPA DE CARGA GENERAL
                                            <div className="flex flex-col items-center justify-center py-10 space-y-4">
                                                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                                                <p className="text-sm text-neutral-400 animate-pulse">Conectando con Microsoft...</p>
                                            </div>
                                        )}

                                        {/* BARRA DE ESTADO */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs font-medium text-neutral-500">
                                                <span>{authProgress?.message || "Procesando..."}</span>
                                                <span>{Math.round(authProgress?.percentage || 0)}%</span>
                                            </div>
                                            <Progress value={authProgress?.percentage || 0} className="h-1.5 bg-white/5" />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </TabsContent>

                        {/* --- OFFLINE --- */}
                        <TabsContent value="offline" className="mt-0 focus-visible:outline-none min-h-[220px]">
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="space-y-5"
                            >
                                <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg flex gap-3">
                                    <WifiOff className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                                    <p className="text-xs text-yellow-200/80 leading-relaxed">
                                        Modo sin conexión. No podrás entrar a servidores premium ni ver skins.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-neutral-300 ml-1">Nombre de Usuario</Label>
                                    <div className="relative">
                                        <Gamepad2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                                        <Input
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                                            placeholder="Ej: Steve"
                                            className="pl-10 bg-[#151515] border-white/10 text-white focus:border-white/20 h-11"
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddOffline()}
                                        />
                                    </div>
                                </div>

                                <Button
                                    onClick={handleAddOffline}
                                    disabled={isLoading || !username.trim()}
                                    className="w-full bg-neutral-800 hover:bg-neutral-700 text-white border border-white/5 h-11 mt-2"
                                >
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Crear Cuenta"}
                                </Button>
                            </motion.div>
                        </TabsContent>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    )
}