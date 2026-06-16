import { Hono } from "@hono/hono";
import type { Context } from "@hono/hono";
import { requireAuth, optionalAuth, type AuthVariables } from "@/auth/middleware.ts";
import { getFileKey } from "@/lib/r2.ts";
import { eq } from "drizzle-orm";
import { db } from "@/db/client.ts";
import { modpacksTable } from "@/db/schema.ts";
import {
    getModpack,
    getPrelaunchAppearance,
    getPublishedVersions,
    getVersion,
    getLatestPublishedVersion,
    getVersionFiles,
    getModpackBasicInfo,
    getExploreHomepage,
    getModpackPassword,
    searchModpacks,
} from "./explore.service.ts";
import { searchTwitchChannels } from "./twitch.service.ts";
import { NotFoundError, ForbiddenError, APIError } from "@/lib/errors/index.ts";
import { log } from "@/lib/logger.ts";
import { checkAccess } from "@/services/acquisition.service.ts";

const app = new Hono<{ Variables: AuthVariables }>();

// ── Homepage ───────────────────────────────────────

app.get("/", optionalAuth, async (c) => {
    try {
        const result = await getExploreHomepage();
        return c.json({ data: result });
    } catch (error) {
        log("[EXPLORE] Failed to fetch homepage:", error);
        return c.json({ errors: [{ status: "500", title: "Internal Server Error", detail: "Failed to fetch homepage." }] }, 500);
    }
});

// ── Search ─────────────────────────────────────────

app.get("/search", async (c) => {
    const query = c.req.query("q");
    if (!query || query.length < 1) {
        return c.json({ data: [] });
    }

    try {
        const results = await searchModpacks(query);
        return c.json({
            data: results.map((m) => ({
                id: m.id,
                type: "modpack",
                attributes: m,
            })),
        });
    } catch (error) {
        log("[EXPLORE] Error searching modpacks:", error);
        return c.json({ errors: [{ status: "500", title: "Internal Server Error", detail: "Search failed." }] }, 500);
    }
});

// ── Modpack public info ────────────────────────────

app.get("/modpacks/:modpackId", optionalAuth, async (c) => {
    const modpackId = c.req.param("modpackId")!;
    const userId = c.get("userId");

    try {
        const modpack = await getModpack(modpackId, userId);
        if (!modpack) {
            return c.json({ errors: [{ status: "404", title: "Not Found", detail: "Modpack not found." }] }, 404);
        }

        return c.json({ data: modpack }, 200);
    } catch (error) {
        log("[EXPLORE] Error in getModpack:", error);
        return c.json({ errors: [{ status: "500", title: "Internal Server Error", detail: "Failed to fetch modpack." }] }, 500);
    }
});

// ── Prelaunch appearance ───────────────────────────

app.get("/modpacks/:modpackId/prelaunch-appearance", async (c) => {
    const modpackId = c.req.param("modpackId")!;

    try {
        const appearance = await getPrelaunchAppearance(modpackId);
        return c.json({
            data: {
                type: "prelaunch-appearance",
                id: modpackId,
                attributes: appearance,
            },
        }, 200);
    } catch (error) {
        log("[EXPLORE] Error in getPrelaunchAppearance:", error);
        return c.json({ errors: [{ status: "500", title: "Internal Server Error", detail: "Failed to fetch prelaunch appearance." }] }, 500);
    }
});

// ── Version list ───────────────────────────────────

app.get("/modpacks/:modpackId/versions", async (c) => {
    const modpackId = c.req.param("modpackId")!;

    try {
        const versions = await getPublishedVersions(modpackId);
        return c.json({ data: versions }, 200);
    } catch (error) {
        log("[EXPLORE] Error in getModpackVersions:", error);
        return c.json({ errors: [{ status: "500", title: "Internal Server Error", detail: "Failed to fetch versions." }] }, 500);
    }
});

// ── Latest version ─────────────────────────────────

