import {
    boolean,
    pgTable,
    uuid,
    varchar,
    timestamp,
    text,
    jsonb,
    pgEnum,
    primaryKey,
    numeric,
    uniqueIndex,
    serial,
    integer,
    bigint
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm";


export enum UserRole {
    USER = "user",
    ADMIN = "admin",
    SUPER_ADMIN = "super_admin",
    SYSTEM = "system",
}

export enum CreatorStatus {
    PENDING = "pending",
    APPROVED = "approved",
    REJECTED = "rejected",
}

export enum CreatorRole {
    OWNER = "owner",
    ADMIN = "admin",
    MEMBER = "member",
}

export enum ModpackVisibility {
    PUBLIC = "public",
    PRIVATE = "private",
    WHITELIST = "whitelist",
}

export enum ModpackStatus {
    DRAFT = "draft",
    PUBLISHED = "published",
    ARCHIVED = "archived",
}

export enum ModLoaderType {
    VANILLA = 'vanilla',
    FORGE = 'forge',
    FABRIC = 'fabric',
    NEOFORGE = 'neoforge',
    QUILT = 'quilt'
}

export type ModpackFileType = 'mods' | 'resourcepacks' | 'config' | 'shaderpacks' | 'datapacks' | 'extras';
export type ModpackFileSide = 'client' | 'server' | 'both';

export enum AcquisitionMethod {
    FREE = "free",
    PASSWORD = "password",
    TWITCH_SUB = "twitch_sub",
}

export enum AcquisitionStatus {
    ACTIVE = "active",
    REVOKED = "revoked",
    SUSPENDED = "suspended",
}

export enum ProcessingJobStatus {
    PENDING = "pending",
    PROCESSING = "processing",
    COMPLETED = "completed",
    FAILED = "failed",
}

export enum AdType {
    HOUSE = "house",
    CREATOR_MODPACK = "creator_modpack",
    CREATOR_PROFILE = "creator_profile",
    EXTERNAL_SPONSOR = "external_sponsor",
}

export enum AdPlacement {
    HERO_CAROUSEL = "hero_carousel",
    EXPLORE_BANNER = "explore_banner",
    MODPACK_SIDEBAR = "modpack_sidebar",
    SERVER_SPONSOR = "server_sponsor",
}

export enum AdStatus {
    DRAFT = "draft",
    PENDING_APPROVAL = "pending_approval",
    ACTIVE = "active",
    PAUSED = "paused",
    COMPLETED = "completed",
    REJECTED = "rejected",
}

export function enumToPgEnum<T extends Record<string, string>>(
    myEnum: T,
): [T[keyof T], ...T[keyof T][]] {
    return Object.values(myEnum) as [T[keyof T], ...T[keyof T][]]
}

export const roleEnum = pgEnum('role', enumToPgEnum(UserRole));
export const creatorStatusEnum = pgEnum('creator_status', enumToPgEnum(CreatorStatus));
export const creatorRoleEnum = pgEnum('creator_role', enumToPgEnum(CreatorRole));
export const modpackVisibilityEnum = pgEnum('modpack_visibility', enumToPgEnum(ModpackVisibility));
export const modpackStatusEnum = pgEnum('modpack_status', enumToPgEnum(ModpackStatus));
export const modLoaderTypeEnum = pgEnum('mod_loader_type', enumToPgEnum(ModLoaderType));
export const processingJobStatusEnum = pgEnum('processing_job_status', enumToPgEnum(ProcessingJobStatus));
export const adTypeEnum = pgEnum('ad_type', enumToPgEnum(AdType));
export const adPlacementEnum = pgEnum('ad_placement', enumToPgEnum(AdPlacement));
export const adStatusEnum = pgEnum('ad_status', enumToPgEnum(AdStatus));

export const users = pgTable("users", {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    username: varchar("username", { length: 32 }).notNull().unique(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    avatarUrl: text("avatar_url"),
    // Discord
    discordId: text("discord_id"),
    discordAccessToken: text("discord_access_token"),
    discordRefreshToken: text("discord_refresh_token"),
    // Patreon
    patreonId: text("patreon_id"),
    patreonAccessToken: text("patreon_access_token"),
    patreonRefreshToken: text("patreon_refresh_token"),
    // Twitch
    twitchId: text("twitch_id"),
    twitchAccessToken: text("twitch_access_token"),
    twitchRefreshToken: text("twitch_refresh_token"),
    twitchDisplayName: text("twitch_display_name"),
    twitchAvatarUrl: text("twitch_avatar_url"),
    role: roleEnum("role").notNull().default(UserRole.USER),
    isPlus: boolean("is_plus").notNull().default(false),
    adFree: boolean("ad_free").notNull().default(false),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userDevices = pgTable("user_devices", {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id").notNull(), // Modpack Store Client generates a unique device ID on first launch and registers it here
    deviceInfo: jsonb("device_info").notNull(), // Store some basic info about the device (OS, version, etc)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});


/* Modpacks */

export const modpackFilesTable = pgTable("modpack_files", {
    hash: text("hash").primaryKey().notNull(), // SHA1 in hex
    size: numeric("size").notNull(), // bytes
    mimeType: text("mime_type"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
});

export const modpacksTable = pgTable("modpacks", {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    name: varchar("name", { length: 64 }).notNull(),
    shortDescription: varchar("short_description", { length: 255 }).notNull(),
    description: text("description"),
    slug: text('slug').notNull().unique(),
    iconUrl: text('icon_url').notNull(),
    iconUrlResized: text('icon_url_resized'),
    bannerUrl: text('banner_url').notNull(),
    bannerUrlResized: text('banner_url_resized'),
    trailerUrl: text('trailer_url'),
    password: text('password'), // nullable
    prelaunchAppearance: jsonb('prelaunch_appearance'),
    visibility: modpackVisibilityEnum('visibility').notNull().default(ModpackVisibility.PRIVATE),
    creatorId: uuid('creator_id').references(() => creatorsTable.id).notNull(),
    showUserAsPublisher: boolean('show_user_as_publisher').default(false),
    creatorUserId: uuid('creator_user_id').references(() => users.id),
    status: modpackStatusEnum('status').notNull().default(ModpackStatus.DRAFT),
    acquisitionMethod: text('acquisition_method').notNull().default(AcquisitionMethod.FREE),
    requiresTwitchSubscription: boolean('requires_twitch_subscription').default(false),
    twitchCreatorIds: jsonb('twitch_creator_ids'),
    twitchChannels: jsonb('twitch_channels'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/* Categories */

export const categoriesTable = pgTable("categories", {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    shortDescription: varchar("short_description", { length: 200 }),
    description: text("description"),
    iconUrl: text("icon_url"),
    displayOrder: integer("display_order").notNull().default(0),
    isAdminOnly: boolean("is_admin_only").notNull().default(false),
    isSelectable: boolean("is_selectable").notNull().default(true),
    isAutomatic: boolean("is_automatic").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const modpackCategoriesTable = pgTable("modpack_categories", {
    id: serial("id").primaryKey(),
    modpackId: uuid("modpack_id").notNull().references(() => modpacksTable.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").notNull().references(() => categoriesTable.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
}, (table) => ({
    uniqueModpackCategory: uniqueIndex("uq_modpack_category").on(table.modpackId, table.categoryId),
}));

export const modpackVersionsTable = pgTable("modpack_versions", {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    modpackId: uuid("modpack_id").notNull().references(() => modpacksTable.id, { onDelete: "cascade" }),
    version: varchar("version", { length: 32 }).notNull(),
    mcVersion: varchar("mc_version", { length: 32 }).notNull(),
    loaderType: modLoaderTypeEnum("loader_type").notNull().default(ModLoaderType.VANILLA),
    loaderVersion: varchar("loader_version", { length: 32 }),
    changelog: text("changelog"),
    status: modpackStatusEnum("status").notNull().default(ModpackStatus.DRAFT),
    releaseDate: timestamp("release_date", { withTimezone: true }),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const modpackVersionFilesTable = pgTable("modpack_version_files", {
    fileHash: text("file_hash").notNull().references(() => modpackFilesTable.hash, { onDelete: "cascade" }),
    modpackVersionId: uuid("modpack_version_id").notNull().references(() => modpackVersionsTable.id, { onDelete: "cascade" }),
    path: text("path").notNull(), // e.g., "mods/jei.jar" inside the pack
    fileType: text("file_type").notNull(), // e.g., "mods", "resourcepacks", etc
    side: text("side").notNull().default('both'), // "client", "server", or "both"
}, (table) => ({
    pk: primaryKey({ columns: [table.fileHash, table.modpackVersionId, table.path] })
}));

export const modpackVersionProcessingJobsTable = pgTable("modpack_version_processing_jobs", {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    versionId: uuid("version_id").notNull().references(() => modpackVersionsTable.id, { onDelete: "cascade" }),
    fileType: text("file_type").notNull(),
    jobId: text("job_id").notNull().unique(),
    status: processingJobStatusEnum("status").notNull().default(ProcessingJobStatus.PENDING),
    progress: numeric("progress").notNull().default('0'),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Creators (a.k.a modpack authors / publishers)
// This is separate from users because not all users are creators

export const creatorsTable = pgTable("creators", {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    displayName: varchar("display_name", { length: 64 }).notNull(),
    slug: varchar("slug", { length: 64 }).notNull().unique(),
    bannerUrl: text("banner_url"),
    logoUrl: text("logo_url"),
    description: text("description"),
    discordUrl: text("discord_url"),
    status: creatorStatusEnum("status").notNull().default(CreatorStatus.PENDING),
    verified: boolean("verified").notNull().default(false),
    partner: boolean("partner").notNull().default(false),
    hostingPartner: boolean("hosting_partner").notNull().default(false),
    banned: boolean("banned").notNull().default(false),
    nameLastChangedAt: timestamp("name_last_changed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const creatorUsersTable = pgTable("creator_users", {
    creatorId: uuid("creator_id").notNull().references(() => creatorsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: creatorRoleEnum("role").notNull().default(CreatorRole.MEMBER),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
    pk: primaryKey({ columns: [table.creatorId, table.userId] })
}));

// Sistema de scopes granular - puede ser a nivel creator o modpack específico
export const permissionsTable = pgTable("permissions", {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

    // Scope target - solo uno debe estar presente
    creatorId: uuid("creator_id").references(() => creatorsTable.id, { onDelete: "cascade" }),
    modpackId: uuid("modpack_id").references(() => modpacksTable.id, { onDelete: "cascade" }),

    // Permisos específicos
    canCreateModpacks: boolean('can_create_modpacks').default(false),
    canEditModpacks: boolean('can_edit_modpacks').default(false),
    canDeleteModpacks: boolean('can_delete_modpacks').default(false),
    canPublishVersions: boolean('can_publish_versions').default(false),
    canManageMembers: boolean('can_manage_members').default(false),
    canManageSettings: boolean('can_manage_settings').default(false)
}, (table) => ({
    uniqueScope: uniqueIndex('unique_scope').on(table.userId, table.creatorId, table.modpackId)
}));


/* Acquisitions */

export const modpackAcquisitionsTable = pgTable("modpack_acquisitions", {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    modpackId: uuid("modpack_id").notNull().references(() => modpacksTable.id, { onDelete: "cascade" }),
    method: text("method").notNull(), // free | password | twitch_sub
    status: text("status").notNull().default(AcquisitionStatus.ACTIVE), // active | revoked | suspended
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
    uniqueUserModpack: uniqueIndex("uq_acq_user_modpack").on(table.userId, table.modpackId)
}));

/* Game Sessions (Yggdrasil) */

export const gameSessionsTable = pgTable("game_sessions", {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token").notNull().unique(),
    clientToken: text("client_token").notNull(),
    serverId: text("server_id"),
    ipAddress: text("ip_address"),
    requestedUsername: varchar("requested_username", { length: 64 }),
    minecraftUuid: text("minecraft_uuid"),
    lastActivity: timestamp("last_activity", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gameSessionsRelations = relations(gameSessionsTable, ({ one }) => ({
    user: one(users, {
        fields: [gameSessionsTable.userId],
        references: [users.id],
    }),
}));

/* Whitelist */

export const modpackWhitelistsTable = pgTable("modpack_whitelists", {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    modpackId: uuid("modpack_id").notNull().references(() => modpacksTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    addedByUserId: uuid("added_by_user_id").references(() => users.id),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
    uniqueUserModpack: uniqueIndex("uq_whitelist_user_modpack").on(table.modpackId, table.userId)
}));

/* Bans */

export const bansTable = pgTable("bans", {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    adminId: uuid("admin_id").notNull().references(() => users.id),
    reason: text("reason"),
    isActive: boolean("is_active").notNull().default(true),
    unbanDate: timestamp("unban_date", { withTimezone: true }),
    unbanAdminId: uuid("unban_admin_id").references(() => users.id),
    unbanReason: text("unban_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bansRelations = relations(bansTable, ({ one }) => ({
    user: one(users, {
        relationName: "user_bans",
        fields: [bansTable.userId],
        references: [users.id],
    }),
    admin: one(users, {
        relationName: "admin_bans",
        fields: [bansTable.adminId],
        references: [users.id],
    }),
    unbanAdmin: one(users, {
        relationName: "unban_admin_bans",
        fields: [bansTable.unbanAdminId],
        references: [users.id],
    }),
}));

/* Creator Storage */

export const creatorAssetsTable = pgTable("creator_assets", {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    creatorId: uuid("creator_id").notNull().references(() => creatorsTable.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    r2Key: text("r2_key").notNull().unique(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const creatorStorageConfigTable = pgTable("creator_storage_config", {
    creatorId: uuid("creator_id").primaryKey().notNull().references(() => creatorsTable.id, { onDelete: "cascade" }),
    storageLimitBytes: bigint("storage_limit_bytes", { mode: "number" }).notNull().default(31457280), // 30 MB
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* 
    Relationships
*/

export const creatorsRelations = relations(creatorsTable, ({ many }) => ({
    users: many(creatorUsersTable),
    modpacks: many(modpacksTable),
    assets: many(creatorAssetsTable),
}));

export const usersRelations = relations(users, ({ many }) => ({
    sessions: many(sessions),
    devices: many(userDevices),
    creatorMemberships: many(creatorUsersTable),
    permissions: many(permissionsTable),
    acquisitions: many(modpackAcquisitionsTable),
    whitelistEntries: many(modpackWhitelistsTable),
    bans: many(bansTable, { relationName: "user_bans" }),
    adminBans: many(bansTable, { relationName: "admin_bans" }),
    unbanAdminBans: many(bansTable, { relationName: "unban_admin_bans" }),
    gameSessions: many(gameSessionsTable),
}));

export const modpacksRelations = relations(modpacksTable, ({ one, many }) => ({
    creator: one(creatorsTable, {
        fields: [modpacksTable.creatorId],
        references: [creatorsTable.id],
    }),
    creatorUser: one(users, {
        fields: [modpacksTable.creatorUserId],
        references: [users.id],
    }),
    versions: many(modpackVersionsTable),
    acquisitions: many(modpackAcquisitionsTable),
    whitelists: many(modpackWhitelistsTable),
    categories: many(modpackCategoriesTable),
}));

export const categoriesRelations = relations(categoriesTable, ({ many }) => ({
    modpacks: many(modpackCategoriesTable),
}));

export const modpackCategoriesRelations = relations(modpackCategoriesTable, ({ one }) => ({
    modpack: one(modpacksTable, {
        fields: [modpackCategoriesTable.modpackId],
        references: [modpacksTable.id],
    }),
    category: one(categoriesTable, {
        fields: [modpackCategoriesTable.categoryId],
        references: [categoriesTable.id],
    }),
}));

export const modpackWhitelistsRelations = relations(modpackWhitelistsTable, ({ one }) => ({
    modpack: one(modpacksTable, {
        fields: [modpackWhitelistsTable.modpackId],
        references: [modpacksTable.id],
    }),
    user: one(users, {
        fields: [modpackWhitelistsTable.userId],
        references: [users.id],
    }),
    addedBy: one(users, {
        fields: [modpackWhitelistsTable.addedByUserId],
        references: [users.id],
    }),
}));

export const modpackAcquisitionsRelations = relations(modpackAcquisitionsTable, ({ one }) => ({
    user: one(users, {
        fields: [modpackAcquisitionsTable.userId],
        references: [users.id],
    }),
    modpack: one(modpacksTable, {
        fields: [modpackAcquisitionsTable.modpackId],
        references: [modpacksTable.id],
    }),
}));

export const creatorAssetsRelations = relations(creatorAssetsTable, ({ one }) => ({
    creator: one(creatorsTable, {
        fields: [creatorAssetsTable.creatorId],
        references: [creatorsTable.id],
    }),
}));

export const creatorStorageConfigRelations = relations(creatorStorageConfigTable, ({ one }) => ({
    creator: one(creatorsTable, {
        fields: [creatorStorageConfigTable.creatorId],
        references: [creatorsTable.id],
    }),
}));

/* Ad & Sponsorship System */

export const adCampaignsTable = pgTable("ad_campaigns", {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    name: varchar("name", { length: 128 }).notNull(),
    type: adTypeEnum("type").notNull().default(AdType.HOUSE),
    placement: adPlacementEnum("placement").notNull().default(AdPlacement.EXPLORE_BANNER),
    status: adStatusEnum("status").notNull().default(AdStatus.ACTIVE),
    creatorId: uuid("creator_id").references(() => creatorsTable.id, { onDelete: "set null" }),
    targetModpackId: uuid("target_modpack_id").references(() => modpacksTable.id, { onDelete: "set null" }),
    targetUrl: text("target_url"),
    title: varchar("title", { length: 128 }).notNull(),
    subtitle: text("subtitle"),
    badgeText: varchar("badge_text", { length: 32 }).notNull().default("Patrocinado"),
    ctaText: varchar("cta_text", { length: 48 }).notNull().default("Ver más"),
    mediaUrl: text("media_url").notNull(),
    weight: integer("weight").notNull().default(1),
    startAt: timestamp("start_at", { withTimezone: true }).notNull().defaultNow(),
    endAt: timestamp("end_at", { withTimezone: true }),
    maxImpressions: integer("max_impressions"),
    maxClicks: integer("max_clicks"),
    paymentMethod: text("payment_method"), // e.g. 'paypal' or 'house'
    paymentNotes: text("payment_notes"), // admin notes e.g. transaction ID, invoice
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adAnalyticsDailyTable = pgTable("ad_analytics_daily", {
    id: serial("id").primaryKey(),
    campaignId: uuid("campaign_id").notNull().references(() => adCampaignsTable.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
    uniqueCampaignDate: uniqueIndex("uq_campaign_date").on(table.campaignId, table.date),
}));

export const adCampaignsRelations = relations(adCampaignsTable, ({ one, many }) => ({
    creator: one(creatorsTable, {
        fields: [adCampaignsTable.creatorId],
        references: [creatorsTable.id],
    }),
    targetModpack: one(modpacksTable, {
        fields: [adCampaignsTable.targetModpackId],
        references: [modpacksTable.id],
    }),
    creatorUser: one(users, {
        fields: [adCampaignsTable.createdBy],
        references: [users.id],
    }),
    analytics: many(adAnalyticsDailyTable),
}));

export const adAnalyticsDailyRelations = relations(adAnalyticsDailyTable, ({ one }) => ({
    campaign: one(adCampaignsTable, {
        fields: [adAnalyticsDailyTable.campaignId],
        references: [adCampaignsTable.id],
    }),
}));