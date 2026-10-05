// Whitelist Types

export interface WhitelistUser {
    id: string;
    username: string;
    discordId?: string;
    avatarUrl?: string;
    notes?: string | null;
}

export interface WhitelistEntry {
    id: string;
    modpackId: string;
    userId: string;
    addedByUserId: string;
    notes?: string;
    createdAt: Date;
    user?: WhitelistUser;
}

export interface WhitelistStats {
    totalWhitelisted: number;
    maxAllowed: number;
    remainingSlots: number;
}

export interface AddToWhitelistData {
    userId?: string;
    discordUsername?: string;
    notes?: string;
}

export interface BulkAddToWhitelistData {
    userIds?: string[];
    usernames?: string[];
    notes?: string;
}

export type BulkWhitelistItemStatus = 'added' | 'already' | 'not_found' | 'error';

export interface BulkWhitelistItemResult {
    userId: string | null;
    username: string | null;
    status: BulkWhitelistItemStatus;
}

export interface BulkWhitelistResult {
    added: number;
    failed: number;
    errors: string[];
    results: BulkWhitelistItemResult[];
}

/** Forma real del backend: array plano de filas (GET /:modpackId/export → `{ data: rows }`). */
export interface WhitelistExportRow {
    userId: string;
    username: string;
    discordId: string | null;
    addedAt: string;
    addedByUsername: string | null;
}

export type WhitelistExportData = WhitelistExportRow[];

export interface WhitelistAccessCheck {
    hasAccess: boolean;
    modpackId: string;
    userId: string;
}

export interface UserWhitelistInfo {
    hasWhitelists: boolean;
    count: number;
}

export interface WhitelistedModpack {
    id: string;
    name: string;
    slug: string;
    shortDescription?: string;
    iconUrl?: string;
    bannerUrl?: string;
    creator: {
        id: string;
        name: string;
        slug?: string;
        verified?: boolean;
        partner?: boolean;
        logoUrl?: string;
    };
    latestVersion?: string | null;
}
