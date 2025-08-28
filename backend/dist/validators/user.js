"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newUserSchema = exports.userSchema = void 0;
// src/validators/user.ts
const zod_1 = require("zod");
// Zod schema
exports.userSchema = zod_1.z.object({
    id: zod_1.z.string().uuid().optional(),
    email: zod_1.z.string().email(),
    avatarUrl: zod_1.z.string().url().optional(),
    username: zod_1.z.string().min(3).max(20),
    discordId: zod_1.z.string().optional(),
    discordAccessToken: zod_1.z.string().optional(),
    discordRefreshToken: zod_1.z.string().optional(),
    admin: zod_1.z.boolean().default(false),
    // Patreon
    patreonId: zod_1.z.string().optional(),
    patreonAccessToken: zod_1.z.string().optional(),
    patreonRefreshToken: zod_1.z.string().optional(),
    // Database fields
    createdAt: zod_1.z.date().optional(),
    updatedAt: zod_1.z.date().optional(),
});
exports.newUserSchema = exports.userSchema.omit({ id: true, createdAt: true, updatedAt: true });
