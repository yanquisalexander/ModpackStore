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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Publisher = exports.scopeSchema = exports.publisherMemberSchema = exports.publisherUpdateSchema = exports.newPublisherSchema = exports.PublisherRole = void 0;
// src/models/Publisher.model.ts
const zod_1 = require("zod");
const client_1 = require("@/db/client");
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("@/db/schema");
// Enums
var PublisherRole;
(function (PublisherRole) {
    PublisherRole["OWNER"] = "owner";
    PublisherRole["ADMIN"] = "admin";
    PublisherRole["MEMBER"] = "member";
})(PublisherRole || (exports.PublisherRole = PublisherRole = {}));
// Validation schemas
exports.newPublisherSchema = zod_1.z.object({
    publisherName: zod_1.z.string().min(1).max(32),
    tosUrl: zod_1.z.string().url(),
    privacyUrl: zod_1.z.string().url(),
    bannerUrl: zod_1.z.string().url(),
    logoUrl: zod_1.z.string().url(),
    description: zod_1.z.string().min(1),
    websiteUrl: zod_1.z.string().url().optional(),
    discordUrl: zod_1.z.string().url().optional(),
    banned: zod_1.z.boolean().default(false),
    verified: zod_1.z.boolean().default(false),
    partnered: zod_1.z.boolean().default(false),
    isHostingPartner: zod_1.z.boolean().default(false),
});
exports.publisherUpdateSchema = exports.newPublisherSchema.partial();
exports.publisherMemberSchema = zod_1.z.object({
    publisherId: zod_1.z.string().uuid(),
    userId: zod_1.z.string().uuid(),
    role: zod_1.z.nativeEnum(PublisherRole),
});
exports.scopeSchema = zod_1.z.object({
    publisherId: zod_1.z.string().uuid().optional(),
    modpackId: zod_1.z.string().uuid().optional(),
    canCreateModpacks: zod_1.z.boolean().default(false),
    canEditModpacks: zod_1.z.boolean().default(false),
    canDeleteModpacks: zod_1.z.boolean().default(false),
    canPublishVersions: zod_1.z.boolean().default(false),
    canManageMembers: zod_1.z.boolean().default(false),
    canManageSettings: zod_1.z.boolean().default(false),
}).refine(data => data.publisherId || data.modpackId, {
    message: "Either publisherId or modpackId must be provided"
});
class Publisher {
    constructor(data) {
        var _a, _b, _c, _d;
        // Immutable fields
        this.id = data.id;
        this.createdAt = data.createdAt;
        // Mutable fields
        this.publisherName = data.publisherName;
        this.tosUrl = data.tosUrl;
        this.privacyUrl = data.privacyUrl;
        this.bannerUrl = data.bannerUrl;
        this.logoUrl = data.logoUrl;
        this.description = data.description;
        this.websiteUrl = data.websiteUrl;
        this.discordUrl = data.discordUrl;
        this.banned = (_a = data.banned) !== null && _a !== void 0 ? _a : false;
        this.verified = (_b = data.verified) !== null && _b !== void 0 ? _b : false;
        this.partnered = (_c = data.partnered) !== null && _c !== void 0 ? _c : false;
        this.isHostingPartner = (_d = data.isHostingPartner) !== null && _d !== void 0 ? _d : false;
    }
    // Static factory methods
    static create(data, ownerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const parsed = exports.newPublisherSchema.safeParse(data);
            if (!parsed.success) {
                throw new Error(`Invalid publisher data: ${JSON.stringify(parsed.error.format())}`);
            }
            const now = new Date();
            try {
                const newPublisher = yield client_1.client.transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                    // Create publisher
                    const [insertedPublisherRecord] = yield tx
                        .insert(schema_1.PublishersTable)
                        .values(Object.assign(Object.assign({}, parsed.data), { createdAt: now }))
                        .returning();
                    if (!insertedPublisherRecord) {
                        throw new Error("Publisher creation failed: No record returned.");
                    }
                    // Add owner as member
                    yield tx.insert(schema_1.PublisherMembersTable).values({
                        publisherId: insertedPublisherRecord.id,
                        userId: ownerId,
                        role: PublisherRole.OWNER,
                        createdAt: now,
                        updatedAt: now, // PublisherMembersTable has createdAt and updatedAt
                    });
                    return new Publisher(insertedPublisherRecord);
                }));
                return newPublisher;
            }
            catch (error) {
                console.error(`Failed to create publisher and add owner:`, error);
                throw new Error(`Failed to create publisher: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    // Query methods
    static findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(id === null || id === void 0 ? void 0 : id.trim()))
                return null;
            try {
                const [publisher] = yield client_1.client.select().from(schema_1.PublishersTable).where((0, drizzle_orm_1.eq)(schema_1.PublishersTable.id, id));
                return publisher ? new Publisher(publisher) : null;
            }
            catch (error) {
                console.error(`Error finding publisher by ID ${id}:`, error);
                return null;
            }
        });
    }
    static findByName(publisherName) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(publisherName === null || publisherName === void 0 ? void 0 : publisherName.trim()))
                return null;
            try {
                const [publisher] = yield client_1.client.select().from(schema_1.PublishersTable).where((0, drizzle_orm_1.eq)(schema_1.PublishersTable.publisherName, publisherName));
                return publisher ? new Publisher(publisher) : null;
            }
            catch (error) {
                console.error(`Error finding publisher by name ${publisherName}:`, error);
                return null;
            }
        });
    }
    static findByUser(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(userId === null || userId === void 0 ? void 0 : userId.trim()))
                return [];
            try {
                const publishers = yield client_1.client
                    .select({
                    id: schema_1.PublishersTable.id,
                    publisherName: schema_1.PublishersTable.publisherName,
                    tosUrl: schema_1.PublishersTable.tosUrl,
                    privacyUrl: schema_1.PublishersTable.privacyUrl,
                    bannerUrl: schema_1.PublishersTable.bannerUrl,
                    logoUrl: schema_1.PublishersTable.logoUrl,
                    description: schema_1.PublishersTable.description,
                    websiteUrl: schema_1.PublishersTable.websiteUrl,
                    discordUrl: schema_1.PublishersTable.discordUrl,
                    banned: schema_1.PublishersTable.banned,
                    verified: schema_1.PublishersTable.verified,
                    partnered: schema_1.PublishersTable.partnered,
                    isHostingPartner: schema_1.PublishersTable.isHostingPartner,
                    createdAt: schema_1.PublishersTable.createdAt,
                })
                    .from(schema_1.PublishersTable)
                    .innerJoin(schema_1.PublisherMembersTable, (0, drizzle_orm_1.eq)(schema_1.PublisherMembersTable.publisherId, schema_1.PublishersTable.id))
                    .where((0, drizzle_orm_1.eq)(schema_1.PublisherMembersTable.userId, userId));
                return publishers.map(publisher => new Publisher(publisher));
            }
            catch (error) {
                console.error(`Error finding publishers by user ${userId}:`, error);
                return [];
            }
        });
    }
    static findActive() {
        return __awaiter(this, arguments, void 0, function* (limit = 20, offset = 0) {
            try {
                const publishers = yield client_1.client
                    .select()
                    .from(schema_1.PublishersTable)
                    .where((0, drizzle_orm_1.eq)(schema_1.PublishersTable.banned, false))
                    .orderBy((0, drizzle_orm_1.desc)(schema_1.PublishersTable.createdAt))
                    .limit(limit)
                    .offset(offset);
                return publishers.map(publisher => new Publisher(publisher));
            }
            catch (error) {
                console.error("Error finding active publishers:", error);
                return [];
            }
        });
    }
    static getCompletePublisher(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(id === null || id === void 0 ? void 0 : id.trim()))
                return null;
            try {
                const publisher = yield client_1.client.query.PublishersTable.findFirst({
                    where: (0, drizzle_orm_1.eq)(schema_1.PublishersTable.id, id),
                    with: {
                        members: {
                            with: {
                                user: true,
                                scopes: true
                            }
                        },
                        modpacks: {
                            orderBy: (0, drizzle_orm_1.desc)(schema_1.ModpacksTable.updatedAt),
                            limit: 10
                        }
                    }
                });
                return publisher !== null && publisher !== void 0 ? publisher : null;
            }
            catch (error) {
                console.error(`Error getting complete publisher ${id}:`, error);
                return null;
            }
        });
    }
    // Static method for updates
    static update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const validationResult = exports.publisherUpdateSchema.safeParse(data);
            if (!validationResult.success) {
                throw new Error(`Invalid publisher update data: ${JSON.stringify(validationResult.error.format())}`);
            }
            if (Object.keys(validationResult.data).length === 0) {
                const currentPublisher = yield Publisher.findById(id);
                if (!currentPublisher)
                    throw new Error("Publisher not found for update with empty payload.");
                return currentPublisher;
            }
            // PublishersTable does not have an 'updatedAt' column in the provided schema.ts
            // If it were added, it would be:
            // const updatePayload = { ...validationResult.data, updatedAt: new Date() };
            const updatePayload = validationResult.data;
            try {
                const [updatedRecord] = yield client_1.client
                    .update(schema_1.PublishersTable)
                    .set(updatePayload)
                    .where((0, drizzle_orm_1.eq)(schema_1.PublishersTable.id, id))
                    .returning();
                if (!updatedRecord) {
                    throw new Error("Publisher not found or update failed.");
                }
                return new Publisher(updatedRecord);
            }
            catch (error) {
                console.error(`Failed to update publisher ${id}:`, error);
                throw new Error(`Failed to update publisher: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    // Instance methods
    save() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const dataToSave = {
                publisherName: this.publisherName,
                tosUrl: this.tosUrl,
                privacyUrl: this.privacyUrl,
                bannerUrl: this.bannerUrl,
                logoUrl: this.logoUrl,
                description: this.description,
                websiteUrl: (_a = this.websiteUrl) !== null && _a !== void 0 ? _a : undefined,
                discordUrl: (_b = this.discordUrl) !== null && _b !== void 0 ? _b : undefined,
                banned: this.banned,
                verified: this.verified,
                partnered: this.partnered,
                isHostingPartner: this.isHostingPartner,
            };
            const updatedPublisher = yield Publisher.update(this.id, dataToSave);
            // Update current instance properties
            Object.assign(this, updatedPublisher);
            return this;
        });
    }
    delete() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Note: This should cascade delete members, scopes, etc. according to your DB constraints
                yield client_1.client.delete(schema_1.PublishersTable).where((0, drizzle_orm_1.eq)(schema_1.PublishersTable.id, this.id));
            }
            catch (error) {
                throw new Error(`Failed to delete publisher: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    // Member management
    getMembers() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._members && this._members.length > 0) { // Check if cache is populated
                return this._members;
            }
            try {
                const membersData = yield client_1.client
                    .select({
                    id: schema_1.PublisherMembersTable.id,
                    role: schema_1.PublisherMembersTable.role,
                    userId: schema_1.PublisherMembersTable.userId,
                    userRecord: {
                        id: schema_1.UsersTable.id,
                        username: schema_1.UsersTable.username,
                        email: schema_1.UsersTable.email,
                        avatarUrl: schema_1.UsersTable.avatarUrl,
                    },
                    createdAt: schema_1.PublisherMembersTable.createdAt,
                    updatedAt: schema_1.PublisherMembersTable.updatedAt,
                })
                    .from(schema_1.PublisherMembersTable)
                    .innerJoin(schema_1.UsersTable, (0, drizzle_orm_1.eq)(schema_1.PublisherMembersTable.userId, schema_1.UsersTable.id))
                    .where((0, drizzle_orm_1.eq)(schema_1.PublisherMembersTable.publisherId, this.id));
                // This assumes the structure matches what's expected for `this._members`
                // Or, you might instantiate PublisherMember objects here if you have such a class.
                this._members = membersData.map(m => ({
                    id: m.id,
                    role: m.role,
                    userId: m.userId,
                    user: m.userRecord, // Map to 'user'
                    createdAt: m.createdAt,
                    updatedAt: m.updatedAt,
                }));
                return this._members;
            }
            catch (error) {
                console.error(`Error getting members for publisher ${this.id}:`, error);
                return [];
            }
        });
    }
    getMember(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [member] = yield client_1.client
                    .select()
                    .from(schema_1.PublisherMembersTable)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.PublisherMembersTable.publisherId, this.id), (0, drizzle_orm_1.eq)(schema_1.PublisherMembersTable.userId, userId)));
                return member || null;
            }
            catch (error) {
                console.error(`Error getting member ${userId} for publisher ${this.id}:`, error);
                return null;
            }
        });
    }
    addMember(userId, role) {
        return __awaiter(this, void 0, void 0, function* () {
            const memberData = exports.publisherMemberSchema.safeParse({
                publisherId: this.id,
                userId: userId,
                role: role,
            });
            if (!memberData.success) {
                throw new Error(`Invalid member data: ${JSON.stringify(memberData.error.format())}`);
            }
            try {
                const now = new Date();
                yield client_1.client.insert(schema_1.PublisherMembersTable).values({
                    publisherId: this.id,
                    userId: userId,
                    role: role,
                    createdAt: now,
                    updatedAt: now,
                });
                this._members = undefined; // Clear cache
            }
            catch (error) {
                throw new Error(`Failed to add member: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    removeMember(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield client_1.client.delete(schema_1.PublisherMembersTable).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.PublisherMembersTable.publisherId, this.id), (0, drizzle_orm_1.eq)(schema_1.PublisherMembersTable.userId, userId)));
                this._members = undefined; // Clear cache
            }
            catch (error) {
                throw new Error(`Failed to remove member: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    updateMemberRole(userId, newRole) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield client_1.client.update(schema_1.PublisherMembersTable)
                    .set({
                    role: newRole,
                    updatedAt: new Date()
                })
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.PublisherMembersTable.publisherId, this.id), (0, drizzle_orm_1.eq)(schema_1.PublisherMembersTable.userId, userId)));
                this._members = undefined; // Clear cache
            }
            catch (error) {
                throw new Error(`Failed to update member role: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    // Scopes management
    getMemberScopes(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const member = yield this.getMember(userId);
                if (!member)
                    return [];
                const scopes = yield client_1.client
                    .select()
                    .from(schema_1.ScopesTable)
                    .where((0, drizzle_orm_1.eq)(schema_1.ScopesTable.publisherMemberId, member.id));
                return scopes;
            }
            catch (error) {
                console.error(`Error getting scopes for member ${userId}:`, error);
                return [];
            }
        });
    }
    addMemberScope(userId, scopeData) {
        return __awaiter(this, void 0, void 0, function* () {
            const parsed = exports.scopeSchema.safeParse(scopeData);
            if (!parsed.success) {
                throw new Error(`Invalid scope data: ${JSON.stringify(parsed.error.format())}`);
            }
            try {
                const member = yield this.getMember(userId);
                if (!member) {
                    throw new Error(`User ${userId} is not a member of this publisher`);
                }
                const now = new Date();
                yield client_1.client.insert(schema_1.ScopesTable).values({
                    publisherMemberId: member.id,
                    publisherId: parsed.data.publisherId,
                    modpackId: parsed.data.modpackId,
                    canCreateModpacks: parsed.data.canCreateModpacks,
                    canEditModpacks: parsed.data.canEditModpacks,
                    canDeleteModpacks: parsed.data.canDeleteModpacks,
                    canPublishVersions: parsed.data.canPublishVersions,
                    canManageMembers: parsed.data.canManageMembers,
                    canManageSettings: parsed.data.canManageSettings,
                    createdAt: now,
                    updatedAt: now,
                });
            }
            catch (error) {
                throw new Error(`Failed to add scope: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    removeMemberScope(userId, scopeId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const member = yield this.getMember(userId);
                if (!member) {
                    throw new Error(`User ${userId} is not a member of this publisher`);
                }
                yield client_1.client.delete(schema_1.ScopesTable).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.ScopesTable.id, scopeId), (0, drizzle_orm_1.eq)(schema_1.ScopesTable.publisherMemberId, member.id)));
            }
            catch (error) {
                throw new Error(`Failed to remove scope: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    // Modpacks management
    getModpacks() {
        return __awaiter(this, arguments, void 0, function* (limit = 20, offset = 0) {
            try {
                const modpacks = yield client_1.client
                    .select()
                    .from(schema_1.ModpacksTable)
                    .where((0, drizzle_orm_1.eq)(schema_1.ModpacksTable.publisherId, this.id))
                    .orderBy((0, drizzle_orm_1.desc)(schema_1.ModpacksTable.updatedAt))
                    .limit(limit)
                    .offset(offset);
                return modpacks;
            }
            catch (error) {
                console.error(`Error getting modpacks for publisher ${this.id}:`, error);
                return [];
            }
        });
    }
    getModpacksCount() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [result] = yield client_1.client
                    .select({ count: (0, drizzle_orm_1.count)() })
                    .from(schema_1.ModpacksTable)
                    .where((0, drizzle_orm_1.eq)(schema_1.ModpacksTable.publisherId, this.id));
                return Number(result.count) || 0;
            }
            catch (error) {
                console.error(`Error getting modpacks count for publisher ${this.id}:`, error);
                return 0;
            }
        });
    }
    // Permission checks
    hasUserPermission(userId, permission, modpackId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const member = yield this.getMember(userId);
                if (!member)
                    return false;
                // Owners and admins have all permissions
                if (member.role === PublisherRole.OWNER || member.role === PublisherRole.ADMIN) {
                    return true;
                }
                const scopes = yield this.getMemberScopes(userId);
                // Check organization-level permissions
                const orgScope = scopes.find(scope => scope.publisherId === this.id && !scope.modpackId);
                if (orgScope && orgScope[permission]) {
                    return true;
                }
                // Check modpack-specific permissions if modpackId is provided
                if (modpackId) {
                    const modpackScope = scopes.find(scope => scope.modpackId === modpackId);
                    if (modpackScope && modpackScope[permission]) {
                        return true;
                    }
                }
                return false;
            }
            catch (error) {
                console.error(`Error checking permission ${permission} for user ${userId}:`, error);
                return false;
            }
        });
    }
    isUserMember(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const member = yield this.getMember(userId);
            return !!member;
        });
    }
    isUserOwner(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const member = yield this.getMember(userId);
            return (member === null || member === void 0 ? void 0 : member.role) === PublisherRole.OWNER;
        });
    }
    isUserAdmin(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const member = yield this.getMember(userId);
            return (member === null || member === void 0 ? void 0 : member.role) === PublisherRole.ADMIN || (member === null || member === void 0 ? void 0 : member.role) === PublisherRole.OWNER;
        });
    }
    // Business logic methods
    isBanned() {
        return this.banned;
    }
    isVerified() {
        return this.verified;
    }
    isPartnered() {
        return this.partnered;
    }
    canCreateModpacks() {
        return !this.banned;
    }
    // Serialization methods
    toJson() {
        return {
            id: this.id,
            publisherName: this.publisherName,
            tosUrl: this.tosUrl,
            privacyUrl: this.privacyUrl,
            bannerUrl: this.bannerUrl,
            logoUrl: this.logoUrl,
            description: this.description,
            websiteUrl: this.websiteUrl,
            discordUrl: this.discordUrl,
            banned: this.banned,
            verified: this.verified,
            partnered: this.partnered,
            isHostingPartner: this.isHostingPartner,
            createdAt: this.createdAt,
        };
    }
    toPublicJson() {
        const _a = this.toJson(), { banned } = _a, publicData = __rest(_a, ["banned"]);
        return publicData;
    }
    // Utility methods
    getDisplayName() {
        return this.publisherName;
    }
    getUrl() {
        return `/publisher/${this.publisherName.toLowerCase().replace(/\s+/g, '-')}`;
    }
    hasWebsite() {
        return !!this.websiteUrl;
    }
    hasDiscord() {
        return !!this.discordUrl;
    }
    getBadges() {
        const badges = [];
        if (this.verified)
            badges.push('verified');
        if (this.partnered)
            badges.push('partnered');
        if (this.isHostingPartner)
            badges.push('hosting-partner');
        return badges;
    }
}
exports.Publisher = Publisher;
