import { API_ENDPOINT } from "../consts";

export interface PatreonTierData {
    id: string;
    name: string;
    description: string | null;
    amountCents: number;
    active: boolean;
    metadata: Record<string, boolean | number | string> | null;
    lastSyncAt: Date | null;
    memberCount: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface PatreonMemberData {
    id: string;
    username: string;
    email: string;
    avatarUrl: string | null;
    patreonStatus: string | null;
    patreonEntitledAmount: number | null;
    patreonLastVerified: Date | null;
    tier?: {
        id: string;
        name: string;
        amountCents: number;
    } | null;
}

export interface PatreonStatistics {
    totalTiers: number;
    totalMembers: number;
    totalRevenueCents: number;
    totalRevenueUSD: string;
    lastSync: Date | null;
}

export interface SyncResult {
    tiers: {
        tiersAdded: number;
        tiersUpdated: number;
        tiersDeactivated: number;
    };
    members: {
        membersUpdated: number;
        membersCleared: number;
    };
}

export class PatreonPlusService {
    private static getAuthHeaders(token: string) {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    /**
     * Get all Patreon tiers with member counts
     */
    static async getTiers(token: string): Promise<PatreonTierData[]> {
        const response = await fetch(`${API_ENDPOINT}/admin/patreon-plus/tiers`, {
            method: 'GET',
            headers: this.getAuthHeaders(token)
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Failed to fetch tiers');
        return data.data;
    }

    /**
     * Get members for a specific tier
     */
    static async getTierMembers(token: string, tierId: string): Promise<PatreonMemberData[]> {
        const response = await fetch(`${API_ENDPOINT}/admin/patreon-plus/tiers/${tierId}/members`, {
            method: 'GET',
            headers: this.getAuthHeaders(token)
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Failed to fetch tier members');
        return data.data;
    }

    /**
     * Update tier metadata (benefits)
     */
    static async updateTierMetadata(
        token: string,
        tierId: string,
        metadata: Record<string, boolean | number | string>
    ): Promise<PatreonTierData> {
        const response = await fetch(`${API_ENDPOINT}/admin/patreon-plus/tiers/${tierId}/metadata`, {
            method: 'PATCH',
            headers: this.getAuthHeaders(token),
            body: JSON.stringify({ metadata })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to update metadata');
        }

        return data.data;
    }

    /**
     * Get all active Patreon members
     */
    static async getAllMembers(token: string): Promise<PatreonMemberData[]> {
        const response = await fetch(`${API_ENDPOINT}/admin/patreon-plus/members`, {
            method: 'GET',
            headers: this.getAuthHeaders(token)
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Failed to fetch members');
        return data.data;
    }

    /**
     * Trigger manual synchronization
     */
    static async triggerSync(token: string): Promise<SyncResult> {
        const response = await fetch(`${API_ENDPOINT}/admin/patreon-plus/sync`, {
            method: 'POST',
            headers: this.getAuthHeaders(token)
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Failed to trigger sync');
        return data.data;
    }

    /**
     * Get last sync timestamp
     */
    static async getLastSync(token: string): Promise<Date | null> {
        const response = await fetch(`${API_ENDPOINT}/admin/patreon-plus/last-sync`, {
            method: 'GET',
            headers: this.getAuthHeaders(token)
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Failed to fetch last sync');
        return data.data.lastSync;
    }

    /**
     * Get Patreon Plus statistics
     */
    static async getStatistics(token: string): Promise<PatreonStatistics> {
        const response = await fetch(`${API_ENDPOINT}/admin/patreon-plus/statistics`, {
            method: 'GET',
            headers: this.getAuthHeaders(token)
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Failed to fetch statistics');
        return data.data;
    }
}
