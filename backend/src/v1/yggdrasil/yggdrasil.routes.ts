import { Hono } from "@hono/hono";
import { yggdrasilService } from "@/v1/yggdrasil/yggdrasil.service.ts";

const yggdrasilRoutes = new Hono();

yggdrasilRoutes.get("/", (c) =>
    c.json({
        meta: {
            serverName: "Modpack Store Auth",
            version: { name: "1.8", protocol: 47 },
        },
        skinHosts: [],
    })
);

yggdrasilRoutes.post("/authenticate", async (c) => {
    const body = await c.req.json();
    const result = await yggdrasilService.authenticate(
        body.password,
        body.clientToken,
        body.username,
    );
    return c.json(result);
});

yggdrasilRoutes.post("/refresh", async (c) => {
    const body = await c.req.json();
    const result = await yggdrasilService.refresh(
        body.accessToken,
        body.clientToken,
    );
    return c.json(result);
});

yggdrasilRoutes.post("/validate", async (c) => {
    const body = await c.req.json();
    const valid = await yggdrasilService.validate(
        body.accessToken,
        body.clientToken,
    );
    return c.body(null, valid ? 204 : 403);
});

yggdrasilRoutes.post("/invalidate", async (c) => {
    const body = await c.req.json();
    await yggdrasilService.invalidate(body.accessToken, body.clientToken);
    return c.body(null, 204);
});

yggdrasilRoutes.post("/signout", async (c) => {
    return c.json(
        { error: "Not implemented for ModpackStore auth" },
        501 as any,
    );
});

yggdrasilRoutes.post("/session/minecraft/join", async (c) => {
    const body = await c.req.json();
    await yggdrasilService.joinServer(
        body.accessToken,
        body.selectedProfile,
        body.serverId,
        body.ip,
    );
    return c.body(null, 204);
});

yggdrasilRoutes.get("/session/minecraft/hasJoined", async (c) => {
    const username = c.req.query("username");
    const serverId = c.req.query("serverId");
    const ip = c.req.query("ip");

    if (!username || !serverId) {
        return c.body(null, 204);
    }

    const profile = await yggdrasilService.hasJoined(username, serverId, ip);
    if (!profile) {
        return c.body(null, 204);
    }
    return c.json(profile);
});

yggdrasilRoutes.get("/session/minecraft/profile/:uuid", async (c) => {
    const uuid = c.req.param("uuid");
    const unsigned = c.req.query("unsigned") !== "false";

    const profile = await yggdrasilService.getProfile(uuid, unsigned);
    if (!profile) {
        return c.body(null, 404);
    }
    return c.json(profile);
});

yggdrasilRoutes.post("/sessionserver/session/minecraft/join", async (c) => {
    const body = await c.req.json();
    await yggdrasilService.joinServer(
        body.accessToken,
        body.selectedProfile,
        body.serverId,
        body.ip,
    );
    return c.body(null, 204);
});

yggdrasilRoutes.get("/sessionserver/session/minecraft/hasJoined", async (c) => {
    const username = c.req.query("username");
    const serverId = c.req.query("serverId");
    const ip = c.req.query("ip");

    if (!username || !serverId) {
        return c.body(null, 204);
    }

    const profile = await yggdrasilService.hasJoined(username, serverId, ip);
    if (!profile) {
        return c.body(null, 204);
    }
    return c.json(profile);
});

export default yggdrasilRoutes;
