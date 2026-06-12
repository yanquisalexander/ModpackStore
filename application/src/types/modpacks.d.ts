export interface Modpack {
  prelaunchAppearance: string;
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'published' | 'archived' | 'deleted';
  iconUrl?: string;
  bannerUrl?: string;
  shortDescription?: string;
  description?: string;
  visibility: 'public' | 'private' | 'patreon';
  creatorId: string;
  creatorUserId?: string;
  updatedAt: string;
  createdAt: string;
  organizationId?: string;
  categories?: ModpackCategory[];
  isPaid?: boolean;
  price?: string;
  acquisitionMethod?: 'free' | 'paid' | 'password';
  password?: string;
  requiresTwitchSubscription?: boolean;
  twitchChannels?: TwitchChannel[];
  twitchCreatorIds?: string[];
  allowServerDownload?: boolean;
}

export interface ModpackCategory {
  id: number;
  modpackId: string;
  categoryId: string;
  isPrimary: boolean;
  category: {
    id: string;
    name: string;
    shortDescription?: string;
    description?: string;
    iconUrl?: string;
    displayOrder: number;
    isAdminOnly: boolean;
    isSelectable: boolean;
    isAutomatic: boolean;
    createdAt: string;
  };
}

export interface NewModpackData {
  name: string;
  slug: string;
  publisherId: string;
  shortDescription?: string;
  description?: string;
  iconUrl: string;
  bannerUrl: string;
  visibility: 'public' | 'private' | 'patreon';
  trailerUrl?: string; // Optional based on backend schema
  password?: string; // Optional
  showUserAsPublisher?: boolean; // Optional
  // status and creatorUserId are set by backend
}

// Enum for ModpackVisibility to match backend if possible, or use string literals as above
export enum ModpackVisibilityEnum {
  PUBLIC = 'public',
  PRIVATE = 'private',
  PATREON = 'patreon',
}

export interface ModpackVersion {
  id: string;
  modpackId: string;
  version: string;
  mcVersion: string;
  forgeVersion?: string | null; // Deprecated, kept for backward compatibility
  loaderType?: 'vanilla' | 'forge' | 'fabric' | 'neoforge' | 'quilt';
  loaderVersion?: string | null;
  changelog: string;
  status: 'draft' | 'published' | 'archived'; // Or an enum
  releaseDate?: string | null; // Or Date
  createdAt: string; // Or Date
  updatedAt: string; // Or Date
  createdBy: string;
}

export interface NewModpackVersionData {
  version: string;
  mcVersion: string;
  forgeVersion?: string | null; // Deprecated, kept for backward compatibility
  loaderType?: 'vanilla' | 'forge' | 'fabric' | 'neoforge' | 'quilt';
  loaderVersion?: string | null;
  changelog: string;
  // modpackId and createdBy will be handled by the service/route
}

export interface TwitchChannel {
  id: string;
  username: string;
  displayName: string;
}
