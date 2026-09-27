import { Hono } from "@hono/hono";
import { yggdrasilService } from "@/v1/yggdrasil/yggdrasil.service.ts";
import { APIError } from "@/lib/errors/index.ts";

const yggdrasilRoutes = new Hono();

yggdrasilRoutes.get("/", (c) => {
    const r2PublicDomain = Deno.env.get("R2_PUBLIC_DOMAIN") ?? "";
    const skinDomains = r2PublicDomain ? [new URL(r2PublicDomain).hostname] : [];
    return c.json({
        meta: { serverName: "Modpack Store Auth", version: { name: "1.8", protocol: 47 } },
        skinDomains,
        skinHosts: [],
    });
});

function toYggError(err: APIError) {
    return { error: "ForbiddenOperationException", errorMessage: err.message, cause: (err as any).code || undefined };
}

yggdrasilRoutes.post("/authenticate", async (c) => {
    try {
        const body = await c.req.json();
        const result = await yggdrasilService.authenticate(body.password, body.clientToken, body.username, body.minecraftUuid, body.launcherVersion);
        return c.json(result);
    } catch (err) {
        if (err instanceof APIError) return c.json(toYggError(err), err.statusCode as any);
        throw err;
    }
});

yggdrasilRoutes.post("/refresh", async (c) => {
    try {
        const body = await c.req.json();
        const result = await yggdrasilService.refresh(body.accessToken, body.clientToken);
        return c.json(result);
    } catch (err) {
        if (err instanceof APIError) return c.json(toYggError(err), err.statusCode as any);
        throw err;
    }
});

yggdrasilRoutes.post("/validate", async (c) => {
    const body = await c.req.json();
    const valid = await yggdrasilService.validate(body.accessToken, body.clientToken);
    return c.body(null, valid ? 204 : 403);
});

yggdrasilRoutes.post("/invalidate", async (c) => {
    const body = await c.req.json();
    await yggdrasilService.invalidate(body.accessToken, body.clientToken);
    return c.body(null, 204);
});

yggdrasilRoutes.post("/signout", async (c) => {
    return c.json({ error: "ForbiddenOperationException", errorMessage: "Not implemented" }, 501 as any);
});

async function handleJoin(c: any) {
    try {
        const body = await c.req.json();
        await yggdrasilService.joinServer(body.accessToken, body.selectedProfile, body.serverId, body.ip);
        return c.body(null, 204);
    } catch (err) {
        if (err instanceof APIError) return c.json(toYggError(err), err.statusCode as any);
        throw err;
    }
}

async function handleHasJoined(c: any) {
    try {
        const username = c.req.query("username");
        const serverId = c.req.query("serverId");
        const ip = c.req.query("ip");
        if (!username || !serverId) return c.body(null, 204);
        const profile = await yggdrasilService.hasJoined(username, serverId, ip);
        if (!profile) return c.body(null, 204);
        return c.json(profile);
    } catch (err) {
        if (err instanceof APIError) return c.json(toYggError(err), err.statusCode as any);
        throw err;
    }
}

yggdrasilRoutes.post("/session/minecraft/join", handleJoin);
yggdrasilRoutes.get("/session/minecraft/hasJoined", handleHasJoined);
yggdrasilRoutes.post("/sessionserver/session/minecraft/join", handleJoin);
yggdrasilRoutes.get("/sessionserver/session/minecraft/hasJoined", handleHasJoined);

yggdrasilRoutes.get("/session/minecraft/profile/:uuid", async (c) => {
    const uuid = c.req.param("uuid");
    const unsigned = c.req.query("unsigned") !== "false";
    const profile = await yggdrasilService.getProfile(uuid, unsigned);
    if (!profile) return c.body(null, 404);
    return c.json(profile);
});
yggdrasilRoutes.get("/sessionserver/session/minecraft/profile/:uuid", async (c) => {
    const uuid = c.req.param("uuid");
    const unsigned = c.req.query("unsigned") !== "false";
    const profile = await yggdrasilService.getProfile(uuid, unsigned);
    if (!profile) return c.body(null, 404);
    return c.json(profile);
});

export default yggdrasilRoutes;