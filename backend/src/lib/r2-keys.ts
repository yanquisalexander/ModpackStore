/**
 * r2-keys: helpers puros (strings) sin `aws-sdk`.
 * Este módulo es ligero y seguro para el hot path serverless.
 * Todo lo que necesite S3Client vive en `r2.ts` (lazy).
 */

function getPublicDomain(): string {
    return Deno.env.get("R2_PUBLIC_DOMAIN") ?? "";
}

export function getTempZipKey(modpackId: string, versionId: string, fileType: string): string {
    return `temp-zips/${modpackId}/${versionId}/${fileType}`;
}

export function getFileKey(hash: string): string {
    return `resources/files/${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}`;
}

export function getPublicUrl(hash: string): string {
    const publicDomain = getPublicDomain();
    if (publicDomain) {
        return `${publicDomain}/${getFileKey(hash)}`;
    }
    return getFileKey(hash);
}

export function getModpackImageKey(modpackId: string, type: 'icon' | 'banner'): string {
    return `modpack-images/${modpackId}/${type}`;
}

export function getModpackImageUrl(modpackId: string, type: 'icon' | 'banner'): string {
    const key = getModpackImageKey(modpackId, type);
    const ts = Date.now();
    const publicDomain = getPublicDomain();
    return publicDomain ? `${publicDomain}/${key}?t=${ts}` : `${key}?t=${ts}`;
}

export function getModpackImageResizedKey(modpackId: string, type: 'icon' | 'banner'): string {
    return `modpack-images/${modpackId}/${type}_resized`;
}

export function getModpackImageResizedUrl(modpackId: string, type: 'icon' | 'banner'): string {
    const key = getModpackImageResizedKey(modpackId, type);
    const ts = Date.now();
    const publicDomain = getPublicDomain();
    return publicDomain ? `${publicDomain}/${key}?t=${ts}` : `${key}?t=${ts}`;
}

export function getCreatorImageKey(creatorId: string, type: 'logo' | 'banner'): string {
    return `creator-images/${creatorId}/${type}`;
}

export function getCreatorImageUrl(creatorId: string, type: 'logo' | 'banner'): string {
    const key = getCreatorImageKey(creatorId, type);
    const ts = Date.now();
    const publicDomain = getPublicDomain();
    return publicDomain ? `${publicDomain}/${key}?t=${ts}` : `${key}?t=${ts}`;
}

export function getCreatorAssetKey(creatorId: string, fileName: string): string {
    return `creator-assets/${creatorId}/${fileName}`;
}

export function getCreatorAssetUrl(r2Key: string): string {
    const ts = Date.now();
    const publicDomain = getPublicDomain();
    return publicDomain ? `${publicDomain}/${r2Key}?t=${ts}` : `${r2Key}?t=${ts}`;
}

export function getUserSkinKey(userId: string, hash: string): string {
    return `user-skins/${userId}/${hash}.png`;
}

export function getUserSkinUrl(userId: string, hash: string): string {
    const key = getUserSkinKey(userId, hash);
    const publicDomain = getPublicDomain();
    return publicDomain ? `${publicDomain}/${key}` : key;
}

export function getUserCapeKey(userId: string, hash: string): string {
    return `user-capes/${userId}/${hash}.png`;
}

export function getUserCapeUrl(userId: string, hash: string): string {
    const key = getUserCapeKey(userId, hash);
    const publicDomain = getPublicDomain();
    return publicDomain ? `${publicDomain}/${key}` : key;
}
