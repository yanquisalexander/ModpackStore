// src/models/User.model.ts - TypeORM Version
import { AppDataSource } from "@/db/data-source";
import { User as UserEntity } from "@/entities/User";
import { Session as SessionEntity } from "@/entities/Session";
import { Publisher as PublisherEntity } from "@/entities/Publisher";
import { userSchema, newUserSchema } from "@/validators/user";
import { z } from "zod";
import { sign, verify, JwtPayload } from "jsonwebtoken";
import "dotenv/config";

// Types
type UserType = {
    id: string;
    username: string;
    email: string;
    avatarUrl?: string;
    discordId?: string;
    discordAccessToken?: string;
    discordRefreshToken?: string;
    patreonId?: string;
    patreonAccessToken?: string;
    patreonRefreshToken?: string;
    admin: boolean;
    createdAt: Date;
    updatedAt: Date;
};

// Zod schema for updates, allowing partial updates and omitting certain fields
const userUpdateSchema = userSchema.partial().omit({
    id: true,
    email: true, // Email changes typically require a verification process
    createdAt: true,
    updatedAt: true, // Should be set by the update method
    discordId: true, // Discord ID is set during initial link, not arbitrary update
    patreonId: true, // Patreon ID is set during initial link, not arbitrary update
}).extend({
    // Explicitly include fields that can be updated, including OAuth tokens
    username: userSchema.shape.username.optional(),
    avatarUrl: userSchema.shape.avatarUrl.optional().nullable(),
    admin: userSchema.shape.admin.optional(),
    discordAccessToken: userSchema.shape.discordAccessToken.optional().nullable(),
    discordRefreshToken: userSchema.shape.discordRefreshToken.optional().nullable(),
    patreonAccessToken: userSchema.shape.patreonAccessToken.optional().nullable(),
    patreonRefreshToken: userSchema.shape.patreonRefreshToken.optional().nullable(),
});
type UserUpdateData = z.infer<typeof userUpdateSchema>;

// Zod schemas for partial OAuth data updates
const partialDiscordDataSchema = z.object({
    discordId: userSchema.shape.discordId.optional(),
    accessToken: userSchema.shape.discordAccessToken.optional(),
    refreshToken: userSchema.shape.discordRefreshToken.optional(),
}).partial();
type PartialDiscordData = z.infer<typeof partialDiscordDataSchema>;

const partialPatreonDataSchema = z.object({
    patreonId: userSchema.shape.patreonId.optional(),
    accessToken: userSchema.shape.patreonAccessToken.optional(),
    refreshToken: userSchema.shape.patreonRefreshToken.optional(),
}).partial();
type PartialPatreonData = z.infer<typeof partialPatreonDataSchema>;

export interface TokenPayload extends JwtPayload {
    sub: string;
    sessionId: number;
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
        this.avatarUrl = data.avatarUrl || null;
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

    // OAuth data setters with validation and persistence
    async setDiscordData(data: PartialDiscordData): Promise<void> {
        const parsedData = partialDiscordDataSchema.safeParse(data);
        if (!parsedData.success) {
            throw new Error(`Invalid Discord data: ${JSON.stringify(parsedData.error.format())}`);
        }
        if (parsedData.data.discordId) this._discordData.discordId = parsedData.data.discordId;
        if (parsedData.data.accessToken) this._discordData.accessToken = parsedData.data.accessToken;
        if (parsedData.data.refreshToken) this._discordData.refreshToken = parsedData.data.refreshToken;
        // Persist changes
        await this.save();
    }

