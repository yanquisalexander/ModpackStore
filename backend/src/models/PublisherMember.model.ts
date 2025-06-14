// src/models/PublisherMember.model.ts
import { z } from "zod";
import { client as db } from "@/db/client";
import { eq, and, desc } from "drizzle-orm";
import {
    PublisherMembersTable,
    PublishersTable,
    UsersTable,
    ScopesTable
} from "@/db/schema";

// Types
type PublisherMemberType = typeof PublisherMembersTable.$inferSelect;
type NewPublisherMember = typeof PublisherMembersTable.$inferInsert;
type PublisherMemberUpdateData = Partial<Omit<NewPublisherMember, "id" | "publisherId" | "userId" | "createdAt">>;

// Enums
export enum PublisherRole {
    OWNER = 'owner',
    ADMIN = 'admin',
    MEMBER = 'member'
}

// Role hierarchy for permission checking
const ROLE_HIERARCHY: Record<PublisherRole, number> = {
    [PublisherRole.OWNER]: 3,
    [PublisherRole.ADMIN]: 2,
    [PublisherRole.MEMBER]: 1,
};

// Validation schemas
export const newPublisherMemberSchema = z.object({
    publisherId: z.string().uuid(),
    userId: z.string().uuid(),
    role: z.nativeEnum(PublisherRole),
});

export const publisherMemberUpdateSchema = z.object({
    role: z.nativeEnum(PublisherRole),
});

export const invitePublisherMemberSchema = z.object({
    publisherId: z.string().uuid(),
    userEmail: z.string().email(),
    role: z.nativeEnum(PublisherRole),
});

export class PublisherMember {
    readonly id: number;
    readonly publisherId: string;
    readonly userId: string;
    readonly createdAt: Date;

    role: PublisherRole;
    updatedAt: Date;

    // Cached relations
    private _publisher?: any;
    private _user?: any;
    private _scopes?: any[];

    constructor(data: PublisherMemberType) {
        // Immutable fields
        this.id = data.id;
        this.publisherId = data.publisherId;
        this.userId = data.userId;
        this.createdAt = data.createdAt;

        // Mutable fields
        this.role = data.role as PublisherRole;
        this.updatedAt = data.updatedAt;
    }

