import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { API_ENDPOINT } from '@/consts';
import { useAuthentication } from '@/stores/AuthContext';
import { fetchMinecraftManifestWithFailover } from '@/utils/minecraftManifestFailover';
import {
    fetchLoaderVersions,
    getModLoaderDisplayName,
    type ModLoaderType
} from '@/utils/modloaderVersions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    modpack: {
        id: string;
        name: string;
        creatorId: string;
    };
    existingVersions: Array<{
        id: string;
        version: string;
        mcVersion: string;
        forgeVersion?: string;
        loaderType?: string;
        loaderVersion?: string;
        createdAt: string;
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

const STEPS: { key: WizardStep; label: string }[] = [
    { key: 'info', label: 'Información' },
    { key: 'loader', label: 'Configuración' },
    { key: 'confirm', label: 'Confirmar' },
];

const getLoaderIcon = (type: ModLoaderType) => {
    const props = { className: "h-5 w-5" };
    switch (type) {
        case 'forge': return <LucideAnvil {...props} />;
        case 'fabric': return <LucideFeather {...props} />;
        case 'neoforge': return <LucideHammer {...props} />;
        case 'quilt': return <LucideTestTubeDiagonal {...props} />;
        default: return <LucidePackage {...props} />;
    }
};

const PublisherModpackVersionWizard = ({
    isOpen,
    onClose,
    onSuccess,
    modpack,
    existingVersions,
}: Props) => {
    const { sessionTokens } = useAuthentication();

    const latestVersion = existingVersions.length > 0 ? existingVersions[0] : null;

    const [currentStep, setCurrentStep] = useState<WizardStep>('info');
    const [loading, setLoading] = useState(false);

    const [versionName, setVersionName] = useState('');
    const [mcVersion, setMcVersion] = useState('');
    const [loaderType, setLoaderType] = useState<ModLoaderType>('vanilla');
    const [loaderVersion, setLoaderVersion] = useState('');

    const [minecraftVersions, setMinecraftVersions] = useState<MinecraftVersion[]>([]);
    const [loaderVersions, setLoaderVersions] = useState<string[]>([]);
    const [loadingMinecraftVersions, setLoadingMinecraftVersions] = useState(false);
    const [loadingLoaderVersions, setLoadingLoaderVersions] = useState(false);

    const [breakingChanges, setBreakingChanges] = useState<BreakingChange[]>([]);
    const [acknowledgedBreaking, setAcknowledgedBreaking] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setCurrentStep('info');
        setVersionName('');
        setMcVersion(latestVersion?.mcVersion || '');
        setLoaderType((latestVersion?.loaderType as ModLoaderType) || 'vanilla');
        setLoaderVersion(latestVersion?.loaderVersion || '');
        setBreakingChanges([]);
        setAcknowledgedBreaking(false);
        setLoading(false);
    }, [isOpen, latestVersion?.id]);

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        const load = async () => {
            setLoadingMinecraftVersions(true);
            try {
                const data = await fetchMinecraftManifestWithFailover();
                if (cancelled) return;
                const releases = data.versions.filter((v: MinecraftVersion) => v.type === 'release');
                setMinecraftVersions(releases);
                if (!mcVersion && releases.length > 0) {
                    setMcVersion(releases[0].id);
                }
            } catch (error) {
                if (cancelled) return;
                console.error('Error loading versions:', error);
                toast.error('No se pudieron cargar las versiones disponibles');
            } finally {
                if (!cancelled) setLoadingMinecraftVersions(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        const fn = async () => {
            setLoadingLoaderVersions(true);
            try {
                const versions = await fetchLoaderVersions(loaderType, mcVersion);
                if (cancelled) return;
                setLoaderVersions(versions);
                if (versions.length > 0 && !loaderVersion) {
                    setLoaderVersion(versions[0]);
                }
            } catch (error) {
                if (cancelled) return;
                console.error('Error loading loader versions:', error);
                toast.error(`No se pudieron cargar las versiones de ${getModLoaderDisplayName(loaderType)}`);
            } finally {
                if (!cancelled) setLoadingLoaderVersions(false);
            }
        };
        if (mcVersion && loaderType !== 'vanilla') {
            fn();
        } else {
            setLoaderVersions([]);
            setLoaderVersion('');
        }
        return () => { cancelled = true; };
    }, [isOpen, mcVersion, loaderType]);

    const currentStepIndex = STEPS.findIndex(s => s.key === currentStep);

    const detectBreakingChanges = () => {
        const changes: BreakingChange[] = [];
        for (const version of existingVersions) {
            const versionLoaderType = version.loaderType || (version.forgeVersion ? 'forge' : 'vanilla');
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
            const response = await fetch(
                `${API_ENDPOINT}/creators/${modpack.creatorId}/modpacks/${modpack.id}/versions`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${sessionTokens?.accessToken}`,
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
                const error = await response.json().catch(() => null);
                throw new Error(error?.message || 'Error al crear la versión');
            }
            await new Promise(resolve => setTimeout(resolve, 1500));
            toast.success('Versión creada exitosamente');
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

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-[#121214] rounded-2xl border border-white/[0.06] shadow-2xl flex flex-col max-h-[85vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06] shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                            <LucideGitBranch className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">
                                Nueva versión
                            </h2>
                            <p className="text-sm text-neutral-500">
                                {modpack.name}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors disabled:opacity-50"
                    >
                        <LucideX className="h-5 w-5 text-neutral-500" />
                    </button>
                </div>

                {/* Step indicator */}
                <div className="px-6 pt-6 pb-4 shrink-0">
                    <div className="flex items-center gap-0">
                        {STEPS.map((step, index) => {
                            const isActive = currentStep === step.key;
                            const isCompleted = index < currentStepIndex;
                            return (
                                <div key={step.key} className="flex items-center flex-1">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                                            isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' :
                                            isCompleted ? 'bg-emerald-600 text-white' :
                                            'bg-white/[0.06] text-neutral-500'
                                        }`}>
                                            {isCompleted ? <LucideCheck className="h-4 w-4" /> : index + 1}
                                        </div>
                                        <span className={`text-xs font-medium hidden sm:block ${
                                            isActive ? 'text-white' : isCompleted ? 'text-emerald-400' : 'text-neutral-500'
                                        }`}>
                                            {step.label}
                                        </span>
                                    </div>
                                    {index < STEPS.length - 1 && (
                                        <div className={`flex-1 h-px mx-4 ${
                                            isCompleted ? 'bg-emerald-600' : 'bg-white/[0.06]'
                                        }`} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
                    <AnimatePresence mode="wait">
                        {currentStep === 'info' && (
                            <motion.div
                                key="info"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className="space-y-6"
                            >
                                <div>
                                    <label className="text-sm font-medium text-neutral-300 block mb-2">
                                        Nombre de la versión <span className="text-red-400">*</span>
                                    </label>
                                    <Input
                                        value={versionName}
                                        onChange={(e) => setVersionName(e.target.value)}
                                        placeholder="ej: 1.0.0, v2.1.3, Release Candidate 1"
                                        className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-neutral-600 h-11"
                                        autoFocus
                                    />
                                    <p className="text-xs text-neutral-600 mt-1.5">
                                        Este nombre se mostrará a los usuarios en la lista de versiones.
                                    </p>
                                </div>

                                {latestVersion && (
                                    <div className="p-4 rounded-xl bg-blue-500/[0.04] border border-blue-500/10">
                                        <div className="flex items-start gap-3">
                                            <LucidePackage className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
                                            <div>
                                                <p className="text-sm font-medium text-white mb-1">
                                                    Versión anterior detectada
                                                </p>
                                                <p className="text-xs text-neutral-400 leading-relaxed">
                                                    Tu última versión fue <span className="text-white font-medium">{latestVersion.version}</span> con
                                                    Minecraft <span className="text-white font-medium">{latestVersion.mcVersion}</span>.
                                                    Los valores se precargarán automáticamente en el siguiente paso.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {currentStep === 'loader' && (
                            <motion.div
                                key="loader"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className="space-y-6"
                            >
                                {/* Minecraft Version */}
                                <div>
                                    <label className="text-sm font-medium text-neutral-300 block mb-2">
                                        Versión de Minecraft <span className="text-red-400">*</span>
                                    </label>
                                    {loadingMinecraftVersions ? (
                                        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                                            <LucideLoader className="h-4 w-4 animate-spin text-blue-400" />
                                            <span className="text-sm text-neutral-500">Cargando versiones...</span>
                                        </div>
                                    ) : (
                                        <Select value={mcVersion} onValueChange={setMcVersion}>
                                            <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white h-11">
                                                <SelectValue placeholder="Selecciona una versión" />
                                            </SelectTrigger>
                                            <SelectContent className="border-white/[0.08] bg-[#1a1a1e]">
                                                {minecraftVersions.map((v) => (
                                                    <SelectItem key={v.id} value={v.id}>{v.id}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>

                                {/* Mod Loader Type */}
                                <div>
                                    <label className="text-sm font-medium text-neutral-300 block mb-3">
                                        Tipo de Modloader <span className="text-red-400">*</span>
                                    </label>
                                    <div className="grid grid-cols-5 gap-2">
                                        {(['vanilla', 'forge', 'fabric', 'neoforge', 'quilt'] as ModLoaderType[]).map((type) => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => {
                                                    setLoaderType(type);
                                                    setLoaderVersion('');
                                                }}
                                                className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-1.5 ${
                                                    loaderType === type
                                                        ? 'bg-blue-600/15 border-blue-500/40 text-white'
                                                        : 'bg-white/[0.03] border-white/[0.06] text-neutral-500 hover:text-neutral-300 hover:border-white/[0.12]'
                                                }`}
                                            >
                                                {getLoaderIcon(type)}
                                                <span className="text-[10px] font-semibold leading-tight text-center">
                                                    {getModLoaderDisplayName(type)}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Loader Version */}
                                {loaderType !== 'vanilla' && (
                                    <div>
                                        <label className="text-sm font-medium text-neutral-300 block mb-2">
                                            Versión de {getModLoaderDisplayName(loaderType)} <span className="text-red-400">*</span>
                                        </label>
                                        {loadingLoaderVersions ? (
                                            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                                                <LucideLoader className="h-4 w-4 animate-spin text-orange-400" />
                                                <span className="text-sm text-neutral-500">
                                                    Cargando versiones de {getModLoaderDisplayName(loaderType)}...
                                                </span>
                                            </div>
                                        ) : loaderVersions.length > 0 ? (
                                            <Select value={loaderVersion} onValueChange={setLoaderVersion}>
                                                <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white h-11">
                                                    <SelectValue placeholder="Selecciona una versión" />
                                                </SelectTrigger>
                                                <SelectContent className="border-white/[0.08] bg-[#1a1a1e]">
                                                    {loaderVersions.map((v) => (
                                                        <SelectItem key={v} value={v}>{v}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <div className="p-4 rounded-xl bg-amber-500/[0.04] border border-amber-500/10">
                                                <p className="text-sm text-amber-400/80">
                                                    No hay versiones de {getModLoaderDisplayName(loaderType)} disponibles
                                                    para Minecraft {mcVersion}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {currentStep === 'confirm' && (
                            <motion.div
                                key="confirm"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className="space-y-6"
                            >
                                <div className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-4">
                                    <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Resumen</h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-neutral-500">Nombre</span>
                                            <span className="text-sm font-medium text-white">{versionName}</span>
                                        </div>
                                        <div className="h-px bg-white/[0.04]" />
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-neutral-500">Minecraft</span>
                                            <span className="text-sm font-medium text-white">{mcVersion}</span>
                                        </div>
                                        <div className="h-px bg-white/[0.04]" />
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-neutral-500">Modloader</span>
                                            <span className="text-sm font-medium text-white flex items-center gap-2">
                                                {getLoaderIcon(loaderType)}
                                                {getModLoaderDisplayName(loaderType)}
                                                {loaderType !== 'vanilla' && <span className="text-neutral-400">v{loaderVersion}</span>}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {breakingChanges.length > 0 && (
                                    <div className="p-5 rounded-xl bg-red-500/[0.04] border border-red-500/10">
                                        <div className="flex items-start gap-3 mb-3">
                                            <LucideAlertTriangle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                                            <div>
                                                <h4 className="text-sm font-semibold text-red-400">Cambio crítico detectado</h4>
                                                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                                                    La nueva configuración no es compatible con las siguientes versiones anteriores:
                                                </p>
                                            </div>
                                        </div>
                                        <ul className="space-y-1.5 mb-4 ml-8">
                                            {breakingChanges.slice(0, 5).map((change, idx) => (
                                                <li key={idx} className="text-xs text-neutral-500 list-disc">
                                                    <span className="text-white font-medium">{change.version}</span>
                                                    {' '}(MC {change.mcVersion} — {getModLoaderDisplayName(change.loaderType as ModLoaderType)})
                                                </li>
                                            ))}
                                            {breakingChanges.length > 5 && (
                                                <li className="text-xs text-neutral-600 list-disc">
                                                    ... y {breakingChanges.length - 5} más
                                                </li>
                                            )}
                                        </ul>
                                        <p className="text-xs text-amber-400/80 mb-4 leading-relaxed">
                                            Los usuarios que actualicen desde esas versiones deberán reinstalar la instancia por completo.
                                        </p>
                                        <label className="flex items-start gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={acknowledgedBreaking}
                                                onChange={(e) => setAcknowledgedBreaking(e.target.checked)}
                                                className="mt-0.5 accent-blue-600"
                                            />
                                            <span className="text-xs text-neutral-300 leading-relaxed">
                                                Entiendo que esta versión no es compatible con versiones anteriores y deseo continuar.
                                            </span>
                                        </label>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {currentStep === 'processing' && (
                            <motion.div
                                key="processing"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center justify-center py-16 space-y-4"
                            >
                                <div className="relative">
                                    <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                                        <LucideLoader className="h-8 w-8 animate-spin text-blue-400" />
                                    </div>
                                </div>
                                <div className="text-center">
                                    <h3 className="text-lg font-semibold text-white">Creando versión...</h3>
                                    <p className="text-sm text-neutral-500 mt-1 max-w-xs">
                                        Estamos configurando todo para tu nueva versión. Esto solo tomará un momento.
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer */}
                {currentStep !== 'processing' && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06] shrink-0">
                        <Button
                            variant="outline"
                            onClick={currentStep === 'info' ? onClose : handleBack}
                            disabled={loading}
                            className="border-white/[0.08] text-neutral-400 hover:text-white hover:bg-white/[0.06]"
                        >
                            <LucideArrowLeft className="h-4 w-4 mr-2" />
                            {currentStep === 'info' ? 'Cancelar' : 'Atrás'}
                        </Button>
                        <Button
                            onClick={handleNext}
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20"
                        >
                            {currentStep === 'confirm' ? (
                                <>
                                    <LucideCheck className="h-4 w-4 mr-2" />
                                    Crear versión
                                </>
                            ) : (
                                <>
                                    Siguiente
                                    <LucideArrowRight className="h-4 w-4 ml-2" />
                                </>
                            )}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PublisherModpackVersionWizard;
