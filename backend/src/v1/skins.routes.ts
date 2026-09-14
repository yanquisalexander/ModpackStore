import { Hono } from "@hono/hono";
import type { Context } from "@hono/hono";
import { requireAuth, type AuthVariables } from "@/auth/middleware.ts";
import { SkinModel } from "@/db/schema.ts";
import { ValidationError } from "@/lib/errors/index.ts";
import {
    uploadSkin,
    uploadCape,
    listSkins,
    listCapes,
    activateSkin,
    activateCape,
    deactivateSkin,
    deactivateCape,
    deleteSkin,
    deleteCape,
    getActiveSkin,
    getActiveCape,
} from "@/services/skins.service.ts";
import { getUserSkinUrl, getUserCapeUrl } from "@/lib/r2.ts";

const app = new Hono();

// ── Get active textures ─────────────────────────────

app.get(
    "/me/textures",
    requireAuth,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const userId = c.get("userId");
        const [activeSkin, activeCape, skins, capes] = await Promise.all([
            getActiveSkin(userId),
            getActiveCape(userId),
            listSkins(userId),
            listCapes(userId),
        ]);

        return c.json({
            data: {
                activeSkin,
                activeCape,
                skins: skins.map((s) => {
                    const hash = s.r2Key.split("/").pop()?.replace(".png", "") || "";
                    return {
                        id: s.id,
                        name: s.name,
                        model: s.model,
                        isActive: s.isActive,
                        url: getUserSkinUrl(s.userId, hash),
                        createdAt: s.createdAt,
                    };
                }),
                capes: capes.map((c) => {
                    const hash = c.r2Key.split("/").pop()?.replace(".png", "") || "";
                    return {
                        id: c.id,
                        name: c.name,
                        isActive: c.isActive,
                        url: getUserCapeUrl(c.userId, hash),
                        createdAt: c.createdAt,
                    };
                }),
            },
        });
    },
);

// ── Upload skin ─────────────────────────────────────

app.post(
    "/me/skin",
    requireAuth,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const userId = c.get("userId");
        const body = await c.req.parseBody();
        const file = body.file as File;

        if (!file || !(file instanceof File)) {
            return c.json(
                { errors: [{ status: "400", title: "Bad Request", detail: "File is required." }] },
                400,
            );
        }

        const modelParam = body.model as string | undefined;
        let model = SkinModel.CLASSIC;
        if (modelParam === "slim") model = SkinModel.SLIM;
        else if (modelParam && modelParam !== "classic") {
            throw new ValidationError("Model must be 'classic' or 'slim'", "INVALID_MODEL");
        }

        const name = (body.name as string) || undefined;
        const fileBytes = new Uint8Array(await file.arrayBuffer());

        const skin = await uploadSkin(userId, fileBytes, model, name);
        return c.json({ data: skin }, 201);
    },
);

// ── Upload cape ─────────────────────────────────────

app.post(
    "/me/cape",
    requireAuth,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const userId = c.get("userId");
        const body = await c.req.parseBody();
        const file = body.file as File;

        if (!file || !(file instanceof File)) {
            return c.json(
                { errors: [{ status: "400", title: "Bad Request", detail: "File is required." }] },
                400,
            );
        }

        const name = (body.name as string) || undefined;
        const fileBytes = new Uint8Array(await file.arrayBuffer());

        const cape = await uploadCape(userId, fileBytes, name);
        return c.json({ data: cape }, 201);
    },
);

// ── Activate skin ───────────────────────────────────

app.put(
    "/me/skin/:skinId/activate",
    requireAuth,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const userId = c.get("userId");
        const skinId = c.req.param("skinId")!;
        const skin = await activateSkin(userId, skinId);
        return c.json({ data: skin });
    },
);

// ── Activate cape ───────────────────────────────────

app.put(
    "/me/cape/:capeId/activate",
    requireAuth,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const userId = c.get("userId");
        const capeId = c.req.param("capeId")!;
        const cape = await activateCape(userId, capeId);
        return c.json({ data: cape });
    },
);

// ── Deactivate skin (reset to default) ──────────────

app.delete(
    "/me/skin",
    requireAuth,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const userId = c.get("userId");
        await deactivateSkin(userId);
        return c.body(null, 204);
    },
);

// ── Deactivate cape (reset to default) ──────────────

app.delete(
    "/me/cape",
    requireAuth,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const userId = c.get("userId");
        await deactivateCape(userId);
        return c.body(null, 204);
    },
);

// ── Delete skin from gallery ────────────────────────

app.delete(
    "/me/skin/:skinId",
    requireAuth,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const userId = c.get("userId");
        const skinId = c.req.param("skinId")!;
        await deleteSkin(userId, skinId);
        return c.body(null, 204);
    },
);

// ── Delete cape from gallery ────────────────────────

app.delete(
    "/me/cape/:capeId",
    requireAuth,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const userId = c.get("userId");
        const capeId = c.req.param("capeId")!;
        await deleteCape(userId, capeId);
        return c.body(null, 204);
    },
);

export default app;
