import { API_ENDPOINT } from "@/consts";

export interface CreatorAuditActor {
    id: string;
    username: string;
    avatarUrl: string | null;
}

export interface CreatorAuditLog {
    id: string;
    creatorId: string;
    actorUserId: string | null;
    actorTokenId: string | null;
    action: string;
    entityType: string | null;
    entityId: string | null;
    details: Record<string, unknown> | null;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
    actor: CreatorAuditActor | null;
}

export interface PaginatedCreatorAuditLogs {
    logs: CreatorAuditLog[];
    total: number;
    page: number;
    totalPages: number;
}

export interface CreatorAuditFilters {
    page?: number;
    limit?: number;
    action?: string;
    actorUserId?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
}

function authHeaders(token: string): HeadersInit {
    return {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
    };
}

export async function listCreatorAuditLogs(
    token: string,
    creatorId: string,
    filters: CreatorAuditFilters = {},
): Promise<PaginatedCreatorAuditLogs> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== "") params.set(key, String(value));
    }
    const res = await fetch(`${API_ENDPOINT}/creators/${creatorId}/audit-logs?${params}`, {
        headers: authHeaders(token),
    });
    if (!res.ok) throw new Error("Error al cargar el registro de auditoría");
    return res.json();
}

export async function listCreatorAuditActions(
    token: string,
    creatorId: string,
): Promise<string[]> {
    const res = await fetch(`${API_ENDPOINT}/creators/${creatorId}/audit-logs/actions`, {
        headers: authHeaders(token),
    });
    if (!res.ok) throw new Error("Error al cargar las acciones de auditoría");
    const data = await res.json();
    return data.data as string[];
}
