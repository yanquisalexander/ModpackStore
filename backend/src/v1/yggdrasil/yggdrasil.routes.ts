import { Hono } from "@hono/hono";
import { yggdrasilService } from "@/v1/yggdrasil/yggdrasil.service.ts";
import { APIError } from "@/lib/errors/index.ts";
const yggdrasilRoutes = new Hono();

const toYggError = (err: any, path?: string) => ({
    error: err?.errorCode || "ForbiddenOperationException",
    errorMessage: err?.message || "An unexpected error occurred.",
    ...(path ? { path } : {}),
});

yggdrasilRoutes.onError((err, c) => {
    console.error("[Yggdrasil Router Error]", err);
    const status = err instanceof APIError ? err.statusCode : 500;
    return c.json(toYggError(err, c.req.path), status as any);
});

yggdrasilRoutes.get("/", (c) => {
    const r2 = Deno.env.get("R2_PUBLIC_DOMAIN") ?? "";
    return c.json({ meta: { serverName: "Modpack Store Auth", version: { name: "1.8", protocol: 47 } }, skinDomains: r2 ? [new URL(r2).hostname] : [], skinHosts: [] });
});

yggdrasilRoutes.post("/authenticate", async (c) => {
    try {
        const b = await c.req.json();
        return c.json(await yggdrasilService.authenticate(b.password, b.clientToken, b.username, b.minecraftUuid, b.launcherVersion, b.modpackId));
    } catch (e) {
        if (e instanceof APIError) return c.json(toYggError(e), e.statusCode as any);
        console.error("[Yggdrasil Authenticate Error]", e);
        return c.json(toYggError(e), 500);
    }
});
yggdrasilRoutes.post("/refresh", async (c) => {
    try {
        const b = await c.req.json();
        if (!b?.accessToken || !b?.clientToken) throw new APIError(400, "credentials can not be null.", "IllegalArgumentException");
        return c.json(await yggdrasilService.refresh(b.accessToken, b.clientToken));
    } catch (e) {
        if (e instanceof APIError) return c.json(toYggError(e), e.statusCode as any);
        console.error("[Yggdrasil Refresh Error]", e);
        return c.json(toYggError(e), 500);
    }
});
yggdrasilRoutes.post("/validate", async (c) => {
    try {
        const b = await c.req.json();
        return c.body(null, await yggdrasilService.validate(b.accessToken, b.clientToken) ? 204 : 403);
    } catch {
        return c.body(null, 403);
    }
});
yggdrasilRoutes.post("/invalidate", async (c) => {
    try {
        const b = await c.req.json();
        await yggdrasilService.invalidate(b.accessToken, b.clientToken);
        return c.body(null, 204);
    } catch {
        return c.body(null, 204);
    }
});
yggdrasilRoutes.post("/signout", (c) => c.json({ error: "ForbiddenOperationException", errorMessage: "Not implemented" }, 501 as any));

async function handleJoin(c: any) {
    try {
        const b = await c.req.json();
        await yggdrasilService.joinServer(b.accessToken, b.selectedProfile, b.serverId, b.ip, b.modpackId);
        return c.body(null, 204);
    } catch (e) {
        if (e instanceof APIError) return c.json(toYggError(e, c.req.path), e.statusCode as any);
        console.error("[Yggdrasil Join Error]", e);
        return c.json(toYggError(e, c.req.path), 500);
    }
}
async function handleHasJoined(c: any) {
    try {
        const username = c.req.query("username"), serverId = c.req.query("serverId"), ip = c.req.query("ip");
        if (!username || !serverId) throw new APIError(400, "Missing username or serverId", "IllegalArgumentException");
        const p = await yggdrasilService.hasJoined(username, serverId, ip);
        if (!p) return c.body(null, 204);
        return c.json(p);
    } catch (e) {
        if (e instanceof APIError) return c.json(toYggError(e, c.req.path), e.statusCode as any);
        console.error("[Yggdrasil HasJoined Error]", e);
        return c.json(toYggError(e, c.req.path), 500);
    }
}

yggdrasilRoutes.post("/session/minecraft/join", handleJoin);
yggdrasilRoutes.get("/session/minecraft/hasJoined", handleHasJoined);
yggdrasilRoutes.post("/sessionserver/session/minecraft/join", handleJoin);
yggdrasilRoutes.get("/sessionserver/session/minecraft/hasJoined", handleHasJoined);

yggdrasilRoutes.get("/session/minecraft/profile/:uuid", async (c) => {
    const p = await yggdrasilService.getProfile(c.req.param("uuid"), c.req.query("unsigned") !== "false");
    if (!p) return c.body(null, 404); return c.json(p);
});
yggdrasilRoutes.get("/sessionserver/session/minecraft/profile/:uuid", async (c) => {
    const p = await yggdrasilService.getProfile(c.req.param("uuid"), c.req.query("unsigned") !== "false");
    if (!p) return c.body(null, 404); return c.json(p);
});

export default yggdrasilRoutes;