app.get("/modpacks/:modpackId/latest", requireAuth, async (c) => {
    const modpackId = c.req.param("modpackId")!;

    try {
        const [modpackData] = await db.select({
            acquisitionMethod: modpacksTable.acquisitionMethod,
        })
            .from(modpacksTable)
            .where(eq(modpacksTable.id, modpackId))
            .limit(1);

        if (modpackData && modpackData.acquisitionMethod !== "free") {
            const { hasAccess } = await checkAccess(c.get("userId"), modpackId);
            if (!hasAccess) {
                throw new ForbiddenError("You need to acquire this modpack first.", "ACCESS_DENIED");
            }
        } else if (modpackData && modpackData.acquisitionMethod === "free") {
            // Free modpacks also require acquisition (add to library)
            const { hasAccess } = await checkAccess(c.get("userId"), modpackId);
            if (!hasAccess) {
                throw new ForbiddenError("Add this modpack to your library first.", "NOT_ACQUIRED");
            }
        }

        const latestVersion = await getLatestPublishedVersion(modpackId);
        const modpack = await getModpackBasicInfo(modpackId);

        return c.json({
            version: {
                id: latestVersion.id,
                version: latestVersion.version,
                mcVersion: latestVersion.mcVersion,
                loaderType: latestVersion.loaderType,
                loaderVersion: latestVersion.loaderVersion,
                releaseDate: latestVersion.releaseDate,
                changelog: latestVersion.changelog,
                modpack: modpack ? { id: modpack.id, name: modpack.name } : null,
            },
        }, 200);
    } catch (error) {
        if (error instanceof NotFoundError) {
            return c.json({ errors: [{ status: "404", title: "Not Found", detail: error.message }] }, 404);
        }
        if (error instanceof ForbiddenError) {
            return c.json({ errors: [{ status: "403", title: "Forbidden", detail: error.message }] }, 403);
        }
        log("[EXPLORE] Error in getLatestVersion:", error);
        return c.json({ errors: [{ status: "500", title: "Internal Server Error", detail: "Failed to fetch latest version." }] }, 500);
    }
});

// ── Manifest (version detail with files) ───────────

app.get("/modpacks/:modpackId/versions/:versionId", requireAuth, async (c) => {
    const modpackId = c.req.param("modpackId")!;
    const versionParam = c.req.param("versionId")!;
    const target = (c.req.query("target") || "both") as "client" | "server" | "both";

    try {
        // Resolve "latest" to actual version ID
        let versionId = versionParam;
        if (versionParam.toLowerCase() === "latest") {
            const latest = await getLatestPublishedVersion(modpackId);
            versionId = latest.id;
        }

        const version = await getVersion(versionId, modpackId);
        const files = await getVersionFiles(versionId, target);

        // Validate access — all modpacks require acquisition
        const { hasAccess } = await checkAccess(c.get("userId"), modpackId);
        if (!hasAccess) {
            throw new ForbiddenError("You need to acquire this modpack first.", "ACCESS_DENIED");
        }

        // Build manifest
        const manifest = {
            id: version.id,
            changelog: version.changelog,
            mcVersion: version.mcVersion,
            loaderType: version.loaderType,
            loaderVersion: version.loaderVersion,
            releaseDate: version.releaseDate,
            status: version.status,
            version: version.version,
            files: files.map((f) => ({
                path: f.fileType ? `${f.fileType}/${f.path}` : f.path,
                fileHash: f.fileHash,
                fileType: f.fileType,
                downloadUrl: `/${getFileKey(f.fileHash)}`,
                side: f.side || "both",
                file: {
                    size: Number(f.size),
                    type: f.mimeType ?? "application/octet-stream",
                },
            })),
        };

        // Deterministic ETag based on versionId + target (immutable since published versions don't change)
        const etag = `"${versionId}/${target}"`;

        // Check If-None-Match
        const ifNoneMatch = c.req.header("If-None-Match");
        if (ifNoneMatch && ifNoneMatch === etag) {
            return new Response(null, {
                status: 304,
                headers: {
                    "ETag": etag,
                    "Cache-Control": "public, max-age=31536000, immutable",
                },
            });
        }

        return c.json({ manifest }, 200, {
            "ETag": etag,
            "Cache-Control": "public, max-age=31536000, immutable",
        });
    } catch (error) {
        if (error instanceof NotFoundError) {
            return c.json({ errors: [{ status: "404", title: "Not Found", detail: error.message }] }, 404);
        }
        if (error instanceof ForbiddenError) {
            return c.json({ errors: [{ status: "403", title: "Forbidden", detail: error.message }] }, 403);
        }
        log("[EXPLORE] Error in getManifest:", error);
        return c.json({ errors: [{ status: "500", title: "Internal Server Error", detail: "Failed to fetch manifest." }] }, 500);
    }
});