    // Static factory methods
    static async create(data: z.infer<typeof newPublisherMemberSchema>): Promise<PublisherMember> {
        const parsed = newPublisherMemberSchema.safeParse(data);
        if (!parsed.success) {
            throw new Error(`Invalid publisher member data: ${JSON.stringify(parsed.error.format())}`);
        }

        // Check if membership already exists
        const existingMember = await PublisherMember.findByPublisherAndUser(
            parsed.data.publisherId,
            parsed.data.userId
        );
        if (existingMember) {
            throw new Error(`User is already a member of this publisher`);
        }

        // Check if publisher exists
        const [publisher] = await db
            .select()
            .from(PublishersTable)
            .where(eq(PublishersTable.id, parsed.data.publisherId));

        if (!publisher) {
            throw new Error(`Publisher with ID ${parsed.data.publisherId} not found`);
        }

        // Check if user exists
        const [user] = await db
            .select()
            .from(UsersTable)
            .where(eq(UsersTable.id, parsed.data.userId));

        if (!user) {
            throw new Error(`User with ID ${parsed.data.userId} not found`);
        }

        const now = new Date();

        try {
            const [inserted] = await db
                .insert(PublisherMembersTable)
                .values({
                    ...parsed.data,
                    createdAt: now,
                    updatedAt: now,
                })
                .returning();

            return new PublisherMember(inserted);
        } catch (error) {
            throw new Error(`Failed to create publisher member: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Query methods
    static async findById(id: number): Promise<PublisherMember | null> {
        if (!id) return null;

        try {
            const [member] = await db
                .select()
                .from(PublisherMembersTable)
                .where(eq(PublisherMembersTable.id, id));

            return member ? new PublisherMember(member) : null;
        } catch (error) {
            console.error(`Error finding publisher member by ID ${id}:`, error);
            return null;
        }
    }

    static async findByPublisherAndUser(publisherId: string, userId: string): Promise<PublisherMember | null> {
        if (!publisherId?.trim() || !userId?.trim()) return null;

        try {
            const [member] = await db
                .select()
                .from(PublisherMembersTable)
                .where(
                    and(
                        eq(PublisherMembersTable.publisherId, publisherId),
                        eq(PublisherMembersTable.userId, userId)
                    )
                );

            return member ? new PublisherMember(member) : null;
        } catch (error) {
            console.error(`Error finding publisher member by publisher ${publisherId} and user ${userId}:`, error);
            return null;
        }
    }

    static async findByPublisher(publisherId: string, limit = 50, offset = 0): Promise<PublisherMember[]> {
        if (!publisherId?.trim()) return [];

        try {
            const members = await db
                .select()
                .from(PublisherMembersTable)
                .where(eq(PublisherMembersTable.publisherId, publisherId))
                .orderBy(desc(PublisherMembersTable.createdAt))
                .limit(limit)
                .offset(offset);

            return members.map(member => new PublisherMember(member));
        } catch (error) {
            console.error(`Error finding members by publisher ${publisherId}:`, error);
            return [];
        }
    }

    static async findByUser(userId: string, limit = 50, offset = 0): Promise<PublisherMember[]> {
        if (!userId?.trim()) return [];

        try {
            const members = await db
                .select()
                .from(PublisherMembersTable)
                .where(eq(PublisherMembersTable.userId, userId))
                .orderBy(desc(PublisherMembersTable.createdAt))
                .limit(limit)
                .offset(offset);

            return members.map(member => new PublisherMember(member));
        } catch (error) {
            console.error(`Error finding memberships by user ${userId}:`, error);
            return [];
        }
    }

    static async findByRole(publisherId: string, role: PublisherRole): Promise<PublisherMember[]> {
        if (!publisherId?.trim()) return [];

        try {
            const members = await db
                .select()
                .from(PublisherMembersTable)
                .where(
                    and(
                        eq(PublisherMembersTable.publisherId, publisherId),
                        eq(PublisherMembersTable.role, role)
                    )
                )
                .orderBy(desc(PublisherMembersTable.createdAt));

            return members.map(member => new PublisherMember(member));
        } catch (error) {
            console.error(`Error finding members by role ${role} for publisher ${publisherId}:`, error);
            return [];
        }
    }

    static async getCompleteMember(id: number) {
        if (!id) return null;

        try {
            const member = await db.query.PublisherMembersTable.findFirst({
                where: eq(PublisherMembersTable.id, id),
                with: {
                    publisher: true,
                    user: true,
                    scopes: true
                }
            });
            return member ?? null;
        } catch (error) {
            console.error(`Error getting complete member ${id}:`, error);
            return null;
        }
    }

    static async getMembersWithDetails(publisherId: string, limit = 50, offset = 0) {
        if (!publisherId?.trim()) return [];

        try {
            const members = await db
                .select({
                    id: PublisherMembersTable.id,
                    role: PublisherMembersTable.role,
                    createdAt: PublisherMembersTable.createdAt,
                    updatedAt: PublisherMembersTable.updatedAt,
                    user: {
                        id: UsersTable.id,
                        username: UsersTable.username,
                        email: UsersTable.email,
                        avatarUrl: UsersTable.avatarUrl,
                    }
                })
                .from(PublisherMembersTable)
                .innerJoin(UsersTable, eq(PublisherMembersTable.userId, UsersTable.id))
                .where(eq(PublisherMembersTable.publisherId, publisherId))
                .orderBy(desc(PublisherMembersTable.createdAt))
                .limit(limit)
                .offset(offset);

            return members;
        } catch (error) {
            console.error(`Error getting members with details for publisher ${publisherId}:`, error);
            return [];
        }
    }

    // Static method for updates
    static async update(id: number, data: z.infer<typeof publisherMemberUpdateSchema>): Promise<PublisherMember> {
        const validationResult = publisherMemberUpdateSchema.safeParse(data);
        if (!validationResult.success) {
            throw new Error(`Invalid publisher member update data: ${JSON.stringify(validationResult.error.format())}`);
        }

        if (Object.keys(validationResult.data).length === 0) {
            const currentMember = await PublisherMember.findById(id);
            if (!currentMember) throw new Error("PublisherMember not found for update with empty payload.");
            return currentMember;
        }

        const updatePayload = {
            ...validationResult.data,
            updatedAt: new Date(),
        };

        try {
            const [updatedRecord] = await db
                .update(PublisherMembersTable)
                .set(updatePayload)
                .where(eq(PublisherMembersTable.id, id))
                .returning();

            if (!updatedRecord) {
                throw new Error("PublisherMember not found or update failed.");
            }
            return new PublisherMember(updatedRecord);
        } catch (error) {
            console.error(`Failed to update publisher member ${id}:`, error);
            throw new Error(`Failed to update publisher member: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Instance methods
    async save(): Promise<PublisherMember> {
        const dataToSave: z.infer<typeof publisherMemberUpdateSchema> = {
            role: this.role,
        };

        const updatedMember = await PublisherMember.update(this.id, dataToSave);
        // Update current instance properties
        this.role = updatedMember.role;
        this.updatedAt = updatedMember.updatedAt;
        return this;
    }

    async delete(): Promise<void> {
        try {
            // Note: This should cascade delete scopes according to your DB constraints
            await db.delete(PublisherMembersTable).where(eq(PublisherMembersTable.id, this.id));
        } catch (error) {
            throw new Error(`Failed to delete publisher member: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async updateRole(newRole: PublisherRole, updatedByUserId?: string): Promise<PublisherMember> {
        // Prevent self-demotion of last owner
        if (this.role === PublisherRole.OWNER && newRole !== PublisherRole.OWNER) {
            const owners = await PublisherMember.findByRole(this.publisherId, PublisherRole.OWNER);
            if (owners.length === 1) {
                throw new Error("Cannot demote the last owner of the publisher");
            }
        }

        // Call the static update method
        const updatedMember = await PublisherMember.update(this.id, { role: newRole });
        // Update instance properties
        this.role = updatedMember.role;
        this.updatedAt = updatedMember.updatedAt;
        return this;
    }

    // Relation methods
    async getPublisher() {
        if (this._publisher) {
            return this._publisher;
        }

        try {
            const [publisher] = await db
                .select()
                .from(PublishersTable)
                .where(eq(PublishersTable.id, this.publisherId));

            this._publisher = publisher || null;
            return this._publisher;
        } catch (error) {
            console.error(`Error getting publisher for member ${this.id}:`, error);
            return null;
        }
    }

    async getUser() {
        if (this._user) {
            return this._user;
        }

        try {
            const [user] = await db
                .select()
                .from(UsersTable)
                .where(eq(UsersTable.id, this.userId));

            this._user = user || null;
            return this._user;
        } catch (error) {
            console.error(`Error getting user for member ${this.id}:`, error);
            return null;
        }
    }

    async getScopes() {
        if (this._scopes) {
            return this._scopes;
        }

        try {
            const scopes = await db
                .select()
                .from(ScopesTable)
                .where(eq(ScopesTable.publisherMemberId, this.id));

            this._scopes = scopes;
            return this._scopes;
        } catch (error) {
            console.error(`Error getting scopes for member ${this.id}:`, error);
            return [];
        }
    }

    // Permission methods
    isOwner(): boolean {
        return this.role === PublisherRole.OWNER;
    }

    isAdmin(): boolean {
        return this.role === PublisherRole.ADMIN;
    }

    isMember(): boolean {
        return this.role === PublisherRole.MEMBER;
    }

    hasRoleOrHigher(role: PublisherRole): boolean {
        return ROLE_HIERARCHY[this.role] >= ROLE_HIERARCHY[role];
    }

    canManageRole(targetRole: PublisherRole): boolean {
        // Owners can manage anyone
        if (this.isOwner()) return true;

        // Admins can manage members but not other admins or owners
        if (this.isAdmin()) {
            return targetRole === PublisherRole.MEMBER;
        }

        // Members cannot manage roles
        return false;
    }

    canPromoteTo(targetRole: PublisherRole): boolean {
        // Owners can promote to any role
        if (this.isOwner()) return true;

        // Admins can only promote to member
        if (this.isAdmin()) {
            return targetRole === PublisherRole.MEMBER;
        }

        return false;
    }

    async hasPermission(permission: string, modpackId?: string): Promise<boolean> {
        // Owners and admins have all permissions
        if (this.isOwner() || this.isAdmin()) {
            return true;
        }

        try {
            const scopes = await this.getScopes();

            // Check organization-level permissions
            const orgScope = scopes.find(scope => scope.publisherId === this.publisherId && !scope.modpackId);
            if (orgScope && orgScope[permission as keyof typeof orgScope]) {
                return true;
            }

            // Check modpack-specific permissions if modpackId is provided
            if (modpackId) {
                const modpackScope = scopes.find(scope => scope.modpackId === modpackId);
                if (modpackScope && modpackScope[permission as keyof typeof modpackScope]) {
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error(`Error checking permission ${permission} for member ${this.id}:`, error);
            return false;
        }
    }

    // Business logic methods
    getDaysAsMember(): number {
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - this.createdAt.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    isRecentMember(days = 7): boolean {
        return this.getDaysAsMember() <= days;
    }

    wasRecentlyUpdated(hours = 24): boolean {
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - this.updatedAt.getTime());
        const diffHours = diffTime / (1000 * 60 * 60);
        return diffHours <= hours;
    }

    // Serialization methods
    toJson(): PublisherMemberType {
        return {
            id: this.id,
            publisherId: this.publisherId,
            userId: this.userId,
            role: this.role,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }

    toPublicJson(): Omit<PublisherMemberType, 'updatedAt'> {
        const { updatedAt, ...publicData } = this.toJson();
        return publicData;
    }

    async toJsonWithDetails() {
        const [publisher, user, scopes] = await Promise.all([
            this.getPublisher(),
            this.getUser(),
            this.getScopes()
        ]);

        return {
            ...this.toJson(),
            publisher,
            user: user ? {
                id: user.id,
                username: user.username,
                avatarUrl: user.avatarUrl
            } : null,
            scopes,
        };
    }

    // Utility methods
    getRoleDisplayName(): string {
        const roleNames = {
            [PublisherRole.OWNER]: 'Owner',
            [PublisherRole.ADMIN]: 'Administrator',
            [PublisherRole.MEMBER]: 'Member',
        };
        return roleNames[this.role];
    }

    getRoleBadgeColor(): string {
        const colors = {
            [PublisherRole.OWNER]: 'red',
            [PublisherRole.ADMIN]: 'blue',
            [PublisherRole.MEMBER]: 'gray',
        };
        return colors[this.role];
    }

    getJoinedDate(): string {
        return this.createdAt.toLocaleDateString();
    }
}