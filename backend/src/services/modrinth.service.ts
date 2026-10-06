/**
 * Modrinth proxy service.
 * Proxies api.modrinth.com/v2 and maps responses to the internal
 * explore shapes so the frontend can reuse the same routes with
 * `?provider=modrinth`.
 */

const MODRINTH_API = "https://api.modrinth.com/v2";
const USER_AGENT = "ModpackStore/1.0 (https://modpackstore.net)";

const FACET_MODPACK = encodeURIComponent('[["project_type:modpack"]]');

export interface ModrinthSearchHit {
    project_id: string;
    slug: string;
    title: string;
    description: string;
    author: string;
    categories: string[];
    display_categories?: string[];
    versions: string[];
    downloads: number;
    follows: number;
    icon_url?: string | null;
    gallery?: string[];
    featured_gallery?: string | null;
    color?: number | null;
}

export interface ModrinthProject {
    id: string;
    slug: string;
    title: string;
    description: string;
    body: string;
    categories: string[];
    additional_categories?: string[];
    game_versions: string[];
    loaders: string[];
    downloads: number;
    followers: number;
    icon_url?: string | null;
    gallery?: Array<{ url: string; featured: boolean; title?: string | null }>;
    color?: number | null;
    team?: string;
    organization?: string | null;
    source_url?: string | null;
    issues_url?: string | null;
    wiki_url?: string | null;
    discord_url?: string | null;
    published: string;
    updated: string;
}

export interface ModrinthVersionFile {
    hashes: { sha1: string; sha512: string };
    url: string;
    filename: string;
    primary: boolean;
    size: number;
    file_type?: string | null;
}

export interface ModrinthVersion {
    id: string;
    project_id: string;
    name: string;
    version_number: string;
    changelog?: string | null;
    date_published: string;
    downloads: number;
    version_type: string;
    status: string;
    game_versions: string[];
    loaders: string[];
    files: ModrinthVersionFile[];
}

async function modrinthFetch<T>(path: string): Promise<T> {
    const res = await fetch(`${MODRINTH_API}${path}`, {
        headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/json",
        },
    });
    if (!res.ok) {
        throw new Error(`Modrinth API error ${res.status} for ${path}`);
    }
    return (await res.json()) as T;
}

// ── Mapping ─────────────────────────────────────────────

function bannerFromHit(hit: ModrinthSearchHit): string | null {
    return hit.featured_gallery ?? hit.gallery?.[0] ?? hit.icon_url ?? null;
}

export function mapSearchHitToModpack(hit: ModrinthSearchHit) {
    return {
        id: hit.slug || hit.project_id,
        provider: "modrinth" as const,
        projectId: hit.project_id,
        name: hit.title,
        slug: hit.slug,
        shortDescription: hit.description,
        description: hit.description,
        iconUrl: hit.icon_url ?? null,
        bannerUrl: bannerFromHit(hit),
        downloads: hit.downloads,
        follows: hit.follows,
        author: hit.author,
        categories: hit.display_categories ?? hit.categories ?? [],
        mcVersions: hit.versions,
        color: hit.color ?? null,
        // Compat con shapes internas
        acquisitionMethod: "free",
        visibility: "public",
        status: "published",
        creator: {
            id: hit.slug,
            name: hit.author,
            slug: hit.author,
            verified: false,
            logoUrl: null,
        },
        externalUrl: `https://modrinth.com/modpack/${hit.slug}`,
    };
}

export function mapProjectToModpack(project: ModrinthProject) {
    const galleryUrls = (project.gallery ?? []).map((g) => g.url);
    const featured = project.gallery?.find((g) => g.featured)?.url ?? galleryUrls[0] ?? null;
    return {
        id: project.slug || project.id,
        provider: "modrinth" as const,
        projectId: project.id,
        name: project.title,
        slug: project.slug,
        shortDescription: project.description,
        description: project.body,
        iconUrl: project.icon_url ?? null,
        bannerUrl: featured,
        gallery: galleryUrls,
        downloads: project.downloads,
        follows: project.followers,
        gameVersions: project.game_versions,
        loaders: project.loaders,
        categories: [...(project.categories ?? []), ...((project.additional_categories ?? []) as string[])],
        sourceUrl: project.source_url ?? null,
        issuesUrl: project.issues_url ?? null,
        wikiUrl: project.wiki_url ?? null,
        discordUrl: project.discord_url ?? null,
        publishedAt: project.published,
        updatedAt: project.updated,
        acquisitionMethod: "free",
        visibility: "public",
        status: "published",
        trailerUrl: null,
        creator: {
            id: project.slug,
            name: project.organization ?? "Modrinth",
            slug: project.slug,
            verified: false,
            logoUrl: null,
        },
        externalUrl: `https://modrinth.com/modpack/${project.slug}`,
    };
}

function normalizeLoader(loader?: string): string {
    if (!loader) return "unknown";
    const l = loader.toLowerCase();
    if (["forge", "fabric", "neoforge", "quilt", "vanilla"].includes(l)) return l;
    if (l.includes("fabric")) return "fabric";
    if (l.includes("forge") && !l.includes("neo")) return "forge";
    if (l.includes("neoforge")) return "neoforge";
    if (l.includes("quilt")) return "quilt";
    return l;
}

