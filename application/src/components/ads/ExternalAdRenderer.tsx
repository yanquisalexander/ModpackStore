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

    const safeScriptSrc = config.scriptSrc.startsWith("//")
        ? `https:${config.scriptSrc}`
        : config.scriptSrc;

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <script>
        // 🛡️ MOCK DE SEGURIDAD NIVEL 4 (Notificaciones y Service Workers)
        try {
            // 1. Engañamos a las Cookies y el Storage
            var mockCookie = "";
            Object.defineProperty(document, 'cookie', {
                get: function() { return mockCookie; },
                set: function(val) { mockCookie = val; },
                configurable: true
            });
            
            var mockStorage = {
                getItem: function() { return null; },
                setItem: function() {},
                removeItem: function() {},
                clear: function() {},
                key: function() { return null; },
                length: 0
            };
            Object.defineProperty(window, 'localStorage', { value: mockStorage, configurable: true });
            Object.defineProperty(window, 'sessionStorage', { value: mockStorage, configurable: true });

            // 2. 🚨 BLOQUEO DE NOTIFICACIONES PUSH (Causante del error actual) 🚨
            var MockNotification = function() { return {}; };
            MockNotification.permission = "denied"; // Le decimos que el usuario lo bloqueó
            MockNotification.requestPermission = function() { 
                return Promise.resolve("denied"); // Respondemos a su promesa con un rechazo pacífico
            };
            Object.defineProperty(window, 'Notification', { value: MockNotification, configurable: true });

            // 3. Bloqueo de Service Workers (Usado a veces junto a las notificaciones)
            if (navigator) {
                Object.defineProperty(navigator, 'serviceWorker', {
                    value: {
                        register: function() { return Promise.reject(new Error("Blocked")); },
                        getRegistrations: function() { return Promise.resolve([]); }
                    },
                    configurable: true
                });
            }

            // 4. Interceptor absoluto de XMLHttpRequest
            var RealXHR = window.XMLHttpRequest;
            window.XMLHttpRequest = function() {
                var xhr = new RealXHR();
                Object.defineProperty(xhr, 'withCredentials', {
                    get: function() { return false; },
                    set: function(val) {},
                    enumerable: true,
                    configurable: true
                });
                return xhr;
            };
            window.XMLHttpRequest.prototype = RealXHR.prototype;

            var originalSetRequestHeader = window.XMLHttpRequest.prototype.setRequestHeader;
            window.XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
                if (header.toLowerCase() === 'origin' && (value === 'null' || value === null)) return;
                return originalSetRequestHeader.apply(this, arguments);
            };

            // 5. Interceptor de Fetch (Súper estricto para limpiar headers Origin: null)
            var originalFetch = window.fetch;
            window.fetch = function() {
                var args = Array.prototype.slice.call(arguments);
                try {
                    var init = args[1] || {};
                    init.credentials = 'omit';
                    
                    if (init.headers) {
                        var cleanHeaders = {};
                        var h = init.headers;
                        // Extraemos todos los headers ignorando el Origin problemático
                        if (h instanceof Headers) {
                            h.forEach(function(val, key) { if (key.toLowerCase() !== 'origin' || val !== 'null') cleanHeaders[key] = val; });
                        } else if (Array.isArray(h)) {
                            h.forEach(function(pair) { if (pair[0].toLowerCase() !== 'origin' || pair[1] !== 'null') cleanHeaders[pair[0]] = pair[1]; });
                        } else {
                            for (var key in h) { if (key.toLowerCase() !== 'origin' || h[key] !== 'null') cleanHeaders[key] = h[key]; }
                        }
                        init.headers = cleanHeaders;
                    }
                    args[1] = init;
                } catch(e) {}
                
                return originalFetch.apply(this, args).catch(function() {
                    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
                });
            };

        } catch(e) {
            console.warn("Seguridad del iframe aplicada parcialmente.");
        }
    </script>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { 
            overflow:hidden; 
            background:transparent;
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100vw;
            height: 100vh;
        }
    </style>
</head>
<body>
    ${containerHtml}
    ${optionScript}
    <script src="${safeScriptSrc}"></script>
</body>
</html>`;
}

export const ExternalAdRenderer: React.FC<ExternalAdRendererProps> = ({
    config,
    variant = "banner",
    className = "",
}) => {
    // Ya no usamos Blob URLs, usamos srcDoc (es más rápido y nativo para React/Iframes)
    const htmlContent = useMemo(() => buildAdHtml(config), [config]);

    const iframeWidth = config.width || "100%";
    const iframeHeight = config.height || "auto";

    // Configuramos un sandbox estricto. 
    // Al omitir 'allow-same-origin', nos aseguramos de que el anuncio no pueda 
    // escapar del iframe ni inyectar elementos 'fixed' en tu página principal.
    const strictSandbox = "allow-scripts allow-popups allow-popups-to-escape-sandbox";

    if (variant === "sidebar") {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`relative rounded-xl overflow-hidden border border-white/[0.08] bg-[#141418] hover:border-white/[0.18] transition-all p-4 space-y-3 shadow-lg ${className}`}
            >
                <div className="relative w-full flex items-center justify-center rounded-lg overflow-hidden bg-black/40 max-w-full">
                    <iframe
                        srcDoc={htmlContent}
                        style={{ width: iframeWidth, height: iframeHeight, border: "none", maxWidth: "100%" }}
                        sandbox={strictSandbox}
                        loading="lazy"
                        title="Ad"
                    />
                </div>

                <Tooltip>
                    <TooltipTrigger asChild>
                        {/* Arreglé un typo tuyo aquí: text- a text-xs */}
                        <div className="flex items-center gap-1.5 text-xs text-neutral-500 cursor-help w-max">
                            <LucideInfo className="w-3 h-3" />
                            <span>{config.label || "Publicidad externa"}</span>
                        </div>
                    </TooltipTrigger>
                    {/* Arreglé un typo tuyo aquí: max-w- a max-w-xs */}
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
                    srcDoc={htmlContent}
                    style={{ width: "100%", height: iframeHeight, border: "none", maxWidth: "100%" }}
                    sandbox={strictSandbox}
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