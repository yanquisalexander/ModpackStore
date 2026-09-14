import { API_ENDPOINT } from "@/consts";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import type { UserTextures, SkinModel } from "@/types/skins";

interface TexturesResponse {
    data: UserTextures;
}

interface SkinResponse {
    data: UserTextures["skins"][0] & { url: string };
}

interface CapeResponse {
    data: UserTextures["capes"][0] & { url: string };
}

export async function getUserTextures(): Promise<UserTextures> {
    const response = await fetchWithAuth(`${API_ENDPOINT}/skins/me/textures`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch textures: ${response.statusText}`);
    }

    const result: TexturesResponse = await response.json();
    return result.data;
}

export async function uploadSkin(
    file: File,
    model: SkinModel = 'classic',
    name?: string,
): Promise<SkinResponse["data"]> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', model);
    if (name) formData.append('name', name);

    const response = await fetchWithAuth(`${API_ENDPOINT}/skins/me/skin`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ errors: [] }));
        const detail = error.errors?.[0]?.detail || response.statusText;
        throw new Error(detail);
    }

    const result: SkinResponse = await response.json();
    return result.data;
}

export async function uploadCape(
    file: File,
    name?: string,
): Promise<CapeResponse["data"]> {
    const formData = new FormData();
    formData.append('file', file);
    if (name) formData.append('name', name);

    const response = await fetchWithAuth(`${API_ENDPOINT}/skins/me/cape`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ errors: [] }));
        const detail = error.errors?.[0]?.detail || response.statusText;
        throw new Error(detail);
    }

    const result: CapeResponse = await response.json();
    return result.data;
}

export async function activateSkin(skinId: string): Promise<void> {
    const response = await fetchWithAuth(`${API_ENDPOINT}/skins/me/skin/${skinId}/activate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
        throw new Error(`Failed to activate skin: ${response.statusText}`);
    }
}

export async function activateCape(capeId: string): Promise<void> {
    const response = await fetchWithAuth(`${API_ENDPOINT}/skins/me/cape/${capeId}/activate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
        throw new Error(`Failed to activate cape: ${response.statusText}`);
    }
}

export async function deactivateSkin(): Promise<void> {
    const response = await fetchWithAuth(`${API_ENDPOINT}/skins/me/skin`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error(`Failed to deactivate skin: ${response.statusText}`);
    }
}

export async function deactivateCape(): Promise<void> {
    const response = await fetchWithAuth(`${API_ENDPOINT}/skins/me/cape`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error(`Failed to deactivate cape: ${response.statusText}`);
    }
}

export async function deleteSkin(skinId: string): Promise<void> {
    const response = await fetchWithAuth(`${API_ENDPOINT}/skins/me/skin/${skinId}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error(`Failed to delete skin: ${response.statusText}`);
    }
}

export async function deleteCape(capeId: string): Promise<void> {
    const response = await fetchWithAuth(`${API_ENDPOINT}/skins/me/cape/${capeId}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error(`Failed to delete cape: ${response.statusText}`);
    }
}
