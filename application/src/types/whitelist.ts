// Whitelist Types

export interface WhitelistUser {
    id: string;
    username: string;
    discordId?: string;
    avatarUrl?: string;
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
    userIds: string[];
    notes?: string;
}

export interface WhitelistExportData {
    modpackId: string;
    modpackName: string;
    totalUsers: number;
    exportedAt: Date;
    users: Array<{
        userId: string;
        username: string;
        discordId?: string;
        addedAt: Date;
        addedBy: string;
        notes?: string;
    }>;
}

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
        logoUrl?: string;
    };
    latestVersion?: string | null;
}
