import { db } from "@/db/client.ts";
import { users, UserRole, categoriesTable } from "@/db/schema.ts";
import { eq } from "drizzle-orm";

export const SYSTEM_EMAIL = "system@app.local";

export async function generateSystemUser() {
    const [existing] = await db.select()
        .from(users)
        .where(eq(users.email, SYSTEM_EMAIL))
        .limit(1);

    if (existing) {
        console.log("System user already exists, skipping creation.");
        return;
    }

    console.log("System user not found, creating...");

    await db.insert(users).values({
        email: SYSTEM_EMAIL,
        avatarUrl: "/images/system-avatar.webp",
        username: "system",
        discordId: "userisnotauthenticable",
        role: UserRole.SYSTEM,
    });

    console.log("System user created successfully.");
}

export async function seedDefaultCategories() {
    const defaults = [
        {
            name: "Nuevos modpacks",
            shortDescription: "Modpacks recientemente publicados",
            isAutomatic: true,
            isAdminOnly: true,
            isSelectable: false,
            displayOrder: 100,
        },
        {
            name: "Uncategorized",
            shortDescription: "Modpacks sin categoría asignada",
            isAutomatic: true,
            isAdminOnly: true,
            isSelectable: false,
            displayOrder: 999,
        },
        {
            name: "Aventura",
            shortDescription: "Explora mundos y completa misiones",
            isAutomatic: false,
            isAdminOnly: false,
            isSelectable: true,
            displayOrder: 10,
        },
        {
            name: "Supervivencia",
            shortDescription: "Packs centrados en supervivencia y crafting",
            isAutomatic: false,
            isAdminOnly: false,
            isSelectable: true,
            displayOrder: 20,
        },
        {
            name: "Tecnología",
            shortDescription: "Máquinas, energía y automatización",
            isAutomatic: false,
            isAdminOnly: false,
            isSelectable: true,
            displayOrder: 30,
        },
        {
            name: "Magia",
            shortDescription: "Hechizos, rituales y dimensiones mágicas",
            isAutomatic: false,
            isAdminOnly: false,
            isSelectable: true,
            displayOrder: 40,
        },
        {
            name: "Optimización",
            shortDescription: "Mejoras de rendimiento y FPS",
            isAutomatic: false,
            isAdminOnly: false,
            isSelectable: true,
            displayOrder: 50,
        },
        {
            name: "Shaders",
            shortDescription: "Packs de shaders y gráficos mejorados",
            isAutomatic: false,
            isAdminOnly: false,
            isSelectable: true,
            displayOrder: 60,
        },
        {
            name: "Retro",
            shortDescription: "Mods clásicos y versiones antiguas",
            isAutomatic: false,
            isAdminOnly: false,
            isSelectable: true,
            displayOrder: 70,
        },
        {
            name: "Fabuloso",
            shortDescription: "Contenido narrativo y de exploración",
            isAutomatic: false,
            isAdminOnly: false,
            isSelectable: true,
            displayOrder: 80,
        },
        {
            name: "Helpers",
            shortDescription: "Mods de utilidad y calidad de vida",
            isAutomatic: false,
            isAdminOnly: false,
            isSelectable: true,
            displayOrder: 90,
        },
    ];

    for (const cat of defaults) {
        const [existing] = await db.select()
            .from(categoriesTable)
            .where(eq(categoriesTable.name, cat.name))
            .limit(1);

        if (!existing) {
            await db.insert(categoriesTable).values(cat);
            console.log(`Category "${cat.name}" created.`);
        }
    }
}

export async function seedDefaultHouseAds() {
    const { adsService } = await import("@/services/ads.service.ts");
    await adsService.seedDefaultHouseAds();
}

