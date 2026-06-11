import { ValidationError } from "@/lib/errors/index.ts";
import { db } from "@/db/client.ts";
import { users } from "@/db/schema.ts";
import { eq } from "drizzle-orm";

export interface DiscordUserData {
    discordId: string;
    username: string;
    email: string;
    avatar: string | null;
}

export const userService = {
    async upsertDiscordUser(data: DiscordUserData) {
        const { discordId, username, email } = data;

        if (!discordId?.trim()) {
            throw new ValidationError("Discord ID is required", "MISSING_DISCORD_ID");
        }
        if (!username?.trim()) {
            throw new ValidationError("Username is required", "MISSING_USERNAME");
        }
        if (!email?.trim()) {
            throw new ValidationError("Email is required for new user creation", "MISSING_EMAIL");
        }

        const avatarUrl = data.avatar
            ? `https://cdn.discordapp.com/avatars/${data.discordId}/${data.avatar}.png`
            : null;

        const now = new Date();
        const existing = await db.select().from(users).where(eq(users.discordId, data.discordId)).limit(1);

        if (existing.length > 0) {
            const result = await db.update(users)
                .set({
                    username: data.username,
                    email: data.email,
                    avatarUrl,
                    lastLoginAt: now,
                    updatedAt: now,
                })
                .where(eq(users.id, existing[0].id))
                .returning();
            return result[0];
        }

        const result = await db.insert(users)
            .values({
                discordId: data.discordId,
                username: data.username,
                email: data.email,
                avatarUrl,
                lastLoginAt: now,
            })
            .returning();
        return result[0];
    },

    async updateDiscordTokens(userId: string, accessToken: string, refreshToken: string) {
        await db.update(users)
            .set({
                discordAccessToken: accessToken,
                discordRefreshToken: refreshToken,
                updatedAt: new Date(),
            })
            .where(eq(users.id, userId));
    },
};
