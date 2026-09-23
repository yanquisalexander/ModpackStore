import { Hono } from "@hono/hono";
import { db } from "@/db/client.ts";
import { systemSettingsTable } from "@/db/schema.ts";
import { eq } from "drizzle-orm";

const publicRoutes = new Hono();

publicRoutes.get("/tos", async (c) => {
    const [contentRow] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "terms_and_conditions_content")).limit(1);
    const [enabledRow] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "terms_and_conditions_enabled")).limit(1);

    return c.json({
        data: {
            content: contentRow?.value || "",
            enabled: enabledRow?.value === "true",
        },
    });
});

export default publicRoutes;
