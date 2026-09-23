import { Hono } from "@hono/hono";
import type { Context } from "@hono/hono";
import { requireAuth, requireAdmin } from "@/auth/middleware.ts";
import { db } from "@/db/client.ts";
import { systemSettingsTable, users } from "@/db/schema.ts";
import { eq, sql } from "drizzle-orm";

const app = new Hono();

app.use("*", requireAuth, requireAdmin);

app.get("/tos", async (c: Context) => {
    const [contentRow] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "terms_and_conditions_content")).limit(1);
    const [enabledRow] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "terms_and_conditions_enabled")).limit(1);

    return c.json({
        data: {
            content: contentRow?.value || "",
            enabled: enabledRow?.value === "true",
        },
    });
});

app.put("/tos", async (c: Context) => {
    const body = await c.req.json<{ content?: string; enabled?: boolean }>();

    if (body.content === undefined && body.enabled === undefined) {
        return c.json({ errors: [{ status: "400", title: "Bad Request", detail: "At least one field (content or enabled) must be provided." }] }, 400);
    }

    if (body.content !== undefined) {
        const [existing] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "terms_and_conditions_content")).limit(1);

        if (existing) {
            await db.update(systemSettingsTable).set({ value: body.content, updatedAt: new Date() }).where(eq(systemSettingsTable.key, "terms_and_conditions_content"));
        } else {
            await db.insert(systemSettingsTable).values({ key: "terms_and_conditions_content", value: body.content });
        }
    }

    if (body.enabled !== undefined) {
        const [existing] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "terms_and_conditions_enabled")).limit(1);
        const enabledValue = body.enabled ? "true" : "false";

        if (existing) {
            await db.update(systemSettingsTable).set({ value: enabledValue, updatedAt: new Date() }).where(eq(systemSettingsTable.key, "terms_and_conditions_enabled"));
        } else {
            await db.insert(systemSettingsTable).values({ key: "terms_and_conditions_enabled", value: enabledValue });
        }
    }

    const [contentRow] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "terms_and_conditions_content")).limit(1);
    const [enabledRow] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "terms_and_conditions_enabled")).limit(1);

    return c.json({
        data: {
            content: contentRow?.value || "",
            enabled: enabledRow?.value === "true",
        },
    });
});

app.post("/tos/revoke-all", async (c: Context) => {
    const result = await db.update(users).set({ tosAcceptedAt: null }).where(sql`tos_accepted_at IS NOT NULL`);
    const usersUpdated = result.rowCount ?? 0;

    return c.json({
        data: {
            usersUpdated,
        },
    });
});

export default app;
