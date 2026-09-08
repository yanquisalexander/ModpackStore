import { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { API_ENDPOINT } from "@/consts";

interface CreatorAsset {
    id: string;
    creatorId: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    url: string;
}

let cachedAssets: CreatorAsset[] | null = null;
let cacheCreatorId: string | null = null;

async function fetchAssets(creatorId: string, token: string): Promise<CreatorAsset[]> {
    if (cachedAssets && cacheCreatorId === creatorId) {
        return cachedAssets;
    }

    try {
        const response = await fetch(`${API_ENDPOINT}/creators/${creatorId}/assets`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) return [];

        const data = await response.json();
        cachedAssets = data.data || [];
        cacheCreatorId = creatorId;
        return cachedAssets;
    } catch {
        return [];
    }
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getContentTypeLabel(contentType: string): string {
    if (contentType.startsWith('image/')) return 'Imagen';
    if (contentType.startsWith('audio/')) return 'Audio';
    if (contentType.startsWith('video/')) return 'Video';
    return 'Archivo';
}

function createAssetPreviewElement(asset: CreatorAsset): HTMLElement {
    const container = document.createElement('div');
    container.className = 'cm-asset-preview';
    container.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 12px;
        min-width: 280px;
        max-width: 360px;
    `;

    // Preview thumbnail
    const preview = document.createElement('div');
    preview.style.cssText = `
        width: 48px;
        height: 48px;
        border-radius: 6px;
        overflow: hidden;
        flex-shrink: 0;
        background: #27272a;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    if (asset.contentType.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = asset.url;
        img.alt = asset.fileName;
        img.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: cover;
        `;
        img.onerror = () => {
            img.remove();
            preview.innerHTML = `<span style="font-size: 20px;">🖼️</span>`;
        };
        preview.appendChild(img);
    } else if (asset.contentType.startsWith('audio/')) {
        preview.innerHTML = `<span style="font-size: 20px;">🎵</span>`;
    } else if (asset.contentType.startsWith('video/')) {
        preview.innerHTML = `<span style="font-size: 20px;">🎬</span>`;
    } else {
        preview.innerHTML = `<span style="font-size: 20px;">📁</span>`;
    }

    // Info section
    const info = document.createElement('div');
    info.style.cssText = `
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
    `;

    const name = document.createElement('div');
    name.textContent = asset.fileName;
    name.style.cssText = `
        font-size: 13px;
        font-weight: 500;
        color: #e4e4e7;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    `;

    const meta = document.createElement('div');
    meta.style.cssText = `
        font-size: 11px;
        color: #71717a;
        display: flex;
        gap: 8px;
    `;

    const typeLabel = document.createElement('span');
    typeLabel.textContent = getContentTypeLabel(asset.contentType);

    const sizeLabel = document.createElement('span');
    sizeLabel.textContent = formatFileSize(asset.sizeBytes);

    meta.appendChild(typeLabel);
    meta.appendChild(document.createTextNode('·'));
    meta.appendChild(sizeLabel);

    info.appendChild(name);
    info.appendChild(meta);

    container.appendChild(preview);
    container.appendChild(info);

    return container;
}

export function createAssetCompletionSource(creatorId: string, token: string) {
    return async (ctx: CompletionContext): Promise<CompletionResult | null> => {
        const word = ctx.matchBefore(/@\w*/);

        if (!word) return null;

        const assets = await fetchAssets(creatorId, token);

        if (assets.length === 0) return null;

        return {
            from: word.from,
            options: assets.map(asset => ({
                label: `@asset:${asset.fileName}`,
                apply: `@asset:${creatorId}/${asset.id}`,
                type: 'keyword',
                // Custom tooltip with preview
                info: () => createAssetPreviewElement(asset),
            })),
        };
    };
}

export function clearAssetCache(): void {
    cachedAssets = null;
    cacheCreatorId = null;
}

/**
 * Parse @asset:CREATOR_ID/ASSET_ID reference
 */
export function parseAssetReference(ref: string): { creatorId: string; assetId: string } | null {
    const match = ref.match(/@asset:([a-f0-9-]{36})\/([a-f0-9-]{36})/);
    if (!match) return null;
    return { creatorId: match[1], assetId: match[2] };
}

/**
 * Translate @asset:CREATOR_ID/ASSET_ID references to actual URLs in TOML content
 */
export async function resolveAssetReferences(
    content: string,
    token: string
): Promise<string> {
    // Find all unique creator IDs in the content
    const creatorIds = new Set<string>();
    const regex = /@asset:([a-f0-9-]{36})\/[a-f0-9-]{36}/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        creatorIds.add(match[1]);
    }

    // Fetch assets for each creator
    const assetMaps = new Map<string, Map<string, string>>();
    for (const cid of creatorIds) {
        const assets = await fetchAssets(cid, token);
        assetMaps.set(cid, new Map(assets.map(a => [a.id, a.url])));
    }

    // Replace references with URLs
    return content.replace(/@asset:([a-f0-9-]{36})\/([a-f0-9-]{36})/g, (match, creatorId, assetId) => {
        const assetMap = assetMaps.get(creatorId);
        return assetMap?.get(assetId) || match;
    });
}

/**
 * Translate asset URLs back to @asset:CREATOR_ID/ASSET_ID references for display
 */
export function convertUrlsToAssetReferences(
    content: string,
    assets: CreatorAsset[]
): string {
    let result = content;

    for (const asset of assets) {
        const escapedUrl = asset.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedUrl.replace(/\?t=\d+/, '\\?t=\\d+'), 'g');
        result = result.replace(regex, `@asset:${asset.creatorId}/${asset.id}`);
    }

    return result;
}
