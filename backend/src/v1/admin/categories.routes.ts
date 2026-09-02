import { Hono } from "@hono/hono";
import type { Context } from "@hono/hono";
import { requireAuth, requireAdmin } from "@/auth/middleware.ts";
import {
    createCategory,
    getCategoryById,
    updateCategory,
    deleteCategory,
    getCategoriesForAdmin,
    assignCategoryToModpack,
    removeCategoryFromModpack,
    setPrimaryCategory,
    getModpackCategories,
    reorderCategories,
} from "@/services/category.service.ts";
import { seedDefaultCategories } from "@/db/seed.ts";

const app = new Hono();

// Initialize default categories
app.post("/initialize", requireAuth, requireAdmin, async (c: Context) => {
    await seedDefaultCategories();
    return c.json({ success: true, message: "Default categories initialized" });
});

// List all categories (admin) — supports query param filtering
app.get("/", requireAuth, requireAdmin, async (c: Context) => {
    const includeAdminOnly = c.req.query("includeAdminOnly") !== "false";
    const onlySelectable = c.req.query("onlySelectable") === "true";
    const includeAutomatic = c.req.query("includeAutomatic") !== "false";

    const categories = await getCategoriesForAdmin();

    const filtered = categories.filter((cat) => {
        if (!includeAdminOnly && cat.isAdminOnly) return false;
        if (onlySelectable && !cat.isSelectable) return false;
        if (!includeAutomatic && cat.isAutomatic) return false;
        return true;
    });

    return c.json({ success: true, data: filtered, meta: { total: filtered.length } });
});

// Get category by ID
app.get("/:categoryId", requireAuth, requireAdmin, async (c: Context) => {
    const category = await getCategoryById(c.req.param("categoryId")!);
    return c.json({ success: true, data: category });
});

// Create category
app.post("/", requireAuth, requireAdmin, async (c: Context) => {
    const body = await c.req.json();
    const category = await createCategory(body);
    return c.json({ success: true, data: category, message: "Category created" }, 201);
});

// Update category
app.put("/:categoryId", requireAuth, requireAdmin, async (c: Context) => {
    const body = await c.req.json();
    const category = await updateCategory(c.req.param("categoryId")!, body);
    return c.json({ success: true, data: category, message: "Category updated" });
});

// Delete category
app.delete("/:categoryId", requireAuth, requireAdmin, async (c: Context) => {
    await deleteCategory(c.req.param("categoryId")!);
    return c.json({ success: true, message: "Category deleted" });
});

// Reorder categories
app.post("/reorder", requireAuth, requireAdmin, async (c: Context) => {
    const { categories } = await c.req.json();
    await reorderCategories(categories);
    return c.json({ success: true, message: "Categories reordered" });
});

// ── Modpack-Category Assignment ───────────────────

// Get modpack's categories
app.get("/modpacks/:modpackId", requireAuth, requireAdmin, async (c: Context) => {
    const categories = await getModpackCategories(c.req.param("modpackId")!);
    return c.json({
        success: true,
        data: categories,
        meta: { total: categories.length, primary: null },
    });
});

// Assign category to modpack
app.post("/modpacks/:modpackId/assign", requireAuth, requireAdmin, async (c: Context) => {
    const { categoryId, isPrimary } = await c.req.json();
    const entry = await assignCategoryToModpack(c.req.param("modpackId")!, categoryId, isPrimary);
    return c.json({ success: true, data: entry, message: "Category assigned" }, 201);
});

// Remove category from modpack
app.delete("/modpacks/:modpackId/:categoryId", requireAuth, requireAdmin, async (c: Context) => {
    await removeCategoryFromModpack(c.req.param("modpackId")!, c.req.param("categoryId")!);
    return c.json({ success: true, message: "Category removed" });
});

// Set primary category for modpack
app.post("/modpacks/:modpackId/primary", requireAuth, requireAdmin, async (c: Context) => {
    const { categoryId } = await c.req.json();
    const entry = await setPrimaryCategory(c.req.param("modpackId")!, categoryId);
    return c.json({ success: true, data: entry, message: "Primary category set" });
});

export default app;
