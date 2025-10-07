export interface MrpackManifest {
  formatVersion: number;
  game: string;
  versionId: string;
  name: string;
  summary?: string;
  files: MrpackFile[];
  dependencies: MrpackDependencies;
}

export interface MrpackFile {
  path: string;
  hashes: MrpackHashes;
  env?: MrpackEnv;
  downloads: string[];
  fileSize: number;
}

export interface MrpackHashes {
  sha1: string;
  sha512: string;
}

export interface MrpackEnv {
  client?: string;
  server?: string;
}

export interface MrpackDependencies {
  minecraft: string;
  forge?: string;
  'fabric-loader'?: string;
  'quilt-loader'?: string;
  neoforge?: string;
}

export interface MrpackCompatibility {
  is_compatible: boolean;
  warnings: string[];
  errors: string[];
  loader: string;
  minecraft_version: string;
}
