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
    LucideInfo,
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

const MODLOADERS: {
    type: ModLoaderType;
    label: string;
    description: string;
    icon: any;
    accentColor: string;
    activeBorder: string;
    activeBg: string;
    glow: string;
}[] = [
    {
        type: 'fabric',
        label: 'Fabric',
        description: 'Rápido y ligero',
        icon: LucideFeather,
        accentColor: 'text-cyan-400',
        activeBorder: 'border-cyan-500/50',
        activeBg: 'bg-cyan-500/10',
        glow: 'shadow-[0_0_20px_rgba(6,182,212,0.15)]',
    },
    {
        type: 'forge',
        label: 'Forge',
        description: 'Ecosistema clásico',
        icon: LucideAnvil,
        accentColor: 'text-amber-400',
        activeBorder: 'border-amber-500/50',
        activeBg: 'bg-amber-500/10',
        glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]',
    },
    {
        type: 'neoforge',
        label: 'NeoForge',
        description: 'Moderno y compatible',
        icon: LucideHammer,
        accentColor: 'text-orange-400',
        activeBorder: 'border-orange-500/50',
        activeBg: 'bg-orange-500/10',
        glow: 'shadow-[0_0_20px_rgba(249,115,22,0.15)]',
    },
    {
        type: 'quilt',
        label: 'Quilt',
        description: 'Modular y abierto',
        icon: LucideTestTubeDiagonal,
        accentColor: 'text-purple-400',
        activeBorder: 'border-purple-500/50',
        activeBg: 'bg-purple-500/10',
        glow: 'shadow-[0_0_20px_rgba(168,85,247,0.15)]',
    },
    {
        type: 'vanilla',
        label: 'Vanilla',
        description: 'Minecraft estándar',
        icon: LucidePackage,
        accentColor: 'text-emerald-400',
        activeBorder: 'border-emerald-500/50',
        activeBg: 'bg-emerald-500/10',
        glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]',
    },
];

const normalizeLoaderType = (raw?: string, forgeVer?: string): ModLoaderType => {
    if (raw) {
        const lower = raw.toLowerCase().trim();
        if (['forge', 'fabric', 'neoforge', 'quilt', 'vanilla'].includes(lower)) {
            return lower as ModLoaderType;
        }
    }
    if (forgeVer && forgeVer !== 'none' && forgeVer !== '') return 'forge';
    return 'vanilla';
};

