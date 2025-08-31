// Utility functions for formatting installation stage messages
import { InstallationStage } from "@/types/InstallationStage";

export function formatStageMessage(stage: InstallationStage | undefined, fallbackMessage: string): string {
    if (!stage) {
        return fallbackMessage;
    }

    switch (stage.type) {
        case "DownloadingFiles":
            const downloadPercentage = stage.total > 0 ? Math.round((stage.current * 100) / stage.total) : 0;
            return `Descargando archivos: ${stage.current}/${stage.total} (${downloadPercentage}%)`;

        case "ExtractingLibraries":
            const extractPercentage = stage.total > 0 ? Math.round((stage.current * 100) / stage.total) : 0;
            return `Extrayendo librerías: ${stage.current}/${stage.total} (${extractPercentage}%)`;

        case "InstallingForge":
            return "Instalando Forge...";

        case "ValidatingAssets":
            const validatingPercentage = stage.total > 0 ? Math.round((stage.current * 100) / stage.total) : 0;
            return `Validando assets: ${stage.current}/${stage.total} (${validatingPercentage}%)`;

        default:
            return fallbackMessage;
    }
}

export function getStageProgress(stage: InstallationStage | undefined): number | undefined {
    if (!stage) return undefined;

    switch (stage.type) {
        case "DownloadingFiles":
        case "ExtractingLibraries":
        case "ValidatingAssets":
            return stage.total > 0 ? (stage.current / stage.total) * 100 : 0;
        case "InstallingForge":
            return undefined; // No progress for Forge installation
        default:
            return undefined;
    }
}