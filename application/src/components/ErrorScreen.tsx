// components/ErrorScreen.tsx
import React from "react";
import { AlertTriangle, Wrench, Wifi, HardDrive, FileX, Settings } from "lucide-react";

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
    switch (category) {
        case "Java":
            return <Settings className="w-12 h-12 text-red-400 mb-4" />;
        case "Network":
            return <Wifi className="w-12 h-12 text-red-400 mb-4" />;
        case "Filesystem":
            return <HardDrive className="w-12 h-12 text-red-400 mb-4" />;
        case "Forge":
            return <Wrench className="w-12 h-12 text-red-400 mb-4" />;
        case "Configuration":
            return <FileX className="w-12 h-12 text-red-400 mb-4" />;
        default:
            return <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />;
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
    if (bootstrapError) {
        return (
            <div className="flex min-h-screen bg-[#202020] text-gray-100 items-center justify-center p-4">
                <div className="max-w-md w-full p-8 rounded-lg bg-red-900/30 border border-red-500/50 text-center">
                    {getErrorIcon(bootstrapError.category)}
                    <h2 className="text-xl font-bold text-red-400 mb-2">Error de instalación</h2>
                    <p className="text-sm text-red-300 mb-4">
                        Falló en: {getStepDisplayName(bootstrapError.step)}
                    </p>
                    <p className="text-gray-300 mb-4">{bootstrapError.message}</p>
                    
                    {bootstrapError.suggestion && (
                        <div className="bg-yellow-900/30 border border-yellow-500/50 rounded p-3 mb-4">
                            <p className="text-sm text-yellow-200">
                                <strong>Sugerencia:</strong> {bootstrapError.suggestion}
                            </p>
                        </div>
                    )}
                    
                    {bootstrapError.technical_details && (
                        <details className="text-left text-xs text-gray-400 mt-4">
                            <summary className="cursor-pointer hover:text-gray-300">
                                Ver detalles técnicos
                            </summary>
                            <pre className="mt-2 p-2 bg-gray-800 rounded overflow-x-auto">
                                {bootstrapError.technical_details}
                            </pre>
                        </details>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-[#202020] text-gray-100 items-center justify-center">
            <div className="p-8 rounded-lg bg-red-900/30 border border-red-500/50 text-center">
                <AlertTriangle className="w-12 h-12 text-red-400 mb-4 mx-auto" />
                <h2 className="text-xl font-bold text-red-400">Ha ocurrido un error</h2>
                <p className="mt-2 text-gray-300">{error}</p>
            </div>
        </div>
    );
};