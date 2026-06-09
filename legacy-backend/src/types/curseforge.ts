// CurseForge manifest types for import functionality

export interface CurseForgeManifest {
    minecraft: {
        version: string;
        modLoaders: Array<{
            id: string;
            primary: boolean;
        }>;
    };
    manifestType: string;
    manifestVersion: number;
    name: string;
    version: string;
    author: string;
    files: CurseForgeModFile[];
    overrides?: string;
}

export interface CurseForgeModFile {
    projectID: number;
    fileID: number;
    required: boolean;
}

export interface CurseForgeProjectInfo {
    id: number;
    name: string;
    slug: string;
    summary: string;
    downloadCount: number;
    categories: Array<{
        id: number;
        name: string;
        slug: string;
    }>;
}

export interface CurseForgeFileInfo {
    id: number;
    displayName: string;
    fileName: string;
    fileDate: string;
    fileLength: number;
    downloadCount: number;
    downloadUrl: string;
    gameVersions: string[];
    dependencies: Array<{
        modId: number;
        relationType: number;
    }>;
    hashes: Array<{
        algo: number;
        value: string;
    }>;
}

export interface CurseForgeImportResult {
    modpack: {
        id: string;
        name: string;
        version: string;
    };
    stats: {
        totalMods: number;
        downloadedMods: number;
        failedMods: number;
        overrideFiles: number;
    };
    errors: string[];
}