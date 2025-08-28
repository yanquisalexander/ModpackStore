"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
// src/models/User.ts
const client_1 = require("@/db/client");
const drizzle_orm_1 = require("drizzle-orm");
const user_1 = require("@/validators/user");
const schema_1 = require("@/db/schema");
const zod_1 = require("zod");
const jsonwebtoken_1 = require("jsonwebtoken");
require("dotenv/config");
const Publisher_model_1 = require("./Publisher.model");
// Zod schema for updates, allowing partial updates and omitting certain fields
const userUpdateSchema = user_1.userSchema.partial().omit({
    id: true,
    email: true, // Email changes typically require a verification process
    createdAt: true,
    updatedAt: true, // Should be set by the update method
    discordId: true, // Discord ID is set during initial link, not arbitrary update
    patreonId: true, // Patreon ID is set during initial link, not arbitrary update
}).extend({
    // Explicitly include fields that can be updated, including OAuth tokens
    username: user_1.userSchema.shape.username.optional(),
    avatarUrl: user_1.userSchema.shape.avatarUrl.optional().nullable(),
    admin: user_1.userSchema.shape.admin.optional(),
    discordAccessToken: user_1.userSchema.shape.discordAccessToken.optional().nullable(),
    discordRefreshToken: user_1.userSchema.shape.discordRefreshToken.optional().nullable(),
    patreonAccessToken: user_1.userSchema.shape.patreonAccessToken.optional().nullable(),
    patreonRefreshToken: user_1.userSchema.shape.patreonRefreshToken.optional().nullable(),
});
// Zod schemas for partial OAuth data updates
const partialDiscordDataSchema = zod_1.z.object({
    discordId: user_1.userSchema.shape.discordId.optional(), // Only if it's ever meant to be set outside initial link
    accessToken: user_1.userSchema.shape.discordAccessToken.optional(),
    refreshToken: user_1.userSchema.shape.discordRefreshToken.optional(),
}).partial();
const partialPatreonDataSchema = zod_1.z.object({
    patreonId: user_1.userSchema.shape.patreonId.optional(), // Only if it's ever meant to be set outside initial link
    accessToken: user_1.userSchema.shape.patreonAccessToken.optional(),
    refreshToken: user_1.userSchema.shape.patreonRefreshToken.optional(),
}).partial();
class User {
    constructor(data) {
        var _a;
        // OAuth data - grouped for better organization
        this._discordData = {};
        this._patreonData = {};
        // Required fields
        this.id = data.id;
        this.email = data.email;
        this.createdAt = data.createdAt;
        // Mutable fields
        this.username = data.username;
        this.avatarUrl = data.avatarUrl;
        this.updatedAt = data.updatedAt;
        this.admin = (_a = data.admin) !== null && _a !== void 0 ? _a : false;
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
    get discordId() { var _a; return (_a = this._discordData.discordId) !== null && _a !== void 0 ? _a : null; }
    get discordAccessToken() { var _a; return (_a = this._discordData.accessToken) !== null && _a !== void 0 ? _a : null; }
    get discordRefreshToken() { var _a; return (_a = this._discordData.refreshToken) !== null && _a !== void 0 ? _a : null; }
    get patreonId() { var _a; return (_a = this._patreonData.patreonId) !== null && _a !== void 0 ? _a : null; }
    get patreonAccessToken() { var _a; return (_a = this._patreonData.accessToken) !== null && _a !== void 0 ? _a : null; }
    get patreonRefreshToken() { var _a; return (_a = this._patreonData.refreshToken) !== null && _a !== void 0 ? _a : null; }
    // OAuth data setters with validation and persistence
    setDiscordData(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const parsedData = partialDiscordDataSchema.safeParse(data);
            if (!parsedData.success) {
                throw new Error(`Invalid Discord data: ${JSON.stringify(parsedData.error.format())}`);
            }
            if (parsedData.data.discordId)
                this._discordData.discordId = parsedData.data.discordId;
            if (parsedData.data.accessToken)
                this._discordData.accessToken = parsedData.data.accessToken;
            if (parsedData.data.refreshToken)
                this._discordData.refreshToken = parsedData.data.refreshToken;
            // Persist changes
            yield this.save();
        });
    }
    setPatreonData(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const parsedData = partialPatreonDataSchema.safeParse(data);
            if (!parsedData.success) {
                throw new Error(`Invalid Patreon data: ${JSON.stringify(parsedData.error.format())}`);
            }
            if (parsedData.data.patreonId)
                this._patreonData.patreonId = parsedData.data.patreonId;
            if (parsedData.data.accessToken)
                this._patreonData.accessToken = parsedData.data.accessToken;
            if (parsedData.data.refreshToken)
                this._patreonData.refreshToken = parsedData.data.refreshToken;
            // Persist changes
            yield this.save();
        });
    }
    // Static factory methods
    static fromJson(json) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        const parsed = user_1.userSchema.safeParse(json);
        if (!parsed.success) {
            throw new Error(`Invalid user data: ${JSON.stringify(parsed.error.format())}`);
        }
        return new User({
            id: (_a = parsed.data.id) !== null && _a !== void 0 ? _a : "",
            username: parsed.data.username,
            email: parsed.data.email,
            avatarUrl: (_b = parsed.data.avatarUrl) !== null && _b !== void 0 ? _b : null,
            createdAt: (_c = parsed.data.createdAt) !== null && _c !== void 0 ? _c : new Date(),
            updatedAt: (_d = parsed.data.updatedAt) !== null && _d !== void 0 ? _d : new Date(),
            admin: (_e = parsed.data.admin) !== null && _e !== void 0 ? _e : false,
            discordId: (_f = parsed.data.discordId) !== null && _f !== void 0 ? _f : null,
            discordAccessToken: (_g = parsed.data.discordAccessToken) !== null && _g !== void 0 ? _g : null,
            discordRefreshToken: (_h = parsed.data.discordRefreshToken) !== null && _h !== void 0 ? _h : null,
            patreonId: (_j = parsed.data.patreonId) !== null && _j !== void 0 ? _j : null,
            patreonAccessToken: (_k = parsed.data.patreonAccessToken) !== null && _k !== void 0 ? _k : null,
            patreonRefreshToken: (_l = parsed.data.patreonRefreshToken) !== null && _l !== void 0 ? _l : null,
        });
    }
    static create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const parsed = user_1.newUserSchema.safeParse(data);
            if (!parsed.success) {
                throw new Error(`Invalid user data: ${JSON.stringify(parsed.error.format())}`);
            }
            const now = new Date();
            try {
                const [inserted] = yield client_1.client
                    .insert(schema_1.UsersTable)
                    .values(Object.assign(Object.assign({}, parsed.data), { createdAt: now, updatedAt: now }))
                    .returning();
                return new User(inserted);
            }
            catch (error) {
                throw new Error(`Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    // Query methods with better error handling
    static findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(id === null || id === void 0 ? void 0 : id.trim()))
                return null;
            try {
                const [user] = yield client_1.client.select().from(schema_1.UsersTable).where((0, drizzle_orm_1.eq)(schema_1.UsersTable.id, id));
                return user ? new User(user) : null;
            }
            catch (error) {
                console.error(`Error finding user by ID ${id}:`, error);
                return null;
            }
        });
    }
    static findByDiscordId(discordId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(discordId === null || discordId === void 0 ? void 0 : discordId.trim()))
                return null;
            try {
                const [user] = yield client_1.client.select().from(schema_1.UsersTable).where((0, drizzle_orm_1.eq)(schema_1.UsersTable.discordId, discordId));
                return user ? new User(user) : null;
            }
            catch (error) {
                console.error(`Error finding user by Discord ID ${discordId}:`, error);
                return null;
            }
        });
    }
    static findByEmail(email) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(email === null || email === void 0 ? void 0 : email.trim()))
                return null;
            try {
                const [user] = yield client_1.client.select().from(schema_1.UsersTable).where((0, drizzle_orm_1.eq)(schema_1.UsersTable.email, email.toLowerCase()));
                return user ? new User(user) : null;
            }
            catch (error) {
                console.error(`Error finding user by email ${email}:`, error);
                return null;
            }
        });
    }
    static findByRefreshToken(refreshToken) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(refreshToken === null || refreshToken === void 0 ? void 0 : refreshToken.trim()))
                return null;
            try {
                // Secure JWT verification instead of manual parsing
                const secret = process.env.JWT_SECRET;
                if (!secret) {
                    throw new Error("JWT_SECRET is not configured");
                }
                const decoded = (0, jsonwebtoken_1.verify)(refreshToken, secret);
                const userId = decoded.sub;
                if (!userId) {
                    throw new Error("Invalid refresh token: userId is undefined");
                }
                return yield User.findById(userId);
            }
            catch (error) {
                console.error("Error finding user by refresh token:", error);
                return null;
            }
        });
    }
    // Enhanced query method with relations
    static getCompleteUser(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(id === null || id === void 0 ? void 0 : id.trim()))
                return null;
            try {
                const user = yield client_1.client.query.UsersTable.findFirst({
                    where: (0, drizzle_orm_1.eq)(schema_1.UsersTable.id, id),
                    with: {
                        publisherMemberships: true,
                    }
                });
                return user !== null && user !== void 0 ? user : null;
            }
            catch (error) {
                console.error(`Error getting complete user ${id}:`, error);
                return null;
            }
        });
    }
    // Static method for updates
    static update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const parsedData = userUpdateSchema.safeParse(data);
            if (!parsedData.success) {
                throw new Error(`Invalid user update data: ${JSON.stringify(parsedData.error.format())}`);
            }
            const updatePayload = Object.assign(Object.assign({}, parsedData.data), { updatedAt: new Date() });
            try {
                const [updatedUserRecord] = yield client_1.client
                    .update(schema_1.UsersTable)
                    .set(updatePayload)
                    .where((0, drizzle_orm_1.eq)(schema_1.UsersTable.id, id))
                    .returning();
                if (!updatedUserRecord) {
                    throw new Error("User not found or update failed");
                }
                return new User(updatedUserRecord);
            }
            catch (error) {
                // Log the error for debugging purposes
                console.error(`Failed to update user ${id}:`, error);
                // Throw a more generic error or a custom error
                throw new Error(`Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    // Instance methods
    save() {
        return __awaiter(this, void 0, void 0, function* () {
            // Data to be saved, ensure it aligns with UserUpdateData schema
            const dataToSave = {
                username: this.username,
                avatarUrl: this.avatarUrl,
                admin: this.admin,
                discordAccessToken: this.discordAccessToken,
                discordRefreshToken: this.discordRefreshToken,
                patreonAccessToken: this.patreonAccessToken,
                patreonRefreshToken: this.patreonRefreshToken,
            };
            const updatedUser = yield User.update(this.id, dataToSave);
            // Update current instance properties from the successfully saved user data
            Object.assign(this, updatedUser);
            return this;
        });
    }
    delete() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield client_1.client.delete(schema_1.UsersTable).where((0, drizzle_orm_1.eq)(schema_1.UsersTable.id, this.id));
            }
            catch (error) {
                throw new Error(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    // Business logic methods
    isPatron() {
        return __awaiter(this, void 0, void 0, function* () {
            // Enhanced logic - you could add more sophisticated checking here
            if (!this.patreonId)
                return false;
            // Add additional validation if needed:
            // - Check if patron status is still active
            // - Validate with Patreon API
            // - Check subscription level
            return true;
        });
    }
    generateTokens(session) {
        return __awaiter(this, void 0, void 0, function* () {
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                throw new Error("JWT_SECRET is not configured");
            }
            const payload = {
                sub: this.id,
                sessionId: session.id,
            };
            try {
                const accessToken = (0, jsonwebtoken_1.sign)(payload, secret, {
                    expiresIn: '4h',
                    issuer: 'ModpackStore', // Cambiado a ModpackStore
                });
                const refreshToken = (0, jsonwebtoken_1.sign)(payload, secret, {
                    expiresIn: '30d',
                    issuer: 'ModpackStore', // Cambiado a ModpackStore
                });
                return { accessToken, refreshToken };
            }
            catch (error) {
                throw new Error(`Failed to generate tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    // método para obtener a que teams/publishers/organizaciones
    //pertenece
    getTeams() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const publishersRaw = yield client_1.client
                    .select({ PublishersTable: schema_1.PublishersTable }) // Seleccionar explícitamente la tabla
                    .from(schema_1.PublishersTable)
                    .innerJoin(schema_1.PublisherMembersTable, (0, drizzle_orm_1.eq)(schema_1.PublishersTable.id, schema_1.PublisherMembersTable.publisherId))
                    .where((0, drizzle_orm_1.eq)(schema_1.PublisherMembersTable.userId, this.id));
                // publishersRaw es un array de objetos con la estructura { PublishersTable: ..., PublisherMembersTable: ... }
                return publishersRaw.map((row) => new Publisher_model_1.Publisher(row.PublishersTable));
            }
            catch (error) {
                console.error(`Error al obtener los equipos para el usuario ${this.id}:`, error);
                throw new Error(`Failed to get publishers: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    // Serialization methods
    toJson() {
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
    toPublicJson() {
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
    hasDiscordAuth() {
        return !!(this.discordId && this.discordAccessToken);
    }
    hasPatreonAuth() {
        return !!(this.patreonId && this.patreonAccessToken);
    }
    getDisplayName() {
        return this.username || this.email.split('@')[0];
    }
}
exports.User = User;
