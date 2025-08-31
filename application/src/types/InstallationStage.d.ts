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

export interface StageDownloadingForgeLibraries {
    type: "DownloadingForgeLibraries";
    current: number;
    total: number;
}

export interface StageValidatingAssets {
    type: "ValidatingAssets";
    current: number;
    total: number;
}

export type InstallationStage = 
    | StageDownloadingFiles 
    | StageExtractingLibraries 
    | StageInstallingForge 
    | StageDownloadingForgeLibraries
    | StageValidatingAssets;

// Event payload type that includes stage information
export interface StageEventPayload {
    id: string;
    name: string;
    message: string;
    stage?: InstallationStage;
}