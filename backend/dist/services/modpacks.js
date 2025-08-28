"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModpackById = exports.searchModpacks = exports.getExploreModpacks = void 0;
const client_1 = require("@/db/client");
const schema_1 = require("@/db/schema"); // Added CategoriesTable for types
const drizzle_orm_1 = require("drizzle-orm");
const getExploreModpacks = () => __awaiter(void 0, void 0, void 0, function* () {
    console.log("[SERVICE_MODPACKS] Fetching modpacks for explore page.");
    try {
        const totalLimit = 100; // Limit for the initial fetch
        const fetchedModpacks = yield client_1.client.query.ModpacksTable.findMany({
            where: (0, drizzle_orm_1.not)((0, drizzle_orm_1.eq)(schema_1.ModpacksTable.visibility, "private")),
            columns: {
                id: true, name: true, shortDescription: true, description: true, slug: true,
                iconUrl: true, bannerUrl: true, trailerUrl: true, visibility: true, status: true,
                createdAt: true, updatedAt: true, showUserAsPublisher: true
                // Excluded: password, publisherId, creatorUserId (fetched via relations if needed for context)
            },
            with: {
                creatorUser: { columns: { username: true, avatarUrl: true } },
                publisher: { columns: { id: true, publisherName: true, verified: true, partnered: true, isHostingPartner: true } },
                categories: {
                    columns: { /* No columns needed from the join table itself */},
                    with: { category: { columns: { id: true, name: true, shortDescription: true } } }
                }
            },
            orderBy: (0, drizzle_orm_1.asc)(schema_1.ModpacksTable.name), // Initial sort, might be re-sorted after grouping
            limit: totalLimit
        });
        // Type assertion for the result of the query, if needed, or map explicitly
        const modpacksWithTypedCategories = fetchedModpacks.map(mp => (Object.assign(Object.assign({}, mp), { categories: mp.categories.map(c => c.category) // Ensure category is properly typed
         })));
        const groupedByCategory = modpacksWithTypedCategories.reduce((acc, modpack) => {
            const { categories: modpackCategories } = modpack, cleanModpack = __rest(modpack, ["categories"]); // `categories` here is the array of CategoryInModpack
            const modpackDataToStore = cleanModpack;
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
            }
            else {
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
        }, {});
        const categoriesArray = Object.values(groupedByCategory);
        categoriesArray.sort((a, b) => a.name.localeCompare(b.name));
        categoriesArray.forEach((category) => {
            category.modpacks.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        });
        console.log(`[SERVICE_MODPACKS] Processed ${categoriesArray.length} categories for explore page.`);
        return categoriesArray;
    }
    catch (error) {
        console.error("[SERVICE_MODPACKS] Error in getExploreModpacks:", error);
        // It's often better to throw a custom service error or the original error for controller to handle
        throw new Error(`Failed to fetch explore modpacks: ${error.message}`);
    }
});
exports.getExploreModpacks = getExploreModpacks;
const searchModpacks = (query_1, ...args_1) => __awaiter(void 0, [query_1, ...args_1], void 0, function* (query, limit = 25) {
    console.log(`[SERVICE_MODPACKS] Searching modpacks with query: "${query}"`);
    try {
        const modpacks = yield client_1.client.query.ModpacksTable.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.not)((0, drizzle_orm_1.eq)(schema_1.ModpacksTable.visibility, "private")), (0, drizzle_orm_1.ilike)(schema_1.ModpacksTable.name, `%${query}%`)),
            columns: {
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
            orderBy: (0, drizzle_orm_1.asc)(schema_1.ModpacksTable.name),
            limit
        });
        console.log(`[SERVICE_MODPACKS] Found ${modpacks.length} modpacks for query "${query}".`);
        // El id ya está incluido en cleanModpack
        return modpacks.map(modpack => {
            const { categories } = modpack, cleanModpack = __rest(modpack, ["categories"]);
            return Object.assign(Object.assign({}, cleanModpack), { id: modpack.id, categories: categories ? categories.map((c) => c.category) : [] });
        });
    }
    catch (error) {
        console.error(`[SERVICE_MODPACKS] Error in searchModpacks for query "${query}":`, error);
        throw new Error(`Failed to search modpacks: ${error.message}`);
    }
});
exports.searchModpacks = searchModpacks;
const getModpackById = (modpackId) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`[SERVICE_MODPACKS] Fetching modpack by ID: ${modpackId}`);
    try {
        const modpackData = yield client_1.client.query.ModpacksTable.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_1.ModpacksTable.id, modpackId),
            columns: {
                id: true, name: true, shortDescription: true, description: true, slug: true,
                iconUrl: true, bannerUrl: true, trailerUrl: true, visibility: true, status: true,
                createdAt: true, updatedAt: true, showUserAsPublisher: true, password: true // Need password to determine isPasswordProtected
            },
            with: {
                creatorUser: { columns: { username: true, avatarUrl: true } },
                publisher: { columns: { id: true, publisherName: true, verified: true, partnered: true, isHostingPartner: true } },
                categories: {
                    columns: { /* No columns from join table */},
                    with: { category: { columns: { id: true, name: true, shortDescription: true } } }
                }
            },
        });
        if (!modpackData) {
            console.log(`[SERVICE_MODPACKS] Modpack with ID ${modpackId} not found.`);
            return null;
        }
        const { categories, password } = modpackData, cleanModpackData = __rest(modpackData, ["categories", "password"]);
        const formattedCategories = categories.map(item => item.category);
        console.log(`[SERVICE_MODPACKS] Modpack ID ${modpackId} found.`);
        return Object.assign(Object.assign({}, cleanModpackData), { categories: formattedCategories, isPasswordProtected: Boolean(password) // Expose only boolean flag
         });
    }
    catch (error) {
        console.error(`[SERVICE_MODPACKS] Error in getModpackById for ID ${modpackId}:`, error);
        throw new Error(`Failed to fetch modpack (ID: ${modpackId}): ${error.message}`);
    }
});
exports.getModpackById = getModpackById;
