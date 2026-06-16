import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from "sonner";
import { useAuthentication } from '@/stores/AuthContext';
import { invoke } from '@tauri-apps/api/core';
import { trackSectionView } from "@/lib/analytics";
import { open } from "@tauri-apps/plugin-dialog";
import { useI18n } from '@/hooks/useI18n';
import { getVersion } from '@tauri-apps/api/app';

import {
    Settings as LucideSettings,
    Folder as LucideFolder,
    Save as LucideSave,
    Loader as LucideLoader,
    X as LucideX,
    Search as LucideSearch,
    Home as LucideHome,
    Gamepad2 as LucideGamepad2,
    Keyboard as LucideKeyboard,
    FlaskConical as LucideFlaskConical,
    Bug as LucideBug,
    Wrench as LucideWrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

import { ConfigSection } from '@/components/configuration/ConfigSection';
import { ThemeSelector } from '@/components/theme/ThemeSelector';
import { WhitelistModeSettings } from '@/components/WhitelistModeSettings';
import { HotkeyRecorder } from '@/components/configuration/HotkeyRecorder';

import type {
    ConfigDefinition,
    ConfigSchema,
    ConfigState,
    ConfigurationDialogProps
} from '@/types/configuration';
import { TranslatedText } from "@/providers/I18nProvider";

const sectionIconMap: Record<string, LucideIcon> = {
    'Inicio': LucideHome,
    'directories': LucideFolder,
    'general': LucideSettings,
    'gameplay': LucideGamepad2,
    'hotkeys': LucideKeyboard,
    'experimental': LucideFlaskConical,
};

export const ConfigurationDialog = ({ isOpen, onClose }: ConfigurationDialogProps) => {
    const { isAuthenticated } = useAuthentication();
    const { availableLanguages, detectedSystemLanguage, resetToSystemLanguage, t } = useI18n();

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
    const [clickHint, setClickHint] = useState('');
    const clickRef = useRef({ count: 0, lastTime: 0 });

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
            setSelectedSection('Inicio');

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

    const getConfigsForSection = useMemo(() => (section: string) => {
        return Object.entries(config.schema)
            .filter(([_, def]) => def.ui_section === section)
            .sort(([a], [b]) => a.localeCompare(b));
    }, [config.schema]);

    const experimentalConfigs = useMemo(() =>
        Object.entries(config.schema)
            .filter(([_, def]) => def.ui_section === "experimental")
            .sort(([a], [b]) => a.localeCompare(b)),
        [config.schema]
    );

    const handleConfigChange = useCallback((key: string, value: any) => {
        setConfig(prev => ({ ...prev, values: { ...prev.values, [key]: value } }));
    }, []);

    const handleGitHashClick = async () => {
        const now = Date.now();
        if (now - clickRef.current.lastTime > 2000) {
            clickRef.current = { count: 1, lastTime: now };
            setClickHint('(1/7)');
            return;
        }
        const newCount = clickRef.current.count + 1;
        clickRef.current = { count: newCount, lastTime: now };

        if (newCount >= 7) {
            clickRef.current = { count: 0, lastTime: now };
            setClickHint('');

            const newDevMode = !(config.values.developerMode === true);
            try {
                await invoke('set_config', { key: 'developerMode', value: newDevMode });
                await loadConfig();
                toast.success(newDevMode ? '🔧 Modo desarrollador activado' : 'Modo desarrollador desactivado');
            } catch {
                toast.error('Error al cambiar modo desarrollador');
            }
        } else {
            setClickHint(`(${newCount}/7)`);
        }
    };

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
                        <button onClick={() => selectDirectory(key, value)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.06] transition-colors flex-shrink-0">
                            <LucideFolder className="h-3.5 w-3.5" /> Examinar
                        </button>
                    </div>
                );
            case "enum":
                return (
                    <Select value={value || def.default} onValueChange={(val) => handleConfigChange(key, val)}>
                        <SelectTrigger className={commonClass}><SelectValue placeholder={def.description} /></SelectTrigger>
                        <SelectContent className="bg-[#121214] border-white/[0.06] text-white">
                            {def.choices?.map((c, i) => <SelectItem key={i} value={c} className="focus:bg-white/[0.04] cursor-pointer">{c}</SelectItem>)}
                        </SelectContent>
                    </Select>
                );
            case "language_enum":
                return (
                    <div className="space-y-2">
                        <Select value={value || def.default} onValueChange={(val) => handleConfigChange(key, val)}>
                            <SelectTrigger className={commonClass}><SelectValue placeholder="Seleccionar idioma" /></SelectTrigger>
                            <SelectContent className="bg-[#121214] border-white/[0.06] text-white">
                                {availableLanguages.map((lang) => (
                                    <SelectItem key={lang} value={lang} className="focus:bg-white/[0.04] cursor-pointer">
                                        <TranslatedText id={`languages.${lang}`} /> {lang === detectedSystemLanguage && "(Detectado)"}
                                    </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                        {detectedSystemLanguage && detectedSystemLanguage !== value && (
                            <button onClick={() => { resetToSystemLanguage(); handleConfigChange(key, detectedSystemLanguage); }} className="w-full text-xs text-neutral-600 hover:text-neutral-400 transition-colors text-left">
                                Usar idioma del sistema
                            </button>
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
            <motion.div
                className="fixed inset-x-0 bottom-0 top-8 z-[40] overflow-hidden border-t border-white/[0.06]"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
            >
                <div className="absolute inset-0 bg-[#0e0e10] flex flex-col">

                    <div className="flex-1 flex overflow-hidden">

                        <aside className="w-64 min-w-[240px] flex flex-col gap-4 p-4 border-r border-white/[0.04]">
                            <div className="flex items-center justify-between pl-1">
                                <div className="flex items-center gap-2 text-white/80">
                                    <LucideSettings className="h-4 w-4" />
                                    <h3 className="text-base font-semibold">Ajustes</h3>
                                </div>
                                <button onClick={onClose} className="flex size-7 items-center justify-center text-neutral-600 hover:text-neutral-400 hover:bg-white/[0.04] rounded-md transition-colors">
                                    <LucideX className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="relative">
                                <LucideSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-600" />
                                <Input
                                    placeholder="Buscar..."
                                    value={sidebarSearch}
                                    onChange={(e) => setSidebarSearch(e.target.value)}
                                    className="pl-8 bg-black/20 border-white/[0.04] text-white placeholder:text-neutral-600 h-9 text-sm rounded-md focus:border-white/10 transition-all"
                                />
                            </div>

                            <nav className="flex-1 overflow-y-auto space-y-0.5 pr-1 scrollbar-thin scrollbar-thumb-white/10">
                                <button
                                    key="Inicio"
                                    onClick={() => setSelectedSection('Inicio')}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2 ${
                                        selectedSection === 'Inicio'
                                            ? 'bg-white/[0.04] text-white'
                                            : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.02]'
                                    }`}
                                >
                                    <LucideHome className="h-4 w-4 shrink-0" />
                                    <span className="capitalize">Inicio</span>
                                </button>
                                {config.sections
                                    .filter(s => {
                                        if (config.values.developerMode === true && s === "experimental") return false;
                                        return s.toLowerCase().includes(sidebarSearch.toLowerCase());
                                    })
                                    .map((section) => {
                                        const Icon = sectionIconMap[section] ?? LucideWrench;
                                        return (
                                            <button
                                                key={section}
                                                onClick={() => setSelectedSection(section)}
                                                className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2 ${
                                                    selectedSection === section
                                                        ? 'bg-white/[0.04] text-white'
                                                        : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.02]'
                                                }`}
                                            >
                                                <Icon className="h-4 w-4 shrink-0" />
                                                <span className="capitalize">{section}</span>
                                            </button>
                                        );
                                    })}

                                {config.values.developerMode === true && (
                                    <button
                                        key="Flags"
                                        onClick={() => setSelectedSection('Flags')}
                                        className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2 ${
                                            selectedSection === 'Flags'
                                                ? 'bg-white/[0.04] text-white'
                                                : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.02]'
                                        }`}
                                    >
                                        <LucideFlaskConical className="h-4 w-4 shrink-0" />
                                        <span>Flags</span>
                                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 font-semibold">DEV</span>
                                    </button>
                                )}
                            </nav>

                            <button
                                onClick={handleGitHashClick}
                                className="w-full text-xs text-neutral-700 font-mono text-center pt-2 border-t border-white/[0.04] hover:text-neutral-500 transition-colors"
                                title={clickHint || undefined}
                            >
                                v{appVersion} ({config.gitHash.slice(0, 7)}){clickHint && ` ${clickHint}`}
                            </button>
                        </aside>

                        <main className="flex-1 overflow-y-auto p-6 relative scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            {config.loading ? (
                                <div className="flex flex-col items-center justify-center h-full text-neutral-600 gap-3">
                                    <LucideLoader className="h-8 w-8 animate-spin" />
                                    <p className="text-sm font-medium tracking-wider uppercase">Cargando...</p>
                                </div>
                            ) : (
                                <div className="max-w-3xl mx-auto space-y-6 pb-24">
                                    {selectedSection === 'Inicio' ? (
                                        <>
                                            <section>
                                                <div className="mb-4">
                                                    <h2 className="text-base font-semibold text-white/80">Temas</h2>
                                                    <p className="text-sm text-neutral-600 mt-0.5">Personaliza la apariencia</p>
                                                </div>
                                                <ThemeSelector />
                                            </section>

                                            {isAuthenticated && (
                                                <>
                                                    <WhitelistModeSettings />
                                                    <div className="h-24 flex items-center justify-center text-neutral-700 text-sm border border-dashed border-white/[0.04] rounded-lg">
                                                        Más opciones próximamente
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    ) : selectedSection === 'Flags' ? (
                                        <ConfigSection
                                            title="Flags"
                                            description="Opciones experimentales — úsalas con precaución"
                                            configs={experimentalConfigs}
                                            values={config.values}
                                            onConfigChange={handleConfigChange}
                                            onRestoreDefaults={() => handleRestoreDefaults('experimental')}
                                            renderConfigControl={renderConfigControl}
                                        />
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

                    <div className="absolute bottom-6 right-8 flex gap-3 z-50">
                        <button
                            onClick={onClose}
                            disabled={config.saving}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04] transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSaveConfig}
                            disabled={config.loading || config.saving}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-white text-black hover:bg-white/90 transition-colors disabled:opacity-50"
                        >
                            {config.saving ? <LucideLoader className="h-3.5 w-3.5 animate-spin" /> : <LucideSave className="h-3.5 w-3.5" />}
                            {config.saving ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>

                </div>
            </motion.div>
        </AnimatePresence>
    );
};