    async setPatreonData(data: PartialPatreonData): Promise<void> {
        const parsedData = partialPatreonDataSchema.safeParse(data);
        if (!parsedData.success) {
            throw new Error(`Invalid Patreon data: ${JSON.stringify(parsedData.error.format())}`);
        }
        if (parsedData.data.patreonId) this._patreonData.patreonId = parsedData.data.patreonId;
        if (parsedData.data.accessToken) this._patreonData.accessToken = parsedData.data.accessToken;
        if (parsedData.data.refreshToken) this._patreonData.refreshToken = parsedData.data.refreshToken;
        // Persist changes
        await this.save();
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

        try {
            // Create new user entity using TypeORM ActiveRecord
            const userEntity = UserEntity.create({
                username: parsed.data.username,
                email: parsed.data.email,
                avatarUrl: parsed.data.avatarUrl,
                discordId: parsed.data.discordId,
                discordAccessToken: parsed.data.discordAccessToken,
                discordRefreshToken: parsed.data.discordRefreshToken,
                patreonId: parsed.data.patreonId,
                patreonAccessToken: parsed.data.patreonAccessToken,
                patreonRefreshToken: parsed.data.patreonRefreshToken,
                admin: parsed.data.admin ?? false,
            });

            const savedUser = await userEntity.save();
            
            return new User({
                id: savedUser.id,
                username: savedUser.username,
                email: savedUser.email,
                avatarUrl: savedUser.avatarUrl,
                discordId: savedUser.discordId,
                discordAccessToken: savedUser.discordAccessToken,
                discordRefreshToken: savedUser.discordRefreshToken,
                patreonId: savedUser.patreonId,
                patreonAccessToken: savedUser.patreonAccessToken,
                patreonRefreshToken: savedUser.patreonRefreshToken,
                admin: savedUser.admin,
                createdAt: savedUser.createdAt,
                updatedAt: savedUser.updatedAt,
            });
        } catch (error) {
            throw new Error(`Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Query methods with better error handling using TypeORM
    static async findById(id: string): Promise<User | null> {
        if (!id?.trim()) return null;

        try {
            const userEntity = await UserEntity.findOne({ where: { id } });
            return userEntity ? new User({
                id: userEntity.id,
                username: userEntity.username,
                email: userEntity.email,
                avatarUrl: userEntity.avatarUrl,
                discordId: userEntity.discordId,
                discordAccessToken: userEntity.discordAccessToken,
                discordRefreshToken: userEntity.discordRefreshToken,
                patreonId: userEntity.patreonId,
                patreonAccessToken: userEntity.patreonAccessToken,
                patreonRefreshToken: userEntity.patreonRefreshToken,
                admin: userEntity.admin,
                createdAt: userEntity.createdAt,
                updatedAt: userEntity.updatedAt,
            }) : null;
        } catch (error) {
            console.error(`Error finding user by ID ${id}:`, error);
            return null;
        }
    }

    static async findByDiscordId(discordId: string): Promise<User | null> {
        if (!discordId?.trim()) return null;

        try {
            const userEntity = await UserEntity.findOne({ where: { discordId } });
            return userEntity ? new User({
                id: userEntity.id,
                username: userEntity.username,
                email: userEntity.email,
                avatarUrl: userEntity.avatarUrl,
                discordId: userEntity.discordId,
                discordAccessToken: userEntity.discordAccessToken,
                discordRefreshToken: userEntity.discordRefreshToken,
                patreonId: userEntity.patreonId,
                patreonAccessToken: userEntity.patreonAccessToken,
                patreonRefreshToken: userEntity.patreonRefreshToken,
                admin: userEntity.admin,
                createdAt: userEntity.createdAt,
                updatedAt: userEntity.updatedAt,
            }) : null;
        } catch (error) {
            console.error(`Error finding user by Discord ID ${discordId}:`, error);
            return null;
        }
    }

    static async findByEmail(email: string): Promise<User | null> {
        if (!email?.trim()) return null;

        try {
            const userEntity = await UserEntity.findOne({ where: { email: email.toLowerCase() } });
            return userEntity ? new User({
                id: userEntity.id,
                username: userEntity.username,
                email: userEntity.email,
                avatarUrl: userEntity.avatarUrl,
                discordId: userEntity.discordId,
                discordAccessToken: userEntity.discordAccessToken,
                discordRefreshToken: userEntity.discordRefreshToken,
                patreonId: userEntity.patreonId,
                patreonAccessToken: userEntity.patreonAccessToken,
                patreonRefreshToken: userEntity.patreonRefreshToken,
                admin: userEntity.admin,
                createdAt: userEntity.createdAt,
                updatedAt: userEntity.updatedAt,
            }) : null;
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

    // Enhanced query method with relations using TypeORM
    static async getCompleteUser(id: string): Promise<UserType & { publisherMemberships: any[] } | null> {
        if (!id?.trim()) return null;

        try {
            const userEntity = await UserEntity.findOne({
                where: { id },
                relations: ["publisherMemberships", "publisherMemberships.publisher"]
            });
            
            if (!userEntity) return null;

            return {
                id: userEntity.id,
                username: userEntity.username,
                email: userEntity.email,
                avatarUrl: userEntity.avatarUrl,
                discordId: userEntity.discordId,
                discordAccessToken: userEntity.discordAccessToken,
                discordRefreshToken: userEntity.discordRefreshToken,
                patreonId: userEntity.patreonId,
                patreonAccessToken: userEntity.patreonAccessToken,
                patreonRefreshToken: userEntity.patreonRefreshToken,
                admin: userEntity.admin,
                createdAt: userEntity.createdAt,
                updatedAt: userEntity.updatedAt,
                publisherMemberships: userEntity.publisherMemberships || []
            };
        } catch (error) {
            console.error(`Error getting complete user ${id}:`, error);
            return null;
        }
    }

    // Static method for updates using TypeORM
    static async update(id: string, data: UserUpdateData): Promise<User> {
        const parsedData = userUpdateSchema.safeParse(data);
        if (!parsedData.success) {
            throw new Error(`Invalid user update data: ${JSON.stringify(parsedData.error.format())}`);
        }

        try {
            const userEntity = await UserEntity.findOne({ where: { id } });
            if (!userEntity) {
                throw new Error("User not found");
            }

            // Update properties
            Object.assign(userEntity, parsedData.data);
            
            const savedUser = await userEntity.save();
            
            return new User({
                id: savedUser.id,
                username: savedUser.username,
                email: savedUser.email,
                avatarUrl: savedUser.avatarUrl,
                discordId: savedUser.discordId,
                discordAccessToken: savedUser.discordAccessToken,
                discordRefreshToken: savedUser.discordRefreshToken,
                patreonId: savedUser.patreonId,
                patreonAccessToken: savedUser.patreonAccessToken,
                patreonRefreshToken: savedUser.patreonRefreshToken,
                admin: savedUser.admin,
                createdAt: savedUser.createdAt,
                updatedAt: savedUser.updatedAt,
            });
        } catch (error) {
            console.error(`Failed to update user ${id}:`, error);
            throw new Error(`Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Instance methods
    async save(): Promise<User> {
        const dataToSave: UserUpdateData = {
            username: this.username,
            avatarUrl: this.avatarUrl,
            admin: this.admin,
            discordAccessToken: this.discordAccessToken,
            discordRefreshToken: this.discordRefreshToken,
            patreonAccessToken: this.patreonAccessToken,
            patreonRefreshToken: this.patreonRefreshToken,
        };

        const updatedUser = await User.update(this.id, dataToSave);
        Object.assign(this, updatedUser);
        return this;
    }

    async delete(): Promise<void> {
        try {
            const userEntity = await UserEntity.findOne({ where: { id: this.id } });
            if (userEntity) {
                await userEntity.remove();
            }
        } catch (error) {
            throw new Error(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Business logic methods
    async isPatron(): Promise<boolean> {
        if (!this.patreonId) return false;
        return true;
    }

    async generateTokens(session: { id: number }): Promise<UserTokens> {
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
                expiresIn: '4h',
                issuer: 'ModpackStore',
            });

            const refreshToken = sign(payload, secret, {
                expiresIn: '30d',
                issuer: 'ModpackStore',
            });

            return { accessToken, refreshToken };
        } catch (error) {
            throw new Error(`Failed to generate tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Get teams/publishers using TypeORM relations
    async getTeams(): Promise<any[]> {
        try {
            const userEntity = await UserEntity.findOne({
                where: { id: this.id },
                relations: ["publisherMemberships", "publisherMemberships.publisher"]
            });

            if (!userEntity || !userEntity.publisherMemberships) {
                return [];
            }

            return userEntity.publisherMemberships.map(membership => membership.publisher);
        } catch (error: unknown) {
            console.error(`Error getting teams for user ${this.id}:`, error);
            throw new Error(`Failed to get publishers: ${error instanceof Error ? error.message : 'Unknown error'}`);
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