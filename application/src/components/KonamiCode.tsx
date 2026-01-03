import {
    LucideArrowBigDownDash,
    LucideArrowBigLeftDash,
    LucideArrowBigRightDash,
    LucideArrowBigUpDash,
    LucideCode,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const konamiCode = [
    "ArrowUp",
    "ArrowUp",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowLeft",
    "ArrowRight",
    "b",
    "a",
];

const iconMap: Record<string, JSX.Element> = {
    ArrowUp: <LucideArrowBigUpDash />,
    ArrowDown: <LucideArrowBigDownDash />,
    ArrowLeft: <LucideArrowBigLeftDash />,
    ArrowRight: <LucideArrowBigRightDash />,
};

export const KonamiCode = () => {
    const konamiRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    const [currentKeyIcon, setCurrentKeyIcon] = useState<JSX.Element | string | null>(null);
    const [comboCount, setComboCount] = useState<number>(-1);
    const [showCurrentKey, setShowCurrentKey] = useState(false);
    const [active, setActive] = useState(false);

    useEffect(() => {
        let position = 0;
        let resetTimeout: ReturnType<typeof setTimeout> | null = null;

        const reset = () => {
            position = 0;
            setComboCount(-1);
            setShowCurrentKey(false);
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (active) return;

            const key = event.key;

            // Reset timeout para reiniciar si no continúa el código
            if (resetTimeout) clearTimeout(resetTimeout);
            resetTimeout = setTimeout(() => {
                reset();
            }, 2000);

            if (key === konamiCode[position]) {
                position++;

                setCurrentKeyIcon(iconMap[key] ?? key.toUpperCase());
                setShowCurrentKey(true);
                setComboCount(position - 1);

                if (position === konamiCode.length) {
                    setActive(true);
                    setShowCurrentKey(false);
                    if (resetTimeout) clearTimeout(resetTimeout);

                    // Mostrar contenedor y reproducir
                    konamiRef.current?.classList.remove("opacity-0", "pointer-events-none");
                    konamiRef.current?.removeAttribute("aria-hidden");

                    // Reiniciar el video al principio por si acaso
                    if (videoRef.current) {
                        videoRef.current.currentTime = 0;
                        videoRef.current.play().catch(e => console.error("Error reproduciendo video:", e));
                    }

                    document.body.classList.add("temblor");

                    reset();
                }
            } else {
                if (resetTimeout) clearTimeout(resetTimeout);
                reset();
            }
        };

        const handleVideoEnd = () => {
            konamiRef.current?.classList.add("opacity-0", "pointer-events-none");
            konamiRef.current?.setAttribute("aria-hidden", "true");
            document.body.classList.remove("temblor");
            setActive(false);
        };

        const video = videoRef.current;
        video?.addEventListener("ended", handleVideoEnd);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            video?.removeEventListener("ended", handleVideoEnd);
            if (resetTimeout) clearTimeout(resetTimeout);
        };
    }, [active]);

    return (
        <>
            <div
                id="konami"
                ref={konamiRef}
                aria-hidden="true"
                // Se eliminó bg-black/50 para no oscurecer
                className="pointer-events-none z-[9999] opacity-0 fixed transition-opacity duration-500 inset-0 flex items-center justify-center text-white font-bold text-lg"
            >
                <div className="flex flex-col items-center justify-center w-full h-full relative">
                    {/* Indicador de texto sobre el video */}
                    <div className="absolute bottom-16 z-20 flex items-center gap-2 drop-shadow-lg animate-pulse">
                        <LucideCode size={24} />
                        <span>¡Código Konami activado!</span>
                    </div>

                    <video
                        ref={videoRef}
                        src="/assets/videos/konami_2.webm"
                        // Se añadió grayscale y un blur muy suave (1px)
                        className="h-screen w-screen object-cover grayscale blur-[1px]"
                        loop={false}
                        playsInline
                    />
                </div>
            </div>

            {/* Indicador de teclas presionadas */}
            <div
                id="konami-current-key"
                className={`pointer-events-none transition-all duration-200 fixed bottom-4 z-[9990] right-4 flex items-center gap-3 ${showCurrentKey ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
            >
                {comboCount >= 0 && (
                    <span className="text-white font-black text-2xl italic drop-shadow-md">
                        x{comboCount + 1}
                    </span>
                )}
                <span className="size-12 justify-center items-center flex text-white bg-black/80 backdrop-blur-md border-2 border-white/50 rounded-xl shadow-xl">
                    {currentKeyIcon}
                </span>
            </div>
        </>
    );
};