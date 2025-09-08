import { relations } from "drizzle-orm";
import { boolean, integer, jsonb, numeric, pgEnum, timestamp, uuid, unique } from "drizzle-orm/pg-core";
import { pgTable, serial, text, varchar } from "drizzle-orm/pg-core";

// Enums
export const userRoleEnum = pgEnum('user_role', ['user', 'admin', 'superadmin']);
export const auditActionEnum = pgEnum('audit_action', [
    'user_login', 'user_logout', 'user_created', 'user_updated', 'user_deleted', 
    'user_role_changed', 'modpack_created', 'modpack_updated', 'modpack_deleted',
    'admin_access', 'audit_log_viewed'
]);

// Tabla de usuarios actualizada con roles
export const UsersTable = pgTable("users", {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    username: varchar("username", { length: 32 }).notNull().unique(),
    email: text("email").notNull(),
    avatarUrl: text("avatar_url"),
    // Discord
    discordId: text("discord_id"),
    discordAccessToken: text("discord_access_token"),
    discordRefreshToken: text("discord_refresh_token"),
    // Patreon
    patreonId: text("patreon_id"),
    patreonAccessToken: text("patreon_access_token"),
    patreonRefreshToken: text("patreon_refresh_token"),
    role: userRoleEnum("role").default('user').notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Nueva tabla de audit logs
export const AuditLogsTable = pgTable("audit_logs", {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    action: auditActionEnum("action").notNull(),
    userId: uuid("user_id").references(() => UsersTable.id),
    targetUserId: uuid("target_user_id").references(() => UsersTable.id),
    targetResourceId: uuid("target_resource_id"),
    details: jsonb("details"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const SessionsTable = pgTable('sessions', {
    id: serial('id').primaryKey(),
    userId: uuid('user_id').references(() => UsersTable.id).notNull(),
    deviceInfo: jsonb('device_info').default({}),
    locationInfo: jsonb('location_info').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Publishers con isHostingPartner
export const PublishersTable = pgTable('publishers', {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    publisherName: varchar('publisher_name', { length: 32 }).notNull(),
    tosUrl: text('tos_url').notNull(),
    privacyUrl: text('privacy_url').notNull(),
    bannerUrl: text('banner_url').notNull(),
    logoUrl: text('logo_url').notNull(),
    description: text('description').notNull(),
    websiteUrl: text('website_url'),
    discordUrl: text('discord_url'),
    banned: boolean('banned').default(false).notNull(),
    verified: boolean('verified').default(false).notNull(),
    partnered: boolean('partnered').default(false).notNull(),
    isHostingPartner: boolean('is_hosting_partner').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Tabla de miembros de publishers
export const PublisherMembersTable = pgTable('publisher_members', {
    id: serial('id').primaryKey(),
    publisherId: uuid('publisher_id').references(() => PublishersTable.id).notNull(),
    userId: uuid('user_id').references(() => UsersTable.id).notNull(),
    role: text('role').notNull(), // 'owner', 'admin', 'member'
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Sistema de scopes granular - puede ser a nivel organización o modpack específico
export const ScopesTable = pgTable('scopes', {
    id: serial('id').primaryKey(),
    publisherMemberId: integer('publisher_member_id').references(() => PublisherMembersTable.id).notNull(),

    // Scope target - solo uno debe estar presente
    publisherId: uuid('publisher_id').references(() => PublishersTable.id), // Para permisos a nivel organización
    modpackId: uuid('modpack_id').references(() => ModpacksTable.id),     // Para permisos a modpack específico

    // Permisos específicos
    canCreateModpacks: boolean('can_create_modpacks').default(false),
    canEditModpacks: boolean('can_edit_modpacks').default(false),
    canDeleteModpacks: boolean('can_delete_modpacks').default(false),
    canPublishVersions: boolean('can_publish_versions').default(false),
    canManageMembers: boolean('can_manage_members').default(false),
    canManageSettings: boolean('can_manage_settings').default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Modpacks simplificados
export const ModpacksTable = pgTable('modpacks', {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    name: text('name').notNull(),
    shortDescription: text('short_description'),
    description: text('description'),
    slug: text('slug').notNull().unique(),
    iconUrl: text('icon_url').notNull(),
    bannerUrl: text('banner_url').notNull(),
    trailerUrl: text('trailer_url'),
    password: text('password'), // nullable
    visibility: text('visibility').notNull(), // public, private, patreon
    publisherId: uuid('publisher_id').references(() => PublishersTable.id).notNull(),
    showUserAsPublisher: boolean('show_user_as_publisher').default(false),
    creatorUserId: uuid('creator_user_id').references(() => UsersTable.id),
    status: text('status').notNull().default('draft'),
    isPaid: boolean('is_paid').default(false),
    price: numeric('price', { precision: 10, scale: 2 }).default('0').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Versiones de modpacks
export const ModpackVersionsTable = pgTable('modpack_versions', {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    modpackId: uuid('modpack_id').references(() => ModpacksTable.id).notNull(),
    version: text('version').notNull(),
    mcVersion: text('mc_version').notNull(),
    forgeVersion: text('forge_version'), // nullable
    changelog: text('changelog').notNull(),
    status: text('status').notNull().default('draft'),
    releaseDate: timestamp('release_date', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => UsersTable.id).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/* 
    Sistema de de-duplicación
    Almacenaremos todos los archivos, y si
    alguna versión de otro modpack lo utiliza y ya lo tenemos guardado
    reutilizamos
*/
// Archivos únicos, deduplicados globalmente
export const ModpackFilesTable = pgTable('modpack_files', {
    hash: varchar('hash', { length: 64 }).primaryKey(), // SHA256 en hex
    size: integer('size').notNull(),                     // bytes
    mimeType: text('mime_type'),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
});


// Archivos de versiones de modpacks
export const ModpackVersionFilesTable = pgTable('modpack_version_files', {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    modpackVersionId: uuid('modpack_version_id').references(() => ModpackVersionsTable.id).notNull(),
    fileHash: varchar('file_hash', { length: 64 }).references(() => ModpackFilesTable.hash).notNull(),
    path: text('path').notNull(), // ej: "mods/jei.jar" dentro del pack
}, (table) => ({
    uniqueVersionFileHashPath: unique().on(table.modpackVersionId, table.fileHash, table.path),
}));

// Categorías
export const CategoriesTable = pgTable('categories', {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    name: text('name').notNull(),
    shortDescription: text('short_description'),
    description: text('description'),
    iconUrl: text('icon_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Relación muchos a muchos entre modpacks y categorías
export const ModpackCategoriesTable = pgTable('modpack_categories', {
    id: serial('id').primaryKey(),
    modpackId: uuid('modpack_id').references(() => ModpacksTable.id).notNull(),
    categoryId: uuid('category_id').references(() => CategoriesTable.id).notNull(),
});

export const WalletsTable = pgTable('wallets', {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    publisherId: uuid('publisher_id').references(() => PublishersTable.id).notNull(),
    balance: numeric('balance', { precision: 10, scale: 2 }).default('0').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const transactionTypeEnum = pgEnum('transaction_type', ['purchase', 'commission', 'deposit', 'withdrawal']);

export const WalletTransactionsTable = pgTable('wallet_transactions', {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    walletId: uuid('wallet_id').references(() => WalletsTable.id).notNull(),
    // 'purchase', 'commission', 'deposit', 'withdrawal'
    type: transactionTypeEnum('type').notNull(),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    relatedUserId: uuid('related_user_id').references(() => UsersTable.id), // usuario que compró
    relatedModpackId: uuid('related_modpack_id').references(() => ModpacksTable.id),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const UserPurchasesTable = pgTable('user_purchases', {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    userId: uuid('user_id').references(() => UsersTable.id).notNull(),
    modpackId: uuid('modpack_id').references(() => ModpacksTable.id).notNull(),
    pricePaid: numeric('price_paid', { precision: 10, scale: 2 }).notNull(),
    purchasedAt: timestamp('purchased_at', { withTimezone: true }).defaultNow().notNull(),
});




// RELACIONES

export const usersRelations = relations(UsersTable, ({ many }) => ({
    sessions: many(SessionsTable),
    publisherMemberships: many(PublisherMembersTable),
    createdModpacks: many(ModpacksTable, { relationName: 'creatorUser' }),
    createdVersions: many(ModpackVersionsTable),
}));

export const publishersRelations = relations(PublishersTable, ({ many }) => ({
    members: many(PublisherMembersTable),
    modpacks: many(ModpacksTable),
    teamScopes: many(ScopesTable, { relationName: 'publisherScopes' }),
}));

export const publisherMembersRelations = relations(PublisherMembersTable, ({ one, many }) => ({
    publisher: one(PublishersTable, { fields: [PublisherMembersTable.publisherId], references: [PublishersTable.id] }),
    user: one(UsersTable, { fields: [PublisherMembersTable.userId], references: [UsersTable.id] }),
    scopes: many(ScopesTable),
}));

export const scopesRelations = relations(ScopesTable, ({ one }) => ({
    publisherMember: one(PublisherMembersTable, { fields: [ScopesTable.publisherMemberId], references: [PublisherMembersTable.id] }),
    publisher: one(PublishersTable, { fields: [ScopesTable.publisherId], references: [PublishersTable.id], relationName: 'publisherScopes' }),
    modpack: one(ModpacksTable, { fields: [ScopesTable.modpackId], references: [ModpacksTable.id] }),
}));

export const modpacksRelations = relations(ModpacksTable, ({ one, many }) => ({
    publisher: one(PublishersTable, { fields: [ModpacksTable.publisherId], references: [PublishersTable.id] }),
    creatorUser: one(UsersTable, { fields: [ModpacksTable.creatorUserId], references: [UsersTable.id], relationName: 'creatorUser' }),
    categories: many(ModpackCategoriesTable),
    versions: many(ModpackVersionsTable),
    scopes: many(ScopesTable),
}));

export const sessionsRelations = relations(SessionsTable, ({ one }) => ({
    user: one(UsersTable, { fields: [SessionsTable.userId], references: [UsersTable.id] }),
}));

export const categoriesRelations = relations(CategoriesTable, ({ many }) => ({
    modpacks: many(ModpackCategoriesTable),
}));

export const modpackCategoriesRelations = relations(ModpackCategoriesTable, ({ one }) => ({
    modpack: one(ModpacksTable, { fields: [ModpackCategoriesTable.modpackId], references: [ModpacksTable.id] }),
    category: one(CategoriesTable, { fields: [ModpackCategoriesTable.categoryId], references: [CategoriesTable.id] }),
}));

export const modpackVersionsRelations = relations(ModpackVersionsTable, ({ one, many }) => ({
    modpack: one(ModpacksTable, { fields: [ModpackVersionsTable.modpackId], references: [ModpacksTable.id] }),
    createdByUser: one(UsersTable, { fields: [ModpackVersionsTable.createdBy], references: [UsersTable.id] }),
    files: many(ModpackVersionFilesTable),
}));

export const modpackVersionFilesRelations = relations(ModpackVersionFilesTable, ({ one }) => ({
    modpackVersion: one(ModpackVersionsTable, { fields: [ModpackVersionFilesTable.modpackVersionId], references: [ModpackVersionsTable.id] }),
    file: one(ModpackFilesTable, { fields: [ModpackVersionFilesTable.fileHash], references: [ModpackFilesTable.hash] }),
}));
