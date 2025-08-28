"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.modpackVersionFilesRelations = exports.modpackVersionsRelations = exports.modpackCategoriesRelations = exports.categoriesRelations = exports.sessionsRelations = exports.modpacksRelations = exports.scopesRelations = exports.publisherMembersRelations = exports.publishersRelations = exports.usersRelations = exports.UserPurchasesTable = exports.WalletTransactionsTable = exports.transactionTypeEnum = exports.WalletsTable = exports.ModpackCategoriesTable = exports.CategoriesTable = exports.ModpackVersionFilesTable = exports.ModpackFilesTable = exports.ModpackVersionsTable = exports.ModpacksTable = exports.ScopesTable = exports.PublisherMembersTable = exports.PublishersTable = exports.SessionsTable = exports.UsersTable = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const pg_core_2 = require("drizzle-orm/pg-core");
// Tabla de usuarios (sin cambios)
exports.UsersTable = (0, pg_core_2.pgTable)("users", {
    id: (0, pg_core_1.uuid)("id").primaryKey().notNull().defaultRandom(),
    username: (0, pg_core_2.varchar)("username", { length: 32 }).notNull().unique(),
    email: (0, pg_core_2.text)("email").notNull(),
    avatarUrl: (0, pg_core_2.text)("avatar_url"),
    // Discord
    discordId: (0, pg_core_2.text)("discord_id"),
    discordAccessToken: (0, pg_core_2.text)("discord_access_token"),
    discordRefreshToken: (0, pg_core_2.text)("discord_refresh_token"),
    // Patreon
    patreonId: (0, pg_core_2.text)("patreon_id"),
    patreonAccessToken: (0, pg_core_2.text)("patreon_access_token"),
    patreonRefreshToken: (0, pg_core_2.text)("patreon_refresh_token"),
    admin: (0, pg_core_1.boolean)("admin").default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
exports.SessionsTable = (0, pg_core_2.pgTable)('sessions', {
    id: (0, pg_core_2.serial)('id').primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.UsersTable.id).notNull(),
    deviceInfo: (0, pg_core_1.jsonb)('device_info').default({}),
    locationInfo: (0, pg_core_1.jsonb)('location_info').default({}),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
// Publishers con isHostingPartner
exports.PublishersTable = (0, pg_core_2.pgTable)('publishers', {
    id: (0, pg_core_1.uuid)('id').primaryKey().notNull().defaultRandom(),
    publisherName: (0, pg_core_2.varchar)('publisher_name', { length: 32 }).notNull(),
    tosUrl: (0, pg_core_2.text)('tos_url').notNull(),
    privacyUrl: (0, pg_core_2.text)('privacy_url').notNull(),
    bannerUrl: (0, pg_core_2.text)('banner_url').notNull(),
    logoUrl: (0, pg_core_2.text)('logo_url').notNull(),
    description: (0, pg_core_2.text)('description').notNull(),
    websiteUrl: (0, pg_core_2.text)('website_url'),
    discordUrl: (0, pg_core_2.text)('discord_url'),
    banned: (0, pg_core_1.boolean)('banned').default(false).notNull(),
    verified: (0, pg_core_1.boolean)('verified').default(false).notNull(),
    partnered: (0, pg_core_1.boolean)('partnered').default(false).notNull(),
    isHostingPartner: (0, pg_core_1.boolean)('is_hosting_partner').default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
// Tabla de miembros de publishers
exports.PublisherMembersTable = (0, pg_core_2.pgTable)('publisher_members', {
    id: (0, pg_core_2.serial)('id').primaryKey(),
    publisherId: (0, pg_core_1.uuid)('publisher_id').references(() => exports.PublishersTable.id).notNull(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.UsersTable.id).notNull(),
    role: (0, pg_core_2.text)('role').notNull(), // 'owner', 'admin', 'member'
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
// Sistema de scopes granular - puede ser a nivel organización o modpack específico
exports.ScopesTable = (0, pg_core_2.pgTable)('scopes', {
    id: (0, pg_core_2.serial)('id').primaryKey(),
    publisherMemberId: (0, pg_core_1.integer)('publisher_member_id').references(() => exports.PublisherMembersTable.id).notNull(),
    // Scope target - solo uno debe estar presente
    publisherId: (0, pg_core_1.uuid)('publisher_id').references(() => exports.PublishersTable.id), // Para permisos a nivel organización
    modpackId: (0, pg_core_1.uuid)('modpack_id').references(() => exports.ModpacksTable.id), // Para permisos a modpack específico
    // Permisos específicos
    canCreateModpacks: (0, pg_core_1.boolean)('can_create_modpacks').default(false),
    canEditModpacks: (0, pg_core_1.boolean)('can_edit_modpacks').default(false),
    canDeleteModpacks: (0, pg_core_1.boolean)('can_delete_modpacks').default(false),
    canPublishVersions: (0, pg_core_1.boolean)('can_publish_versions').default(false),
    canManageMembers: (0, pg_core_1.boolean)('can_manage_members').default(false),
    canManageSettings: (0, pg_core_1.boolean)('can_manage_settings').default(false),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
// Modpacks simplificados
exports.ModpacksTable = (0, pg_core_2.pgTable)('modpacks', {
    id: (0, pg_core_1.uuid)('id').primaryKey().notNull().defaultRandom(),
    name: (0, pg_core_2.text)('name').notNull(),
    shortDescription: (0, pg_core_2.text)('short_description'),
    description: (0, pg_core_2.text)('description'),
    slug: (0, pg_core_2.text)('slug').notNull().unique(),
    iconUrl: (0, pg_core_2.text)('icon_url').notNull(),
    bannerUrl: (0, pg_core_2.text)('banner_url').notNull(),
    trailerUrl: (0, pg_core_2.text)('trailer_url'),
    password: (0, pg_core_2.text)('password'), // nullable
    visibility: (0, pg_core_2.text)('visibility').notNull(), // public, private, patreon
    publisherId: (0, pg_core_1.uuid)('publisher_id').references(() => exports.PublishersTable.id).notNull(),
    showUserAsPublisher: (0, pg_core_1.boolean)('show_user_as_publisher').default(false),
    creatorUserId: (0, pg_core_1.uuid)('creator_user_id').references(() => exports.UsersTable.id),
    status: (0, pg_core_2.text)('status').notNull().default('draft'),
    isPaid: (0, pg_core_1.boolean)('is_paid').default(false),
    price: (0, pg_core_1.numeric)('price', { precision: 10, scale: 2 }).default('0').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
// Versiones de modpacks
exports.ModpackVersionsTable = (0, pg_core_2.pgTable)('modpack_versions', {
    id: (0, pg_core_1.uuid)('id').primaryKey().notNull().defaultRandom(),
    modpackId: (0, pg_core_1.uuid)('modpack_id').references(() => exports.ModpacksTable.id).notNull(),
    version: (0, pg_core_2.text)('version').notNull(),
    mcVersion: (0, pg_core_2.text)('mc_version').notNull(),
    forgeVersion: (0, pg_core_2.text)('forge_version'), // nullable
    changelog: (0, pg_core_2.text)('changelog').notNull(),
    status: (0, pg_core_2.text)('status').notNull().default('draft'),
    releaseDate: (0, pg_core_1.timestamp)('release_date', { withTimezone: true }),
    createdBy: (0, pg_core_1.uuid)('created_by').references(() => exports.UsersTable.id).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
/*
    Sistema de de-duplicación
    Almacenaremos todos los archivos, y si
    alguna versión de otro modpack lo utiliza y ya lo tenemos guardado
    reutilizamos
*/
// Archivos únicos, deduplicados globalmente
exports.ModpackFilesTable = (0, pg_core_2.pgTable)('modpack_files', {
    hash: (0, pg_core_2.varchar)('hash', { length: 64 }).primaryKey(), // SHA256 en hex
    size: (0, pg_core_1.integer)('size').notNull(), // bytes
    mimeType: (0, pg_core_2.text)('mime_type'),
    uploadedAt: (0, pg_core_1.timestamp)('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
});
// Archivos de versiones de modpacks
exports.ModpackVersionFilesTable = (0, pg_core_2.pgTable)('modpack_version_files', {
    id: (0, pg_core_1.uuid)('id').primaryKey().notNull().defaultRandom(),
    modpackVersionId: (0, pg_core_1.uuid)('modpack_version_id').references(() => exports.ModpackVersionsTable.id).notNull(),
    fileHash: (0, pg_core_2.varchar)('file_hash', { length: 64 }).references(() => exports.ModpackFilesTable.hash).notNull(),
    path: (0, pg_core_2.text)('path').notNull(), // ej: "mods/jei.jar" dentro del pack
});
// Categorías
exports.CategoriesTable = (0, pg_core_2.pgTable)('categories', {
    id: (0, pg_core_1.uuid)('id').primaryKey().notNull().defaultRandom(),
    name: (0, pg_core_2.text)('name').notNull(),
    shortDescription: (0, pg_core_2.text)('short_description'),
    description: (0, pg_core_2.text)('description'),
    iconUrl: (0, pg_core_2.text)('icon_url'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
// Relación muchos a muchos entre modpacks y categorías
exports.ModpackCategoriesTable = (0, pg_core_2.pgTable)('modpack_categories', {
    id: (0, pg_core_2.serial)('id').primaryKey(),
    modpackId: (0, pg_core_1.uuid)('modpack_id').references(() => exports.ModpacksTable.id).notNull(),
    categoryId: (0, pg_core_1.uuid)('category_id').references(() => exports.CategoriesTable.id).notNull(),
});
exports.WalletsTable = (0, pg_core_2.pgTable)('wallets', {
    id: (0, pg_core_1.uuid)('id').primaryKey().notNull().defaultRandom(),
    publisherId: (0, pg_core_1.uuid)('publisher_id').references(() => exports.PublishersTable.id).notNull(),
    balance: (0, pg_core_1.numeric)('balance', { precision: 10, scale: 2 }).default('0').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.transactionTypeEnum = (0, pg_core_1.pgEnum)('transaction_type', ['purchase', 'commission', 'deposit', 'withdrawal']);
exports.WalletTransactionsTable = (0, pg_core_2.pgTable)('wallet_transactions', {
    id: (0, pg_core_1.uuid)('id').primaryKey().notNull().defaultRandom(),
    walletId: (0, pg_core_1.uuid)('wallet_id').references(() => exports.WalletsTable.id).notNull(),
    // 'purchase', 'commission', 'deposit', 'withdrawal'
    type: (0, exports.transactionTypeEnum)('type').notNull(),
    amount: (0, pg_core_1.numeric)('amount', { precision: 10, scale: 2 }).notNull(),
    relatedUserId: (0, pg_core_1.uuid)('related_user_id').references(() => exports.UsersTable.id), // usuario que compró
    relatedModpackId: (0, pg_core_1.uuid)('related_modpack_id').references(() => exports.ModpacksTable.id),
    description: (0, pg_core_2.text)('description'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.UserPurchasesTable = (0, pg_core_2.pgTable)('user_purchases', {
    id: (0, pg_core_1.uuid)('id').primaryKey().notNull().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.UsersTable.id).notNull(),
    modpackId: (0, pg_core_1.uuid)('modpack_id').references(() => exports.ModpacksTable.id).notNull(),
    pricePaid: (0, pg_core_1.numeric)('price_paid', { precision: 10, scale: 2 }).notNull(),
    purchasedAt: (0, pg_core_1.timestamp)('purchased_at', { withTimezone: true }).defaultNow().notNull(),
});
// RELACIONES
exports.usersRelations = (0, drizzle_orm_1.relations)(exports.UsersTable, ({ many }) => ({
    sessions: many(exports.SessionsTable),
    publisherMemberships: many(exports.PublisherMembersTable),
    createdModpacks: many(exports.ModpacksTable, { relationName: 'creatorUser' }),
    createdVersions: many(exports.ModpackVersionsTable),
}));
exports.publishersRelations = (0, drizzle_orm_1.relations)(exports.PublishersTable, ({ many }) => ({
    members: many(exports.PublisherMembersTable),
    modpacks: many(exports.ModpacksTable),
    teamScopes: many(exports.ScopesTable, { relationName: 'publisherScopes' }),
}));
exports.publisherMembersRelations = (0, drizzle_orm_1.relations)(exports.PublisherMembersTable, ({ one, many }) => ({
    publisher: one(exports.PublishersTable, { fields: [exports.PublisherMembersTable.publisherId], references: [exports.PublishersTable.id] }),
    user: one(exports.UsersTable, { fields: [exports.PublisherMembersTable.userId], references: [exports.UsersTable.id] }),
    scopes: many(exports.ScopesTable),
}));
exports.scopesRelations = (0, drizzle_orm_1.relations)(exports.ScopesTable, ({ one }) => ({
    publisherMember: one(exports.PublisherMembersTable, { fields: [exports.ScopesTable.publisherMemberId], references: [exports.PublisherMembersTable.id] }),
    publisher: one(exports.PublishersTable, { fields: [exports.ScopesTable.publisherId], references: [exports.PublishersTable.id], relationName: 'publisherScopes' }),
    modpack: one(exports.ModpacksTable, { fields: [exports.ScopesTable.modpackId], references: [exports.ModpacksTable.id] }),
}));
exports.modpacksRelations = (0, drizzle_orm_1.relations)(exports.ModpacksTable, ({ one, many }) => ({
    publisher: one(exports.PublishersTable, { fields: [exports.ModpacksTable.publisherId], references: [exports.PublishersTable.id] }),
    creatorUser: one(exports.UsersTable, { fields: [exports.ModpacksTable.creatorUserId], references: [exports.UsersTable.id], relationName: 'creatorUser' }),
    categories: many(exports.ModpackCategoriesTable),
    versions: many(exports.ModpackVersionsTable),
    scopes: many(exports.ScopesTable),
}));
exports.sessionsRelations = (0, drizzle_orm_1.relations)(exports.SessionsTable, ({ one }) => ({
    user: one(exports.UsersTable, { fields: [exports.SessionsTable.userId], references: [exports.UsersTable.id] }),
}));
exports.categoriesRelations = (0, drizzle_orm_1.relations)(exports.CategoriesTable, ({ many }) => ({
    modpacks: many(exports.ModpackCategoriesTable),
}));
exports.modpackCategoriesRelations = (0, drizzle_orm_1.relations)(exports.ModpackCategoriesTable, ({ one }) => ({
    modpack: one(exports.ModpacksTable, { fields: [exports.ModpackCategoriesTable.modpackId], references: [exports.ModpacksTable.id] }),
    category: one(exports.CategoriesTable, { fields: [exports.ModpackCategoriesTable.categoryId], references: [exports.CategoriesTable.id] }),
}));
exports.modpackVersionsRelations = (0, drizzle_orm_1.relations)(exports.ModpackVersionsTable, ({ one, many }) => ({
    modpack: one(exports.ModpacksTable, { fields: [exports.ModpackVersionsTable.modpackId], references: [exports.ModpacksTable.id] }),
    createdByUser: one(exports.UsersTable, { fields: [exports.ModpackVersionsTable.createdBy], references: [exports.UsersTable.id] }),
    files: many(exports.ModpackVersionFilesTable),
}));
exports.modpackVersionFilesRelations = (0, drizzle_orm_1.relations)(exports.ModpackVersionFilesTable, ({ one }) => ({
    modpackVersion: one(exports.ModpackVersionsTable, { fields: [exports.ModpackVersionFilesTable.modpackVersionId], references: [exports.ModpackVersionsTable.id] }),
    file: one(exports.ModpackFilesTable, { fields: [exports.ModpackVersionFilesTable.fileHash], references: [exports.ModpackFilesTable.hash] }),
}));
