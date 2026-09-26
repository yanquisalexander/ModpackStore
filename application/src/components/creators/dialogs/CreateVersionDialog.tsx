import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    LucidePackage,
    LucideArrowRight,
    LucideArrowLeft,
    LucideCheck,
    LucideX,
    LucideAnvil,
    LucideFeather,
    LucideHammer,
    LucideTestTubeDiagonal,
    LucideAlertTriangle,
    LucideLoader,
    LucideGitBranch,
    LucideSparkles,
    LucideHistory,
    LucideRefreshCw,
    LucideCpu,
    LucideLayers,
} from 'lucide-react';
import { toast } from 'sonner';
import { API_ENDPOINT } from '@/consts';
import { useAuthentication } from '@/stores/AuthContext';
import { fetchMinecraftManifestWithFailover } from '@/utils/minecraftManifestFailover';
import {
    fetchLoaderVersions,
    getModLoaderDisplayName,
    type ModLoaderType,
} from '@/utils/modloaderVersions';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

export interface CreateVersionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    modpack: {
        id: string;
        name: string;
        creatorId?: string;
        publisherId?: string;
        loaderType?: string;
        loaderVersion?: string;
    };
    existingVersions?: Array<{
        id: string;
        version: string;
        mcVersion: string;
        forgeVersion?: string;
        loaderType?: string;
        loaderVersion?: string;
        createdAt?: string;
        status?: string;
    }>;
}

interface MinecraftVersion {
    id: string;
    type: string;
    url: string;
}

interface BreakingChange {
    version: string;
    mcVersion: string;
    loaderType: string;
}

type WizardStep = 'info' | 'loader' | 'confirm' | 'processing';

const STEPS: { key: WizardStep; label: string; icon: any }[] = [
    { key: 'info', label: 'Información', icon: LucideGitBranch },
    { key: 'loader', label: 'Modloader', icon: LucideCpu },
    { key: 'confirm', label: 'Confirmación', icon: LucideCheck },
];

// Modloader brand accent colors are intentionally semantic (cyan=Fabric, amber=Forge, etc.)
const MODLOADERS: {
    type: ModLoaderType;
    label: string;
    description: string;
    icon: any;
    accentColor: string;
    activeBorder: string;
    activeBg: string;
}[] = [
    { type: 'fabric',   label: 'Fabric',   description: 'Rápido y ligero',     icon: LucideFeather,          accentColor: 'text-cyan-400',    activeBorder: 'border-cyan-500/40',    activeBg: 'bg-cyan-500/10' },
    { type: 'forge',    label: 'Forge',    description: 'Ecosistema clásico',   icon: LucideAnvil,            accentColor: 'text-amber-400',   activeBorder: 'border-amber-500/40',   activeBg: 'bg-amber-500/10' },
    { type: 'neoforge', label: 'NeoForge', description: 'Moderno y compatible', icon: LucideHammer,           accentColor: 'text-orange-400',  activeBorder: 'border-orange-500/40',  activeBg: 'bg-orange-500/10' },
    { type: 'quilt',    label: 'Quilt',    description: 'Modular y abierto',    icon: LucideTestTubeDiagonal, accentColor: 'text-purple-400',  activeBorder: 'border-purple-500/40',  activeBg: 'bg-purple-500/10' },
    { type: 'vanilla',  label: 'Vanilla',  description: 'Minecraft estándar',   icon: LucidePackage,          accentColor: 'text-emerald-400', activeBorder: 'border-emerald-500/40', activeBg: 'bg-emerald-500/10' },
];

const normalizeLoaderType = (raw?: string, forgeVer?: string): ModLoaderType => {
    if (raw) {
        const lower = raw.toLowerCase().trim();
        if (['forge', 'fabric', 'neoforge', 'quilt', 'vanilla'].includes(lower)) return lower as ModLoaderType;
    }
    if (forgeVer && forgeVer !== 'none' && forgeVer !== '') return 'forge';
    return 'vanilla';
};

const cleanLoaderVersion = (ver?: string, mcVer?: string): string => {
    if (!ver || ver === 'none') return '';
    let clean = ver.trim();
    if (mcVer && clean.startsWith(`${mcVer}-`)) clean = clean.slice(mcVer.length + 1);
    return clean;
};

