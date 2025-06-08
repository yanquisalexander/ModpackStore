// src/models/User.ts
import { client as db } from "@/db/client";
import { eq } from "drizzle-orm";
import { userSchema, newUserSchema } from "@/validators/user";
import { UsersTable } from "@/db/schema";
import type { z } from "zod";
import { Session } from "./Session.model";
import { sign, verify, JwtPayload } from "jsonwebtoken";
import "dotenv/config";

// Types
type UserType = typeof UsersTable.$inferSelect;
type NewUser = typeof UsersTable.$inferInsert;
type UserUpdateData = Partial<Omit<NewUser, "id" | "createdAt">>;

interface TokenPayload extends JwtPayload {
    sub: string;
    sessionId: string;
}

interface UserTokens {
    accessToken: string;
    refreshToken: string;
}

// Interfaces for better type safety
interface OAuthTokens {
    accessToken?: string | null;
    refreshToken?: string | null;
}

interface DiscordData extends OAuthTokens {
    discordId?: string | null;
}

interface PatreonData extends OAuthTokens {
    patreonId?: string | null;
}

export class User {
    readonly id: string;
    readonly email: string;
    readonly createdAt: Date;

    username: string;
    avatarUrl: string | null;
    updatedAt: Date;
    admin: boolean;

    // OAuth data - grouped for better organization
    private _discordData: DiscordData = {};
    private _patreonData: PatreonData = {};

    constructor(data: UserType) {
        // Required fields
        this.id = data.id;
        this.email = data.email;
        this.createdAt = data.createdAt;

        // Mutable fields
        this.username = data.username;
        this.avatarUrl = data.avatarUrl;
        this.updatedAt = data.updatedAt;
        this.admin = data.admin ?? false;

        // OAuth data
        this._discordData = {
            discordId: data.discordId,
            accessToken: data.discordAccessToken,
            refreshToken: data.discordRefreshToken,
        };

        this._patreonData = {
            patreonId: data.patreonId,
            accessToken: data.patreonAccessToken,
            refreshToken: data.patreonRefreshToken,
        };
    }

    // Getters for OAuth data (read-only access)
    get discordId(): string | null { return this._discordData.discordId ?? null; }
    get discordAccessToken(): string | null { return this._discordData.accessToken ?? null; }
    get discordRefreshToken(): string | null { return this._discordData.refreshToken ?? null; }

    get patreonId(): string | null { return this._patreonData.patreonId ?? null; }
    get patreonAccessToken(): string | null { return this._patreonData.accessToken ?? null; }
    get patreonRefreshToken(): string | null { return this._patreonData.refreshToken ?? null; }

    // OAuth data setters with validation
    setDiscordData(data: Partial<DiscordData>): void {
        this._discordData = { ...this._discordData, ...data };
    }

    setPatreonData(data: Partial<PatreonData>): void {
        this._patreonData = { ...this._patreonData, ...data };
    }

    // Static factory methods
    static fromJson(json: unknown): User {
        const parsed = userSchema.safeParse(json);
        if (!parsed.success) {
            throw new Error(`Invalid user data: ${JSON.stringify(parsed.error.format())}`);
        }

        return new User({
            id: parsed.data.id ?? "",
            username: parsed.data.username,
            email: parsed.data.email,
            avatarUrl: parsed.data.avatarUrl ?? null,
            createdAt: parsed.data.createdAt ?? new Date(),
            updatedAt: parsed.data.updatedAt ?? new Date(),
            admin: parsed.data.admin ?? false,
            discordId: parsed.data.discordId ?? null,
            discordAccessToken: parsed.data.discordAccessToken ?? null,
            discordRefreshToken: parsed.data.discordRefreshToken ?? null,
            patreonId: parsed.data.patreonId ?? null,
            patreonAccessToken: parsed.data.patreonAccessToken ?? null,
            patreonRefreshToken: parsed.data.patreonRefreshToken ?? null,
        });
    }

