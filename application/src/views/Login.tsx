import { DiscordIcon } from "@/icons/DiscordIcon";
import { useAuthentication } from "@/stores/AuthContext";
import { useGlobalContext } from "@/stores/GlobalContext";
import { LucideLockOpen } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

export const Login = () => {
    const { startDiscordAuth, error, authStep, isAuthenticated } = useAuthentication();
    const { titleBarState, setTitleBarState } = useGlobalContext();

    useEffect(() => {
        const TOAST_ID = "login-toast";

        // Early return if authenticated
        if (isAuthenticated) {
            toast.dismiss(TOAST_ID);
            return;
        }

        // Handle error cases
        if (error) {
            if (error.code === "NOT_IN_GUILD") {
                toast.dismiss(TOAST_ID);
                toast.custom(() => (
                    <div className="flex items-center justify-center p-4 bg-gradient-to-r from-gray-700 to-gray-600 text-white rounded-md shadow-md transform border border-white/10 backdrop-blur-md">
                        <span className="mr-3 text-2xl">⚠️</span>
                        <span className="text-sm font-medium">
                            No estás en el servidor de Discord.
                            <br />
                            <a
                                href="https://discord.gg/zXHhjExy92"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 hover:underline mt-1 inline-block transition-colors"
                            >
                                Unirme al servidor →
                            </a>
                        </span>
                    </div>
                ), {
                    id: "required-guild",
                    duration: 10000
                });

                return;
            } else {
                toast.error("Error al iniciar sesión", { id: TOAST_ID });
            }
            return;
        }

        // Handle different authentication steps
        const toastMessages: Record<string, string> = {
            "starting-auth": "Conectando con Discord...",
            "waiting-callback": "Esperando respuesta...",
            "processing-callback": "Verificando credenciales...",
        };

        if (authStep === "requesting-session") {
            toast.dismiss(TOAST_ID);
        } else if (authStep && toastMessages[authStep]) {
            toast.loading(toastMessages[authStep], { id: TOAST_ID });
        }
    }, [error, authStep, isAuthenticated]);

    useEffect(() => {
        setTitleBarState({
            ...titleBarState,
            title: "Login",
            icon: LucideLockOpen,
            customIconClassName: "bg-gray-900",
            canGoBack: false,
            opaque: false,
        });
    }, []);

    return (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            {/* Video Background */}
            <video
                src="/assets/videos/doggy-bg.webm"
                autoPlay
                loop
                muted
                className="absolute !opacity-70 inset-0 object-cover w-full h-full -z-20"
            />

            {/* Gradient Overlay para mejorar legibilidad sin tapar el video */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/10 to-transparent -z-10" />

            {/* Loading/Transition overlay original */}
            <div className="-z-9 w-full h-full absolute inset-0 bg-ms-primary animate-fade-out pointer-events-none" />

            <div className="z-10 w-full h-full flex items-center">
                <div className="flex items-center justify-center md:justify-start w-full px-8 md:pl-24">

                    {/* Modern Glass Card */}
                    <article className="
                        w-full max-w-[420px] 
                        p-8 md:p-10 
                        flex flex-col justify-center items-center text-center 
                        bg-black/40 
                        backdrop-blur-xl 
                        backdrop-saturate-150
                        border border-white/10 
                        rounded-2xl 
                        shadow-2xl 
                        animate-in fade-in slide-in-from-left-4 duration-700
                    ">
                        {/* Title Section */}
                        <div className="mb-8 space-y-2">
                            <h1 className="font-bold text-4xl tracking-tight from-[#bcfe47] to-[#05cc2a] bg-clip-text text-transparent bg-gradient-to-b drop-shadow-sm">
                                Modpack Store
                            </h1>
                            <p className="text-base text-neutral-300 font-medium leading-relaxed">
                                Tu puerta de entrada a la mejor colección de mods. Inicia sesión para continuar.
                            </p>
                        </div>

                        {/* Action Button */}
                        <button
                            disabled={!!authStep}
                            onClick={startDiscordAuth}
                            className="
                                group relative w-full
                                flex items-center justify-center 
                                px-6 py-3.5 
                                text-base font-bold text-white 
                                bg-[#5865F2] hover:bg-[#4752C4] 
                                rounded-xl 
                                shadow-lg shadow-indigo-500/20 
                                transition-all duration-300 ease-out
                                hover:scale-[1.02] hover:shadow-indigo-500/40
                                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                            "
                        >
                            <DiscordIcon className="w-6 h-6 mr-3 transition-transform group-hover:rotate-[15deg]" />
                            <span>Conectar con Discord</span>
                        </button>

                        {/* Footer / Disclaimer (Optional aesthetic touch) */}
                        <div className="mt-6 text-xs text-neutral-500">
                            Acceso seguro vía OAuth2
                        </div>
                    </article>
                </div>
            </div>
        </div>
    );
};