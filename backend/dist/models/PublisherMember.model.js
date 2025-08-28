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
exports.PublisherMember = exports.invitePublisherMemberSchema = exports.publisherMemberUpdateSchema = exports.newPublisherMemberSchema = exports.PublisherRole = void 0;
// src/models/PublisherMember.model.ts
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
// Role hierarchy for permission checking
const ROLE_HIERARCHY = {
    [PublisherRole.OWNER]: 3,
    [PublisherRole.ADMIN]: 2,
    [PublisherRole.MEMBER]: 1,
};
// Validation schemas
exports.newPublisherMemberSchema = zod_1.z.object({
    publisherId: zod_1.z.string().uuid(),
    userId: zod_1.z.string().uuid(),
    role: zod_1.z.nativeEnum(PublisherRole),
});
exports.publisherMemberUpdateSchema = zod_1.z.object({
    role: zod_1.z.nativeEnum(PublisherRole),
});
exports.invitePublisherMemberSchema = zod_1.z.object({
    publisherId: zod_1.z.string().uuid(),
    userEmail: zod_1.z.string().email(),
    role: zod_1.z.nativeEnum(PublisherRole),
});
class PublisherMember {
    constructor(data) {
        // Immutable fields
        this.id = data.id;
        this.publisherId = data.publisherId;
        this.userId = data.userId;
        this.createdAt = data.createdAt;
        // Mutable fields
        this.role = data.role;
        this.updatedAt = data.updatedAt;
    }
    // Static factory methods
    static create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const parsed = exports.newPublisherMemberSchema.safeParse(data);
            if (!parsed.success) {
                throw new Error(`Invalid publisher member data: ${JSON.stringify(parsed.error.format())}`);
            }
            // Check if membership already exists
            const existingMember = yield PublisherMember.findByPublisherAndUser(parsed.data.publisherId, parsed.data.userId);
            if (existingMember) {
                throw new Error(`User is already a member of this publisher`);
            }
            // Check if publisher exists
            const [publisher] = yield client_1.client
                .select()
                .from(schema_1.PublishersTable)
                .where((0, drizzle_orm_1.eq)(schema_1.PublishersTable.id, parsed.data.publisherId));
            if (!publisher) {
                throw new Error(`Publisher with ID ${parsed.data.publisherId} not found`);
            }
            // Check if user exists
            const [user] = yield client_1.client
                .select()
                .from(schema_1.UsersTable)
                .where((0, drizzle_orm_1.eq)(schema_1.UsersTable.id, parsed.data.userId));
            if (!user) {
                throw new Error(`User with ID ${parsed.data.userId} not found`);
            }
            const now = new Date();
            try {
                const [inserted] = yield client_1.client
                    .insert(schema_1.PublisherMembersTable)
                    .values(Object.assign(Object.assign({}, parsed.data), { createdAt: now, updatedAt: now }))
                    .returning();
                return new PublisherMember(inserted);
            }
            catch (error) {
                throw new Error(`Failed to create publisher member: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    // Query methods
    static findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!id)
                return null;
            try {
                const [member] = yield client_1.client
                    .select()
                    .from(schema_1.PublisherMembersTable)
                    .where((0, drizzle_orm_1.eq)(schema_1.PublisherMembersTable.id, id));
                return member ? new PublisherMember(member) : null;
            }
            catch (error) {
                console.error(`Error finding publisher member by ID ${id}:`, error);
                return null;
            }
        });
    }
    static findByPublisherAndUser(publisherId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(publisherId === null || publisherId === void 0 ? void 0 : publisherId.trim()) || !(userId === null || userId === void 0 ? void 0 : userId.trim()))
                return null;
            try {
                const [member] = yield client_1.client
                    .select()
                    .from(schema_1.PublisherMembersTable)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.PublisherMembersTable.publisherId, publisherId), (0, drizzle_orm_1.eq)(schema_1.PublisherMembersTable.userId, userId)));
                return member ? new PublisherMember(member) : null;
            }
            catch (error) {
                console.error(`Error finding publisher member by publisher ${publisherId} and user ${userId}:`, error);
                return null;
            }
        });
    }
    static findByPublisher(publisherId_1) {
        return __awaiter(this, arguments, void 0, function* (publisherId, limit = 50, offset = 0) {
            if (!(publisherId === null || publisherId === void 0 ? void 0 : publisherId.trim()))
                return [];
            try {
                const members = yield client_1.client
                    .select()
                    .from(schema_1.PublisherMembersTable)
                    .where((0, drizzle_orm_1.eq)(schema_1.PublisherMembersTable.publisherId, publisherId))
                    .orderBy((0, drizzle_orm_1.desc)(schema_1.PublisherMembersTable.createdAt))
                    .limit(limit)
                    .offset(offset);
                return members.map(member => new PublisherMember(member));
            }
            catch (error) {
                console.error(`Error finding members by publisher ${publisherId}:`, error);
                return [];
            }
        });
    }
    static findByUser(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, limit = 50, offset = 0) {
            if (!(userId === null || userId === void 0 ? void 0 : userId.trim()))
                return [];
            try {
                const members = yield client_1.client
                    .select()
                    .from(schema_1.PublisherMembersTable)
                    .where((0, drizzle_orm_1.eq)(schema_1.PublisherMembersTable.userId, userId))
                    .orderBy((0, drizzle_orm_1.desc)(schema_1.PublisherMembersTable.createdAt))
                    .limit(limit)
                    .offset(offset);
                return members.map(member => new PublisherMember(member));
            }
            catch (error) {
                console.error(`Error finding memberships by user ${userId}:`, error);
                return [];
            }
        });
    }
    static findByRole(publisherId, role) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(publisherId === null || publisherId === void 0 ? void 0 : publisherId.trim()))
                return [];
            try {
                const members = yield client_1.client
                    .select()
                    .from(schema_1.PublisherMembersTable)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.PublisherMembersTable.publisherId, publisherId), (0, drizzle_orm_1.eq)(schema_1.PublisherMembersTable.role, role)))
                    .orderBy((0, drizzle_orm_1.desc)(schema_1.PublisherMembersTable.createdAt));
                return members.map(member => new PublisherMember(member));
            }
            catch (error) {
                console.error(`Error finding members by role ${role} for publisher ${publisherId}:`, error);
                return [];
            }
        });
    }
    static getCompleteMember(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!id)
                return null;
            try {
                const member = yield client_1.client.query.PublisherMembersTable.findFirst({
                    where: (0, drizzle_orm_1.eq)(schema_1.PublisherMembersTable.id, id),
                    with: {
                        publisher: true,
                        user: true,
                        scopes: true
                    }
                });
                return member !== null && member !== void 0 ? member : null;
            }
            catch (error) {
                console.error(`Error getting complete member ${id}:`, error);
                return null;
            }
        });
    }
    static getMembersWithDetails(publisherId_1) {
        return __awaiter(this, arguments, void 0, function* (publisherId, limit = 50, offset = 0) {
            if (!(publisherId === null || publisherId === void 0 ? void 0 : publisherId.trim()))
                return [];
            try {
                const members = yield client_1.client
                    .select({
                    id: schema_1.PublisherMembersTable.id,
                    role: schema_1.PublisherMembersTable.role,
                    createdAt: schema_1.PublisherMembersTable.createdAt,
                    updatedAt: schema_1.PublisherMembersTable.updatedAt,
                    user: {
                        id: schema_1.UsersTable.id,
                        username: schema_1.UsersTable.username,
                        email: schema_1.UsersTable.email,
                        avatarUrl: schema_1.UsersTable.avatarUrl,
                    }
                })
                    .from(schema_1.PublisherMembersTable)
                    .innerJoin(schema_1.UsersTable, (0, drizzle_orm_1.eq)(schema_1.PublisherMembersTable.userId, schema_1.UsersTable.id))
                    .where((0, drizzle_orm_1.eq)(schema_1.PublisherMembersTable.publisherId, publisherId))
                    .orderBy((0, drizzle_orm_1.desc)(schema_1.PublisherMembersTable.createdAt))
                    .limit(limit)
                    .offset(offset);
                return members;
            }
            catch (error) {
                console.error(`Error getting members with details for publisher ${publisherId}:`, error);
                return [];
            }
        });
    }
    // Static method for updates
    static update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const validationResult = exports.publisherMemberUpdateSchema.safeParse(data);
            if (!validationResult.success) {
                throw new Error(`Invalid publisher member update data: ${JSON.stringify(validationResult.error.format())}`);
            }
            if (Object.keys(validationResult.data).length === 0) {
                const currentMember = yield PublisherMember.findById(id);
                if (!currentMember)
                    throw new Error("PublisherMember not found for update with empty payload.");
                return currentMember;
            }
            const updatePayload = Object.assign(Object.assign({}, validationResult.data), { updatedAt: new Date() });
            try {
                const [updatedRecord] = yield client_1.client
                    .update(schema_1.PublisherMembersTable)
                    .set(updatePayload)
                    .where((0, drizzle_orm_1.eq)(schema_1.PublisherMembersTable.id, id))
                    .returning();
                if (!updatedRecord) {
                    throw new Error("PublisherMember not found or update failed.");
                }
                return new PublisherMember(updatedRecord);
            }
            catch (error) {
                console.error(`Failed to update publisher member ${id}:`, error);
                throw new Error(`Failed to update publisher member: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    // Instance methods
    save() {
        return __awaiter(this, void 0, void 0, function* () {
            const dataToSave = {
                role: this.role,
            };
            const updatedMember = yield PublisherMember.update(this.id, dataToSave);
            // Update current instance properties
            this.role = updatedMember.role;
            this.updatedAt = updatedMember.updatedAt;
            return this;
        });
    }
    delete() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Note: This should cascade delete scopes according to your DB constraints
                yield client_1.client.delete(schema_1.PublisherMembersTable).where((0, drizzle_orm_1.eq)(schema_1.PublisherMembersTable.id, this.id));
            }
            catch (error) {
                throw new Error(`Failed to delete publisher member: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    updateRole(newRole, updatedByUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Prevent self-demotion of last owner
            if (this.role === PublisherRole.OWNER && newRole !== PublisherRole.OWNER) {
                const owners = yield PublisherMember.findByRole(this.publisherId, PublisherRole.OWNER);
                if (owners.length === 1) {
                    throw new Error("Cannot demote the last owner of the publisher");
                }
            }
            // Call the static update method
            const updatedMember = yield PublisherMember.update(this.id, { role: newRole });
            // Update instance properties
            this.role = updatedMember.role;
            this.updatedAt = updatedMember.updatedAt;
            return this;
        });
    }
    // Relation methods
    getPublisher() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._publisher) {
                return this._publisher;
            }
            try {
                const [publisher] = yield client_1.client
                    .select()
                    .from(schema_1.PublishersTable)
                    .where((0, drizzle_orm_1.eq)(schema_1.PublishersTable.id, this.publisherId));
                this._publisher = publisher || null;
                return this._publisher;
            }
            catch (error) {
                console.error(`Error getting publisher for member ${this.id}:`, error);
                return null;
            }
        });
    }
    getUser() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._user) {
                return this._user;
            }
            try {
                const [user] = yield client_1.client
                    .select()
                    .from(schema_1.UsersTable)
                    .where((0, drizzle_orm_1.eq)(schema_1.UsersTable.id, this.userId));
                this._user = user || null;
                return this._user;
            }
            catch (error) {
                console.error(`Error getting user for member ${this.id}:`, error);
                return null;
            }
        });
    }
    getScopes() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._scopes) {
                return this._scopes;
            }
            try {
                const scopes = yield client_1.client
                    .select()
                    .from(schema_1.ScopesTable)
                    .where((0, drizzle_orm_1.eq)(schema_1.ScopesTable.publisherMemberId, this.id));
                this._scopes = scopes;
                return this._scopes;
            }
            catch (error) {
                console.error(`Error getting scopes for member ${this.id}:`, error);
                return [];
            }
        });
    }
    // Permission methods
    isOwner() {
        return this.role === PublisherRole.OWNER;
    }
    isAdmin() {
        return this.role === PublisherRole.ADMIN;
    }
    isMember() {
        return this.role === PublisherRole.MEMBER;
    }
    hasRoleOrHigher(role) {
        return ROLE_HIERARCHY[this.role] >= ROLE_HIERARCHY[role];
    }
    canManageRole(targetRole) {
        // Owners can manage anyone
        if (this.isOwner())
            return true;
        // Admins can manage members but not other admins or owners
        if (this.isAdmin()) {
            return targetRole === PublisherRole.MEMBER;
        }
        // Members cannot manage roles
        return false;
    }
    canPromoteTo(targetRole) {
        // Owners can promote to any role
        if (this.isOwner())
            return true;
        // Admins can only promote to member
        if (this.isAdmin()) {
            return targetRole === PublisherRole.MEMBER;
        }
        return false;
    }
    hasPermission(permission, modpackId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Owners and admins have all permissions
            if (this.isOwner() || this.isAdmin()) {
                return true;
            }
            try {
                const scopes = yield this.getScopes();
                // Check organization-level permissions
                const orgScope = scopes.find(scope => scope.publisherId === this.publisherId && !scope.modpackId);
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
                console.error(`Error checking permission ${permission} for member ${this.id}:`, error);
                return false;
            }
        });
    }
    // Business logic methods
    getDaysAsMember() {
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - this.createdAt.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    isRecentMember(days = 7) {
        return this.getDaysAsMember() <= days;
    }
    wasRecentlyUpdated(hours = 24) {
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - this.updatedAt.getTime());
        const diffHours = diffTime / (1000 * 60 * 60);
        return diffHours <= hours;
    }
    // Serialization methods
    toJson() {
        return {
            id: this.id,
            publisherId: this.publisherId,
            userId: this.userId,
            role: this.role,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
    toPublicJson() {
        const _a = this.toJson(), { updatedAt } = _a, publicData = __rest(_a, ["updatedAt"]);
        return publicData;
    }
    toJsonWithDetails() {
        return __awaiter(this, void 0, void 0, function* () {
            const [publisher, user, scopes] = yield Promise.all([
                this.getPublisher(),
                this.getUser(),
                this.getScopes()
            ]);
            return Object.assign(Object.assign({}, this.toJson()), { publisher, user: user ? {
                    id: user.id,
                    username: user.username,
                    avatarUrl: user.avatarUrl
                } : null, scopes });
        });
    }
    // Utility methods
    getRoleDisplayName() {
        const roleNames = {
            [PublisherRole.OWNER]: 'Owner',
            [PublisherRole.ADMIN]: 'Administrator',
            [PublisherRole.MEMBER]: 'Member',
        };
        return roleNames[this.role];
    }
    getRoleBadgeColor() {
        const colors = {
            [PublisherRole.OWNER]: 'red',
            [PublisherRole.ADMIN]: 'blue',
            [PublisherRole.MEMBER]: 'gray',
        };
        return colors[this.role];
    }
    getJoinedDate() {
        return this.createdAt.toLocaleDateString();
    }
}
exports.PublisherMember = PublisherMember;