export const CreateVersionDialog: React.FC<CreateVersionDialogProps> = ({
    isOpen,
    onClose,
    onSuccess,
    modpack,
    existingVersions = [],
}) => {
    const { sessionTokens } = useAuthentication();

    // Detect latest existing version for autocomplete
    const latestVersion = useMemo(() => {
        if (!existingVersions || existingVersions.length === 0) return null;
        const sorted = [...existingVersions].sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            if (dateA && dateB && dateA !== dateB) return dateB - dateA;
            return (b.version || '').localeCompare(a.version || '', undefined, { numeric: true, sensitivity: 'base' });
        });
        return sorted[0];
    }, [existingVersions]);

    const previousConfig = useMemo(() => {
        if (!latestVersion) {
            if (modpack.loaderType || modpack.loaderVersion) {
                const lType = normalizeLoaderType(modpack.loaderType);
                const lVer = cleanLoaderVersion(modpack.loaderVersion);
                return { versionName: '', mcVersion: '', loaderType: lType, loaderVersion: lVer, source: 'modpack' };
            }
            return null;
        }
        const lType = normalizeLoaderType(latestVersion.loaderType, latestVersion.forgeVersion);
        const lVer = cleanLoaderVersion(latestVersion.loaderVersion || latestVersion.forgeVersion, latestVersion.mcVersion);
        return { versionName: latestVersion.version, mcVersion: latestVersion.mcVersion || '', loaderType: lType, loaderVersion: lVer, source: 'version' };
    }, [latestVersion, modpack]);

    // Wizard state
    const [currentStep, setCurrentStep] = useState<WizardStep>('info');
    const [loading, setLoading] = useState(false);
    const [versionName, setVersionName] = useState('');
    const [mcVersion, setMcVersion] = useState('');
    const [loaderType, setLoaderType] = useState<ModLoaderType>('vanilla');
    const [loaderVersion, setLoaderVersion] = useState('');

    // Versions data
    const [minecraftVersions, setMinecraftVersions] = useState<MinecraftVersion[]>([]);
    const [loaderVersions, setLoaderVersions] = useState<string[]>([]);
    const [loadingMinecraftVersions, setLoadingMinecraftVersions] = useState(false);
    const [loadingLoaderVersions, setLoadingLoaderVersions] = useState(false);

    // Breaking changes
    const [breakingChanges, setBreakingChanges] = useState<BreakingChange[]>([]);
    const [acknowledgedBreaking, setAcknowledgedBreaking] = useState(false);

    // Preserve target loader version across async fetches
    const targetLoaderVersionRef = useRef<string>('');

    // Reset and initialize when dialog opens
    useEffect(() => {
        if (!isOpen) return;
        setCurrentStep('info');
        setVersionName('');
        setBreakingChanges([]);
        setAcknowledgedBreaking(false);
        setLoading(false);
        if (previousConfig) {
            setMcVersion(previousConfig.mcVersion);
            setLoaderType(previousConfig.loaderType);
            setLoaderVersion(previousConfig.loaderVersion);
            targetLoaderVersionRef.current = previousConfig.loaderVersion;
        } else {
            setMcVersion(''); setLoaderType('vanilla'); setLoaderVersion('');
            targetLoaderVersionRef.current = '';
        }
    }, [isOpen, previousConfig]);

    // Fetch Minecraft versions
    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        const loadMc = async () => {
            setLoadingMinecraftVersions(true);
            try {
                const data = await fetchMinecraftManifestWithFailover();
                if (cancelled) return;
                const releases = data.versions.filter((v: MinecraftVersion) => v.type === 'release');
                setMinecraftVersions(releases);
                setMcVersion((prev) => {
                    if (prev) return prev;
                    if (previousConfig?.mcVersion) return previousConfig.mcVersion;
                    return releases.length > 0 ? releases[0].id : '';
                });
            } catch {
                if (cancelled) return;
                toast.error('No se pudieron cargar las versiones de Minecraft');
            } finally {
                if (!cancelled) setLoadingMinecraftVersions(false);
            }
        };
        loadMc();
        return () => { cancelled = true; };
    }, [isOpen, previousConfig?.mcVersion]);

    // Fetch Loader Versions with robust autocomplete
    useEffect(() => {
        if (!isOpen) return;
        if (!mcVersion || loaderType === 'vanilla') { setLoaderVersions([]); setLoaderVersion(''); return; }
        let cancelled = false;
        const loadLoader = async () => {
            setLoadingLoaderVersions(true);
            try {
                const versions = await fetchLoaderVersions(loaderType, mcVersion);
                if (cancelled) return;
                setLoaderVersions(versions);
                setLoaderVersion((current) => {
                    const target = targetLoaderVersionRef.current;
                    if (target && versions.includes(target)) return target;
                    if (target) {
                        const partial = versions.find((v) => v === target || target.includes(v) || v.includes(target));
                        if (partial) return partial;
                    }
                    if (current && versions.includes(current)) return current;
                    return versions.length > 0 ? versions[0] : '';
                });
            } catch {
                if (cancelled) return;
                toast.error(`No se pudieron cargar las versiones de ${getModLoaderDisplayName(loaderType)}`);
            } finally {
                if (!cancelled) setLoadingLoaderVersions(false);
            }
        };
        loadLoader();
        return () => { cancelled = true; };
    }, [isOpen, mcVersion, loaderType]);

    const handleSelectLoaderType = (type: ModLoaderType) => {
        setLoaderType(type);
        if (previousConfig && previousConfig.loaderType === type) {
            targetLoaderVersionRef.current = previousConfig.loaderVersion;
            setLoaderVersion(previousConfig.loaderVersion);
        } else {
            targetLoaderVersionRef.current = '';
            setLoaderVersion('');
        }
    };

    const handleApplyPreviousConfig = () => {
        if (!previousConfig) return;
        if (previousConfig.mcVersion) setMcVersion(previousConfig.mcVersion);
        setLoaderType(previousConfig.loaderType);
        targetLoaderVersionRef.current = previousConfig.loaderVersion;
        setLoaderVersion(previousConfig.loaderVersion);
        toast.info('Configuración de la versión anterior restaurada');
    };

    const detectBreakingChanges = () => {
        const changes: BreakingChange[] = [];
        for (const version of existingVersions) {
            const versionLoaderType = normalizeLoaderType(version.loaderType, version.forgeVersion);
            if (version.mcVersion !== mcVersion || versionLoaderType !== loaderType) {
                changes.push({ version: version.version, mcVersion: version.mcVersion, loaderType: versionLoaderType });
            }
        }
        setBreakingChanges(changes);
        setAcknowledgedBreaking(false);
    };

    const handleNext = () => {
        if (currentStep === 'info') {
            if (!versionName.trim()) { toast.error('Debes ingresar un nombre para la versión'); return; }
            setCurrentStep('loader');
        } else if (currentStep === 'loader') {
            if (!mcVersion) { toast.error('Debes seleccionar una versión de Minecraft'); return; }
            if (loaderType !== 'vanilla' && !loaderVersion) {
                toast.error(`Debes seleccionar una versión de ${getModLoaderDisplayName(loaderType)}`); return;
            }
            detectBreakingChanges();
            setCurrentStep('confirm');
        } else if (currentStep === 'confirm') {
            if (breakingChanges.length > 0 && !acknowledgedBreaking) {
                toast.error('Debes confirmar que entiendes los cambios críticos'); return;
            }
            handleSubmit();
        }
    };

    const handleBack = () => {
        if (currentStep === 'loader') setCurrentStep('info');
        else if (currentStep === 'confirm') setCurrentStep('loader');
    };

    const handleSubmit = async () => {
        setCurrentStep('processing');
        setLoading(true);
        try {
            const orgId = modpack.creatorId || modpack.publisherId;
            if (!orgId) throw new Error('No se encontró el identificador del creador o publisher');

            const response = await fetch(
                `${API_ENDPOINT}/creators/${orgId}/modpacks/${modpack.id}/versions`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${sessionTokens?.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        version: versionName.trim(),
                        mcVersion,
                        loaderType,
                        loaderVersion: loaderType === 'vanilla' ? null : loaderVersion,
                    }),
                }
            );

            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                throw new Error(errData?.message || errData?.detail || 'Error al crear la versión');
            }

            await new Promise((resolve) => setTimeout(resolve, 800));
            toast.success('¡Versión creada exitosamente!');
            onSuccess();
            onClose();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Error al crear la versión');
            setCurrentStep('confirm');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const currentStepIndex = STEPS.findIndex((s) => s.key === currentStep);

    return (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-card border border-border shadow-xl rounded-2xl flex flex-col max-h-[90vh] overflow-hidden">

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                    <div className="flex items-center gap-3.5">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                            <LucideGitBranch className="h-4 w-4" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-base font-semibold tracking-tight text-foreground">Nueva Versión</h2>
                                <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-muted-foreground border border-border">
                                    {modpack.name}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">Publica una nueva compilación para tu comunidad</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
                        title="Cerrar"
                    >
                        <LucideX className="h-4 w-4" />
                    </button>
                </div>

                {/* ── Step indicator ── */}
                <div className="px-6 pt-4 pb-3 border-b border-border/50">
                    <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-muted/30 border border-border">
                        {STEPS.map((step, idx) => {
                            const isActive = currentStep === step.key;
                            const isCompleted = idx < currentStepIndex;
                            return (
                                <button
                                    key={step.key}
                                    type="button"
                                    onClick={() => { if (isCompleted && !loading) setCurrentStep(step.key); }}
                                    disabled={!isCompleted && !isActive}
                                    className={cn(
                                        'flex items-center justify-center gap-2 py-2 px-2 rounded-lg text-xs font-medium transition-all duration-200',
                                        isActive
                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                            : isCompleted
                                            ? 'text-foreground hover:bg-muted/50 cursor-pointer'
                                            : 'text-muted-foreground/50 cursor-not-allowed'
                                    )}
                                >
                                    <div className={cn(
                                        'w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                                        isActive
                                            ? 'bg-primary-foreground/20 text-primary-foreground'
                                            : isCompleted
                                            ? 'bg-emerald-500/20 text-emerald-500'
                                            : 'bg-border text-muted-foreground'
                                    )}>
                                        {isCompleted ? <LucideCheck className="h-3 w-3 text-emerald-500" /> : idx + 1}
                                    </div>
                                    <span className="truncate">{step.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── Content ── */}
                <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar">
                    <AnimatePresence mode="wait">

                        {/* STEP 1: Basic Info */}
                        {currentStep === 'info' && (
                            <motion.div
                                key="info"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-6"
                            >
                                {/* Previous version banner */}
                                {previousConfig && (
                                    <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center text-primary mt-0.5 shrink-0">
                                                <LucideHistory className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs font-semibold text-primary">Versión anterior detectada</span>
                                                    {previousConfig.versionName && (
                                                        <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-primary/15 text-primary border border-primary/20">
                                                            {previousConfig.versionName}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                                    Autocompletaremos los valores de Minecraft y Modloader a partir de esta configuración.
                                                </p>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {previousConfig.mcVersion && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-muted border border-border text-foreground">
                                                            <span className="text-muted-foreground">MC:</span> {previousConfig.mcVersion}
                                                        </span>
                                                    )}
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-muted border border-border text-foreground">
                                                        <span className="text-muted-foreground">Loader:</span>{' '}
                                                        {getModLoaderDisplayName(previousConfig.loaderType)}
                                                        {previousConfig.loaderVersion ? ` v${previousConfig.loaderVersion}` : ''}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={handleApplyPreviousConfig}
                                            className="shrink-0 h-8 text-xs border-primary/30 text-primary hover:bg-primary/10 hover:text-primary gap-1.5"
                                        >
                                            <LucideRefreshCw className="h-3 w-3" /> Heredar
                                        </Button>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                                        Nombre / Identificador de la versión <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        value={versionName}
                                        onChange={(e) => setVersionName(e.target.value)}
                                        placeholder="ej: 1.0.0, v2.1.0-beta, Release 3"
                                        className="h-11 text-sm"
                                        autoFocus
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleNext(); } }}
                                    />
                                    <p className="text-[11px] text-muted-foreground">
                                        Esta etiqueta será visible en el lanzador y en la tienda para los jugadores.
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 2: Minecraft & Modloader */}
                        {currentStep === 'loader' && (
                            <motion.div
                                key="loader"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-6"
                            >
                                {/* Minecraft version selector */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                            Versión de Minecraft <span className="text-destructive">*</span>
                                        </label>
                                        {previousConfig?.mcVersion && mcVersion === previousConfig.mcVersion && (
                                            <span className="text-[11px] text-primary flex items-center gap-1 font-medium">
                                                <LucideSparkles className="h-3 w-3" /> Sugerida de la versión anterior
                                            </span>
                                        )}
                                    </div>
                                    {loadingMinecraftVersions ? (
                                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                                            <LucideLoader className="h-4 w-4 animate-spin text-primary" />
                                            <span className="text-xs text-muted-foreground">Cargando versiones oficiales de Minecraft...</span>
                                        </div>
                                    ) : (
                                        <Select value={mcVersion} onValueChange={setMcVersion}>
                                            <SelectTrigger className="h-11">
                                                <SelectValue placeholder="Selecciona una versión de Minecraft" />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-64">
                                                {minecraftVersions.map((v) => (
                                                    <SelectItem key={v.id} value={v.id}>
                                                        <div className="flex items-center justify-between w-full gap-4">
                                                            <span>{v.id}</span>
                                                            {previousConfig?.mcVersion === v.id && (
                                                                <span className="text-[10px] text-primary font-medium px-1.5 py-0.5 rounded bg-primary/10">
                                                                    Anterior
                                                                </span>
                                                            )}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>

                                {/* Modloader tiles */}
                                <div className="space-y-3">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                                        Tipo de Modloader <span className="text-destructive">*</span>
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                        {MODLOADERS.map((m) => {
                                            const isSelected = loaderType === m.type;
                                            const LoaderIcon = m.icon;
                                            const isPrevLoader = previousConfig?.loaderType === m.type;
                                            return (
                                                <button
                                                    key={m.type}
                                                    type="button"
                                                    onClick={() => handleSelectLoaderType(m.type)}
                                                    className={cn(
                                                        'relative p-3 rounded-xl border transition-all duration-200 flex flex-col items-center justify-center text-center gap-2 cursor-pointer group',
                                                        isSelected
                                                            ? cn(m.activeBg, m.activeBorder, 'scale-[1.02] shadow-sm')
                                                            : 'bg-muted/20 border-border hover:bg-muted/40 hover:border-border/80'
                                                    )}
                                                >
                                                    {isPrevLoader && (
                                                        <span className="absolute -top-2 right-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-primary text-primary-foreground">
                                                            Previo
                                                        </span>
                                                    )}
                                                    <div className={cn(
                                                        'w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110',
                                                        isSelected ? cn(m.accentColor, 'bg-white/10') : 'text-muted-foreground bg-muted/40'
                                                    )}>
                                                        <LoaderIcon className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-semibold text-foreground">{m.label}</div>
                                                        <div className="text-[10px] text-muted-foreground hidden sm:block truncate max-w-[80px]">
                                                            {m.description}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Loader version dropdown */}
                                {loaderType !== 'vanilla' && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                Versión de {getModLoaderDisplayName(loaderType)} <span className="text-destructive">*</span>
                                            </label>
                                            {previousConfig?.loaderVersion && loaderVersion === previousConfig.loaderVersion && (
                                                <span className="text-[11px] text-primary flex items-center gap-1 font-medium">
                                                    <LucideCheck className="h-3 w-3" /> Autocompletada de la versión anterior
                                                </span>
                                            )}
                                        </div>
                                        {loadingLoaderVersions ? (
                                            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                                                <LucideLoader className="h-4 w-4 animate-spin text-primary" />
                                                <span className="text-xs text-muted-foreground">
                                                    Consultando versiones de {getModLoaderDisplayName(loaderType)} para MC {mcVersion}...
                                                </span>
                                            </div>
                                        ) : loaderVersions.length > 0 ? (
                                            <Select value={loaderVersion} onValueChange={setLoaderVersion}>
                                                <SelectTrigger className="h-11">
                                                    <SelectValue placeholder="Selecciona una versión del modloader" />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-64">
                                                    {loaderVersions.map((v) => (
                                                        <SelectItem key={v} value={v}>
                                                            <div className="flex items-center justify-between w-full gap-4">
                                                                <span>{v}</span>
                                                                {previousConfig?.loaderVersion === v && (
                                                                    <span className="text-[10px] text-primary font-medium px-1.5 py-0.5 rounded bg-primary/10">
                                                                        Anterior
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                                                <LucideAlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                                                        No hay versiones de {getModLoaderDisplayName(loaderType)} disponibles para Minecraft {mcVersion}.
                                                    </p>
                                                    <p className="text-[11px] text-amber-600/70 dark:text-amber-400/70 mt-0.5">
                                                        Prueba seleccionando otra versión de Minecraft o un modloader alternativo.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* STEP 3: Confirm */}
                        {currentStep === 'confirm' && (
                            <motion.div
                                key="confirm"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-6"
                            >
                                {/* Summary card */}
                                <div className="p-5 rounded-xl bg-muted/20 border border-border space-y-4">
                                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        <LucideLayers className="h-4 w-4 text-primary" />
                                        Resumen de la nueva versión
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {[
                                            { label: 'Identificador', value: versionName },
                                            { label: 'Minecraft', value: mcVersion },
                                            {
                                                label: 'Modloader',
                                                value: `${getModLoaderDisplayName(loaderType)}${loaderType !== 'vanilla' && loaderVersion ? ` v${loaderVersion}` : ''}`,
                                            },
                                        ].map((item) => (
                                            <div key={item.label} className="p-3 rounded-lg bg-muted/30 border border-border">
                                                <div className="text-[11px] text-muted-foreground">{item.label}</div>
                                                <div className="text-sm font-semibold text-foreground mt-0.5 truncate">{item.value}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Breaking changes alert */}
                                {breakingChanges.length > 0 && (
                                    <div className="p-5 rounded-xl bg-destructive/10 border border-destructive/25 space-y-4">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-destructive/15 border border-destructive/25 flex items-center justify-center text-destructive shrink-0">
                                                <LucideAlertTriangle className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-semibold uppercase tracking-wider text-destructive">
                                                    Cambio de entorno detectado
                                                </h4>
                                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                                    Esta versión cambia de versión de Minecraft o de modloader respecto a versiones existentes.
                                                    Los usuarios que actualicen podrían necesitar reinstalar su instancia.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="space-y-2.5">
                                            <div className="text-[11px] font-semibold text-muted-foreground">
                                                Versiones anteriores afectadas:
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                                                {breakingChanges.slice(0, 6).map((c, i) => (
                                                    <span key={i} className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted border border-border text-foreground">
                                                        {c.version} (MC {c.mcVersion} · {getModLoaderDisplayName(c.loaderType as ModLoaderType)})
                                                    </span>
                                                ))}
                                                {breakingChanges.length > 6 && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] text-muted-foreground bg-muted border border-border">
                                                        +{breakingChanges.length - 6} más
                                                    </span>
                                                )}
                                            </div>
                                            <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
                                                <input
                                                    type="checkbox"
                                                    checked={acknowledgedBreaking}
                                                    onChange={(e) => setAcknowledgedBreaking(e.target.checked)}
                                                    className="mt-0.5 accent-primary h-4 w-4 rounded"
                                                />
                                                <span className="text-xs text-muted-foreground leading-snug">
                                                    Entiendo que este cambio de entorno puede requerir reinstalación y deseo continuar.
                                                </span>
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Processing state */}
                        {currentStep === 'processing' && (
                            <motion.div
                                key="processing"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center justify-center py-16 space-y-4 text-center"
                            >
                                <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary">
                                    <LucideLoader className="h-7 w-7 animate-spin" />
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-foreground">Publicando nueva versión...</h3>
                                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                                        Estamos registrando la versión y preparando el manifiesto para el modpack.
                                    </p>
                                </div>
                            </motion.div>
                        )}

                    </AnimatePresence>
                </div>

                {/* ── Footer ── */}
                {currentStep !== 'processing' && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-border">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={currentStep === 'info' ? onClose : handleBack}
                            disabled={loading}
                            className="text-muted-foreground hover:text-foreground gap-1.5 text-sm"
                        >
                            <LucideArrowLeft className="h-3.5 w-3.5" />
                            {currentStep === 'info' ? 'Cancelar' : 'Atrás'}
                        </Button>

                        <Button
                            type="button"
                            onClick={handleNext}
                            disabled={loading || (currentStep === 'confirm' && breakingChanges.length > 0 && !acknowledgedBreaking)}
                            className="gap-1.5 min-w-[120px]"
                        >
                            {currentStep === 'confirm' ? (
                                <><LucideCheck className="h-3.5 w-3.5" /> Confirmar y Crear</>
                            ) : (
                                <>Siguiente <LucideArrowRight className="h-3.5 w-3.5" /></>
                            )}
                        </Button>
                    </div>
                )}

            </div>
        </div>
    );
};

export default CreateVersionDialog;
