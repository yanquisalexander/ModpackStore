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

function generateAdHtml(config: ExternalAdConfig): string {
    const width = config.width || "100%";
    const height = config.height || "100%";
    const scriptSrc = config.scriptSrc;

    let bodyHtml = "";

    if (config.format === "hilltopads") {
        const settingsJson = JSON.stringify(config.settings || {});
        bodyHtml = `<script>
(function(pbqc){
var d = document,
    s = d.createElement('script'),
    l = d.currentScript || d.scripts[d.scripts.length - 1];
s.settings = pbqc || {};
s.src = ${JSON.stringify(scriptSrc)};
s.async = true;
s.referrerPolicy = 'no-referrer-when-downgrade';
l.parentNode.insertBefore(s, l);
})(${settingsJson});
</script>`;
    } else if (config.format === "exoclick") {
        const zoneId = config.zoneId || "";
        const insClass = config.insClass || "eas6a97888e2";
        bodyHtml = `<ins class="${insClass}" data-zoneid="${zoneId}"></ins>
<script async type="application/javascript" src="${scriptSrc}"></script>
<script>(AdProvider = window.AdProvider || []).push({"serve": {}});</script>`;
    } else {
        const optionsScript = config.options
            ? `<script>window.atOptions=${JSON.stringify(config.options)};</script>`
            : "";
        let containerHtml = "";
        if (config.native && config.containerId) {
            containerHtml = `<div id="${config.containerId}" style="width:${width};height:${height};max-height:200px;overflow:hidden;"></div>`;
        }
        bodyHtml = `${containerHtml}${optionsScript}<script src="${scriptSrc}"></script>`;
    }

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <base target="_blank" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      * { box-sizing: border-box; }
    </style>
  </head>
  <body>
    ${bodyHtml}
  </body>
</html>`;
}

export const ExternalAdRenderer: React.FC<ExternalAdRendererProps> = ({
    config,
    variant = "banner",
    className = "",
}) => {
    // Mode: "local" uses sandboxed srcDoc iframe (isolated, cannot escape or cover titlebar, avoids domain mismatch),
    // "remote" uses the hosted Vercel endpoint.
    const renderMode = config.renderMode || "local";

    const localHtml = useMemo(() => {
        if (renderMode !== "local") return "";
        return generateAdHtml(config);
    }, [config, renderMode]);

    const iframeSrc = useMemo(() => {
        if (renderMode !== "remote") return "";
        const payload: Record<string, unknown> = {
            scriptSrc: config.scriptSrc,
        };
        if (config.containerId) payload.containerId = config.containerId;
        if (config.format) payload.format = config.format;
        if (config.zoneId) payload.zoneId = config.zoneId;
        if (config.insClass) payload.insClass = config.insClass;
        if (config.settings) payload.settings = config.settings;
        if (config.width) payload.width = config.width;
        if (config.height) payload.height = config.height;
        if (config.native) payload.native = true;
        if (config.options) payload.options = config.options;
        if (config.scriptAttrs) payload.scriptAttrs = config.scriptAttrs;

        return `${ADS_BASE_URL}/ads/serve?payload=${encodeURIComponent(encodeBase64Url(payload))}`;
    }, [config, renderMode]);

    const iframeHeight = config.height || "auto";

    const iframeAllow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";

    if (variant === "sidebar") {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ contain: "paint", isolation: "isolate" }}
                className={`relative rounded-xl overflow-hidden border border-white/[0.08] bg-[#141418] hover:border-white/[0.18] transition-all p-4 space-y-3 shadow-lg ${className}`}
            >
                <div className="relative w-full flex items-center justify-center rounded-lg overflow-hidden bg-black/40 max-w-full">
                    <iframe
                        {...(renderMode === "local" ? { srcDoc: localHtml } : { src: iframeSrc })}
                        style={{ width: "100%", height: iframeHeight, border: "none", maxWidth: "100%" }}
                        allow={iframeAllow}
                        referrerPolicy="no-referrer-when-downgrade"
                        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
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
            style={{ contain: "paint", isolation: "isolate" }}
            className={`relative rounded-2xl overflow-hidden border border-white/[0.08] bg-[#121215] hover:border-white/[0.18] transition-all duration-300 shadow-xl ${className}`}
        >
            <div className="relative w-full flex items-center justify-center overflow-hidden max-w-full">
                <iframe
                    {...(renderMode === "local" ? { srcDoc: localHtml } : { src: iframeSrc })}
                    style={{ width: "100%", height: iframeHeight, border: "none", maxWidth: "100%" }}
                    allow={iframeAllow}
                    referrerPolicy="no-referrer-when-downgrade"
                    sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
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
