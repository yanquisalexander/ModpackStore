import { Modpack } from "@/entities/Modpack";
import { ModpackStatus, ModpackVisibility } from "@/types/enums";


// Define types for cleaner code, especially for results of queries
type ModpackForExplore = {
    id: string;
    name: string;
    shortDescription?: string | null;
    description?: string | null;
    slug: string;
    iconUrl?: string;
    bannerUrl?: string;
    trailerUrl?: string;
    visibility: ModpackVisibility;
    status: ModpackStatus;
    createdAt: Date;
    updatedAt: Date;
    showUserAsPublisher: boolean;
    creatorUser: { username: string | null; avatarUrl: string | null } | null;
    publisher: { id: string; publisherName: string; verified: boolean; partnered: boolean; isHostingPartner: boolean } | null;
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

        const fetchedModpacks = await Modpack.find({
            where: {
                visibility: ModpackVisibility.PUBLIC,
                status: ModpackStatus.PUBLISHED
            },
            relations: ["creatorUser", "publisher", "categories", "categories.category"],
            take: totalLimit,
            order: { name: "ASC" },
        });

        const groupedByCategory: Record<string, GroupedModpackResult> = fetchedModpacks.reduce(
            (acc, modpack) => {
                const modpackDataToStore: ModpackForExplore = {
                    id: modpack.id,
                    name: modpack.name,
                    shortDescription: modpack.shortDescription,
                    description: modpack.description,
                    slug: modpack.slug,
                    iconUrl: modpack.iconUrl,
                    bannerUrl: modpack.bannerUrl,
                    trailerUrl: modpack.trailerUrl,
                    visibility: modpack.visibility,
                    status: modpack.status,
                    createdAt: modpack.createdAt,
                    updatedAt: modpack.updatedAt,
                    showUserAsPublisher: modpack.showUserAsPublisher,
                    creatorUser: modpack.creatorUser ? {
                        username: modpack.creatorUser.username,
                        avatarUrl: modpack.creatorUser.avatarUrl ?? null
                    } : null,
                    publisher: modpack.publisher ? {
                        id: modpack.publisher.id,
                        publisherName: modpack.publisher.publisherName,
                        verified: modpack.publisher.verified,
                        partnered: modpack.publisher.partnered,
                        isHostingPartner: modpack.publisher.isHostingPartner
                    } : null,
                };

                if (!modpack.categories || modpack.categories.length === 0) {
                    const uncategorizedId = "uncategorized";
                    if (!acc[uncategorizedId]) {
                        acc[uncategorizedId] = {
                            id: uncategorizedId,
                            name: "Uncategorized",
                            modpacks: [],
                        };
                    }
                    if (acc[uncategorizedId].modpacks.length < 10) {
                        acc[uncategorizedId].modpacks.push(modpackDataToStore);
                    }
                } else {
                    modpack.categories.forEach((modpackCategory) => {
                        const category = modpackCategory.category;
                        if (!acc[category.id]) {
                            acc[category.id] = {
                                id: category.id,
                                name: category.name,
                                shortDescription: category.shortDescription,
                                modpacks: [],
                            };
                        }
                        if (acc[category.id].modpacks.length < 10) {
                            acc[category.id].modpacks.push(modpackDataToStore);
                        }
                    });
                }
                return acc;
            },
            {} as Record<string, GroupedModpackResult>
        );

        const categoriesArray = Object.values(groupedByCategory);
        categoriesArray.sort((a, b) => a.name.localeCompare(b.name));
        categoriesArray.forEach((category) => {
            category.modpacks.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        });

        console.log(
            `[SERVICE_MODPACKS] Processed ${categoriesArray.length} categories for explore page.`
        );
        return categoriesArray;
    } catch (error: any) {
        console.error("[SERVICE_MODPACKS] Error in getExploreModpacks:", error);
        throw new Error(`Failed to fetch explore modpacks: ${error.message}`);
    }
};

