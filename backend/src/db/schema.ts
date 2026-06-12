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
    uniqueIndex
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm";


export enum UserRole {
    USER = "user",
    ADMIN = "admin",
    SUPER_ADMIN = "super_admin",
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
    role: roleEnum("role").notNull().default(UserRole.USER),
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
    bannerUrl: text('banner_url').notNull(),
    trailerUrl: text('trailer_url'),
    password: text('password'), // nullable
    prelaunchAppearance: jsonb('prelaunch_appearance'),
    visibility: modpackVisibilityEnum('visibility').notNull().default(ModpackVisibility.PRIVATE),
    creatorId: uuid('creator_id').references(() => creatorsTable.id).notNull(),
    showUserAsPublisher: boolean('show_user_as_publisher').default(false),
    creatorUserId: uuid('creator_user_id').references(() => users.id),
    status: modpackStatusEnum('status').notNull().default(ModpackStatus.DRAFT),
    isPaid: boolean('is_paid').default(false),
    price: numeric('price', { precision: 10, scale: 2 }).default('0').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

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


/* 
    Relationships
*/

export const creatorsRelations = relations(creatorsTable, ({ many }) => ({
    users: many(creatorUsersTable),
    modpacks: many(modpacksTable),
}));

export const usersRelations = relations(users, ({ many }) => ({
    sessions: many(sessions),
    devices: many(userDevices),
    creatorMemberships: many(creatorUsersTable),
    permissions: many(permissionsTable),
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
}));