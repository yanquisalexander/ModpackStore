import { db } from "@/db/client.ts";
import { gameSessionsTable, users, bansTable } from "@/db/schema.ts";
import { eq, and, lt } from "drizzle-orm";
import { APIError } from "@/lib/errors/index.ts";
import { verify } from "@hono/hono/jwt";
import { getActiveSkin, getActiveCape } from "@/services/skins.service.ts";
import { getProfileFromMojang } from "@/v1/mojang/mojang.service.ts";

const JWT_SECRET = Deno.env.get("JWT_SECRET")!;
const YGGDRASIL_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const INACTIVITY_TIMEOUT_MS = 6 * 60 * 60 * 1000;

export interface YggdrasilProfile {
    id: string;
    name: string;
    properties?: Array<{ name: string; value: string; signature?: string }>;
}

export interface YggdrasilAuthResponse {
    accessToken: string;
    clientToken: string;
    availableProfiles: YggdrasilProfile[];
    selectedProfile: YggdrasilProfile;
    user?: { id: string; username: string };
}

export const yggdrasilService = {
    async authenticate(
        jwtToken: string,
        clientToken?: string,
        requestedUsername?: string,
        minecraftUuid?: string,
        launcherVersion?: string,
    ): Promise<YggdrasilAuthResponse> {
        let decoded: any;
        try {
            decoded = await verify(jwtToken, JWT_SECRET, "HS256");
        } catch {
            throw new APIError(403, "Invalid token.", "ForbiddenOperationException");
        }

        const userId = decoded.sub as string | undefined;
        if (!userId) throw new APIError(403, "Invalid token.", "ForbiddenOperationException");

        const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (!user) throw new APIError(403, "Invalid token.", "ForbiddenOperationException");

        // NO bloqueamos por ban ni launcher aquí. Eso debe pasar en join.
        const accessToken = generateToken(32);
        const generatedClientToken = clientToken || generateToken(16);
        const expiresAt = new Date(Date.now() + YGGDRASIL_SESSION_DURATION_MS);

        await db.insert(gameSessionsTable).values({
            userId: user.id,
            accessToken,
            clientToken: generatedClientToken,
            requestedUsername: requestedUsername || null,
            minecraftUuid: minecraftUuid || null,
            launcherVersion: launcherVersion || null,
            lastActivity: new Date(),
            expiresAt,
        });

        const profile = await buildProfile(user, requestedUsername || user.username, false, minecraftUuid);

        return {
            accessToken,
            clientToken: generatedClientToken,
            availableProfiles: [profile],
            selectedProfile: profile,
            user: { id: user.id, username: user.username },
        };
    },

    async refresh(accessToken: string, clientToken: string): Promise<YggdrasilAuthResponse> {
        const [row] = await db.select({ session: gameSessionsTable, user: users })
            .from(gameSessionsTable).innerJoin(users, eq(gameSessionsTable.userId, users.id))
            .where(eq(gameSessionsTable.accessToken, accessToken)).limit(1);

        if (!row || row.session.clientToken !== clientToken) {
            throw new APIError(403, "Invalid token.", "ForbiddenOperationException");
        }

        if (isExpired(row.session.expiresAt) || isInactive(row.session.lastActivity)) {
            await db.delete(gameSessionsTable).where(eq(gameSessionsTable.id, row.session.id));
            throw new APIError(403, "Session expired.", "ForbiddenOperationException");
        }

        const newAccessToken = generateToken(32);
        const newExpiresAt = new Date(Date.now() + YGGDRASIL_SESSION_DURATION_MS);
        await db.update(gameSessionsTable).set({
            accessToken: newAccessToken,
            expiresAt: newExpiresAt,
            lastActivity: new Date(),
        }).where(eq(gameSessionsTable.id, row.session.id));

        const profile = await buildProfile(row.user, undefined, false, row.session.minecraftUuid ?? undefined);

        return {
            accessToken: newAccessToken,
            clientToken: row.session.clientToken,
            availableProfiles: [profile],
            selectedProfile: profile,
            user: { id: row.user.id, username: row.user.username },
        };
    },

    async validate(accessToken: string, clientToken?: string): Promise<boolean> {
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

    async invalidate(accessToken: string, clientToken: string): Promise<void> {
        const [gs] = await db.select().from(gameSessionsTable).where(eq(gameSessionsTable.accessToken, accessToken)).limit(1);
        if (gs && gs.clientToken === clientToken) {
            await db.delete(gameSessionsTable).where(eq(gameSessionsTable.id, gs.id));
        }
    },

    async joinServer(accessToken: string, selectedProfile: string, serverId: string, ipAddress?: string): Promise<void> {
        const [gs] = await db.select().from(gameSessionsTable).where(eq(gameSessionsTable.accessToken, accessToken)).limit(1);
        if (!gs) throw new APIError(403, "Invalid session.", "ForbiddenOperationException");

        if (isExpired(gs.expiresAt) || isInactive(gs.lastActivity)) {
            await db.delete(gameSessionsTable).where(eq(gameSessionsTable.id, gs.id));
            throw new APIError(403, "Session expired.", "ForbiddenOperationException");
        }

        const [user] = await db.select().from(users).where(eq(users.id, gs.userId)).limit(1);
        if (!user) throw new APIError(403, "User not found.", "ForbiddenOperationException");

        // VALIDACIONES QUE QUIERES QUE SE VEAN AL UNIRSE
        if (!gs.launcherVersion) {
            throw new APIError(403, "\n§c§l⚠ LAUNCHER REQUIRED ⚠§r\n§6This server §e§lrequires§r you to use the §e§lModpack Store Launcher§r!\n§7Please update to the latest version.", "ForbiddenOperationException");
        }

        if (await isUserBanned(user.id)) {
            throw new APIError(403, "\n§c§l⚠ BAN NOTICE ⚠§r\n§6Your §e§lModpack Store§r account has been §c§lBANNED§r!\n§7Please contact support for more information.", "ForbiddenOperationException");
        }

        const uuidRegex = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
        if (!uuidRegex.test(selectedProfile)) {
            throw new APIError(403, "Invalid profile ID. Configure your Minecraft nickname in instance settings.", "ForbiddenOperationException");
        }

        await db.update(gameSessionsTable).set({ serverId, ipAddress: ipAddress || null, lastActivity: new Date() }).where(eq(gameSessionsTable.id, gs.id));
    },

    async hasJoined(username: string, serverId: string, ip?: string): Promise<YggdrasilProfile | null> {
        const [row] = await db.select({ session: gameSessionsTable, user: users })
            .from(gameSessionsTable).innerJoin(users, eq(gameSessionsTable.userId, users.id))
            .where(and(eq(gameSessionsTable.serverId, serverId), eq(gameSessionsTable.requestedUsername, username))).limit(1);

        // Si no hay ticket de join -> 204, NO 403. Es el comportamiento oficial.
        if (!row) return null;

        const { session: gs, user } = row;
        if (isExpired(gs.expiresAt) || isInactive(gs.lastActivity)) {
            await db.delete(gameSessionsTable).where(eq(gameSessionsTable.id, gs.id));
            return null;
        }

        if (await isUserBanned(user.id)) {
            throw new APIError(403, "\n§c§l⚠ BAN NOTICE ⚠§r\n§6Your §e§lModpack Store§r account has been §c§lBANNED§r from multiplayer!\n§7Please contact support.", "ForbiddenOperationException");
        }

        if (ip && gs.ipAddress && gs.ipAddress !== ip) return null;

        // Consume el ticket
        await db.update(gameSessionsTable).set({ serverId: null, lastActivity: new Date() }).where(eq(gameSessionsTable.id, gs.id));

        return await buildProfile(user, undefined, false, gs.minecraftUuid ?? undefined);
    },

    async getProfile(uuid: string, unsigned: boolean = true): Promise<YggdrasilProfile | null> {
        const cleanUuid = uuid.replace(/-/g, "");
        const dashedUuid = uuidWithDashes(cleanUuid);
        const mojangProfile = await getProfileFromMojang(cleanUuid, unsigned);
        if (mojangProfile) return mojangProfile;

        const [user] = await db.select().from(users).where(eq(users.id, dashedUuid)).limit(1);
        if (user) return await buildProfile(user, undefined, !unsigned, dashedUuid);

        const [session] = await db.select({ user: users, session: gameSessionsTable })
            .from(gameSessionsTable).innerJoin(users, eq(gameSessionsTable.userId, users.id))
            .where(eq(gameSessionsTable.minecraftUuid, dashedUuid)).limit(1);
        if (session) return await buildProfile(session.user, session.session.requestedUsername ?? undefined, !unsigned, dashedUuid);

        return null;
    },

    async cleanupExpiredSessions(): Promise<void> {
        await db.delete(gameSessionsTable).where(lt(gameSessionsTable.expiresAt, new Date()));
    },
};

function generateToken(byteLength: number): string {
    const bytes = new Uint8Array(byteLength);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
function isExpired(d: Date) { return new Date(d).getTime() < Date.now(); }
function isInactive(d: Date) { return new Date(d).getTime() < Date.now() - INACTIVITY_TIMEOUT_MS; }
function uuidWithDashes(uuid: string) {
    if (uuid.includes("-")) return uuid;
    return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
}
async function isUserBanned(userId: string) {
    const [ban] = await db.select().from(bansTable).where(and(eq(bansTable.userId, userId), eq(bansTable.isActive, true))).limit(1);
    return !!ban;
}
async function buildProfile(user: { id: string; username: string; avatarUrl: string | null }, customUsername?: string, signed = false, minecraftUuid?: string): Promise<YggdrasilProfile> {
    const profileId = minecraftUuid || user.id;
    const profile: YggdrasilProfile = { id: uuidWithDashes(profileId), name: customUsername || user.username };
    const [activeSkin, activeCape] = await Promise.all([getActiveSkin(user.id), getActiveCape(user.id)]);
    if (activeSkin || activeCape) {
        const textures: any = {};
        if (activeSkin) { textures.SKIN = { url: activeSkin.url }; if (activeSkin.model === "slim") textures.SKIN.metadata = { model: "slim" }; }
        if (activeCape) textures.CAPE = { url: activeCape.url };
        const textureData = { timestamp: Date.now(), profileId: profileId.replace(/-/g, ""), profileName: profile.name, textures };
        const encodedTextures = btoa(JSON.stringify(textureData));
        profile.properties = [{ name: "textures", value: encodedTextures, ...(signed ? { signature: await signTextures(encodedTextures) } : {}) }];
    }
    return profile;
}
async function signTextures(data: string): Promise<string> {
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data)));
    let binary = ""; for (let i = 0; i < hash.length; i++) binary += String.fromCharCode(hash[i]);
    return btoa(binary);
}