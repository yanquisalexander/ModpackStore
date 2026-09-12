import React, { useEffect, useRef } from "react";
import { LucideInfo } from "lucide-react";
import { motion } from "motion/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ExternalAdConfig } from "./externalAdsConfig";

interface ExternalAdRendererProps {
    config: ExternalAdConfig;
    variant?: "banner" | "sidebar";
    className?: string;
}

export const ExternalAdRenderer: React.FC<ExternalAdRendererProps> = ({
    config,
    variant = "banner",
    className = "",
}) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const scriptInjected = useRef(false);

    useEffect(() => {
        if (scriptInjected.current || !wrapperRef.current) return;

        const wrapper = wrapperRef.current;

        if (config.native) {
            const container = document.createElement("div");
            container.id = config.containerId;
            container.style.width = config.width || "100%";
            container.style.height = config.height || "auto";
            wrapper.appendChild(container);
        }

        if (config.options) {
            const optionsScript = document.createElement("script");
            optionsScript.textContent = `atOptions = ${JSON.stringify(config.options)};`;
            wrapper.appendChild(optionsScript);
        }

        const script = document.createElement("script");
        script.src = config.scriptSrc;
        script.async = true;
        wrapper.appendChild(script);

        scriptInjected.current = true;

        return () => {
            scriptInjected.current = false;
            while (wrapper.firstChild) {
                wrapper.removeChild(wrapper.firstChild);
            }
        };
    }, [config.containerId, config.scriptSrc, config.width, config.height, config.options]);

    const isNative = config.native === true;
    const nativeMaxHeight = isNative ? "200px" : undefined;

    if (variant === "sidebar") {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`relative rounded-xl overflow-hidden border border-white/[0.08] bg-[#141418] hover:border-white/[0.18] transition-all p-4 space-y-3 shadow-lg ${className}`}
            >
                <div
                    ref={wrapperRef}
                    className="relative w-full flex items-center justify-center rounded-lg overflow-hidden bg-black/40"
                    style={isNative ? { maxHeight: nativeMaxHeight, overflow: "hidden" } : undefined}
                />

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
            <div
                ref={wrapperRef}
                className="relative w-full flex items-center justify-center"
                style={isNative ? { maxHeight: nativeMaxHeight, overflow: "hidden" } : undefined}
            />

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
