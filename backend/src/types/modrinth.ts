// Modrinth manifest types for .mrpack import functionality
// Based on official spec: https://support.modrinth.com/en/articles/8802351-modrinth-modpack-format-mrpack

export interface ModrinthManifest {
    formatVersion: number;
    game: string;
    versionId: string;
    name: string;
    summary?: string;
    files: ModrinthFile[];
    dependencies: ModrinthDependencies;
}

export interface ModrinthFile {
    path: string;
    hashes: {
        sha1: string;
        sha512: string;
    };
    env?: {
        client?: 'required' | 'optional' | 'unsupported';
        server?: 'required' | 'optional' | 'unsupported';
    };
    downloads: string[];
    fileSize: number;
}

export interface ModrinthDependencies {
    minecraft: string;
    forge?: string;
    'fabric-loader'?: string;
    'quilt-loader'?: string;
    'neoforge'?: string;
}

export interface ModrinthImportResult {
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
