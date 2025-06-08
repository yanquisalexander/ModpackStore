// src/validators/user.ts
import { z } from "zod";

// Zod schema
export const userSchema = z.object({
    id: z.string().uuid().optional(),
    email: z.string().email(),
    avatarUrl: z.string().url().optional(),
    username: z.string().min(3).max(20),
    discordId: z.string().optional(),
    discordAccessToken: z.string().optional(),
    discordRefreshToken: z.string().optional(),
    admin: z.boolean().default(false),

    // Patreon
    patreonId: z.string().optional(),
    patreonAccessToken: z.string().optional(),
    patreonRefreshToken: z.string().optional(),

    // Database fields
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});

export const newUserSchema = userSchema.omit({ id: true, createdAt: true, updatedAt: true });