const cleanLoaderVersion = (ver?: string, mcVer?: string): string => {
    if (!ver || ver === 'none') return '';
    let clean = ver.trim();
    if (mcVer && clean.startsWith(`${mcVer}-`)) {
        clean = clean.slice(mcVer.length + 1);
    }
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

    // 1. Detect and order existing versions safely
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

    // Computed previous configuration
    const previousConfig = useMemo(() => {
        if (!latestVersion) {
            if (modpack.loaderType || modpack.loaderVersion) {
                const lType = normalizeLoaderType(modpack.loaderType);
                const lVer = cleanLoaderVersion(modpack.loaderVersion);
                return {
                    versionName: '',
                    mcVersion: '',
                    loaderType: lType,
                    loaderVersion: lVer,
                    source: 'modpack',
                };
            }
            return null;
        }

        const lType = normalizeLoaderType(latestVersion.loaderType, latestVersion.forgeVersion);
        const lVer = cleanLoaderVersion(latestVersion.loaderVersion || latestVersion.forgeVersion, latestVersion.mcVersion);

        return {
            versionName: latestVersion.version,
            mcVersion: latestVersion.mcVersion || '',
            loaderType: lType,
            loaderVersion: lVer,
            source: 'version',
        };
    }, [latestVersion, modpack]);

    // Wizard Form State
    const [currentStep, setCurrentStep] = useState<WizardStep>('info');
    const [loading, setLoading] = useState(false);

    const [versionName, setVersionName] = useState('');
    const [mcVersion, setMcVersion] = useState('');
    const [loaderType, setLoaderType] = useState<ModLoaderType>('vanilla');
    const [loaderVersion, setLoaderVersion] = useState('');

    // Versions Data
    const [minecraftVersions, setMinecraftVersions] = useState<MinecraftVersion[]>([]);
    const [loaderVersions, setLoaderVersions] = useState<string[]>([]);
    const [loadingMinecraftVersions, setLoadingMinecraftVersions] = useState(false);
    const [loadingLoaderVersions, setLoadingLoaderVersions] = useState(false);

    // Breaking changes
    const [breakingChanges, setBreakingChanges] = useState<BreakingChange[]>([]);
    const [acknowledgedBreaking, setAcknowledgedBreaking] = useState(false);

    // Target loader version ref to preserve autocomplete even during async fetching
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
            setMcVersion('');
            setLoaderType('vanilla');
            setLoaderVersion('');
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
            } catch (error) {
                if (cancelled) return;
                console.error('Error loading Minecraft versions:', error);
                toast.error('No se pudieron cargar las versiones de Minecraft');
            } finally {
                if (!cancelled) setLoadingMinecraftVersions(false);
            }
        };

        loadMc();
        return () => {
            cancelled = true;
        };
    }, [isOpen, previousConfig?.mcVersion]);

    // Fetch Loader Versions with robust autocomplete
    useEffect(() => {
        if (!isOpen) return;
        if (!mcVersion || loaderType === 'vanilla') {
            setLoaderVersions([]);
            setLoaderVersion('');
            return;
        }

        let cancelled = false;

        const loadLoader = async () => {
            setLoadingLoaderVersions(true);
            try {
                const versions = await fetchLoaderVersions(loaderType, mcVersion);
                if (cancelled) return;

                setLoaderVersions(versions);

                // Autocomplete resolution:
                setLoaderVersion((current) => {
                    const target = targetLoaderVersionRef.current;

                    // 1. If target version matches exactly in fetched versions
                    if (target && versions.includes(target)) {
                        return target;
                    }

                    // 2. If target version has a partial match (e.g. build number)
                    if (target) {
                        const partialMatch = versions.find(
                            (v) => v === target || target.includes(v) || v.includes(target)
                        );
                        if (partialMatch) return partialMatch;
                    }

                    // 3. If current selection is valid in the newly fetched versions, keep it
                    if (current && versions.includes(current)) {
                        return current;
                    }

                    // 4. Default to the latest available loader version
                    return versions.length > 0 ? versions[0] : '';
                });
            } catch (error) {
                if (cancelled) return;
                console.error(`Error loading ${loaderType} versions:`, error);
                toast.error(`No se pudieron cargar las versiones de ${getModLoaderDisplayName(loaderType)}`);
            } finally {
                if (!cancelled) setLoadingLoaderVersions(false);
            }
        };

        loadLoader();
        return () => {
            cancelled = true;
        };
    }, [isOpen, mcVersion, loaderType]);

    // Handler when user selects a different loader type
    const handleSelectLoaderType = (type: ModLoaderType) => {
        setLoaderType(type);
        if (previousConfig && previousConfig.loaderType === type) {
            // Restore previous version target if user switches back to previous loader
            targetLoaderVersionRef.current = previousConfig.loaderVersion;
            setLoaderVersion(previousConfig.loaderVersion);
        } else {
            // Switching to another loader type: reset target so it picks the latest for that loader
            targetLoaderVersionRef.current = '';
            setLoaderVersion('');
        }
    };

    // Apply previous version configuration with one click
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
                changes.push({
                    version: version.version,
                    mcVersion: version.mcVersion,
                    loaderType: versionLoaderType,
                });
            }
        }
        setBreakingChanges(changes);
        setAcknowledgedBreaking(false);
    };

    const handleNext = () => {
        if (currentStep === 'info') {
            if (!versionName.trim()) {
                toast.error('Debes ingresar un nombre para la versión');
                return;
            }
            setCurrentStep('loader');
        } else if (currentStep === 'loader') {
            if (!mcVersion) {
                toast.error('Debes seleccionar una versión de Minecraft');
                return;
            }
            if (loaderType !== 'vanilla' && !loaderVersion) {
                toast.error(`Debes seleccionar una versión de ${getModLoaderDisplayName(loaderType)}`);
                return;
            }
            detectBreakingChanges();
            setCurrentStep('confirm');
        } else if (currentStep === 'confirm') {
            if (breakingChanges.length > 0 && !acknowledgedBreaking) {
                toast.error('Debes confirmar que entiendes los cambios críticos');
                return;
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
            if (!orgId) {
                throw new Error('No se encontró el identificador del creador o publisher');
            }

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
            console.error('Error creating version:', error);
            toast.error(error instanceof Error ? error.message : 'Error al crear la versión');
            setCurrentStep('confirm');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const currentStepIndex = STEPS.findIndex((s) => s.key === currentStep);

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-[#0c0c10]/95 border border-white/[0.08] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)] rounded-3xl flex flex-col max-h-[90vh] overflow-hidden text-neutral-100 ring-1 ring-white/[0.05]">
                {/* ── Top Header / Branding ── */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06] bg-white/[0.02]">
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm shadow-primary/20">
                            <LucideGitBranch className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-bold tracking-tight text-white">Nueva Versión</h2>
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/[0.06] text-neutral-300 border border-white/[0.08]">
                                    {modpack.name}
                                </span>
                            </div>
                            <p className="text-xs text-neutral-400 mt-0.5">
                                Publica una nueva compilación para tu comunidad
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-50"
                        title="Cerrar"
                    >
                        <LucideX className="h-4 w-4" />
                    </button>
                </div>

                {/* ── Google TV-ish Segmented Step Pills ── */}
                <div className="px-6 pt-5 pb-3 border-b border-white/[0.04]">
                    <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                        {STEPS.map((step, idx) => {
                            const isActive = currentStep === step.key;
                            const isCompleted = idx < currentStepIndex;
                            const StepIcon = step.icon;

                            return (
                                <button
                                    key={step.key}
                                    type="button"
                                    onClick={() => {
                                        if (isCompleted && !loading) {
                                            setCurrentStep(step.key);
                                        }
                                    }}
                                    disabled={!isCompleted && !isActive}
                                    className={cn(
                                        'relative flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-xl text-xs font-semibold tracking-wide transition-all duration-300',
                                        isActive
                                            ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                                            : isCompleted
                                            ? 'text-neutral-300 hover:text-white hover:bg-white/[0.04] cursor-pointer'
                                            : 'text-neutral-500 cursor-not-allowed opacity-60'
                                    )}
                                >
                                    <div
                                        className={cn(
                                            'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors',
                                            isActive
                                                ? 'bg-primary-foreground/20 text-primary-foreground'
                                                : isCompleted
                                                ? 'bg-emerald-500/20 text-emerald-400'
                                                : 'bg-white/[0.08] text-neutral-400'
                                        )}
                                    >
                                        {isCompleted ? <LucideCheck className="h-3 w-3 text-emerald-400" /> : idx + 1}
                                    </div>
                                    <span className="truncate">{step.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── Content Area with Smooth Motion Transitions ── */}
                <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar">
                    <AnimatePresence mode="wait">
                        {/* STEP 1: Basic Info */}
                        {currentStep === 'info' && (
                            <motion.div
                                key="info"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                                transition={{ duration: 0.22 }}
                                className="space-y-6"
                            >
                                {/* Previous Version Hero Banner */}
                                {previousConfig && (
                                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-white/[0.02] to-transparent border border-primary/20 p-4.5">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-start gap-3.5">
                                                <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary mt-0.5 shrink-0">
                                                    <LucideHistory className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold uppercase tracking-wider text-primary">
                                                            Versión anterior detectada
                                                        </span>
                                                        {previousConfig.versionName && (
                                                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/15 text-primary border border-primary/20">
                                                                {previousConfig.versionName}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                                                        Autocompletaremos los valores de Minecraft y Modloader a partir de esta configuración.
                                                    </p>
                                                    <div className="flex flex-wrap items-center gap-2 mt-2.5">
                                                        {previousConfig.mcVersion && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/[0.05] border border-white/[0.08] text-neutral-200">
                                                                <span className="text-neutral-400">MC:</span>{' '}
                                                                <strong className="text-white">{previousConfig.mcVersion}</strong>
                                                            </span>
                                                        )}
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/[0.05] border border-white/[0.08] text-neutral-200">
                                                            <span className="text-neutral-400">Loader:</span>{' '}
                                                            <strong className="text-white">
                                                                {getModLoaderDisplayName(previousConfig.loaderType)}
                                                                {previousConfig.loaderVersion ? ` v${previousConfig.loaderVersion}` : ''}
                                                            </strong>
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={handleApplyPreviousConfig}
                                                className="shrink-0 h-8 text-xs border-primary/30 text-primary hover:bg-primary/10 gap-1.5"
                                            >
                                                <LucideRefreshCw className="h-3 w-3" />
                                                Heredar
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Version Input */}
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block">
                                        Nombre / Identificador de la versión <span className="text-red-400">*</span>
                                    </label>
                                    <div className="relative">
                                        <Input
                                            value={versionName}
                                            onChange={(e) => setVersionName(e.target.value)}
                                            placeholder="ej: 1.0.0, v2.1.0-beta, Release 3"
                                            className="bg-white/[0.03] border-white/[0.08] focus:border-primary text-white placeholder:text-neutral-500 h-12 text-sm rounded-xl px-4"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleNext();
                                                }
                                            }}
                                        />
                                    </div>
                                    <p className="text-[11px] text-neutral-400">
                                        Esta etiqueta será visible en el lanzador y en la tienda para los jugadores.
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 2: Minecraft & Modloader Configuration */}
                        {currentStep === 'loader' && (
                            <motion.div
                                key="loader"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                                transition={{ duration: 0.22 }}
                                className="space-y-6"
                            >
                                {/* Minecraft Version Selector */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                                            Versión de Minecraft <span className="text-red-400">*</span>
                                        </label>
                                        {previousConfig?.mcVersion && mcVersion === previousConfig.mcVersion && (
                                            <span className="text-[11px] text-primary flex items-center gap-1 font-medium">
                                                <LucideSparkles className="h-3 w-3" /> Sugerida de la versión anterior
                                            </span>
                                        )}
                                    </div>

                                    {loadingMinecraftVersions ? (
                                        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                                            <LucideLoader className="h-4 w-4 animate-spin text-primary" />
                                            <span className="text-xs text-neutral-400">Cargando versiones oficiales de Minecraft...</span>
                                        </div>
                                    ) : (
                                        <Select value={mcVersion} onValueChange={setMcVersion}>
                                            <SelectTrigger className="bg-white/[0.03] border-white/[0.08] hover:border-white/[0.15] text-white h-12 rounded-xl px-4">
                                                <SelectValue placeholder="Selecciona una versión de Minecraft" />
                                            </SelectTrigger>
                                            <SelectContent className="border-white/[0.08] bg-[#121218] max-h-64 text-white">
                                                {minecraftVersions.map((v) => (
                                                    <SelectItem
                                                        key={v.id}
                                                        value={v.id}
                                                        className="focus:bg-white/[0.08] focus:text-white"
                                                    >
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

                                {/* Modloader Type Interactive Tiles */}
                                <div className="space-y-3">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block">
                                        Tipo de Modloader <span className="text-red-400">*</span>
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
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
                                                        'relative p-3.5 rounded-2xl border transition-all duration-200 flex flex-col items-center justify-center text-center gap-2 group cursor-pointer',
                                                        isSelected
                                                            ? cn(m.activeBg, m.activeBorder, m.glow, 'text-white scale-[1.02]')
                                                            : 'bg-white/[0.02] border-white/[0.06] text-neutral-400 hover:text-white hover:bg-white/[0.05] hover:border-white/[0.12]'
                                                    )}
                                                >
                                                    {isPrevLoader && (
                                                        <span className="absolute -top-2 right-2 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-primary text-primary-foreground shadow-sm">
                                                            Previo
                                                        </span>
                                                    )}
                                                    <div
                                                        className={cn(
                                                            'w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110',
                                                            isSelected ? cn(m.accentColor, 'bg-white/10') : 'text-neutral-400 bg-white/[0.04]'
                                                        )}
                                                    >
                                                        <LoaderIcon className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold leading-tight tracking-tight text-white">
                                                            {m.label}
                                                        </div>
                                                        <div className="text-[10px] text-neutral-400 mt-0.5 hidden sm:block truncate max-w-[80px]">
                                                            {m.description}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Loader Version Dropdown */}
                                {loaderType !== 'vanilla' && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                                                Versión de {getModLoaderDisplayName(loaderType)} <span className="text-red-400">*</span>
                                            </label>
                                            {previousConfig?.loaderVersion && loaderVersion === previousConfig.loaderVersion && (
                                                <span className="text-[11px] text-primary flex items-center gap-1 font-medium">
                                                    <LucideCheck className="h-3 w-3" /> Autocompletada de la versión anterior
                                                </span>
                                            )}
                                        </div>

                                        {loadingLoaderVersions ? (
                                            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                                                <LucideLoader className="h-4 w-4 animate-spin text-primary" />
                                                <span className="text-xs text-neutral-400">
                                                    Consultando versiones disponibles de {getModLoaderDisplayName(loaderType)} para MC {mcVersion}...
                                                </span>
                                            </div>
                                        ) : loaderVersions.length > 0 ? (
                                            <Select value={loaderVersion} onValueChange={setLoaderVersion}>
                                                <SelectTrigger className="bg-white/[0.03] border-white/[0.08] hover:border-white/[0.15] text-white h-12 rounded-xl px-4">
                                                    <SelectValue placeholder="Selecciona una versión del modloader" />
                                                </SelectTrigger>
                                                <SelectContent className="border-white/[0.08] bg-[#121218] max-h-64 text-white">
                                                    {loaderVersions.map((v) => (
                                                        <SelectItem
                                                            key={v}
                                                            value={v}
                                                            className="focus:bg-white/[0.08] focus:text-white"
                                                        >
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
                                            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                                                <LucideAlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="text-xs font-medium text-amber-200">
                                                        No hay versiones de {getModLoaderDisplayName(loaderType)} disponibles para Minecraft {mcVersion}.
                                                    </p>
                                                    <p className="text-[11px] text-amber-200/70 mt-0.5">
                                                        Prueba seleccionando otra versión de Minecraft o modloader alternativo.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* STEP 3: Confirmation & Breaking Changes Check */}
                        {currentStep === 'confirm' && (
                            <motion.div
                                key="confirm"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                                transition={{ duration: 0.22 }}
                                className="space-y-6"
                            >
                                {/* Summary Card */}
                                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-4">
                                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-400">
                                        <LucideLayers className="h-4 w-4 text-primary" />
                                        Resumen de la nueva versión
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                                            <div className="text-[11px] text-neutral-400">Identificador</div>
                                            <div className="text-sm font-semibold text-white mt-0.5 truncate">{versionName}</div>
                                        </div>
                                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                                            <div className="text-[11px] text-neutral-400">Minecraft</div>
                                            <div className="text-sm font-semibold text-white mt-0.5">{mcVersion}</div>
                                        </div>
                                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                                            <div className="text-[11px] text-neutral-400">Modloader</div>
                                            <div className="text-sm font-semibold text-white mt-0.5 flex items-center gap-1.5">
                                                <span>{getModLoaderDisplayName(loaderType)}</span>
                                                {loaderType !== 'vanilla' && loaderVersion && (
                                                    <span className="text-neutral-400 text-xs">v{loaderVersion}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Breaking Changes Alert */}
                                {breakingChanges.length > 0 && (
                                    <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/25 space-y-3.5">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                                                <LucideAlertTriangle className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-red-400">
                                                    Cambio de entorno detectado
                                                </h4>
                                                <p className="text-xs text-red-200/80 mt-1 leading-relaxed">
                                                    Esta versión cambia de versión de Minecraft o de modloader respecto a versiones existentes.
                                                    Los usuarios que actualicen podrían necesitar reinstalar su instancia.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="pl-11 space-y-2">
                                            <div className="text-[11px] font-semibold text-neutral-300">
                                                Versiones anteriores afectadas:
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                                                {breakingChanges.slice(0, 6).map((c, i) => (
                                                    <span
                                                        key={i}
                                                        className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/[0.06] border border-white/[0.08] text-neutral-300"
                                                    >
                                                        {c.version} (MC {c.mcVersion} · {getModLoaderDisplayName(c.loaderType as ModLoaderType)})
                                                    </span>
                                                ))}
                                                {breakingChanges.length > 6 && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/[0.04] text-neutral-400">
                                                        +{breakingChanges.length - 6} más
                                                    </span>
                                                )}
                                            </div>

                                            <label className="flex items-start gap-2.5 pt-2 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={acknowledgedBreaking}
                                                    onChange={(e) => setAcknowledgedBreaking(e.target.checked)}
                                                    className="mt-0.5 accent-primary h-4 w-4 rounded"
                                                />
                                                <span className="text-xs text-neutral-300 leading-snug">
                                                    Entiendo que este cambio de entorno puede requerir reinstalación y deseo continuar.
                                                </span>
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Processing State */}
                        {currentStep === 'processing' && (
                            <motion.div
                                key="processing"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center justify-center py-16 space-y-4 text-center"
                            >
                                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shadow-lg shadow-primary/20">
                                    <LucideLoader className="h-8 w-8 animate-spin" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">Publicando nueva versión...</h3>
                                    <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                                        Estamos registrando la versión y preparando el manifiesto para el modpack.
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ── Footer Actions ── */}
                {currentStep !== 'processing' && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06] bg-white/[0.02]">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={currentStep === 'info' ? onClose : handleBack}
                            disabled={loading}
                            className="text-neutral-400 hover:text-white hover:bg-white/[0.06] rounded-xl text-xs gap-1.5"
                        >
                            <LucideArrowLeft className="h-3.5 w-3.5" />
                            {currentStep === 'info' ? 'Cancelar' : 'Atrás'}
                        </Button>

                        <Button
                            type="button"
                            onClick={handleNext}
                            disabled={loading || (currentStep === 'confirm' && breakingChanges.length > 0 && !acknowledgedBreaking)}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl text-xs gap-1.5 shadow-md shadow-primary/25 min-w-[120px]"
                        >
                            {currentStep === 'confirm' ? (
                                <>
                                    <LucideCheck className="h-3.5 w-3.5" />
                                    Confirmar y Crear
                                </>
                            ) : (
                                <>
                                    Siguiente
                                    <LucideArrowRight className="h-3.5 w-3.5" />
                                </>
                            )}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CreateVersionDialog;