// ── Check update ───────────────────────────────────

app.get("/modpacks/:modpackId/check-update", optionalAuth, async (c) => {
    const modpackId = c.req.param("modpackId")!;
    const currentVersion = c.req.query("currentVersion");

    if (!currentVersion) {
        return c.json({ errors: [{ status: "400", title: "Bad Request", detail: "Missing currentVersion query parameter." }] }, 400);
    }

    try {
        const [modpackData] = await db.select({
            acquisitionMethod: modpacksTable.acquisitionMethod,
        })
            .from(modpacksTable)
            .where(eq(modpacksTable.id, modpackId))
            .limit(1);

        // Non-free modpacks require auth + access check for updates
        if (modpackData && modpackData.acquisitionMethod !== "free") {
            const userId = c.get("userId");
            if (!userId) {
                throw new ForbiddenError("Authentication required", "AUTH_REQUIRED");
            }
            const { hasAccess } = await checkAccess(userId, modpackId);
            if (!hasAccess) {
                throw new ForbiddenError("You need to acquire this modpack first.", "ACCESS_DENIED");
            }
        }

        const latestVersion = await getLatestPublishedVersion(modpackId);
        const modpack = await getModpackBasicInfo(modpackId);

        const hasUpdate = latestVersion.version !== currentVersion;

        return c.json({
            hasUpdate,
            currentVersion,
            latestVersion: {
                id: latestVersion.id,
                version: latestVersion.version,
                mcVersion: latestVersion.mcVersion,
                loaderType: latestVersion.loaderType,
                loaderVersion: latestVersion.loaderVersion,
                releaseDate: latestVersion.releaseDate,
                changelog: latestVersion.changelog,
            },
            modpack: modpack ? { id: modpack.id, name: modpack.name } : null,
        }, 200);
    } catch (error) {
        if (error instanceof NotFoundError) {
            return c.json({ errors: [{ status: "404", title: "Not Found", detail: error.message }] }, 404);
        }
        if (error instanceof ForbiddenError) {
            return c.json({ errors: [{ status: "403", title: "Forbidden", detail: error.message }] }, 403);
        }
        log("[EXPLORE] Error in checkUpdate:", error);
        return c.json({ errors: [{ status: "500", title: "Internal Server Error", detail: "Failed to check for updates." }] }, 500);
    }
});

// ── Twitch channel search ─────────────────────────

app.get("/twitch-channels/search", async (c) => {
    const query = c.req.query("query");
    if (!query || query.length < 2) {
        return c.json({ channels: [] });
    }

    try {
        const channels = await searchTwitchChannels(query);
        return c.json({ channels });
    } catch (error) {
        log("[EXPLORE] Error searching Twitch channels:", error);
        return c.json({ errors: [{ status: "500", title: "Internal Server Error", detail: "Failed to search Twitch channels." }] }, 500);
    }
});

// ── Validate password ──────────────────────────────

app.post("/modpacks/:modpackId/validate-password", requireAuth, async (c) => {
    const modpackId = c.req.param("modpackId")!;
    const { password } = await c.req.json();

    if (!password) {
        return c.json({ errors: [{ status: "400", title: "Bad Request", detail: "Password is required." }] }, 400);
    }

    try {
        const modpack = await getModpack(modpackId);

        if (!modpack) {
            return c.json({ errors: [{ status: "404", title: "Not Found", detail: "Modpack not found." }] }, 404);
        }

        const hashedPassword = await getModpackPassword(modpackId);
        const { default: bcrypt } = await import("npm:bcryptjs");
        const valid = hashedPassword ? await bcrypt.compare(password, hashedPassword) : false;

        return c.json({
            valid,
            message: valid ? "Password is correct." : "Incorrect password.",
        }, 200);
    } catch (error) {
        log("[EXPLORE] Error in validatePassword:", error);
        return c.json({ errors: [{ status: "500", title: "Internal Server Error", detail: "Failed to validate password." }] }, 500);
    }
});

export default app;
