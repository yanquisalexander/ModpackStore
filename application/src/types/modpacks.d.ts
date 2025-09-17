export interface Modpack {
  prelaunchAppearance: string;
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'published' | 'archived' | 'deleted';
  iconUrl?: string;
  bannerUrl?: string;
  shortDescription?: string;
  description?: string; // Added from backend schema consideration
  visibility: 'public' | 'private' | 'patreon'; // Added from backend schema consideration
  publisherId: string;
  creatorUserId?: string; // Added from backend schema consideration
  updatedAt: string; // Or Date
  createdAt: string; // Or Date
  organizationId?: string; // ID de la organización a la que pertenece el modpack (opcional para UI contextual)
  categories?: ModpackCategory[]; // Added for category support
  // trailerUrl, password, showUserAsPublisher can be added if needed
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
  forgeVersion?: string | null;
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
  forgeVersion?: string | null;
  changelog: string;
  // modpackId and createdBy will be handled by the service/route
}
