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

        if (isAuthenticated) {
            toast.dismiss(TOAST_ID);
            return;
        }

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
                ), { id: "required-guild", duration: 10000 });
                return;
            } else {
                toast.error("Error al iniciar sesión", { id: TOAST_ID });
            }
            return;
        }

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

            {/* ── Video Background ── */}
            <video
                src="/assets/videos/doggy-bg.webm"
                autoPlay
                loop
                muted
                className="absolute inset-0 object-cover w-full h-full -z-20 opacity-80"
            />

            {/* ── Cinematic vignette + color grade ── */}
            <div className="absolute inset-0 -z-10 pointer-events-none">
                {/* dark vignette around edges */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
                {/* left-side darkening so card is legible */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />
                {/* subtle green tint from bottom-right to tie palette */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_80%_80%,rgba(5,204,42,0.08)_0%,transparent_70%)]" />
            </div>

            {/* ── Page-load fade overlay (original) ── */}
            <div className="-z-9 w-full h-full absolute inset-0 bg-ms-primary animate-fade-out pointer-events-none" />

            {/* ── Main layout ── */}
            <div className="z-10 w-full h-full flex items-center">
                <div className="flex items-center justify-center md:justify-start w-full px-8 md:pl-20">

                    {/*
                     * ── Card ──
                     * Material Expressive 3 key ideas applied here:
                     *   • Large border-radius (rounded-[28px]) — "squircle" feel
                     *   • Tonal surface instead of plain glass
                     *   • Generous padding
                     *   • State-layer on the button (ripple via group/hover)
                     *   • Expressive type scale: big display, small body
                    */}
                    <article className="
                        w-full max-w-[400px]
                        relative
                        flex flex-col items-start text-left
                        px-9 py-10
                        rounded-[28px]
                        border border-white/[0.09]
                        overflow-hidden
                        animate-in fade-in slide-in-from-left-5 duration-700
                    ">
                        {/* Tonal fill — dark with green undertone (ME3 "surface container") */}
                        <div className="absolute inset-0 -z-10 bg-black/50 backdrop-blur-2xl backdrop-saturate-[1.4]" />
                        {/* Inner top-edge shimmer */}
                        <div className="absolute inset-x-0 top-0 h-px -z-10 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                        {/* Subtle green glow bleeding from bottom-left */}
                        <div className="absolute -bottom-16 -left-16 w-56 h-56 -z-10 rounded-full bg-[#bcfe47]/10 blur-3xl" />

                        {/* ── Eyebrow chip ── */}
                        <div className="
                            flex items-center gap-2
                            mb-6 px-3 py-1.5
                            rounded-full
                            bg-[#bcfe47]/10 border border-[#bcfe47]/20
                        ">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#bcfe47] animate-pulse shadow-[0_0_6px_#bcfe47]" />
                            <span className="text-[11px] font-semibold tracking-widest uppercase text-[#bcfe47]">
                                Modpack Store
                            </span>
                        </div>

                        {/* ── Display headline — ME3 "expressive" type ── */}
                        <h1 className="
                            font-bold leading-[1.05] tracking-tight
                            text-[42px]
                            text-white mb-3
                        ">
                            Tu mundo
                            <br />
                            <span className="
                                bg-gradient-to-b from-[#bcfe47] to-[#05cc2a]
                                bg-clip-text text-transparent
                                drop-shadow-[0_0_24px_rgba(188,254,71,0.3)]
                            ">
                                de mods.
                            </span>
                        </h1>

                        {/* ── Body copy ── */}
                        <p className="text-sm font-light text-white/50 leading-relaxed mb-8 max-w-[300px]">
                            La mejor colección de modpacks, curada y lista.
                            Entra con Discord y empieza a explorar.
                        </p>

                        {/*
                         * ── CTA Button ──
                         * ME3 "filled" button: full rounding, state-layer on hover,
                         * elevation implied by color contrast (no hard shadow needed)
                        */}
                        <button
                            disabled={!!authStep}
                            onClick={startDiscordAuth}
                            className="
                                group relative w-full
                                flex items-center justify-center gap-3
                                px-6 py-4
                                rounded-full
                                font-semibold text-[15px] text-white tracking-[0.01em]
                                bg-[#5865F2]
                                transition-all duration-300 ease-out
                                hover:bg-[#4752C4]
                                hover:-translate-y-0.5
                                hover:shadow-[0_8px_28px_rgba(88,101,242,0.45)]
                                active:scale-[0.97] active:translate-y-0
                                disabled:opacity-40 disabled:cursor-not-allowed
                                disabled:hover:translate-y-0 disabled:hover:shadow-none
                                overflow-hidden
                            "
                        >
                            {/* ME3 state layer */}
                            <span className="
                                absolute inset-0 rounded-full
                                bg-white/0 group-hover:bg-white/[0.08]
                                transition-colors duration-200
                            " />
                            {/* Top specular highlight */}
                            <span className="
                                absolute inset-x-0 top-0 h-1/2 rounded-t-full
                                bg-gradient-to-b from-white/15 to-transparent
                                pointer-events-none
                            " />

                            <DiscordIcon className="w-5 h-5 relative z-10 transition-transform duration-300 group-hover:rotate-12" />
                            <span className="relative z-10">
                                {authStep ? "Conectando..." : "Conectar con Discord"}
                            </span>
                        </button>

                        {/* ── Divider ── */}
                        <div className="flex items-center gap-3 w-full mt-6">
                            <div className="flex-1 h-px bg-white/[0.08]" />
                            <span className="text-[11px] text-white/25 tracking-wide">acceso seguro vía OAuth2</span>
                            <div className="flex-1 h-px bg-white/[0.08]" />
                        </div>

                        {/* ── Trust line ── */}
                        <p className="mt-4 text-[11px] text-white/25 text-center w-full">
                            🔒 Tus datos nunca se comparten con terceros
                        </p>
                    </article>
                </div>
            </div>
        </div>
    );
};