// Utility functions for formatting installation stage messages
import { InstallationStage } from "@/types/InstallationStage";

export function formatStageMessage(stage: InstallationStage | undefined, fallbackMessage: string): string {
    if (!stage) {
        return fallbackMessage;
    }

    switch (stage.type) {
        case "DownloadingFiles":
            const downloadPercentage = stage.total > 0 ? Number(((stage.current * 100) / stage.total).toFixed(1)) : 0;
            return `Descargando archivos: ${stage.current}/${stage.total} (${downloadPercentage.toFixed(1)}%)`;

        case "ExtractingLibraries":
            const extractPercentage = stage.total > 0 ? Number(((stage.current * 100) / stage.total).toFixed(1)) : 0;
            return `Extrayendo librerías: ${stage.current}/${stage.total} (${extractPercentage.toFixed(1)}%)`;

        case "InstallingForge":
            return "Instalando Forge...";

        case "ValidatingAssets":
            const validatingPercentage = stage.total > 0 ? Number(((stage.current * 100) / stage.total).toFixed(1)) : 0;
            return `Validando assets: ${stage.current}/${stage.total} (${validatingPercentage.toFixed(1)}%)`;

        case "DownloadingForgeLibraries":
            const forgePercentage = stage.total > 0 ? Number(((stage.current * 100) / stage.total).toFixed(1)) : 0;
            return `Descargando librerías de Forge: ${stage.current}/${stage.total} (${forgePercentage.toFixed(1)}%)`;

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
        case "DownloadingForgeLibraries":
            return stage.total > 0 ? Number(((stage.current / stage.total) * 100).toFixed(1)) : 0;
        case "InstallingForge":
            return undefined; // No progress for Forge installation
        default:
            return undefined;
    }
}