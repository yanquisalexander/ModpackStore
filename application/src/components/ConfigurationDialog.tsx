import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from "sonner";
import { useAuthentication } from '@/stores/AuthContext';
import { invoke } from '@tauri-apps/api/core';
import { trackSectionView } from "@/lib/analytics";
import { open } from "@tauri-apps/plugin-dialog";

// Lucide Icons
import {
    Settings as LucideSettings,
    Folder as LucideFolder,
    Save as LucideSave,
    Loader as LucideLoader,
    X as LucideX
} from "lucide-react";

// shadcn/ui components
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

// Tipos optimizados
interface ConfigurationDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ConfigDefinition {
    type: 'string' | 'integer' | 'float' | 'boolean' | 'path' | 'enum' | 'slider';
    default: any;
    description: string;
    ui_section: string;
    client?: boolean;
    min?: number;
    max?: number;
    step?: number;
    choices?: any[];
    validator?: string;
}

interface ConfigSchema {
    [key: string]: ConfigDefinition;
}

interface ConfigState {
    values: Record<string, any>;
    schema: ConfigSchema;
    sections: string[];
    loading: boolean;
    saving: boolean;
    gitHash: string;
}

export const ConfigurationDialog = ({ isOpen, onClose }: ConfigurationDialogProps) => {
    const { isAuthenticated } = useAuthentication();

    // Estado consolidado
    const [config, setConfig] = useState<ConfigState>({
        values: {},
        schema: {},
        sections: [],
        loading: true,
        saving: false,
        gitHash: 'Loading...'
    });

    const [activeTab, setActiveTab] = useState<string>("");

    // Cargar configuración optimizada
    const loadConfig = useCallback(async () => {
        try {
            setConfig(prev => ({ ...prev, loading: true }));

            // Cargar en paralelo
            const [schema, values, gitHash] = await Promise.all([
                invoke<ConfigSchema>('get_schema'),
                invoke<Record<string, any>>('get_config'),
                invoke<string>('get_git_hash').catch(() => 'Error fetching hash')
            ]);

            // Extraer secciones
            const sections = Array.from(
                new Set(
                    Object.values(schema)
                        .map(def => def.ui_section)
                        .filter(section => section && section !== "internal")
                )
            );

            setConfig({
                values,
                schema,
                sections,
                loading: false,
                saving: false,
                gitHash
            });

            // Establecer primera sección como activa si no hay una seleccionada
            if (sections.length > 0 && !activeTab) {
                setActiveTab(sections[0]);
            }

        } catch (error) {
            console.error("Failed to load config:", error);
            toast.error("Error al cargar la configuración");
            setConfig(prev => ({ ...prev, loading: false }));
        }
    }, [activeTab]);

    // Efectos optimizados
    useEffect(() => {
        if (isOpen) {
            trackSectionView("configuration");
            loadConfig();
        }
    }, [isOpen, loadConfig]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, onClose]);

    // Obtener configuraciones para sección (memoizado)
    const getConfigsForSection = useMemo(() => {
        return (section: string): [string, ConfigDefinition][] => {
            return Object.entries(config.schema)
                .filter(([_, def]) => def.ui_section === section)
                .sort(([a], [b]) => a.localeCompare(b));
        };
    }, [config.schema]);

    // Manejar cambios de configuración
    const handleConfigChange = useCallback((key: string, value: any) => {
        setConfig(prev => ({
            ...prev,
            values: { ...prev.values, [key]: value }
        }));
    }, []);

    // Seleccionar directorio
    const selectDirectory = useCallback(async (key: string, currentPath: string) => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                defaultPath: currentPath,
                title: `Seleccionar ${config.schema[key]?.description || "directorio"}`
            });

            if (selected && !Array.isArray(selected)) {
                handleConfigChange(key, selected);
            }
        } catch (error) {
            console.error("Error al seleccionar directorio:", error);
            toast.error("Error al seleccionar directorio");
        }
    }, [config.schema, handleConfigChange]);

    // Guardar configuración optimizada
    const handleSaveConfig = useCallback(async () => {
        try {
            setConfig(prev => ({ ...prev, saving: true }));

            // Usar Promise.all para guardar en paralelo
            await Promise.all(
                Object.entries(config.values).map(([key, value]) =>
                    invoke('set_config', { key, value })
                )
            );

            toast.success("Configuración guardada", {
                description: "Los cambios han sido guardados correctamente.",
                richColors: true,
            });

            setConfig(prev => ({ ...prev, saving: false }));
            onClose();
        } catch (error) {
            console.error("Error al guardar configuración:", error);
            toast.error("Error al guardar", {
                description: "No se pudo guardar la configuración. Intenta nuevamente.",
            });
            setConfig(prev => ({ ...prev, saving: false }));
        }
    }, [config.values, onClose]);

    // Renderizar controles optimizado
    const renderConfigControl = useCallback((key: string, def: ConfigDefinition) => {
        const value = config.values[key] ?? def.default;

        const commonInputProps = {
            className: "bg-neutral-800 border-neutral-700 text-white"
        };

        switch (def.type) {
            case "string":
                return (
                    <Input
                        {...commonInputProps}
                        value={value || ''}
                        onChange={(e) => handleConfigChange(key, e.target.value)}
                    />
                );

            case "integer":
            case "float":
                return (
                    <Input
                        {...commonInputProps}
                        type="number"
                        value={value || def.default}
                        min={def.min}
                        max={def.max}
                        step={def.type === "float" ? (def.step || 0.1) : 1}
                        onChange={(e) => handleConfigChange(key,
                            def.type === "integer"
                                ? parseInt(e.target.value) || def.default
                                : parseFloat(e.target.value) || def.default
                        )}
                    />
                );

            case "slider":
                return (
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm text-neutral-400">
                            <span>{def.min}</span>
                            <span className="text-white font-medium">{value}</span>
                            <span>{def.max}</span>
                        </div>
                        <Slider
                            value={[value || def.default]}
                            onValueChange={(val) => handleConfigChange(key, val[0])}
                            min={def.min || 0}
                            max={def.max || 100}
                            step={def.step || 1}
                            className="w-full"
                        />
                    </div>
                );

            case "boolean":
                return (
                    <Switch
                        checked={value === true}
                        onCheckedChange={(checked) => handleConfigChange(key, checked)}
                    />
                );

            case "path":
                return (
                    <div className="flex gap-2">
                        <Input
                            {...commonInputProps}
                            value={value || ''}
                            onChange={(e) => handleConfigChange(key, e.target.value)}
                            readOnly={def.validator !== undefined}
                        />
                        <Button
                            variant="outline"
                            onClick={() => selectDirectory(key, value)}
                            className="border-neutral-700 hover:bg-neutral-800 hover:text-white shrink-0"
                        >
                            <LucideFolder className="h-4 w-4 mr-2" />
                            Examinar
                        </Button>
                    </div>
                );

            case "enum":
                return (
                    <Select
                        value={value || def.default}
                        onValueChange={(val) => handleConfigChange(key, val)}
                    >
                        <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white">
                            <SelectValue placeholder={def.description} />
                        </SelectTrigger>
                        <SelectContent className="bg-neutral-800 border-neutral-700 text-white z-[9999]">
                            {def.choices?.map((choice, idx) => (
                                <SelectItem key={idx} value={choice}>
                                    {choice}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );

            default:
                return (
                    <Input
                        {...commonInputProps}
                        value={String(value) || ''}
                        onChange={(e) => handleConfigChange(key, e.target.value)}
                    />
                );
        }
    }, [config.values, handleConfigChange, selectDirectory]);

    // Componente de configuración individual
    const ConfigItem = useCallback(({ configKey, def, showSeparator }: {
        configKey: string;
        def: ConfigDefinition;
        showSeparator: boolean;
    }) => (
        <div key={configKey}>
            {def.type === "boolean" ? (
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label className="text-base font-medium text-white">
                            {def.description}
                        </Label>
                    </div>
                    {renderConfigControl(configKey, def)}
                </div>
            ) : (
                <div className="space-y-2">
                    <Label htmlFor={configKey} className="text-sm font-medium text-white">
                        {def.description}
                    </Label>
                    {renderConfigControl(configKey, def)}
                    {def.type === "slider" && (
                        <p className="text-xs text-neutral-400">
                            Rango: {def.min} - {def.max}
                        </p>
                    )}
                </div>
            )}
            {showSeparator && <Separator className="bg-neutral-800 my-4" />}
        </div>
    ), [renderConfigControl]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-[999] flex items-center justify-center bg-black/75 overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
            >
                <motion.div
                    className="w-full h-full flex flex-col overflow-hidden"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                    {/* Header */}
                    <header className="bg-neutral-900 border-b border-neutral-800 p-4 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <LucideSettings className="h-5 w-5 text-blue-500" />
                            <h2 className="text-xl font-semibold text-white">Configuración</h2>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="rounded-full hover:bg-neutral-800"
                        >
                            <LucideX className="h-5 w-5 text-neutral-400" />
                        </Button>
                    </header>

                    {/* Content */}
                    <main className="flex-1 overflow-y-auto bg-neutral-950 p-4">
                        {config.loading ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="flex flex-col items-center gap-2">
                                    <LucideLoader className="h-8 w-8 animate-spin text-blue-500" />
                                    <p className="text-lg text-white">Cargando configuración...</p>
                                </div>
                            </div>
                        ) : (
                            <div className="max-w-4xl mx-auto">
                                <Card className="bg-neutral-950/50 border-neutral-800">
                                    <CardHeader>
                                        <CardTitle className="text-2xl font-semibold text-white">
                                            Configuración
                                        </CardTitle>
                                        <CardDescription className="text-neutral-400">
                                            Personaliza los ajustes del launcher según tus preferencias
                                        </CardDescription>
                                    </CardHeader>

                                    {config.sections.length > 0 && (
                                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                            <TabsList className="bg-neutral-900 border-b border-neutral-800 mx-4">
                                                {config.sections.map((section) => (
                                                    <TabsTrigger key={section} value={section}>
                                                        {section.charAt(0).toUpperCase() + section.slice(1)}
                                                    </TabsTrigger>
                                                ))}
                                            </TabsList>

                                            <CardContent className="pt-6">
                                                {config.sections.map((section) => {
                                                    const sectionConfigs = getConfigsForSection(section);

                                                    return (
                                                        <TabsContent key={section} value={section} className="space-y-6">
                                                            <div className="space-y-4">
                                                                {sectionConfigs.map(([key, def], index, array) => (
                                                                    <ConfigItem
                                                                        key={key}
                                                                        configKey={key}
                                                                        def={def}
                                                                        showSeparator={index < array.length - 1}
                                                                    />
                                                                ))}

                                                                {/* Opciones adicionales para usuarios autenticados */}
                                                                {isAuthenticated && section === "gameplay" && (
                                                                    <>
                                                                        <Separator className="bg-neutral-800" />
                                                                        <div className="space-y-4">
                                                                            <div className="flex items-center justify-between">
                                                                                <div className="space-y-0.5">
                                                                                    <Label className="text-base font-medium text-white">
                                                                                        Opciones avanzadas
                                                                                    </Label>
                                                                                    <p className="text-sm text-neutral-400">
                                                                                        Opciones adicionales para usuarios autenticados
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </>
                                                                )}

                                                                {/* Placeholder para futuras opciones */}
                                                                {section === "gameplay" && sectionConfigs.length === 0 && (
                                                                    <div className="h-32 flex items-center justify-center rounded-md border border-dashed border-neutral-700 bg-neutral-900/50">
                                                                        <p className="text-sm text-neutral-400">
                                                                            Más opciones estarán disponibles en futuras versiones
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TabsContent>
                                                    );
                                                })}
                                            </CardContent>
                                        </Tabs>
                                    )}
                                </Card>
                            </div>
                        )}
                    </main>

                    {/* Footer */}
                    <footer className="bg-neutral-900 border-t border-neutral-800 p-4 flex justify-between items-center">
                        <div className="text-xs text-neutral-500">
                            Commit: {config.gitHash}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={onClose}
                                className="border-neutral-700 hover:bg-neutral-800 text-white"
                                disabled={config.saving}
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleSaveConfig}
                                disabled={config.loading || config.saving}
                                className="bg-blue-600 hover:bg-blue-500 text-white font-medium"
                            >
                                {config.saving ? (
                                    <>
                                        <LucideLoader className="h-4 w-4 mr-2 animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <LucideSave className="h-4 w-4 mr-2" />
                                        Guardar cambios
                                    </>
                                )}
                            </Button>
                        </div>
                    </footer>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};