import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { LucideShield, LucideInfo, LucideCheckCircle2 } from 'lucide-react';
import { useWhitelistMode } from '@/hooks/useWhitelistMode';
import { cn } from '@/lib/utils';

export const WhitelistModeSettings: React.FC = () => {
    const {
        hasWhitelists,
        whitelistCount,
        isWhitelistMode,
        setWhitelistMode,
        loading
    } = useWhitelistMode();

    if (loading || !hasWhitelists) return null;

    return (
        <div className="group relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] transition-all hover:bg-white/[0.04]">

            {/* Decoración de fondo sutil (Glow) */}
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-purple-500/5 blur-3xl transition-opacity group-hover:opacity-70" />

            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-white/5 p-4">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg border transition-colors",
                        isWhitelistMode
                            ? "bg-purple-500/20 border-purple-500/30 text-purple-300"
                            : "bg-white/5 border-white/10 text-white/40"
                    )}>
                        <LucideShield className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">Whitelist Mode</h3>
                        <p className="text-xs text-white/40">Acceso exclusivo a tus servidores privados</p>
                    </div>
                </div>
                <Badge variant="outline" className="border-white/10 bg-white/5 text-white/60">
                    {whitelistCount} Instancias
                </Badge>
            </div>

            {/* CONTENT */}
            <div className="p-4 space-y-4">

                {/* Toggle Row */}
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <label className="text-sm font-medium text-white/90">Activar Modo Whitelist</label>
                        <p className="text-xs text-white/50 max-w-[280px]">
                            Prioriza tus instancias privadas en la pantalla de inicio.
                        </p>
                    </div>
                    <Switch
                        checked={isWhitelistMode}
                        onCheckedChange={setWhitelistMode}
                        className="data-[state=checked]:bg-purple-600"
                    />
                </div>

                {/* Info Box Dinámico */}
                <div className={cn(
                    "flex gap-3 rounded-lg border p-3 text-xs transition-colors",
                    isWhitelistMode
                        ? "border-purple-500/20 bg-purple-500/10 text-purple-200"
                        : "border-blue-500/20 bg-blue-500/10 text-blue-200"
                )}>
                    {isWhitelistMode ? (
                        <LucideCheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-purple-400" />
                    ) : (
                        <LucideInfo className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                    )}

                    <div className="leading-relaxed opacity-90">
                        {isWhitelistMode ? (
                            <span>
                                Tu pantalla de inicio ahora muestra <strong>Primero las instancias Whitelist</strong>.
                                Aún puedes ver el resto en la sección Explorar.
                            </span>
                        ) : (
                            <span>
                                Habilita esto si usas principalmente modpacks privados.
                                Te ahorrará tiempo al abrir el launcher.
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};