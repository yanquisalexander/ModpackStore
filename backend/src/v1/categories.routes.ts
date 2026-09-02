import { Hono } from "@hono/hono";
import { getCategoriesForPublishers } from "@/services/category.service.ts";

const app = new Hono();

app.get("/publishers", async (c) => {
    const categories = await getCategoriesForPublishers();
    return c.json({ success: true, data: categories, meta: { total: categories.length } });
});

export default app;
