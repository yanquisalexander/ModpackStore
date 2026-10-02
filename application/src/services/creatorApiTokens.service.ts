import { API_ENDPOINT } from "@/consts";

export interface CreatorApiToken {
    id: string;
    name: string;
    prefix: string;
    scopes: string[];
    modpackIds: string[] | null;
    expiresAt: string | null;
    lastUsedAt: string | null;
    revokedAt: string | null;
    createdBy: string;
    createdAt: string;
}

export interface CreatedCreatorApiToken extends CreatorApiToken {
    /** Full secret (`mps_...`). Returned exactly once on creation — never again. */
    token: string;
}

export interface CreateTokenInput {
    name: string;
    scopes: string[];
    expiresAt?: string | null;
    modpackIds?: string[] | null;
}

function authHeaders(token: string): HeadersInit {
    return {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
    };
}

async function throwOnError(res: Response, fallback: string): Promise<never> {
    let detail = fallback;
    try {
        const body = await res.json();
        detail = body.errors?.[0]?.detail || body.message || fallback;
    } catch {
        detail = res.statusText || fallback;
    }
    throw new Error(detail);
}

export async function listCreatorApiTokens(
    token: string,
    creatorId: string,
): Promise<CreatorApiToken[]> {
    const res = await fetch(`${API_ENDPOINT}/creators/${creatorId}/api-tokens`, {
        headers: authHeaders(token),
    });
    if (!res.ok) await throwOnError(res, "Error al listar los tokens");
    const data = await res.json();
    return data.data;
}

export async function createCreatorApiToken(
    token: string,
    creatorId: string,
    input: CreateTokenInput,
): Promise<CreatedCreatorApiToken> {
    const res = await fetch(`${API_ENDPOINT}/creators/${creatorId}/api-tokens`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify(input),
    });
    if (!res.ok) await throwOnError(res, "Error al crear el token");
    const data = await res.json();
    return data.data;
}

export async function revokeCreatorApiToken(
    token: string,
    creatorId: string,
    tokenId: string,
): Promise<void> {
    const res = await fetch(`${API_ENDPOINT}/creators/${creatorId}/api-tokens/${tokenId}`, {
        method: "DELETE",
        headers: authHeaders(token),
    });
    if (!res.ok) await throwOnError(res, "Error al revocar el token");
}

export interface CreatorModpackOption {
    id: string;
    name: string;
}

export async function listCreatorModpacksForTokens(
    token: string,
    creatorId: string,
): Promise<CreatorModpackOption[]> {
    const res = await fetch(`${API_ENDPOINT}/creators/${creatorId}/modpacks`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) await throwOnError(res, "Error al listar los modpacks");
    const data = await res.json();
    const modpacks = Array.isArray(data) ? data : (data.modpacks || []);
    return modpacks.map((m: { id: string; name: string }) => ({ id: m.id, name: m.name }));
}
