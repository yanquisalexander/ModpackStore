import { Hono } from "@hono/hono";
import { yggdrasilService } from "@/v1/yggdrasil/yggdrasil.service.ts";
import { APIError } from "@/lib/errors/index.ts";

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
    try {
        const body = await c.req.json();
        const result = await yggdrasilService.authenticate(
            body.password,
            body.clientToken,
            body.username,
            body.minecraftUuid,
        );
        return c.json(result);
    } catch (err) {
        if (err instanceof APIError) {
            return c.json(
                { error: "ForbiddenOperationException", errorMessage: err.message },
                err.statusCode as any,
            );
        }
        throw err;
    }
});

yggdrasilRoutes.post("/refresh", async (c) => {
    try {
        const body = await c.req.json();
        const result = await yggdrasilService.refresh(
            body.accessToken,
            body.clientToken,
        );
        return c.json(result);
    } catch (err) {
        if (err instanceof APIError) {
            return c.json(
                { error: "ForbiddenOperationException", errorMessage: err.message },
                err.statusCode as any,
            );
        }
        throw err;
    }
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
    try {
        const body = await c.req.json();
        await yggdrasilService.joinServer(
            body.accessToken,
            body.selectedProfile,
            body.serverId,
            body.ip,
        );
        return c.body(null, 204);
    } catch (err) {
        if (err instanceof APIError) {
            return c.json(
                { error: "ForbiddenOperationException", errorMessage: err.message },
                err.statusCode as any,
            );
        }
        throw err;
    }
});

yggdrasilRoutes.get("/session/minecraft/hasJoined", async (c) => {
    try {
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
    } catch (err) {
        if (err instanceof APIError) {
            return c.json(
                { error: "ForbiddenOperationException", errorMessage: err.message },
                err.statusCode as any,
            );
        }
        throw err;
    }
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
    try {
        const body = await c.req.json();
        await yggdrasilService.joinServer(
            body.accessToken,
            body.selectedProfile,
            body.serverId,
            body.ip,
        );
        return c.body(null, 204);
    } catch (err) {
        if (err instanceof APIError) {
            return c.json(
                { error: "ForbiddenOperationException", errorMessage: err.message },
                err.statusCode as any,
            );
        }
        throw err;
    }
});

yggdrasilRoutes.get("/sessionserver/session/minecraft/hasJoined", async (c) => {
    try {
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
    } catch (err) {
        if (err instanceof APIError) {
            return c.json(
                { error: "ForbiddenOperationException", errorMessage: err.message },
                err.statusCode as any,
            );
        }
        throw err;
    }
});

export default yggdrasilRoutes;