export const searchModpacks = async (query: string, limit = 25): Promise<ModpackForExplore[]> => {
    console.log(`[SERVICE_MODPACKS] Searching modpacks with query: "${query}"`);
    try {
        const modpacks = await Modpack.search(query, limit);

        console.log(`[SERVICE_MODPACKS] Found ${modpacks.length} modpacks for query "${query}".`);

        return modpacks.map(modpack => ({
            id: modpack.id,
            name: modpack.name,
            shortDescription: modpack.shortDescription,
            description: modpack.description,
            slug: modpack.slug,
            iconUrl: modpack.iconUrl,
            bannerUrl: modpack.bannerUrl,
            trailerUrl: modpack.trailerUrl,
            visibility: modpack.visibility,
            status: modpack.status,
            createdAt: modpack.createdAt,
            updatedAt: modpack.updatedAt,
            showUserAsPublisher: modpack.showUserAsPublisher,
            creatorUser: modpack.creatorUser ? {
                username: modpack.creatorUser.username,
                avatarUrl: modpack.creatorUser.avatarUrl ?? null
            } : null,
            publisher: modpack.publisher ? {
                id: modpack.publisher.id,
                publisherName: modpack.publisher.publisherName,
                verified: modpack.publisher.verified,
                partnered: modpack.publisher.partnered,
                isHostingPartner: modpack.publisher.isHostingPartner
            } : null,
        }));
    } catch (error: any) {
        console.error(`[SERVICE_MODPACKS] Error in searchModpacks for query "${query}":`, error);
        throw new Error(`Failed to search modpacks: ${error.message}`);
    }
};

// Define a more specific return type for getModpackById
type ModpackDetails = {
    id: string;
    name: string;
    shortDescription?: string | null;
    description?: string | null;
    slug: string;
    iconUrl?: string;
    bannerUrl?: string;
    trailerUrl?: string;
    visibility: ModpackVisibility;
    status: ModpackStatus;
    createdAt: Date;
    updatedAt: Date;
    showUserAsPublisher: boolean;
    creatorUser: { username: string | null; avatarUrl: string | null } | null;
    publisher: { id: string; publisherName: string; verified: boolean; partnered: boolean; isHostingPartner: boolean } | null;
    categories: CategoryInModpack[];
    isPasswordProtected: boolean;
};

export const getModpackById = async (modpackId: string): Promise<ModpackDetails | null> => {
    console.log(`[SERVICE_MODPACKS] Fetching modpack by ID: ${modpackId}`);
    try {
        const modpack = await Modpack.findOne({
            where: { id: modpackId },
            relations: ["creatorUser", "publisher", "categories", "categories.category"],
        });

        if (!modpack) {
            console.log(`[SERVICE_MODPACKS] Modpack with ID ${modpackId} not found.`);
            return null;
        }

        const formattedCategories = modpack.categories?.map(modpackCategory => ({
            id: modpackCategory.category.id,
            name: modpackCategory.category.name,
            shortDescription: modpackCategory.category.shortDescription ?? null,
        })) || [];

        console.log(`[SERVICE_MODPACKS] Modpack ID ${modpackId} found.`);
        return {
            id: modpack.id,
            name: modpack.name,
            shortDescription: modpack.shortDescription,
            description: modpack.description,
            slug: modpack.slug,
            iconUrl: modpack.iconUrl,
            bannerUrl: modpack.bannerUrl,
            trailerUrl: modpack.trailerUrl,
            visibility: modpack.visibility,
            status: modpack.status,
            createdAt: modpack.createdAt,
            updatedAt: modpack.updatedAt,
            showUserAsPublisher: modpack.showUserAsPublisher,
            creatorUser: modpack.creatorUser ? {
                username: modpack.creatorUser.username,
                avatarUrl: modpack.creatorUser.avatarUrl ?? null
            } : null,
            publisher: modpack.publisher ? {
                id: modpack.publisher.id,
                publisherName: modpack.publisher.publisherName,
                verified: modpack.publisher.verified,
                partnered: modpack.publisher.partnered,
                isHostingPartner: modpack.publisher.isHostingPartner
            } : null,
            categories: formattedCategories,
            isPasswordProtected: modpack.isPasswordProtected(),
        };
    } catch (error: any) {
        console.error(`[SERVICE_MODPACKS] Error in getModpackById for ID ${modpackId}:`, error);
        throw new Error(`Failed to fetch modpack (ID: ${modpackId}): ${error.message}`);
    }
};