export function mapVersionToPublic(projectSlug: string, v: ModrinthVersion) {
    const primary = v.files.find((f) => f.primary) ?? v.files[0];
    const mrpackFile = v.files.find((f) => f.filename.endsWith(".mrpack")) ?? primary;
    return {
        id: v.id,
        provider: "modrinth" as const,
        version: v.version_number,
        name: v.name,
        mcVersion: v.game_versions[0] ?? "unknown",
        gameVersions: v.game_versions,
        loaderType: normalizeLoader(v.loaders[0]),
        loaders: v.loaders,
        loaderVersion: null,
        changelog: v.changelog ?? "",
        releaseDate: v.date_published,
        status: "published" as const,
        downloads: v.downloads,
        versionType: v.version_type,
        mrpackUrl: mrpackFile?.url ?? null,
        mrpackFilename: mrpackFile?.filename ?? null,
        mrpackSize: mrpackFile?.size ?? null,
        files: v.files.map((f) => ({
            path: f.filename,
            downloadUrl: f.url,
            size: f.size,
            primary: f.primary,
            hashes: f.hashes,
            file: { type: "mod" },
        })),
        externalUrl: `https://modrinth.com/modpack/${projectSlug}/version/${v.version_number}`,
    };
}

// ── API ─────────────────────────────────────────────────

export async function searchModrinthModpacks(query: string, limit = 20, offset = 0) {
    const params = new URLSearchParams({
        query,
        facets: '[["project_type:modpack"]]',
        limit: String(limit),
        offset: String(offset),
        index: "relevance",
    });
    const data = await modrinthFetch<{ hits: ModrinthSearchHit[]; total_hits: number }>(
        `/search?${params.toString()}`,
    );
    return {
        hits: data.hits.map(mapSearchHitToModpack),
        total: data.total_hits,
    };
}

export async function getModrinthTrending(limit = 20) {
    const params = new URLSearchParams({
        query: "",
        facets: FACET_MODPACK,
        limit: String(limit),
        index: "trending",
    });
    // facets ya viene encoded; URLSearchParams lo re-encodea, así que construimos manual
    const data = await modrinthFetch<{ hits: ModrinthSearchHit[] }>(
        `/search?query=&facets=${FACET_MODPACK}&limit=${limit}&index=follows`,
    );
    void params;
    return data.hits.map(mapSearchHitToModpack);
}

export async function getModrinthPopular(limit = 20) {
    const data = await modrinthFetch<{ hits: ModrinthSearchHit[] }>(
        `/search?query=&facets=${FACET_MODPACK}&limit=${limit}&index=downloads`,
    );
    return data.hits.map(mapSearchHitToModpack);
}

export async function getModrinthRecent(limit = 20) {
    const data = await modrinthFetch<{ hits: ModrinthSearchHit[] }>(
        `/search?query=&facets=${FACET_MODPACK}&limit=${limit}&index=newest`,
    );
    return data.hits.map(mapSearchHitToModpack);
}

export async function getModrinthHomepage() {
    const [trending, popular, recent] = await Promise.all([
        getModrinthTrending(20).catch(() => []),
        getModrinthPopular(20).catch(() => []),
        getModrinthRecent(20).catch(() => []),
    ]);
    return {
        categories: [
            {
                id: "modrinth-trending",
                name: "Tendencias",
                shortDescription: "Modpacks en tendencia en Modrinth",
                displayOrder: 0,
                provider: "modrinth",
                modpacks: trending,
            },
            {
                id: "modrinth-popular",
                name: "Populares",
                shortDescription: "Los más descargados de Modrinth",
                displayOrder: 1,
                provider: "modrinth",
                modpacks: popular,
            },
            {
                id: "modrinth-recent",
                name: "Novedades",
                shortDescription: "Publicados recientemente",
                displayOrder: 2,
                provider: "modrinth",
                modpacks: recent,
            },
        ],
        featured: [],
    };
}

export async function getModrinthProject(idOrSlug: string) {
    const project = await modrinthFetch<ModrinthProject>(
        `/project/${encodeURIComponent(idOrSlug)}`,
    );
    return mapProjectToModpack(project);
}

export async function getModrinthVersions(idOrSlug: string, limit = 30) {
    const versions = await modrinthFetch<ModrinthVersion[]>(
        `/project/${encodeURIComponent(idOrSlug)}/version?limit=${limit}`,
    );
    const listed = versions.filter((v) => v.status === "listed" || v.status === "approved");
    const source = listed.length > 0 ? listed : versions;
    return source.map((v) => mapVersionToPublic(idOrSlug, v));
}

export async function getModrinthVersion(projectSlug: string, versionId: string) {
    // Intento directo por id de versión
    try {
        const v = await modrinthFetch<ModrinthVersion>(
            `/version/${encodeURIComponent(versionId)}`,
        );
        return mapVersionToPublic(projectSlug, v);
    } catch {
        // Fallback: buscar en el listado
        const all = await getModrinthVersions(projectSlug, 100);
        const found = all.find((x) => x.id === versionId || x.version === versionId);
        if (!found) throw new Error(`Modrinth version not found: ${versionId}`);
        return found;
    }
}
