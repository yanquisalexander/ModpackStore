import { db } from "@/db/client.ts";
import { gameSessionsTable, users, bansTable } from "@/db/schema.ts";
import { eq, and, or, lt, isNull } from "drizzle-orm";
import { APIError } from "@/lib/errors/index.ts";
import { verify } from "@hono/hono/jwt";
import { getActiveSkin, getActiveCape } from "@/services/skins.service.ts";
import { getProfileFromMojang } from "@/v1/mojang/mojang.service.ts";


const JWT_SECRET = Deno.env.get("JWT_SECRET")!;
const YGGDRASIL_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const INACTIVITY_TIMEOUT_MS = 6 * 60 * 60 * 1000;
const MIN_LAUNCHER_VERSION = "1.2.0";

export interface YggdrasilProfile {
    id: string; name: string;
    properties?: Array<{ name: string; value: string; signature?: string }>;
}
export interface YggdrasilAuthResponse {
    accessToken: string; clientToken: string;
    availableProfiles: YggdrasilProfile[]; selectedProfile: YggdrasilProfile;
    user?: { id: string; username: string };
}

export const yggdrasilService = {
    async authenticate(jwtToken: string, clientToken?: string, requestedUsername?: string, minecraftUuid?: string, launcherVersion?: string) {
        let decoded: any;
        try { decoded = await verify(jwtToken, JWT_SECRET, "HS256"); }
        catch { throw new APIError(403, "Invalid token.", "ForbiddenOperationException"); }
        if (!decoded?.sub) throw new APIError(403, "Invalid token.", "ForbiddenOperationException");

        const [user] = await db.select().from(users).where(eq(users.id, decoded.sub)).limit(1);
        if (!user) throw new APIError(403, "Invalid token.", "ForbiddenOperationException");

        const accessToken = generateToken(32);
        const generatedClientToken = clientToken || generateToken(16);
        await db.insert(gameSessionsTable).values({
            userId: user.id, accessToken, clientToken: generatedClientToken,
            requestedUsername: requestedUsername || null,
            minecraftUuid: minecraftUuid || null,
            launcherVersion: launcherVersion || null,
            lastActivity: new Date(),
            expiresAt: new Date(Date.now() + YGGDRASIL_SESSION_DURATION_MS),
        });

        const profile = await buildProfile(user, requestedUsername || user.username, false, minecraftUuid);
        return { accessToken, clientToken: generatedClientToken, availableProfiles: [profile], selectedProfile: profile, user: { id: user.id, username: user.username } };
    },

    async refresh(accessToken: string, clientToken: string) {
        const [row] = await db.select({ session: gameSessionsTable, user: users }).from(gameSessionsTable).innerJoin(users, eq(gameSessionsTable.userId, users.id)).where(eq(gameSessionsTable.accessToken, accessToken)).limit(1);
        if (!row || row.session.clientToken !== clientToken) throw new APIError(401, "Invalid access_token.", "ForbiddenOperationException");
        if (isExpired(row.session.expiresAt)) {
            await db.delete(gameSessionsTable).where(eq(gameSessionsTable.id, row.session.id));
            throw new APIError(401, "Expired access_token.", "ForbiddenOperationException");
        }
        if (isInactive(row.session.lastActivity)) {
            await db.delete(gameSessionsTable).where(eq(gameSessionsTable.id, row.session.id));
            throw new APIError(401, "Expired access_token.", "ForbiddenOperationException");
        }

        const newAccessToken = generateToken(32);
        await db.update(gameSessionsTable).set({ accessToken: newAccessToken, expiresAt: new Date(Date.now() + YGGDRASIL_SESSION_DURATION_MS), lastActivity: new Date() }).where(eq(gameSessionsTable.id, row.session.id));
        const profile = await buildProfile(row.user, undefined, false, row.session.minecraftUuid ?? undefined);
        return { accessToken: newAccessToken, clientToken: row.session.clientToken, availableProfiles: [profile], selectedProfile: profile, user: { id: row.user.id, username: row.user.username } };
    },

    async validate(accessToken: string, clientToken?: string) {
        const [gs] = await db.select().from(gameSessionsTable).where(eq(gameSessionsTable.accessToken, accessToken)).limit(1);
        if (!gs) return false;
        if (clientToken && gs.clientToken !== clientToken) return false;
        if (isExpired(gs.expiresAt) || isInactive(gs.lastActivity)) {
            await db.delete(gameSessionsTable).where(eq(gameSessionsTable.id, gs.id));
            return false;
        }
        await db.update(gameSessionsTable).set({ lastActivity: new Date() }).where(eq(gameSessionsTable.id, gs.id));
        return true;
    },

    async invalidate(accessToken: string, clientToken: string) {
        const [gs] = await db.select().from(gameSessionsTable).where(eq(gameSessionsTable.accessToken, accessToken)).limit(1);
        if (gs && gs.clientToken === clientToken) await db.delete(gameSessionsTable).where(eq(gameSessionsTable.id, gs.id));
    },

    async joinServer(accessToken: string, selectedProfile: string, serverId: string, ipAddress?: string) {
        if (!accessToken || !selectedProfile || !serverId) throw new APIError(400, "credentials can not be null.", "IllegalArgumentException");

        const [gs] = await db.select().from(gameSessionsTable).where(eq(gameSessionsTable.accessToken, accessToken)).limit(1);
        if (!gs) throw new APIError(401, "Invalid access_token.", "ForbiddenOperationException");
        if (isExpired(gs.expiresAt) || isInactive(gs.lastActivity)) {
            await db.delete(gameSessionsTable).where(eq(gameSessionsTable.id, gs.id));
            throw new APIError(401, "Expired access_token.", "ForbiddenOperationException");
        }
        if (gs.accessToken === "00000000-0000-0000-0000-000000000000" || selectedProfile === "00000000-0000-0000-0000-000000000000") {
            throw new APIError(400, "credentials can not be null.", "IllegalArgumentException");
        }

        const [user] = await db.select().from(users).where(eq(users.id, gs.userId)).limit(1);
        if (!user) throw new APIError(401, "Invalid access_token.", "ForbiddenOperationException");

        // Primero verificar si el usuario está baneado (prioridad sobre cualquier otra comprobación)
        if (await isUserBanned(user.id)) {
            throw new APIError(
                403,
                "\n\n§c§l⚠ BAN NOTICE ⚠§r\n\n§6Your §e§lModpack Store§r account has been §c§lBANNED§r!\n\n§7Please contact support for more information.\n",
                "UserBannedException",
            );
        }

        if (!gs.launcherVersion || !isVersionAtLeast(gs.launcherVersion, MIN_LAUNCHER_VERSION)) {
            throw new APIError(
                403,
                "\n\n§c§l⚠ LAUNCHER REQUIRED ⚠§r\n\n§6This server §e§lrequires§r you to use the §e§lModpack Store Launcher§r!\n\n§7Please install or update to the latest version.\n",
                "UserBannedException",
            );
        }

        const uuidRegex = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
        if (!uuidRegex.test(selectedProfile)) {
            throw new APIError(400, "Invalid selectedProfile.", "IllegalArgumentException");
        }

        await db.update(gameSessionsTable).set({ serverId, ipAddress: ipAddress || null, lastActivity: new Date() }).where(eq(gameSessionsTable.id, gs.id));
    },

    async hasJoined(username: string, serverId: string, ip?: string): Promise<YggdrasilProfile | null> {
        const [row] = await db.select({ session: gameSessionsTable, user: users })
            .from(gameSessionsTable)
            .innerJoin(users, eq(gameSessionsTable.userId, users.id))
            .where(
                and(
                    eq(gameSessionsTable.serverId, serverId),
                    or(
                        eq(gameSessionsTable.requestedUsername, username),
                        eq(users.username, username)
                    )
                )
            )
            .limit(1);

        if (!row) return null; // OFICIAL: 204 = no hizo join, NO es error

        const { session: gs, user } = row;
        if (isExpired(gs.expiresAt) || isInactive(gs.lastActivity)) {
            await db.delete(gameSessionsTable).where(eq(gameSessionsTable.id, gs.id));
            return null;
        }
        if (ip && gs.ipAddress && gs.ipAddress !== ip) return null;

        if (await isUserBanned(user.id)) {
            throw new APIError(
                403,
                "\n\n§c§l⚠ BAN NOTICE ⚠§r\n\n§6Your §e§lModpack Store§r account has been §c§lBANNED§r from multiplayer!\n\n§7Please contact support for more information.\n",
                "UserBannedException",
            );
        }

        await db.update(gameSessionsTable).set({ serverId: null, lastActivity: new Date() }).where(eq(gameSessionsTable.id, gs.id));
        return await buildProfile(user, undefined, false, gs.minecraftUuid ?? undefined);
    },

    async getProfile(uuid: string, unsigned = true) {
        const cleanUuid = uuid.replace(/-/g, "");
        const dashedUuid = uuidWithDashes(cleanUuid);
        const mojangProfile = await getProfileFromMojang(cleanUuid, unsigned);
        if (mojangProfile) return mojangProfile;
        const [user] = await db.select().from(users).where(eq(users.id, dashedUuid)).limit(1);
        if (user) return await buildProfile(user, undefined, !unsigned, dashedUuid);
        const [s] = await db.select({ user: users, session: gameSessionsTable }).from(gameSessionsTable).innerJoin(users, eq(gameSessionsTable.userId, users.id)).where(eq(gameSessionsTable.minecraftUuid, dashedUuid)).limit(1);
        if (s) return await buildProfile(s.user, s.session.requestedUsername ?? undefined, !unsigned, dashedUuid);
        return null;
    },
    async cleanupExpiredSessions() { await db.delete(gameSessionsTable).where(lt(gameSessionsTable.expiresAt, new Date())); },
};

