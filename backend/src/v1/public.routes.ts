import { Hono } from "@hono/hono";
import { db } from "@/db/client.ts";
import { systemSettingsTable } from "@/db/schema.ts";
import { eq } from "drizzle-orm";
import {
    getCachedTos,
    setCachedTos,
} from "@/services/kv-explore.ts";

const publicRoutes = new Hono();

publicRoutes.get("/tos", async (c) => {
    const cached = await getCachedTos();
    if (cached) {
        return c.json({ data: cached }, 200, { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" });
    }

    const [contentRow] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "terms_and_conditions_content")).limit(1);
    const [enabledRow] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "terms_and_conditions_enabled")).limit(1);

    const data = {
        content: contentRow?.value || "",
        enabled: enabledRow?.value === "true",
    };
    await setCachedTos(data);
    return c.json({ data }, 200, { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" });
});

export default publicRoutes;
