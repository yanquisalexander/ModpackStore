// Types for the installation stage system

export interface StageDownloadingFiles {
    type: "DownloadingFiles";
    current: number;
    total: number;
}

export interface StageExtractingLibraries {
    type: "ExtractingLibraries";
    current: number;
    total: number;
}

export interface StageInstallingForge {
    type: "InstallingForge";
}

export interface StageValidatingAssets {
    type: "ValidatingAssets";
    current: number;
    total: number;
}

export interface StageDownloadingForgeLibraries {
    type: "DownloadingForgeLibraries";
    current: number;
    total: number;
}

export interface StageDownloadingModpackFiles {
    type: "DownloadingModpackFiles";
    current: number;
    total: number;
}

export interface StageCheckingModpackStatus {
    type: "CheckingModpackStatus";
}

export interface StageLightweightValidation {
    type: "LightweightValidation";
}

export type InstallationStage = 
    | StageDownloadingFiles 
    | StageExtractingLibraries 
    | StageInstallingForge 
    | StageValidatingAssets
    | StageDownloadingForgeLibraries
    | StageDownloadingModpackFiles
    | StageCheckingModpackStatus
    | StageLightweightValidation;

// Event payload type that includes stage information
export interface StageEventPayload {
    id: string;
    name: string;
    message: string;
    stage?: InstallationStage;
}