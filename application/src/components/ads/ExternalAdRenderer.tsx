import React, { useMemo } from "react";
import { LucideInfo } from "lucide-react";
import { motion } from "motion/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ExternalAdConfig } from "./externalAdsConfig";

interface ExternalAdRendererProps {
    config: ExternalAdConfig;
    variant?: "banner" | "sidebar";
    className?: string;
}

const ADS_BASE_URL = "https://modpackstore.vercel.app";

function encodeBase64Url(data: Record<string, unknown>): string {
    const json = JSON.stringify(data);
    const bytes = new TextEncoder().encode(json);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const ExternalAdRenderer: React.FC<ExternalAdRendererProps> = ({
    config,
    variant = "banner",
    className = "",
}) => {
    const iframeSrc = useMemo(() => {
        const payload: Record<string, unknown> = {
            scriptSrc: config.scriptSrc,
            containerId: config.containerId,
        };
        if (config.width) payload.width = config.width;
        if (config.height) payload.height = config.height;
        if (config.native) payload.native = true;
        if (config.options) payload.options = config.options;
        if (config.scriptAttrs) payload.scriptAttrs = config.scriptAttrs;

        return `${ADS_BASE_URL}/ads/serve?payload=${encodeURIComponent(encodeBase64Url(payload))}`;
    }, [config]);

    const iframeHeight = config.height || "auto";

    const iframeAllow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";

    if (variant === "sidebar") {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`relative rounded-xl overflow-hidden border border-white/[0.08] bg-[#141418] hover:border-white/[0.18] transition-all p-4 space-y-3 shadow-lg ${className}`}
            >
                <div className="relative w-full flex items-center justify-center rounded-lg overflow-hidden bg-black/40 max-w-full">
                    <iframe
                        src={iframeSrc}
                        style={{ width: "100%", height: iframeHeight, border: "none", maxWidth: "100%" }}
                        allow={iframeAllow}
                        referrerPolicy="no-referrer-when-downgrade"
                        loading="lazy"
                        title="Ad"
                    />
                </div>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 text-xs text-neutral-500 cursor-help w-max">
                            <LucideInfo className="w-3 h-3" />
                            <span>{config.label || "Publicidad externa"}</span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                        El contenido mostrado en este anuncio es proporcionado por un servicio externo y no está controlado por ModpackStore. Haz clic bajo tu propia responsabilidad.
                    </TooltipContent>
                </Tooltip>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className={`relative rounded-2xl overflow-hidden border border-white/[0.08] bg-[#121215] hover:border-white/[0.18] transition-all duration-300 shadow-xl ${className}`}
        >
            <div className="relative w-full flex items-center justify-center overflow-hidden max-w-full">
                <iframe
                    src={iframeSrc}
                    style={{ width: "100%", height: iframeHeight, border: "none", maxWidth: "100%" }}
                    allow={iframeAllow}
                    referrerPolicy="no-referrer-when-downgrade"
                    loading="lazy"
                    title="Ad"
                />
            </div>

            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="absolute bottom-2 right-3 flex items-center gap-1.5 text-xs text-neutral-500 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-md cursor-help">
                        <LucideInfo className="w-3 h-3" />
                        <span>{config.label || "Publicidad externa"}</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                    El contenido mostrado en este anuncio es proporcionado por un servicio externo y no está controlado por ModpackStore. Haz clic bajo tu propia responsabilidad.
                </TooltipContent>
            </Tooltip>
        </motion.div>
    );
};
