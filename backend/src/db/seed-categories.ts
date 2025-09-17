import "dotenv/config";
import { client as db } from "./client";
import { CategoriesTable } from "./schema";
import { eq } from "drizzle-orm";

const defaultCategories = [
    {
        name: "Survival",
        shortDescription: "Modpacks centrados en la supervivencia",
        description: "Modpacks que se enfocan en mejorar y expandir la experiencia de supervivencia en Minecraft",
        sortOrder: 10,
        isPrimaryAllowed: true,
        isPublisherSelectable: true
    },
    {
        name: "Adventure",
        shortDescription: "Modpacks de aventura y exploración",
        description: "Modpacks que añaden nuevas dimensiones, estructuras y aventuras para explorar",
        sortOrder: 20,
        isPrimaryAllowed: true,
        isPublisherSelectable: true
    },
    {
        name: "Tech",
        shortDescription: "Modpacks tecnológicos e industriales",
        description: "Modpacks que se centran en máquinas, automatización y tecnología avanzada",
        sortOrder: 30,
        isPrimaryAllowed: true,
        isPublisherSelectable: true
    },
    {
        name: "Magic",
        shortDescription: "Modpacks mágicos y místicos",
        description: "Modpacks que introducen sistemas de magia, hechicería y elementos sobrenaturales",
        sortOrder: 40,
        isPrimaryAllowed: true,
        isPublisherSelectable: true
    },
    {
        name: "Kitchen Sink",
        shortDescription: "Modpacks todo-en-uno",
        description: "Modpacks que incluyen una gran variedad de mods de diferentes categorías",
        sortOrder: 50,
        isPrimaryAllowed: true,
        isPublisherSelectable: true
    },
    {
        name: "Lightweight",
        shortDescription: "Modpacks ligeros y optimizados",
        description: "Modpacks diseñados para computadoras de menores recursos",
        sortOrder: 60,
        isPrimaryAllowed: true,
        isPublisherSelectable: true
    },
    {
        name: "Hardcore",
        shortDescription: "Modpacks de alta dificultad",
        description: "Modpacks que incrementan significativamente la dificultad del juego",
        sortOrder: 70,
        isPrimaryAllowed: false,
        isPublisherSelectable: true
    },
    {
        name: "Destacado de nuestros partners",
        shortDescription: "Modpacks destacados por el equipo",
        description: "Modpacks seleccionados especialmente por nuestros socios",
        sortOrder: 5,
        isPrimaryAllowed: false,
        isPublisherSelectable: false
    },
    {
        name: "Nuevos modpacks",
        shortDescription: "Modpacks recientemente publicados",
        description: "Categoría automática para modpacks publicados recientemente",
        sortOrder: 1,
        isPrimaryAllowed: false,
        isPublisherSelectable: false
    }
];

export const seedDefaultCategories = async () => {
    console.log("🌱 Seeding default categories...");
    
    try {
        for (const category of defaultCategories) {
            // Check if category already exists
            const existingCategory = await db
                .select()
                .from(CategoriesTable)
                .where(eq(CategoriesTable.name, category.name))
                .limit(1);

            if (existingCategory.length === 0) {
                await db.insert(CategoriesTable).values(category);
                console.log(`✅ Created category: ${category.name}`);
            } else {
                console.log(`⏭️  Category already exists: ${category.name}`);
            }
        }
        
        console.log("🎉 Default categories seeded successfully!");
    } catch (error) {
        console.error("❌ Error seeding categories:", error);
        throw error;
    }
};

// If executed as a script
if (require.main === module) {
    seedDefaultCategories()
        .then(() => {
            console.log("Seeding completed successfully");
            process.exit(0);
        })
        .catch((error) => {
            console.error("Seeding failed:", error);
            process.exit(1);
        });
}