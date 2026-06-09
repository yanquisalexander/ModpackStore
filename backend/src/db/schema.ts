import {
    boolean,
    pgTable,
    uuid,
    varchar,
    timestamp,
    text,
    jsonb,
    vector,
    pgEnum
} from "drizzle-orm/pg-core"

export const UserRole = {
    USER = "user",
    ADMIN = "admin",
    SUPER_ADMIN = "super_admin",
} as const;

export function enumToPgEnum<T extends Record<string, string>>(
    myEnum: T,
): [T[keyof T], ...T[keyof T][]] {
    return Object.values(myEnum) as [T[keyof T], ...T[keyof T][]]
}

export const roleEnum = pgEnum('role', enumToPgEnum(UserRole));


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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
