import React, { useState, useEffect } from 'react';
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
    Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { API_ENDPOINT } from '@/consts';
import { useAuthentication } from '@/stores/AuthContext';
import { fetchMinecraftManifestWithFailover } from '@/utils/minecraftManifestFailover';
import { 
    fetchForgeVersions, 
    fetchLoaderVersions, 
    getModLoaderDisplayName,
    type ModLoaderType 
} from '@/utils/modloaderVersions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { motion, AnimatePresence } from 'motion/react';
import Lottie from 'lottie-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    modpack: {
        id: string;
        name: string;
        publisherId: string;
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

const ModpackVersionWizard: React.FC<Props> = ({ 
    isOpen, 
    onClose, 
    onSuccess, 
    modpack, 
    existingVersions 
}) => {
    const { sessionTokens } = useAuthentication();
    
    // Wizard state
    const [currentStep, setCurrentStep] = useState<WizardStep>('info');
    const [loading, setLoading] = useState(false);
    
    // Form data
    const latestVersion = existingVersions.length > 0 ? existingVersions[0] : null;
    const [versionName, setVersionName] = useState('');
    const [mcVersion, setMcVersion] = useState(latestVersion?.mcVersion || '');
    const [loaderType, setLoaderType] = useState<ModLoaderType>(
        (latestVersion?.loaderType as ModLoaderType) || 'vanilla'
    );
    const [loaderVersion, setLoaderVersion] = useState(latestVersion?.loaderVersion || '');
    
    // Version lists
    const [minecraftVersions, setMinecraftVersions] = useState<MinecraftVersion[]>([]);
    const [forgeVersionsMap, setForgeVersionsMap] = useState<Record<string, string[]>>({});
    const [loaderVersions, setLoaderVersions] = useState<string[]>([]);
    const [loadingVersions, setLoadingVersions] = useState(false);
    
    // Breaking changes
    const [breakingChanges, setBreakingChanges] = useState<BreakingChange[]>([]);
    const [acknowledgedBreaking, setAcknowledgedBreaking] = useState(false);
    
    // Success animation data (placeholder - you can replace with actual Lottie JSON)
    const successAnimation = {
        v: "5.5.7",
        fr: 60,
        ip: 0,
        op: 120,
        w: 500,
        h: 500,
        nm: "Success",
        ddd: 0,
        assets: [],
        layers: []
    };

    // Load Minecraft and Forge versions when wizard opens
    useEffect(() => {
        if (isOpen) {
            loadVersions();
        }
    }, [isOpen]);

    // Update loader versions when MC version or loader type changes
    useEffect(() => {
        if (mcVersion && loaderType !== 'vanilla') {
            loadLoaderVersions();
        } else {
            setLoaderVersions([]);
            setLoaderVersion('');
        }
    }, [mcVersion, loaderType]);

    // Check for breaking changes when moving to confirm step
    useEffect(() => {
        if (currentStep === 'confirm' && latestVersion) {
            detectBreakingChanges();
        }
    }, [currentStep]);

    const loadVersions = async () => {
        setLoadingVersions(true);
        try {
            // Load Minecraft versions
            const data = await fetchMinecraftManifestWithFailover();
            const releases = data.versions.filter((v: MinecraftVersion) => v.type === 'release');
            setMinecraftVersions(releases);
            
            // Set default MC version if not set
            if (!mcVersion && releases.length > 0) {
                setMcVersion(releases[0].id);
            }
            
            // Load Forge versions
            const forgeMap = await fetchForgeVersions();
            setForgeVersionsMap(forgeMap);
        } catch (error) {
            console.error('Error loading versions:', error);
            toast.error('No se pudieron cargar las versiones disponibles');
        } finally {
            setLoadingVersions(false);
        }
    };

    const loadLoaderVersions = async () => {
        setLoadingVersions(true);
        try {
            const versions = await fetchLoaderVersions(loaderType, mcVersion);
            setLoaderVersions(versions);
            
            // Set first version as default if not set
            if (versions.length > 0 && !loaderVersion) {
                setLoaderVersion(versions[0]);
            }
        } catch (error) {
            console.error('Error loading loader versions:', error);
            toast.error(`No se pudieron cargar las versiones de ${getModLoaderDisplayName(loaderType)}`);
        } finally {
            setLoadingVersions(false);
        }
    };

    const detectBreakingChanges = () => {
        const changes: BreakingChange[] = [];
        
        for (const version of existingVersions) {
            const versionLoaderType = version.loaderType || (version.forgeVersion ? 'forge' : 'vanilla');
            
            // Check if MC version or loader type differs
            if (version.mcVersion !== mcVersion || versionLoaderType !== loaderType) {
                changes.push({
                    version: version.version,
                    mcVersion: version.mcVersion,
                    loaderType: versionLoaderType
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
        if (currentStep === 'loader') {
            setCurrentStep('info');
        } else if (currentStep === 'confirm') {
            setCurrentStep('loader');
        }
    };

    const handleSubmit = async () => {
        setCurrentStep('processing');
        setLoading(true);

        try {
            const response = await fetch(
                `${API_ENDPOINT}/creators/publishers/${modpack.publisherId}/modpacks/${modpack.id}/versions`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        versionName: versionName.trim(),
                        mcVersion,
                        loaderType,
                        loaderVersion: loaderType === 'vanilla' ? null : loaderVersion,
                        forgeVersion: loaderType === 'forge' ? loaderVersion : null,
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.json().catch(() => null);
                throw new Error(error?.message || 'Error al crear la versión');
            }

            // Show success animation for a moment
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            toast.success('Versión creada exitosamente');
            resetForm();
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

    const resetForm = () => {
        setCurrentStep('info');
        setVersionName('');
        setMcVersion(latestVersion?.mcVersion || '');
        setLoaderType((latestVersion?.loaderType as ModLoaderType) || 'vanilla');
        setLoaderVersion(latestVersion?.loaderVersion || '');
        setBreakingChanges([]);
        setAcknowledgedBreaking(false);
    };

    const handleClose = () => {
        if (!loading) {
            resetForm();
            onClose();
        }
    };

    const getLoaderIcon = (type: ModLoaderType) => {
        const iconProps = { className: "h-6 w-6" };
        switch (type) {
            case 'forge': return <LucideAnvil {...iconProps} />;
            case 'fabric': return <LucideFeather {...iconProps} />;
            case 'neoforge': return <LucideHammer {...iconProps} />;
            case 'quilt': return <LucideTestTubeDiagonal {...iconProps} />;
            default: return <LucidePackage {...iconProps} />;
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-zinc-950 flex items-center justify-center">
            <div className="w-full max-w-4xl h-full max-h-[90vh] bg-zinc-900 rounded-lg shadow-2xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <LucidePackage className="h-8 w-8 text-blue-500" />
                        <div>
                            <h2 className="text-2xl font-bold text-white">
                                Crear Nueva Versión
                            </h2>
                            <p className="text-sm text-zinc-400">
                                {modpack.name}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={loading}
                        className="p-2 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <LucideX className="h-6 w-6 text-zinc-400" />
                    </button>
                </div>

                {/* Progress indicator */}
                <div className="px-6 pt-6">
                    <div className="flex items-center justify-between">
                        {(['info', 'loader', 'confirm'] as const).map((step, index) => (
                            <React.Fragment key={step}>
                                <div className="flex flex-col items-center gap-2">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                                        currentStep === step 
                                            ? 'bg-blue-600 text-white' 
                                            : index < ['info', 'loader', 'confirm'].indexOf(currentStep)
                                            ? 'bg-green-600 text-white'
                                            : 'bg-zinc-800 text-zinc-500'
                                    }`}>
                                        {index < ['info', 'loader', 'confirm'].indexOf(currentStep) 
                                            ? <LucideCheck className="h-5 w-5" />
                                            : index + 1
                                        }
                                    </div>
                                    <span className="text-xs text-zinc-400 capitalize">{step}</span>
                                </div>
                                {index < 2 && (
                                    <div className={`flex-1 h-1 mx-4 ${
                                        index < ['info', 'loader', 'confirm'].indexOf(currentStep)
                                            ? 'bg-green-600'
                                            : 'bg-zinc-800'
                                    }`} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <AnimatePresence mode="wait">
                        {currentStep === 'info' && (
                            <motion.div
                                key="info"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div>
                                    <h3 className="text-xl font-semibold text-white mb-2">
                                        Información Básica
                                    </h3>
                                    <p className="text-zinc-400">
                                        Comienza ingresando un nombre identificador para esta nueva versión.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-sm font-medium text-zinc-300 block mb-2">
                                            Nombre de la Versión *
                                        </label>
                                        <Input
                                            value={versionName}
                                            onChange={(e) => setVersionName(e.target.value)}
                                            placeholder="ej: 1.0.0, v2.1.3, Release Candidate 1"
                                            className="text-lg bg-zinc-800 border-zinc-700 text-white"
                                            autoFocus
                                        />
                                        <p className="text-xs text-zinc-500 mt-1">
                                            Este nombre se mostrará a los usuarios en la lista de versiones.
                                        </p>
                                    </div>

                                    {latestVersion && (
                                        <Alert className="bg-blue-900/20 border-blue-800">
                                            <LucidePackage className="h-4 w-4" />
                                            <AlertTitle>Versión anterior detectada</AlertTitle>
                                            <AlertDescription>
                                                Tu última versión fue <strong>{latestVersion.version}</strong> con 
                                                Minecraft {latestVersion.mcVersion}.
                                                Los valores se precargarán automáticamente en el siguiente paso.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {currentStep === 'loader' && (
                            <motion.div
                                key="loader"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div>
                                    <h3 className="text-xl font-semibold text-white mb-2">
                                        Configuración Técnica
                                    </h3>
                                    <p className="text-zinc-400">
                                        Selecciona la versión de Minecraft y el modloader que utilizará esta versión.
                                    </p>
                                </div>

                                <div className="space-y-6">
                                    {/* Minecraft Version */}
                                    <div>
                                        <label className="text-sm font-medium text-zinc-300 block mb-2">
                                            Versión de Minecraft *
                                        </label>
                                        {loadingVersions ? (
                                            <div className="flex items-center gap-2 p-3 bg-zinc-800 rounded-lg">
                                                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                                <span className="text-sm text-zinc-400">Cargando versiones...</span>
                                            </div>
                                        ) : (
                                            <Select value={mcVersion} onValueChange={setMcVersion}>
                                                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                                                    <SelectValue placeholder="Selecciona una versión" />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-60">
                                                    {minecraftVersions.map((v) => (
                                                        <SelectItem key={v.id} value={v.id}>
                                                            {v.id}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </div>

                                    {/* Mod Loader Type */}
                                    <div>
                                        <label className="text-sm font-medium text-zinc-300 block mb-2">
                                            Tipo de Modloader *
                                        </label>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {(['vanilla', 'forge', 'fabric', 'neoforge', 'quilt'] as ModLoaderType[]).map((type) => (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    onClick={() => setLoaderType(type)}
                                                    className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                                                        loaderType === type
                                                            ? 'bg-blue-600/20 border-blue-600 text-white'
                                                            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                                                    }`}
                                                >
                                                    {getLoaderIcon(type)}
                                                    <span className="font-medium">
                                                        {getModLoaderDisplayName(type)}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Loader Version */}
                                    {loaderType !== 'vanilla' && (
                                        <div>
                                            <label className="text-sm font-medium text-zinc-300 block mb-2">
                                                Versión de {getModLoaderDisplayName(loaderType)} *
                                            </label>
                                            {loadingVersions ? (
                                                <div className="flex items-center gap-2 p-3 bg-zinc-800 rounded-lg">
                                                    <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                                                    <span className="text-sm text-zinc-400">
                                                        Cargando versiones de {getModLoaderDisplayName(loaderType)}...
                                                    </span>
                                                </div>
                                            ) : loaderVersions.length > 0 ? (
                                                <Select value={loaderVersion} onValueChange={setLoaderVersion}>
                                                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                                                        <SelectValue placeholder="Selecciona una versión" />
                                                    </SelectTrigger>
                                                    <SelectContent className="max-h-60">
                                                        {loaderVersions.map((v) => (
                                                            <SelectItem key={v} value={v}>
                                                                {v}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <Alert className="bg-yellow-900/20 border-yellow-800">
                                                    <LucideAlertTriangle className="h-4 w-4" />
                                                    <AlertDescription>
                                                        No hay versiones de {getModLoaderDisplayName(loaderType)} disponibles 
                                                        para Minecraft {mcVersion}
                                                    </AlertDescription>
                                                </Alert>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {currentStep === 'confirm' && (
                            <motion.div
                                key="confirm"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div>
                                    <h3 className="text-xl font-semibold text-white mb-2">
                                        Confirmación
                                    </h3>
                                    <p className="text-zinc-400">
                                        Revisa los detalles antes de crear la versión.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    {/* Summary */}
                                    <div className="bg-zinc-800 rounded-lg p-4 space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-zinc-400">Nombre de versión:</span>
                                            <span className="text-white font-medium">{versionName}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-zinc-400">Minecraft:</span>
                                            <span className="text-white font-medium">{mcVersion}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-zinc-400">Modloader:</span>
                                            <span className="text-white font-medium flex items-center gap-2">
                                                {getLoaderIcon(loaderType)}
                                                {getModLoaderDisplayName(loaderType)}
                                                {loaderType !== 'vanilla' && ` ${loaderVersion}`}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Breaking Changes Warning */}
                                    {breakingChanges.length > 0 && (
                                        <Alert className="bg-red-900/20 border-red-800">
                                            <LucideAlertTriangle className="h-5 w-5 text-red-500" />
                                            <AlertTitle className="text-lg font-bold text-red-400">
                                                ⚠️ ¡Atención! Cambio Crítico Detectado
                                            </AlertTitle>
                                            <AlertDescription className="space-y-3 mt-2">
                                                <p className="text-zinc-300">
                                                    La nueva configuración del modloader o de la versión de Minecraft 
                                                    no es compatible con las siguientes versiones anteriores:
                                                </p>
                                                <ul className="list-disc list-inside space-y-1 text-sm">
                                                    {breakingChanges.slice(0, 5).map((change, idx) => (
                                                        <li key={idx} className="text-zinc-400">
                                                            <strong>{change.version}</strong> 
                                                            {' '}(Minecraft {change.mcVersion} - {getModLoaderDisplayName(change.loaderType as ModLoaderType)})
                                                        </li>
                                                    ))}
                                                    {breakingChanges.length > 5 && (
                                                        <li className="text-zinc-500">
                                                            ... y {breakingChanges.length - 5} más
                                                        </li>
                                                    )}
                                                </ul>
                                                <p className="text-yellow-300 text-sm">
                                                    Los usuarios que actualicen a esta nueva versión desde las mencionadas anteriormente 
                                                    deberán reinstalar la instancia por completo para evitar errores.
                                                </p>
                                                
                                                <label className="flex items-start gap-3 mt-4 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={acknowledgedBreaking}
                                                        onChange={(e) => setAcknowledgedBreaking(e.target.checked)}
                                                        className="mt-1"
                                                    />
                                                    <span className="text-white text-sm">
                                                        Entiendo que esta versión no es compatible con versiones anteriores 
                                                        y deseo continuar.
                                                    </span>
                                                </label>
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {currentStep === 'processing' && (
                            <motion.div
                                key="processing"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center justify-center py-12 space-y-6"
                            >
                                <div className="w-48 h-48">
                                    <Lottie 
                                        animationData={successAnimation} 
                                        loop={true}
                                        className="w-full h-full"
                                    />
                                </div>
                                <h3 className="text-2xl font-bold text-white">
                                    Creando versión...
                                </h3>
                                <p className="text-zinc-400 text-center max-w-md">
                                    Estamos configurando todo para tu nueva versión. 
                                    Esto solo tomará un momento.
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer */}
                {currentStep !== 'processing' && (
                    <div className="p-6 border-t border-zinc-800 flex justify-between">
                        <Button
                            variant="outline"
                            onClick={currentStep === 'info' ? handleClose : handleBack}
                            disabled={loading}
                            className="bg-zinc-800 text-white hover:bg-zinc-700"
                        >
                            <LucideArrowLeft className="h-4 w-4 mr-2" />
                            {currentStep === 'info' ? 'Cancelar' : 'Atrás'}
                        </Button>
                        
                        <Button
                            onClick={handleNext}
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {currentStep === 'confirm' ? (
                                <>
                                    <LucideCheck className="h-4 w-4 mr-2" />
                                    Crear Versión
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

export default ModpackVersionWizard;
