import { client } from "@/db/client";
import { ModpacksTable, CategoriesTable } from "@/db/schema"; // Added CategoriesTable for types
import { and, asc, eq, ilike, not } from "drizzle-orm";

// TODO: Replace console.log with a dedicated logger solution throughout the service.

// Define types for cleaner code, especially for results of queries
type ModpackForExplore = Omit<typeof ModpacksTable.$inferSelect, "password" | "publisherId" | "creatorUserId"> & {
    creatorUser: { username: string | null; avatarUrl: string | null } | null;
    publisher: { id: string; publisherName: string; verified: boolean; partnered: boolean; isHostingPartner: boolean } | null;
    // categories property is processed and removed before final output in getExploreModpacks
};

type CategoryInModpack = {
    id: string;
    name: string;
    shortDescription: string | null;
};

type GroupedModpackResult = {
    id: string;
    name: string;
    shortDescription?: string | null;
    modpacks: ModpackForExplore[];
};


export const getExploreModpacks = async (): Promise<GroupedModpackResult[]> => {
    console.log("[SERVICE_MODPACKS] Fetching modpacks for explore page.");
    try {
        const totalLimit = 100; // Limit for the initial fetch

        const fetchedModpacks = await client.query.ModpacksTable.findMany({
            where: not(eq(ModpacksTable.visibility, "private")),
            columns: { // Explicitly list all needed columns, exclude sensitive ones
                id: true, name: true, shortDescription: true, description: true, slug: true,
                iconUrl: true, bannerUrl: true, trailerUrl: true, visibility: true, status: true,
                createdAt: true, updatedAt: true, showUserAsPublisher: true
                // Excluded: password, publisherId, creatorUserId (fetched via relations if needed for context)
            },
            with: {
                creatorUser: { columns: { username: true, avatarUrl: true } },
                publisher: { columns: { id: true, publisherName: true, verified: true, partnered: true, isHostingPartner: true } },
                categories: {
                    columns: { /* No columns needed from the join table itself */ },
                    with: { category: { columns: { id: true, name: true, shortDescription: true } } }
                }
            },
            orderBy: asc(ModpacksTable.name), // Initial sort, might be re-sorted after grouping
            limit: totalLimit
        });

        // Type assertion for the result of the query, if needed, or map explicitly
        const modpacksWithTypedCategories = fetchedModpacks.map(mp => ({
            ...mp,
            categories: mp.categories.map(c => c.category) as CategoryInModpack[] // Ensure category is properly typed
        }));

        const groupedByCategory: Record<string, GroupedModpackResult> = modpacksWithTypedCategories.reduce(
            (acc, modpack) => {
                const { categories: modpackCategories, ...cleanModpack } = modpack; // `categories` here is the array of CategoryInModpack
                const modpackDataToStore: ModpackForExplore = cleanModpack;

                if (!modpackCategories || modpackCategories.length === 0) {
                    const uncategorizedId = "uncategorized";
                    if (!acc[uncategorizedId]) {
                        acc[uncategorizedId] = {
                            id: uncategorizedId, name: "Uncategorized", modpacks: [],
                        };
                    }
                    if (acc[uncategorizedId].modpacks.length < 10) {
                        acc[uncategorizedId].modpacks.push(modpackDataToStore);
                    }
                } else {
                    modpackCategories.forEach((category) => {
                        if (!acc[category.id]) {
                            acc[category.id] = {
                                id: category.id, name: category.name, shortDescription: category.shortDescription, modpacks: [],
                            };
                        }
                        if (acc[category.id].modpacks.length < 10) {
                            acc[category.id].modpacks.push(modpackDataToStore);
                        }
                    });
                }
                return acc;
            }, {} as Record<string, GroupedModpackResult>);

        const categoriesArray = Object.values(groupedByCategory);
        categoriesArray.sort((a, b) => a.name.localeCompare(b.name));
        categoriesArray.forEach((category) => {
            category.modpacks.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        });

        console.log(`[SERVICE_MODPACKS] Processed ${categoriesArray.length} categories for explore page.`);
        return categoriesArray;
    } catch (error: any) {
        console.error("[SERVICE_MODPACKS] Error in getExploreModpacks:", error);
        // It's often better to throw a custom service error or the original error for controller to handle
        throw new Error(`Failed to fetch explore modpacks: ${error.message}`);
    }
};

