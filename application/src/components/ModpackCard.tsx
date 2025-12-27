import { Link, useNavigate } from "react-router-dom";
import {
    LucideCheck,
    LucidePackage,
    LucidePlay,
    LucideUser2,
    LucideVerified,
    LucideSparkles,
    LucideCrown,
    LucideGamepad2
} from "lucide-react";

// Helper simple por si no usas librerías externas
const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ");

export const ModpackCard = ({
    modpack,
    to = "/prelaunch/",
    className = ""
}: {
    modpack: any,
    to?: string,
    className?: string
}) => {
    const navigate = useNavigate();

    // --- LÓGICA DE DATOS ---
    const { showUserAsPublisher } = modpack;

    let displayPublisher = { ...modpack.publisher };
    const originalPublisherName = displayPublisher.publisherName;

    if (showUserAsPublisher && modpack.creatorUser) {
        displayPublisher = {
            ...displayPublisher,
            publisherName: modpack.creatorUser.username || "Desconocido",
        };
    }

    const isPatreon = modpack.visibility === "patreon";

    // --- LÓGICA DE ESTILOS ---
    const getPublisherStyle = () => {
        const base = "backdrop-blur-md border border-white/10 text-white/90";

        if (showUserAsPublisher && displayPublisher.isHostingPartner) {
            return { className: `${base} bg-purple-500/20 text-purple-200 border-purple-500/30`, icon: LucideCrown };
        }

        if (!showUserAsPublisher) {
            if (displayPublisher.partnered) return { className: "bg-[#5865F2] text-white border-transparent", icon: LucideVerified };
            if (displayPublisher.verified) return { className: "bg-[#1f8b4c] text-white border-transparent", icon: LucideCheck };
        }

        return { className: `${base} bg-black/40 hover:bg-black/60`, icon: LucideUser2 };
    };

    const pubStyle = getPublisherStyle();

    const handlePublisherClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const slug = displayPublisher.slug || displayPublisher.id;
        if (slug) navigate(`/p/${slug}`);
    };

    return (
        <Link
            to={to}
            draggable={false}
            className={cn(
                // AQUI ESTABA EL ERROR: Agregamos 'aspect-video' para forzar la relación de aspecto 16:9
                "group relative block w-full overflow-hidden rounded-xl bg-[#121214] aspect-video",
                "ring-1 ring-white/10 transition-all duration-300 hover:ring-white/30 hover:shadow-2xl hover:shadow-black/50",
                isPatreon && "ring-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.1)]",
                className
            )}
        >
            {/* 1. IMAGEN DE FONDO (Absolute) */}
            <div className="absolute inset-0 z-0">
                <img
                    src={modpack.bannerUrl || "/images/modpack-fallback.webp"}
                    onError={(e) => { e.currentTarget.src = "/images/modpack-fallback.webp" }}
                    alt={modpack.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/40 to-transparent opacity-90" />
                <div className="absolute inset-0 bg-black/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </div>

            {/* 2. EFECTOS PATREON */}
            {isPatreon && (
                <>
                    <div className="absolute top-0 right-0 p-3 z-20">
                        <div className="flex items-center gap-1.5 rounded-full bg-yellow-500/90 px-2.5 py-1 text-[10px] font-bold text-black shadow-lg backdrop-blur-sm">
                            <LucideSparkles size={12} fill="currentColor" />
                            <span>PREMIUM</span>
                        </div>
                    </div>
                    <div className="absolute inset-0 pointer-events-none rounded-xl border border-yellow-500/20 opacity-50 z-20" />
                </>
            )}

            {/* 3. CONTENIDO (Absolute sobre la imagen) */}
            <div className="absolute inset-0 flex flex-col justify-end p-4 z-10">

                <div className="transform transition-transform duration-300 group-hover:-translate-y-2">
                    {/* Publisher */}
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                        <button
                            onClick={handlePublisherClick}
                            className={cn(
                                "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium transition-all hover:scale-105 active:scale-95",
                                pubStyle.className
                            )}
                        >
                            <pubStyle.icon size={12} />
                            <span className="max-w-[120px] truncate">{displayPublisher.publisherName}</span>
                        </button>

                        {showUserAsPublisher && displayPublisher.isHostingPartner && (
                            <span className="flex items-center gap-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 text-[10px] font-bold text-yellow-500">
                                <span>de {originalPublisherName}</span>
                                {displayPublisher.verified && <LucideVerified size={10} />}
                            </span>
                        )}
                    </div>

                    {/* Título y Categoría */}
                    <h3 className="font-sans text-lg font-bold leading-tight text-white drop-shadow-md group-hover:text-[var(--primary)] transition-colors line-clamp-1">
                        {modpack.name}
                    </h3>

                    <div className="mt-1 flex items-center gap-2 text-xs text-white/50">
                        <LucidePackage size={12} />
                        <span>Modpack</span>
                    </div>
                </div>

                {/* Botón Acción */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between opacity-0 transition-all duration-300 transform translate-y-4 group-hover:opacity-100 group-hover:translate-y-0">
                    <span className="text-xs font-medium text-white/40">

                    </span>
                    <div className="flex items-center gap-2 rounded-lg bg-white text-black px-3 py-1.5 text-xs font-bold shadow-lg shadow-white/10 transition-transform hover:scale-105 active:scale-95">
                        <LucideGamepad2 size={12} />
                        Jugar
                    </div>
                </div>
            </div>
        </Link>
    );
};