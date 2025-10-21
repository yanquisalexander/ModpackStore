import { Modpack } from "@/entities/Modpack";
import { ModpackStatus, ModpackVisibility } from "@/types/enums";
import { CategoryService } from "./category.service";


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
    featured: boolean;
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
    displayOrder?: number;
    modpacks: ModpackForExplore[];
};

export const getExploreModpacks = async (): Promise<GroupedModpackResult[]> => {
    console.log("[SERVICE_MODPACKS] Fetching modpacks for explore page.");
    try {
        const totalLimit = 100; // Limit for the initial fetch

        // Initialize category service and ensure default categories exist
        const categoryService = new CategoryService();
        await categoryService.ensureDefaultCategories();

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
                    featured: modpack.featured,
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
                            displayOrder: 999,
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
                                displayOrder: category.displayOrder,
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
        categoriesArray.sort((a, b) => {
            // First try to sort by displayOrder if available
            const aOrder = a.displayOrder ?? 999;
            const bOrder = b.displayOrder ?? 999;
            if (aOrder !== bOrder) {
                return aOrder - bOrder;
            }
            // Fallback to name sorting
            return a.name.localeCompare(b.name);
        });

        console.log('Categories with displayOrder:', categoriesArray.map(c => ({ name: c.name, displayOrder: c.displayOrder })));
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

export const searchModpacks = async (query: string, limit = 25, user?: any): Promise<ModpackForExplore[]> => {
    console.log(`[SERVICE_MODPACKS] Searching modpacks with query: "${query}"`);
    
    // Check if query is a UUID (direct ID search)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUUID = uuidPattern.test(query);
    
    if (isUUID) {
        // Direct ID search with permission handling
        try {
            const modpack = await Modpack.findOne({
                where: { id: query },
                relations: ["creatorUser", "publisher", "categories", "categories.category"],
            });
            
            if (!modpack) {
                console.log(`[SERVICE_MODPACKS] Modpack with ID ${query} not found.`);
                return [];
            }
            
            // Permission checks based on modpack status and visibility
            if (modpack.status === ModpackStatus.DRAFT) {
                // Draft: only accessible to creator, admins, or team members
                if (!user) {
                    console.log(`[SERVICE_MODPACKS] Draft modpack ${query} requires authentication.`);
                    return [];
                }
                
                // Check if user is creator
                if (modpack.creatorUserId === user.id) {
                    console.log(`[SERVICE_MODPACKS] User is creator of draft modpack ${query}.`);
                } else {
                    // Check if user is admin
                    const isAdmin = user.role === 'admin' || user.role === 'superadmin';
                    if (!isAdmin) {
                        // Check if user is team member with access
                        const hasTeamAccess = await user.getRoleInPublisher(modpack.publisherId);
                        if (!hasTeamAccess) {
                            console.log(`[SERVICE_MODPACKS] User does not have access to draft modpack ${query}.`);
                            return [];
                        }
                    }
                }
            } else if (modpack.status === ModpackStatus.PUBLISHED) {
                // Published modpack with private visibility: accessible to anyone with the ID
                if (modpack.visibility === ModpackVisibility.PRIVATE) {
                    console.log(`[SERVICE_MODPACKS] Private published modpack ${query} accessible via ID.`);
                } else if (modpack.visibility !== ModpackVisibility.PUBLIC) {
                    // Other visibility restrictions still apply (e.g., PATREON)
                    console.log(`[SERVICE_MODPACKS] Modpack ${query} has visibility: ${modpack.visibility}.`);
                }
            } else {
                // Archived or deleted modpacks not accessible via search
                console.log(`[SERVICE_MODPACKS] Modpack ${query} has status: ${modpack.status} and is not searchable.`);
                return [];
            }
            
            // Return the modpack
            return [{
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
                featured: modpack.featured,
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
            }];
        } catch (error: any) {
            console.error(`[SERVICE_MODPACKS] Error in ID-based search for query "${query}":`, error);
            throw new Error(`Failed to search modpack by ID: ${error.message}`);
        }
    }
    
    // Regular text search (existing logic)
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
            featured: modpack.featured,
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
    prelaunchAppearance?: any;
    requiredTwitchChannels: string[];
    requiresTwitchSubscription: boolean;
};

export const getModpackById = async (modpackId: string, user?: any): Promise<ModpackDetails | null> => {
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

        // Permission checks based on modpack status and visibility
        if (modpack.status === ModpackStatus.DRAFT) {
            // Draft: only accessible to creator, admins, or team members
            if (!user) {
                console.log(`[SERVICE_MODPACKS] Draft modpack ${modpackId} requires authentication.`);
                return null;
            }
            
            // Check if user is creator
            if (modpack.creatorUserId === user.id) {
                console.log(`[SERVICE_MODPACKS] User is creator of draft modpack ${modpackId}.`);
            } else {
                // Check if user is admin
                const isAdmin = user.role === 'admin' || user.role === 'superadmin';
                if (!isAdmin) {
                    // Check if user is team member with access
                    const hasTeamAccess = await user.getRoleInPublisher(modpack.publisherId);
                    if (!hasTeamAccess) {
                        console.log(`[SERVICE_MODPACKS] User does not have access to draft modpack ${modpackId}.`);
                        return null;
                    }
                }
            }
        } else if (modpack.status === ModpackStatus.PUBLISHED) {
            // Published modpack with private visibility: accessible to anyone
            if (modpack.visibility === ModpackVisibility.PRIVATE) {
                console.log(`[SERVICE_MODPACKS] Private published modpack ${modpackId} accessible.`);
            } else if (modpack.visibility !== ModpackVisibility.PUBLIC) {
                // Other visibility restrictions still apply (e.g., PATREON)
                console.log(`[SERVICE_MODPACKS] Modpack ${modpackId} has visibility: ${modpack.visibility}.`);
            }
        } else if (modpack.status === ModpackStatus.ARCHIVED || modpack.status === ModpackStatus.DELETED) {
            // Archived or deleted modpacks not accessible
            console.log(`[SERVICE_MODPACKS] Modpack ${modpackId} has status: ${modpack.status} and is not accessible.`);
            return null;
        }

        const formattedCategories = modpack.categories?.map(modpackCategory => ({
            id: modpackCategory.category.id,
            name: modpackCategory.category.name,
            shortDescription: modpackCategory.category.shortDescription ?? null,
        })) || [];

        console.log(`[SERVICE_MODPACKS] Modpack ID ${modpackId} found and accessible.`);
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
            prelaunchAppearance: modpack.prelaunchAppearance,
            requiredTwitchChannels: modpack.getRequiredTwitchCreatorIds(),
            requiresTwitchSubscription: modpack.requiresTwitchSubscription,
        };
    } catch (error: any) {
        console.error(`[SERVICE_MODPACKS] Error in getModpackById for ID ${modpackId}:`, error);
        throw new Error(`Failed to fetch modpack (ID: ${modpackId}): ${error.message}`);
    }
};

export const getFeaturedModpacks = async (): Promise<ModpackForExplore[]> => {
    console.log("[SERVICE_MODPACKS] Fetching featured modpacks.");
    try {
        const featuredModpacks = await Modpack.find({
            where: {
                visibility: ModpackVisibility.PUBLIC,
                status: ModpackStatus.PUBLISHED,
                featured: true
            },
            relations: ["creatorUser", "publisher"],
            take: 20, // Limit to 20 featured modpacks
            order: { updatedAt: "DESC" }, // Most recently updated first
        });

        return featuredModpacks.map(modpack => ({
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
            featured: modpack.featured,
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
        console.error("[SERVICE_MODPACKS] Error in getFeaturedModpacks:", error);
        throw new Error(`Failed to fetch featured modpacks: ${error.message}`);
    }
};