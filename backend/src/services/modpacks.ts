import { client } from "@/db/client"
import { ModpacksTable } from "@/db/schema"
import { and, asc, eq, ilike, not } from "drizzle-orm"

export const getExploreModpacks = async () => {
    // Límite general de modpacks que trae la consulta (para performance)
    const totalLimit = 100;

    const modpacks = await client.query.ModpacksTable.findMany({
        where: not(eq(ModpacksTable.visibility, "private")),
        columns: {
            password: false,
            publisherId: false,
            creatorUserId: false,
        },
        with: {
            creatorUser: {
                columns: {
                    username: true,
                    avatarUrl: true,
                }
            },
            publisher: {
                columns: {
                    id: true,
                    publisherName: true,
                    verified: true,
                    partnered: true,
                    isHostingPartner: true
                }
            },
            categories: {
                columns: {
                    modpackId: false,
                    categoryId: false,
                    id: false,
                },
                with: {
                    category: {
                        columns: {
                            id: true,
                            name: true,
                            shortDescription: true,
                        }
                    }
                }
            },
        },
        orderBy: asc(ModpacksTable.name),
        limit: totalLimit
    });

    const categories = modpacks.reduce((acc, modpack) => {
        const relatedCategories = modpack.categories.map(c => c.category);
        const { categories, ...cleanModpack } = modpack;

        if (relatedCategories.length === 0) {
            const uncategorizedId = "uncategorized";
            if (!acc[uncategorizedId]) {
                acc[uncategorizedId] = {
                    id: uncategorizedId,
                    name: "Sin categoría",
                    modpacks: [],
                };
            }
            if (acc[uncategorizedId].modpacks.length < 10) {
                acc[uncategorizedId].modpacks.push(cleanModpack);
            }
        } else {
            relatedCategories.forEach((category) => {
                if (!acc[category.id]) {
                    acc[category.id] = {
                        id: category.id,
                        name: category.name,
                        shortDescription: category.shortDescription,
                        modpacks: [],
                    };
                }
                if (acc[category.id].modpacks.length < 10) {
                    acc[category.id].modpacks.push(cleanModpack);
                }
            });
        }

        return acc;
    }, {} as Record<string, any>);

    const categoriesArray = Object.values(categories);

    categoriesArray.sort((a, b) => a.name.localeCompare(b.name));
    categoriesArray.forEach((category) => {
        category.modpacks.sort((a: any, b: any) => a.name.localeCompare(b.name));
    });

    return categoriesArray;
};


export const searchModpacks = async (query: string, limit = 25) => {
    const modpacks = await client.query.ModpacksTable.findMany({
        where: and(
            not(eq(ModpacksTable.visibility, "private")),
            ilike(ModpacksTable.name, `%${query}%`)
        ),
        columns: {
            password: false,
            publisherId: false,
            creatorUserId: false,
        },
        with: {
            creatorUser: {
                columns: {
                    username: true,
                    avatarUrl: true,
                }
            },
            publisher: {
                columns: {
                    id: true,
                    publisherName: true,
                    verified: true,
                    partnered: true,
                    isHostingPartner: true
                }
            },
            categories: {
                columns: {
                    modpackId: false,
                    categoryId: false,
                    id: false,
                },
                with: {
                    category: {
                        columns: {
                            id: true,
                            name: true,
                            shortDescription: true,
                        }
                    }
                }
            },
        },
        orderBy: asc(ModpacksTable.name),
        limit
    })

    // Here we don't need to group by categories, since we are searching by name
    // and we are not interested in the categories of the modpacks

    // We just return the modpacks found

    return modpacks.map(modpack => {
        const { categories, ...cleanModpack } = modpack
        return cleanModpack
    })
}

export const getModpackById = async (modpackId: string) => {
    const modpackData = await client.query.ModpacksTable.findFirst({
        where: eq(ModpacksTable.id, modpackId),
        columns: {
            publisherId: false,
            creatorUserId: false,
        },
        with: {
            creatorUser: {
                columns: {
                    username: true,
                    avatarUrl: true,
                }
            },
            publisher: {
                columns: {
                    id: true,
                    publisherName: true,
                    verified: true,
                    partnered: true,
                    isHostingPartner: true
                }
            },
            categories: {
                columns: {
                    modpackId: false,
                    categoryId: false,
                    id: false,
                },
                with: {
                    category: {
                        columns: {
                            id: true,
                            name: true,
                            shortDescription: true,
                        }
                    }
                }
            },
        },
    })

    if (!modpackData) return null

    // Extraer categorías y resto de datos del modpack
    const { categories, password, ...cleanModpackData } = modpackData

    // Transformar las categorías para mantener solo la información de cada categoría
    const formattedCategories = categories.map(item => item.category)

    // Construir el resultado con las categorías transformadas y un flag para password
    return {
        ...cleanModpackData,
        categories: formattedCategories,
        isPasswordProtected: Boolean(password)
    }
}