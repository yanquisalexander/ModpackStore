import { Link } from "react-router-dom"
import { AlertTriangle, Wrench, Wifi, HardDrive, FileX, Settings, LucideHome, LucideArrowLeft } from "lucide-react"

interface BootstrapError {
    step: string;
    category: string;
    message: string;
    suggestion?: string;
    technical_details?: string;
}

interface ErrorScreenProps {
    error: string;
    bootstrapError?: BootstrapError;
}

const getErrorIcon = (category?: string) => {
    const className = "w-10 h-10 text-neutral-600 mb-5"
    switch (category) {
        case "Java":
            return <Settings className={className} />;
        case "Network":
            return <Wifi className={className} />;
        case "Filesystem":
            return <HardDrive className={className} />;
        case "Forge":
            return <Wrench className={className} />;
        case "Configuration":
            return <FileX className={className} />;
        default:
            return <AlertTriangle className={className} />;
    }
};

const getStepDisplayName = (step: string): string => {
    const stepNames: Record<string, string> = {
        CreatingDirectories: "Creando directorios",
        DownloadingManifest: "Descargando manifiesto de versión",
        DownloadingVersionJson: "Descargando configuración de versión",
        DownloadingClientJar: "Descargando cliente de Minecraft",
        CheckingJavaVersion: "Verificando versión de Java",
        InstallingJava: "Instalando Java",
        DownloadingLibraries: "Descargando librerías",
        ValidatingAssets: "Validando assets",
        ExtractingNatives: "Extrayendo librerías nativas",
        DownloadingForgeInstaller: "Descargando instalador de Forge",
        RunningForgeInstaller: "Ejecutando instalador de Forge",
        CreatingLauncherProfiles: "Creando perfiles del launcher"
    };
    return stepNames[step] || step;
};

export const ErrorScreen: React.FC<ErrorScreenProps> = ({ error, bootstrapError }) => {
    return (
        <div className="h-full flex flex-col items-center justify-center px-4">
            {getErrorIcon(bootstrapError?.category)}

            <h1 className="text-base font-semibold text-white/80">
                {bootstrapError ? "Error de instalación" : "Ha ocurrido un error"}
            </h1>

            {bootstrapError && (
                <p className="text-xs text-neutral-500 mt-1">
                    Falló en: {getStepDisplayName(bootstrapError.step)}
                </p>
            )}

            <p className="text-sm text-neutral-600 mt-3 max-w-xs text-center leading-relaxed">
                {bootstrapError ? bootstrapError.message : error}
            </p>

            {bootstrapError?.suggestion && (
                <p className="text-sm text-amber-600/80 mt-3 max-w-xs text-center leading-relaxed">
                    {bootstrapError.suggestion}
                </p>
            )}

            {bootstrapError?.technical_details && (
                <details className="mt-4 text-xs text-neutral-600 max-w-xs w-full">
                    <summary className="cursor-pointer hover:text-neutral-400 text-center">
                        Ver detalles técnicos
                    </summary>
                    <pre className="mt-2 p-3 bg-black/20 rounded overflow-x-auto text-neutral-500">
                        {bootstrapError.technical_details}
                    </pre>
                </details>
            )}

            <div className="flex items-center gap-3 mt-8">
                <Link
                    to="/"
                    className="flex items-center gap-1.5 bg-white text-black text-sm font-semibold px-4 py-2 rounded-lg hover:bg-white/90 transition-colors active:scale-95"
                >
                    <LucideHome className="w-4 h-4" />
                    Ir al inicio
                </Link>
                <button
                    onClick={() => window.history.back()}
                    className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 px-4 py-2 rounded-lg hover:text-neutral-300 hover:bg-white/[0.04] transition-colors"
                >
                    <LucideArrowLeft className="w-4 h-4" />
                    Volver
                </button>
            </div>
        </div>
    );
};
