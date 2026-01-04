import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from "sonner";
import { useAuthentication } from '@/stores/AuthContext';
import { invoke } from '@tauri-apps/api/core';
import { trackSectionView } from "@/lib/analytics";
import { open } from "@tauri-apps/plugin-dialog";
import { useI18n } from '@/hooks/useI18n';
import { getVersion } from '@tauri-apps/api/app';

// Lucide Icons
import {
    Settings as LucideSettings,
    Folder as LucideFolder,
    Save as LucideSave,
    Loader as LucideLoader,
    X as LucideX,
    Search as LucideSearch
} from "lucide-react";

// UI Components
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

// Sub-components
import { ConfigSection } from '@/components/configuration/ConfigSection';
import { ThemeSelector } from '@/components/theme/ThemeSelector';
import { WhitelistModeSettings } from '@/components/WhitelistModeSettings';
import { HotkeyRecorder } from '@/components/configuration/HotkeyRecorder';

// Types
import type {
    ConfigDefinition,
    ConfigSchema,
    ConfigState,
    ConfigurationDialogProps
} from '@/types/configuration';
import { TranslatedText } from "@/providers/I18nProvider";

export const ConfigurationDialog = ({ isOpen, onClose }: ConfigurationDialogProps) => {
    const { isAuthenticated } = useAuthentication();
    const { availableLanguages, detectedSystemLanguage, resetToSystemLanguage, t } = useI18n();

    // State
    const [config, setConfig] = useState<ConfigState>({
        values: {},
        schema: {},
        sections: [],
        loading: true,
        saving: false,
        gitHash: 'Loading...'
    });

    const [selectedSection, setSelectedSection] = useState<string | null>(null);
    const [sidebarSearch, setSidebarSearch] = useState<string>('');
    const [appVersion, setAppVersion] = useState<string>('Loading...');

    // --- DATA LOADING ---
    const loadConfig = useCallback(async () => {
        try {
            setConfig(prev => ({ ...prev, loading: true }));
            const [schema, values, gitHash] = await Promise.all([
                invoke<ConfigSchema>('get_schema'),
                invoke<Record<string, any>>('get_config'),
                invoke<string>('get_git_hash').catch(() => 'Unknown')
            ]);

            const sections = Array.from(new Set(
                Object.values(schema)
                    .map(def => def.ui_section)
                    .filter(section => section && section !== "internal")
            ));

            setConfig({ values, schema, sections, loading: false, saving: false, gitHash });
            setSelectedSection('Inicio'); // Mostrar Inicio por defecto

            try {
                const v = await getVersion();
                setAppVersion(v || 'Unknown');
            } catch { setAppVersion('Unknown'); }

        } catch (error) {
            console.error(error);
            toast.error(t('config.loadError'));
            setConfig(prev => ({ ...prev, loading: false }));
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            trackSectionView("configuration");
            loadConfig();
        }
    }, [isOpen, loadConfig]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        if (isOpen) document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // --- HANDLERS (Iguales que antes) ---
    const getConfigsForSection = useMemo(() => (section: string) => {
        return Object.entries(config.schema)
            .filter(([_, def]) => def.ui_section === section)
            .sort(([a], [b]) => a.localeCompare(b));
    }, [config.schema]);

    const handleConfigChange = useCallback((key: string, value: any) => {
        setConfig(prev => ({ ...prev, values: { ...prev.values, [key]: value } }));
    }, []);

    const handleRestoreDefaults = useCallback((section: string) => {
        const defaults: Record<string, any> = {};
        getConfigsForSection(section).forEach(([key, def]) => defaults[key] = def.default);
        setConfig(prev => ({ ...prev, values: { ...prev.values, ...defaults } }));
        toast.success(`Valores restaurados para ${section}`);
    }, [getConfigsForSection]);

    const selectDirectory = useCallback(async (key: string, currentPath: string) => {
        try {
            const selected = await open({
                directory: true, multiple: false, defaultPath: currentPath,
                title: `Seleccionar ${config.schema[key]?.description || "directorio"}`
            });
            if (selected && !Array.isArray(selected)) handleConfigChange(key, selected);
        } catch { toast.error("Error al seleccionar directorio"); }
    }, [config.schema, handleConfigChange]);

    const handleSaveConfig = useCallback(async () => {
        try {
            setConfig(prev => ({ ...prev, saving: true }));
            const configToSave = Object.entries(config.values).filter(([key]) => key !== 'selectedTheme');
            await Promise.all(configToSave.map(([key, value]) => invoke('set_config', { key, value })));

            // Recargar hotkeys con la nueva configuración
            await invoke('reload_hotkeys');

            toast.success(t('config.saveSuccess'), { description: t('config.saveSuccessDescription') });
            setConfig(prev => ({ ...prev, saving: false }));
            onClose();
        } catch (error) {
            console.error(error);
            toast.error(t('config.saveError'));
            setConfig(prev => ({ ...prev, saving: false }));
        }
    }, [config.values, onClose, t]);

    // --- RENDERERS ---
    const renderConfigControl = useCallback((key: string, def: ConfigDefinition) => {
        const value = config.values[key] ?? def.default;
        const commonClass = "bg-black/20 border-white/10 text-white placeholder:text-white/20 focus:border-white/20 transition-all rounded-lg";

        switch (def.type) {
            case "string":
                return <Input className={commonClass} value={value || ''} onChange={(e) => handleConfigChange(key, e.target.value)} />;
            case "integer":
            case "float":
                return (
                    <Input
                        className={commonClass} type="number"
                        value={value || def.default} min={def.min} max={def.max}
                        step={def.type === "float" ? (def.step || 0.1) : 1}
                        onChange={(e) => handleConfigChange(key, def.type === "integer" ? parseInt(e.target.value) : parseFloat(e.target.value))}
                    />
                );
            case "slider":
                return (
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs text-white/40">
                            <span>{def.min}</span><span className="font-medium text-white">{value}</span><span>{def.max}</span>
                        </div>
                        <Slider value={[value || def.default]} onValueChange={(val) => handleConfigChange(key, val[0])} min={def.min || 0} max={def.max || 100} step={def.step || 1} className="w-full" />
                    </div>
                );
            case "boolean":
                return <Switch checked={value === true} onCheckedChange={(checked) => handleConfigChange(key, checked)} />;
            case "path":
                return (
                    <div className="flex gap-2">
                        <Input className={commonClass} value={value || ''} onChange={(e) => handleConfigChange(key, e.target.value)} readOnly={def.validator !== undefined} />
                        <Button variant="secondary" onClick={() => selectDirectory(key, value)} className="shrink-0 bg-white/5 hover:bg-white/10 text-white border border-white/5">
                            <LucideFolder className="h-4 w-4 mr-2" /> Examinar
                        </Button>
                    </div>
                );
            case "enum":
                return (
                    <Select value={value || def.default} onValueChange={(val) => handleConfigChange(key, val)}>
                        <SelectTrigger className={commonClass}><SelectValue placeholder={def.description} /></SelectTrigger>
                        <SelectContent className="bg-[#121212] border-white/10 text-white">
                            {def.choices?.map((c, i) => <SelectItem key={i} value={c} className="focus:bg-white/10 cursor-pointer">{c}</SelectItem>)}
                        </SelectContent>
                    </Select>
                );
            case "language_enum":
                return (
                    <div className="space-y-2">
                        <Select value={value || def.default} onValueChange={(val) => handleConfigChange(key, val)}>
                            <SelectTrigger className={commonClass}><SelectValue placeholder="Seleccionar idioma" /></SelectTrigger>
                            <SelectContent className="bg-[#121212] border-white/10 text-white">
                                {availableLanguages.map((lang) => (
                                    <SelectItem key={lang} value={lang} className="focus:bg-white/10 cursor-pointer">
                                        <TranslatedText id={`languages.${lang}`} /> {lang === detectedSystemLanguage && "(Detectado)"}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {detectedSystemLanguage && detectedSystemLanguage !== value && (
                            <Button variant="ghost" size="sm" onClick={() => { resetToSystemLanguage(); handleConfigChange(key, detectedSystemLanguage); }} className="w-full text-xs text-white/50 hover:text-white">
                                Usar idioma del sistema
                            </Button>
                        )}
                    </div>
                );
            case "hotkey":
                return <HotkeyRecorder value={String(value || def.default)} onChange={(val) => handleConfigChange(key, val)} />;
            default:
                return <Input className={commonClass} value={String(value) || ''} onChange={(e) => handleConfigChange(key, e.target.value)} />;
        }
    }, [config.values, handleConfigChange, selectDirectory, availableLanguages, detectedSystemLanguage]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {/* CORRECCIÓN AQUÍ:
                1. top-8 (32px): Empuja el modal hacia abajo para no tapar el titlebar.
                2. border-t: Crea una línea divisoria sutil arriba.
                3. z-[40]: Asegura que esté encima del contenido pero debajo de alertas (z-50) o titlebar si es flotante.
            */}
            <motion.div
                className="fixed inset-x-0 bottom-0 top-8 z-[40] overflow-hidden border-t border-white/10"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
            >
                {/* FONDO Y BLUR
                   Aplicamos el fondo sólido translúcido aquí para que cubra todo el espacio disponible
                */}
                <div className="absolute inset-0 bg-[#09090b]/95 backdrop-blur-2xl flex flex-col">

                    {/* CONTAINER GRID */}
                    <div className="flex-1 flex overflow-hidden">

                        {/* --- SIDEBAR --- */}
                        <aside className="w-64 min-w-[240px] flex flex-col gap-4 p-4 border-r border-white/5 bg-white/[0.02]">
                            <div className="flex items-center justify-between pl-2">
                                <div className="flex items-center gap-2 text-white">
                                    <LucideSettings className="h-5 w-5 text-blue-500" />
                                    <h3 className="font-bold tracking-tight">Ajustes</h3>
                                </div>
                                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full hover:bg-white/10 text-white/60 hover:text-white">
                                    <LucideX className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="relative">
                                <LucideSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                                <Input
                                    placeholder="Buscar..."
                                    value={sidebarSearch}
                                    onChange={(e) => setSidebarSearch(e.target.value)}
                                    className="pl-9 bg-black/20 border-white/5 text-white placeholder:text-white/20 h-9 rounded-lg focus:border-white/10 focus:bg-black/40 transition-all"
                                />
                            </div>

                            <nav className="flex-1 overflow-y-auto space-y-1 pr-2 scrollbar-thin scrollbar-thumb-white/10">
                                {/* Tab Inicio fijo al principio */}
                                <button
                                    key="Inicio"
                                    onClick={() => setSelectedSection('Inicio')}
                                    className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between text-sm transition-all ${selectedSection === 'Inicio'
                                        ? 'bg-blue-600/10 text-blue-400 font-medium'
                                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                                        }`}
                                >
                                    <span className="capitalize">Inicio</span>
                                    {selectedSection === 'Inicio' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                                </button>
                                {config.sections
                                    .filter(s => s.toLowerCase().includes(sidebarSearch.toLowerCase()))
                                    .map((section) => (
                                        <button
                                            key={section}
                                            onClick={() => setSelectedSection(section)}
                                            className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between text-sm transition-all ${selectedSection === section
                                                ? 'bg-blue-600/10 text-blue-400 font-medium'
                                                : 'text-white/60 hover:bg-white/5 hover:text-white'
                                                }`}
                                        >
                                            <span className="capitalize">{section}</span>
                                            {selectedSection === section && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                                        </button>
                                    ))}
                            </nav>

                            <div className="text-[10px] text-white/20 font-mono text-center pt-2 border-t border-white/5">
                                v{appVersion} ({config.gitHash.slice(0, 7)})
                            </div>
                        </aside>

                        {/* --- MAIN CONTENT --- */}
                        <main className="flex-1 overflow-y-auto p-8 relative scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            {config.loading ? (
                                <div className="flex flex-col items-center justify-center h-full text-white/30 gap-4">
                                    <LucideLoader className="h-10 w-10 animate-spin" />
                                    <p className="text-sm font-medium tracking-wider uppercase">Cargando...</p>
                                </div>
                            ) : (
                                <div className="max-w-3xl mx-auto space-y-8 pb-24">
                                    {selectedSection === 'Inicio' ? (
                                        <>
                                            <Card className="bg-white/[0.02] border-white/5">
                                                <CardHeader>
                                                    <CardTitle className="text-white">Temas</CardTitle>
                                                    <CardDescription className="text-white/40">Personaliza la apariencia</CardDescription>
                                                </CardHeader>
                                                <CardContent>
                                                    <ThemeSelector />
                                                </CardContent>
                                            </Card>

                                            {isAuthenticated && (
                                                <>
                                                    <WhitelistModeSettings />
                                                    <Card className="bg-white/[0.02] border-white/5 border-dashed">
                                                        <CardContent className="h-32 flex items-center justify-center text-white/20 text-sm">
                                                            Más opciones próximamente
                                                        </CardContent>
                                                    </Card>
                                                </>
                                            )}
                                        </>
                                    ) : selectedSection ? (
                                        <ConfigSection
                                            title={selectedSection}
                                            description={`Configuración de ${selectedSection}`}
                                            configs={getConfigsForSection(selectedSection)}
                                            values={config.values}
                                            onConfigChange={handleConfigChange}
                                            onRestoreDefaults={() => handleRestoreDefaults(selectedSection)}
                                            renderConfigControl={renderConfigControl}
                                        />
                                    ) : null}
                                </div>
                            )}
                        </main>
                    </div>

                    {/* --- FOOTER ACTIONS --- */}
                    <div className="absolute bottom-6 right-8 flex gap-3 z-50">
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            disabled={config.saving}
                            className="text-white/60 hover:text-white hover:bg-white/10"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleSaveConfig}
                            disabled={config.loading || config.saving}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 shadow-lg shadow-blue-900/20"
                        >
                            {config.saving ? <LucideLoader className="h-4 w-4 mr-2 animate-spin" /> : <LucideSave className="h-4 w-4 mr-2" />}
                            {config.saving ? 'Guardando...' : 'Guardar Cambios'}
                        </Button>
                    </div>

                </div>
            </motion.div>
        </AnimatePresence>
    );
};