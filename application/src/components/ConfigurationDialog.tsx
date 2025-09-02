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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

// Configuration components
import { ConfigSection } from '@/components/configuration/ConfigSection';

// Types
import type { 
    ConfigDefinition, 
    ConfigSchema, 
    ConfigState, 
    ConfigurationDialogProps 
} from '@/types/configuration';

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

        } catch (error) {
            console.error("Failed to load config:", error);
            toast.error("Error al cargar la configuración");
            setConfig(prev => ({ ...prev, loading: false }));
        }
    }, []);

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

    // Restaurar valores por defecto para una sección
    const handleRestoreDefaults = useCallback((section: string) => {
        const sectionConfigs = getConfigsForSection(section);
        const defaultValues: Record<string, any> = {};
        
        sectionConfigs.forEach(([key, def]) => {
            defaultValues[key] = def.default;
        });
        
        setConfig(prev => ({
            ...prev,
            values: { ...prev.values, ...defaultValues }
        }));
        
        toast.success(`Valores por defecto restaurados para ${section.charAt(0).toUpperCase() + section.slice(1)}`);
    }, [getConfigsForSection]);

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
            className: "bg-background border-input"
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
                        <div className="flex justify-between text-sm text-muted-foreground">
                            <span>{def.min}</span>
                            <span className="font-medium text-foreground">{value}</span>
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
                            className="shrink-0"
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
                        <SelectTrigger className="bg-background border-input">
                            <SelectValue placeholder={def.description} />
                        </SelectTrigger>
                        <SelectContent className="z-[9999]">
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

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
            >
                <motion.div
                    className="w-full h-full max-w-3xl flex flex-col overflow-hidden mx-4"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                    {/* Header */}
                    <header className="bg-card border-b p-4 flex justify-between items-center rounded-t-xl">
                        <div className="flex items-center gap-2">
                            <LucideSettings className="h-5 w-5 text-primary" />
                            <h2 className="text-xl font-semibold">Configuración</h2>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="rounded-full"
                        >
                            <LucideX className="h-5 w-5" />
                        </Button>
                    </header>

                    {/* Content */}
                    <main className="flex-1 overflow-y-auto bg-background p-6">
                        {config.loading ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="flex flex-col items-center gap-2">
                                    <LucideLoader className="h-8 w-8 animate-spin text-primary" />
                                    <p className="text-lg">Cargando configuración...</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Header Card */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-2xl font-semibold">
                                            Configuración
                                        </CardTitle>
                                        <CardDescription>
                                            Personaliza los ajustes del launcher según tus preferencias
                                        </CardDescription>
                                    </CardHeader>
                                </Card>

                                {/* Configuration Sections */}
                                {config.sections.length > 0 && config.sections.map((section) => {
                                    const sectionConfigs = getConfigsForSection(section);
                                    const getSectionDescription = (sectionName: string) => {
                                        switch (sectionName) {
                                            case 'general':
                                                return 'Configuraciones generales del launcher';
                                            case 'gameplay':
                                                return 'Configuraciones relacionadas con el gameplay';
                                            case 'minecraft':
                                                return 'Configuraciones específicas de Minecraft';
                                            case 'account':
                                                return 'Configuraciones de cuenta y autenticación';
                                            default:
                                                return `Configuraciones de ${sectionName}`;
                                        }
                                    };

                                    return (
                                        <ConfigSection
                                            key={section}
                                            title={section}
                                            description={getSectionDescription(section)}
                                            configs={sectionConfigs}
                                            values={config.values}
                                            onConfigChange={handleConfigChange}
                                            onRestoreDefaults={() => handleRestoreDefaults(section)}
                                            renderConfigControl={renderConfigControl}
                                        />
                                    );
                                })}

                                {/* Advanced options for authenticated users */}
                                {isAuthenticated && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-lg font-semibold">
                                                Opciones Avanzadas
                                            </CardTitle>
                                            <CardDescription>
                                                Opciones adicionales para usuarios autenticados
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="h-32 flex items-center justify-center rounded-md border border-dashed border-muted bg-muted/50">
                                                <p className="text-sm text-muted-foreground">
                                                    Próximamente disponibles más opciones avanzadas
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        )}
                    </main>

                    {/* Footer */}
                    <footer className="bg-card border-t p-4 flex justify-between items-center rounded-b-xl">
                        <div className="text-xs text-muted-foreground">
                            Commit: {config.gitHash}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={onClose}
                                disabled={config.saving}
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleSaveConfig}
                                disabled={config.loading || config.saving}
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