export const searchModpacks = async (query: string, limit = 25): Promise<ModpackForExplore[]> => {
    console.log(`[SERVICE_MODPACKS] Searching modpacks with query: "${query}"`);
    try {
        const modpacks = await client.query.ModpacksTable.findMany({
            where: and(
                not(eq(ModpacksTable.visibility, "private")),
                ilike(ModpacksTable.name, `%${query}%`)
            ),
            columns: { // Asegúrate de incluir el id aquí
                id: true, name: true, shortDescription: true, description: true, slug: true,
                iconUrl: true, bannerUrl: true, trailerUrl: true, visibility: true, status: true,
                createdAt: true, updatedAt: true, showUserAsPublisher: true
            },
            with: {
                creatorUser: { columns: { username: true, avatarUrl: true } },
                publisher: { columns: { id: true, publisherName: true, verified: true, partnered: true, isHostingPartner: true } },
                categories: {
                    columns: {},
                    with: { category: { columns: { id: true, name: true } } }
                }
            },
            orderBy: asc(ModpacksTable.name),
            limit
        });

        console.log(`[SERVICE_MODPACKS] Found ${modpacks.length} modpacks for query "${query}".`);
        // El id ya está incluido en cleanModpack
        return modpacks.map(modpack => {
            const { categories, ...cleanModpack } = modpack;
            return {
                ...cleanModpack,
                id: modpack.id, // asegurar que id siempre esté presente
                categories: categories ? categories.map((c: any) => c.category) : []
            } as ModpackForExplore;
        });
    } catch (error: any) {
        console.error(`[SERVICE_MODPACKS] Error in searchModpacks for query "${query}":`, error);
        throw new Error(`Failed to search modpacks: ${error.message}`);
    }
};

// Define a more specific return type for getModpackById
type ModpackDetails = Omit<typeof ModpacksTable.$inferSelect, "publisherId" | "creatorUserId" | "categories" | "password"> & {
    creatorUser: { username: string | null; avatarUrl: string | null } | null;
    publisher: { id: string; publisherName: string; verified: boolean; partnered: boolean; isHostingPartner: boolean } | null;
    categories: CategoryInModpack[];
    isPasswordProtected: boolean;
};

export const getModpackById = async (modpackId: string): Promise<ModpackDetails | null> => {
    console.log(`[SERVICE_MODPACKS] Fetching modpack by ID: ${modpackId}`);
    try {
        const modpackData = await client.query.ModpacksTable.findFirst({
            where: eq(ModpacksTable.id, modpackId),
            columns: { // Explicitly list columns, exclude sensitive ones not handled later
                id: true, name: true, shortDescription: true, description: true, slug: true,
                iconUrl: true, bannerUrl: true, trailerUrl: true, visibility: true, status: true,
                createdAt: true, updatedAt: true, showUserAsPublisher: true, password: true // Need password to determine isPasswordProtected
            },
            with: {
                creatorUser: { columns: { username: true, avatarUrl: true } },
                publisher: { columns: { id: true, publisherName: true, verified: true, partnered: true, isHostingPartner: true } },
                categories: {
                    columns: { /* No columns from join table */ },
                    with: { category: { columns: { id: true, name: true, shortDescription: true } } }
                }
            },
        });

        if (!modpackData) {
            console.log(`[SERVICE_MODPACKS] Modpack with ID ${modpackId} not found.`);
            return null;
        }

        const { categories, password, ...cleanModpackData } = modpackData;
        const formattedCategories = categories.map(item => item.category as CategoryInModpack);

        console.log(`[SERVICE_MODPACKS] Modpack ID ${modpackId} found.`);
        return {
            ...cleanModpackData,
            categories: formattedCategories,
            isPasswordProtected: Boolean(password) // Expose only boolean flag
        };
    } catch (error: any) {
        console.error(`[SERVICE_MODPACKS] Error in getModpackById for ID ${modpackId}:`, error);
        throw new Error(`Failed to fetch modpack (ID: ${modpackId}): ${error.message}`);
    }
};