import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RotateCcw } from 'lucide-react';
import type { ConfigSectionProps } from '@/types/configuration';

export const ConfigSection: React.FC<ConfigSectionProps> = ({
    title,
    description,
    configs,
    onRestoreDefaults,
    renderConfigControl
}) => {
    // Título formateado
    const sectionTitle = title.charAt(0).toUpperCase() + title.slice(1);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">

            {/* HEADER DE LA SECCIÓN */}
            <div className="flex items-start justify-between border-b border-white/5 pb-4 mb-6">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight text-white">
                        {sectionTitle}
                    </h2>
                    {description && (
                        <p className="text-sm text-white/50">
                            {description}
                        </p>
                    )}
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRestoreDefaults}
                    className="text-white/40 hover:text-white hover:bg-white/5 h-8 px-3 text-xs"
                >
                    <RotateCcw className="h-3 w-3 mr-2" />
                    Restaurar defecto
                </Button>
            </div>

            {/* LISTA DE CONFIGURACIONES */}
            <div className="space-y-8">
                {configs.length > 0 ? (
                    configs.map(([key, def]) => (
                        <div key={key} className="group">

                            {/* LAYOUT CONDICIONAL (Boolean vs Otros) */}
                            {def.type === "boolean" ? (
                                <div className="flex items-center justify-between p-3 -mx-3 rounded-xl transition-colors hover:bg-white/[0.03]">
                                    <div className="space-y-1 pr-4">
                                        <Label htmlFor={key} className="text-sm font-medium text-white/90 cursor-pointer">
                                            {def.description}
                                        </Label>
                                        {/* Podrías añadir una descripción extendida aquí si existiera en `def` */}
                                    </div>
                                    <div className="shrink-0">
                                        {renderConfigControl(key, def)}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3 p-3 -mx-3 rounded-xl transition-colors hover:bg-white/[0.03]">
                                    <div className="flex justify-between items-center">
                                        <Label htmlFor={key} className="text-sm font-medium text-white/90">
                                            {def.description}
                                        </Label>
                                        {def.type === "slider" && (
                                            <span className="text-xs text-white/40 font-mono">
                                                {/* Aquí podrías mostrar el valor actual si se pasara como prop, o dejarlo en el control */}
                                            </span>
                                        )}
                                    </div>

                                    {renderConfigControl(key, def)}

                                    {def.type === "slider" && (
                                        <div className="flex justify-between text-xs text-white/20 px-1">
                                            <span>Min: {def.min}</span>
                                            <span>Max: {def.max}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="h-40 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] text-center">
                        <p className="text-sm text-white/40">
                            No hay configuraciones disponibles para esta sección.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};