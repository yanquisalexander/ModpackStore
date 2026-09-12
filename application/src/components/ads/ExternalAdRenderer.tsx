import React, { useEffect, useRef, useMemo } from "react";
import { LucideInfo } from "lucide-react";
import { motion } from "motion/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ExternalAdConfig } from "./externalAdsConfig";

interface ExternalAdRendererProps {
    config: ExternalAdConfig;
    variant?: "banner" | "sidebar";
    className?: string;
}

function buildAdHtml(config: ExternalAdConfig): string {
    const optionScript = config.options
        ? `<script>window.atOptions = ${JSON.stringify(config.options)};</script>`
        : "";

    const containerStyle = config.native
        ? `width:${config.width || "100%"};height:${config.height || "auto"};max-height:200px;overflow:hidden;`
        : `width:${config.width || "100%"};height:${config.height || "auto"};`;

    const containerHtml = config.native
        ? `<div id="${config.containerId}" style="${containerStyle}"></div>`
        : "";

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{overflow:hidden;background:transparent}</style></head>
<body>
${containerHtml}
${optionScript}
<script src="${config.scriptSrc}" async></script>
</body>
</html>`;
}

export const ExternalAdRenderer: React.FC<ExternalAdRendererProps> = ({
    config,
    variant = "banner",
    className = "",
}) => {
    const blobUrl = useMemo(() => {
        const html = buildAdHtml(config);
        const blob = new Blob([html], { type: "text/html" });
        return URL.createObjectURL(blob);
    }, [config.containerId, config.scriptSrc, config.width, config.height, config.options, config.native]);

    useEffect(() => {
        return () => {
            URL.revokeObjectURL(blobUrl);
        };
    }, [blobUrl]);

    const iframeWidth = config.width || "100%";
    const iframeHeight = config.height || "auto";

    if (variant === "sidebar") {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`relative rounded-xl overflow-hidden border border-white/[0.08] bg-[#141418] hover:border-white/[0.18] transition-all p-4 space-y-3 shadow-lg ${className}`}
            >
                <div className="relative w-full flex items-center justify-center rounded-lg overflow-hidden bg-black/40 max-w-full">
                    <iframe
                        src={blobUrl}
                        style={{ width: iframeWidth, height: iframeHeight, border: "none", maxWidth: "100%" }}
                        sandbox="allow-scripts allow-popups"
                        loading="lazy"
                        title="Ad"
                    />
                </div>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 cursor-help w-max">
                            <LucideInfo className="w-3 h-3" />
                            <span>{config.label || "Publicidad externa"}</span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[250px]">
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
                    src={blobUrl}
                    style={{ width: "100%", height: iframeHeight, border: "none", maxWidth: "100%" }}
                    sandbox="allow-scripts allow-popups"
                    loading="lazy"
                    title="Ad"
                />
            </div>

            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="absolute bottom-2 right-3 flex items-center gap-1.5 text-[10px] text-neutral-500 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-md cursor-help">
                        <LucideInfo className="w-3 h-3" />
                        <span>{config.label || "Publicidad externa"}</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[250px]">
                    El contenido mostrado en este anuncio es proporcionado por un servicio externo y no está controlado por ModpackStore. Haz clic bajo tu propia responsabilidad.
                </TooltipContent>
            </Tooltip>
        </motion.div>
    );
};