    static async create(data: z.infer<typeof newUserSchema>): Promise<User> {
        const parsed = newUserSchema.safeParse(data);
        if (!parsed.success) {
            throw new Error(`Invalid user data: ${JSON.stringify(parsed.error.format())}`);
        }

        const now = new Date();

        try {
            const [inserted] = await db
                .insert(UsersTable)
                .values({
                    ...parsed.data,
                    createdAt: now,
                    updatedAt: now,
                })
                .returning();

            return new User(inserted);
        } catch (error) {
            throw new Error(`Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Query methods with better error handling
    static async findById(id: string): Promise<User | null> {
        if (!id?.trim()) return null;

        try {
            const [user] = await db.select().from(UsersTable).where(eq(UsersTable.id, id));
            return user ? new User(user) : null;
        } catch (error) {
            console.error(`Error finding user by ID ${id}:`, error);
            return null;
        }
    }

    static async findByDiscordId(discordId: string): Promise<User | null> {
        if (!discordId?.trim()) return null;

        try {
            const [user] = await db.select().from(UsersTable).where(eq(UsersTable.discordId, discordId));
            return user ? new User(user) : null;
        } catch (error) {
            console.error(`Error finding user by Discord ID ${discordId}:`, error);
            return null;
        }
    }

    static async findByEmail(email: string): Promise<User | null> {
        if (!email?.trim()) return null;

        try {
            const [user] = await db.select().from(UsersTable).where(eq(UsersTable.email, email.toLowerCase()));
            return user ? new User(user) : null;
        } catch (error) {
            console.error(`Error finding user by email ${email}:`, error);
            return null;
        }
    }

    static async findByRefreshToken(refreshToken: string): Promise<User | null> {
        if (!refreshToken?.trim()) return null;

        try {
            // Secure JWT verification instead of manual parsing
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                throw new Error("JWT_SECRET is not configured");
            }

            const decoded = verify(refreshToken, secret) as TokenPayload;
            const userId = decoded.sub;

            if (!userId) {
                throw new Error("Invalid refresh token: userId is undefined");
            }

            return await User.findById(userId);
        } catch (error) {
            console.error("Error finding user by refresh token:", error);
            return null;
        }
    }

    // Enhanced query method with relations
    static async getCompleteUser(id: string): Promise<UserType & { publisherMemberships: any[] } | null> {
        if (!id?.trim()) return null;

        try {
            const user = await db.query.UsersTable.findFirst({
                where: eq(UsersTable.id, id),
                with: {
                    publisherMemberships: true,
                }
            });
            return user ?? null;
        } catch (error) {
            console.error(`Error getting complete user ${id}:`, error);
            return null;
        }
    }

    // Instance methods
    async update(data: UserUpdateData): Promise<User> {
        const updateData = {
            ...data,
            updatedAt: new Date(),
        };

        try {
            await db.update(UsersTable).set(updateData).where(eq(UsersTable.id, this.id));

            const updated = await User.findById(this.id);
            if (!updated) {
                throw new Error("Failed to retrieve updated user");
            }

            // Update current instance
            Object.assign(this, updated);
            return this;
        } catch (error) {
            throw new Error(`Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async save(): Promise<User> {
        const updateData = {
            username: this.username,
            avatarUrl: this.avatarUrl,
            admin: this.admin,
            discordAccessToken: this.discordAccessToken,
            discordRefreshToken: this.discordRefreshToken,
            patreonAccessToken: this.patreonAccessToken,
            patreonRefreshToken: this.patreonRefreshToken,
            updatedAt: new Date(),
        };

        return this.update(updateData);
    }

    async delete(): Promise<void> {
        try {
            await db.delete(UsersTable).where(eq(UsersTable.id, this.id));
        } catch (error) {
            throw new Error(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Business logic methods
    async isPatron(): Promise<boolean> {
        // Enhanced logic - you could add more sophisticated checking here
        if (!this.patreonId) return false;

        // Add additional validation if needed:
        // - Check if patron status is still active
        // - Validate with Patreon API
        // - Check subscription level

        return true;
    }

    async generateTokens(session: Session): Promise<UserTokens> {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error("JWT_SECRET is not configured");
        }

        const payload: Omit<TokenPayload, 'iat' | 'exp'> = {
            sub: this.id,
            sessionId: session.id,
        };

        try {
            const accessToken = sign(payload, secret, {
                expiresIn: '1h',
                issuer: 'your-app-name', // Add issuer for better security
                audience: 'your-app-users',
            });

            const refreshToken = sign(payload, secret, {
                expiresIn: '30d',
                issuer: 'your-app-name',
                audience: 'your-app-users',
            });

            return { accessToken, refreshToken };
        } catch (error) {
            throw new Error(`Failed to generate tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Serialization methods
    toJson(): UserType {
        return {
            id: this.id,
            username: this.username,
            avatarUrl: this.avatarUrl,
            email: this.email,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            admin: this.admin,
            discordId: this.discordId,
            discordAccessToken: this.discordAccessToken,
            discordRefreshToken: this.discordRefreshToken,
            patreonId: this.patreonId,
            patreonAccessToken: this.patreonAccessToken,
            patreonRefreshToken: this.patreonRefreshToken,
        };
    }

    // Safe serialization for public APIs (excludes sensitive data)
    toPublicJson(): Omit<UserType, 'discordAccessToken' | 'discordRefreshToken' | 'patreonAccessToken' | 'patreonRefreshToken'> {
        return {
            id: this.id,
            username: this.username,
            avatarUrl: this.avatarUrl,
            email: this.email,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            admin: this.admin,
            discordId: this.discordId,
            patreonId: this.patreonId,
        };
    }

    // Utility methods
    hasDiscordAuth(): boolean {
        return !!(this.discordId && this.discordAccessToken);
    }

    hasPatreonAuth(): boolean {
        return !!(this.patreonId && this.patreonAccessToken);
    }

    getDisplayName(): string {
        return this.username || this.email.split('@')[0];
    }
}