function generateToken(n: number) { const b = new Uint8Array(n); crypto.getRandomValues(b); return Array.from(b, x => x.toString(16).padStart(2, "0")).join(""); }
function isExpired(d: Date) { return new Date(d).getTime() < Date.now(); }
function isInactive(d: Date) { return new Date(d).getTime() < Date.now() - INACTIVITY_TIMEOUT_MS; }
function uuidWithDashes(u: string) { if (u.includes("-")) return u; return `${u.slice(0, 8)}-${u.slice(8, 12)}-${u.slice(12, 16)}-${u.slice(16, 20)}-${u.slice(20)}`; }
async function isUserBanned(id: string) {
    const [ban] = await db
        .select()
        .from(bansTable)
        .where(
            and(
                eq(bansTable.userId, id),
                or(
                    eq(bansTable.isActive, true),
                    isNull(bansTable.unbanDate)
                )
            )
        )
        .limit(1);
    return !!ban;
}
async function buildProfile(user: any, customUsername?: string, signed = false, minecraftUuid?: string): Promise<YggdrasilProfile> {
    const profileId = minecraftUuid || user.id;
    const profile: YggdrasilProfile = { id: uuidWithDashes(profileId), name: customUsername || user.username };
    const [skin, cape] = await Promise.all([getActiveSkin(user.id), getActiveCape(user.id)]);
    if (skin || cape) {
        const textures: any = {};
        if (skin) { textures.SKIN = { url: skin.url }; if (skin.model === "slim") textures.SKIN.metadata = { model: "slim" }; }
        if (cape) textures.CAPE = { url: cape.url };
        const data = { timestamp: Date.now(), profileId: profileId.replace(/-/g, ""), profileName: profile.name, textures };
        const encoded = btoa(JSON.stringify(data));
        profile.properties = [{ name: "textures", value: encoded, ...(signed ? { signature: await signTextures(encoded) } : {}) }];
    }
    return profile;
}
async function signTextures(d: string) { const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(d))); let b = ""; for (let i = 0; i < h.length; i++) b += String.fromCharCode(h[i]); return btoa(b); }
function isVersionAtLeast(version: string, minVersion: string): boolean {
    const cleanV = version.trim().replace(/^v/, "").split("-")[0];
    const cleanMin = minVersion.trim().replace(/^v/, "").split("-")[0];
    const vParts = cleanV.split(".").map(p => parseInt(p, 10) || 0);
    const minParts = cleanMin.split(".").map(p => parseInt(p, 10) || 0);
    for (let i = 0; i < Math.max(vParts.length, minParts.length); i++) {
        const v = vParts[i] ?? 0;
        const min = minParts[i] ?? 0;
        if (v > min) return true;
        if (v < min) return false;
    }
    return true;
}