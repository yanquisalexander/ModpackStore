import { Link, useNavigate } from "react-router-dom";
import {
    LucideCheck,
    LucideUser2,
    LucideVerified,
    LucideCrown,
    LucideGamepad2
} from "lucide-react";

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

    const { showUserAsPublisher } = modpack;

    let displayCreator: any = modpack.creator ? { ...modpack.creator } : {};
    const originalCreatorName = displayCreator.name;

    if (showUserAsPublisher && modpack.creatorUser) {
        displayCreator = {
            ...displayCreator,
            name: modpack.creatorUser.username || "Desconocido",
        };
    }

    const getCreatorStyle = () => {
        if (showUserAsPublisher && displayCreator.hostingPartner) {
            return { className: "bg-white/10 text-white/80", icon: LucideCrown };
        }
        if (!showUserAsPublisher) {
            if (displayCreator.partner) return { className: "bg-white/10 text-white/80", icon: LucideVerified };
            if (displayCreator.verified) return { className: "bg-white/10 text-white/80", icon: LucideCheck };
        }
        return { className: "bg-white/10 text-white/80", icon: LucideUser2 };
    };

    const creatorStyle = getCreatorStyle();

    const handleCreatorClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const slug = displayCreator.slug || displayCreator.id;
        if (slug) navigate(`/c/${slug}`);
    };

    return (
        <Link
            to={to}
            draggable={false}
            className={cn(
                "group relative block w-full overflow-hidden rounded-xl bg-[#121214] aspect-video",
                "ring-1 ring-white/[0.06] transition-shadow duration-300 hover:ring-white/20",
                className
            )}
        >
            <div className="absolute inset-0 z-0">
                <img
                    src={modpack.bannerUrl || "/images/modpack-fallback.webp"}
                    onError={(e) => { e.currentTarget.src = "/images/modpack-fallback.webp" }}
                    alt={modpack.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/20 to-transparent" />
            </div>

            <div className="absolute inset-0 z-10 flex flex-col justify-end p-4 opacity-0 translate-y-3 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <button
                                onClick={handleCreatorClick}
                                className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/70 transition-opacity hover:opacity-80"
                            >
                                <creatorStyle.icon size={10} />
                                <span className="max-w-[100px] truncate">{displayCreator.name}</span>
                            </button>
                        </div>
                        <h3 className="text-base font-bold leading-tight text-white drop-shadow-md line-clamp-1">
                            {modpack.name}
                        </h3>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-white text-black px-3 py-1.5 text-xs font-bold shadow-lg flex-shrink-0 transition-transform hover:scale-105 active:scale-95">
                        <LucideGamepad2 size={12} />
                        Jugar
                    </div>
                </div>
            </div>
        </Link>
    );
};
