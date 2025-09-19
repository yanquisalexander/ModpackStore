// src/models/Publisher.model.ts
import { z } from "zod";
import { client as db } from "@/db/client";
import { eq, and, desc, sql, count } from "drizzle-orm";
import {
    PublishersTable,
    PublisherMembersTable,
    ScopesTable,
    ModpacksTable,
    UsersTable
} from "@/db/schema";

// Types
type PublisherType = typeof PublishersTable.$inferSelect;
type NewPublisher = typeof PublishersTable.$inferInsert;
type PublisherUpdateData = Partial<Omit<NewPublisher, "id" | "createdAt">>;

// Enums
export enum PublisherRole {
    OWNER = 'owner',
    ADMIN = 'admin',
    MEMBER = 'member'
}

// Validation schemas
export const newPublisherSchema = z.object({
    publisherName: z.string().min(1).max(32),
    tosUrl: z.string().url(),
    privacyUrl: z.string().url(),
    bannerUrl: z.string().url(),
    logoUrl: z.string().url(),
    description: z.string().min(1),
    websiteUrl: z.string().url().optional(),
    discordUrl: z.string().url().optional(),
    banned: z.boolean().default(false),
    verified: z.boolean().default(false),
    partnered: z.boolean().default(false),
    isHostingPartner: z.boolean().default(false),
});

export const publisherUpdateSchema = newPublisherSchema.partial();

export const publisherMemberSchema = z.object({
    publisherId: z.string().uuid(),
    userId: z.string().uuid(),
    role: z.nativeEnum(PublisherRole),
});

export const scopeSchema = z.object({
    publisherId: z.string().uuid().optional(),
    modpackId: z.string().uuid().optional(),
    // Legacy permissions (keeping for compatibility)
    canCreateModpacks: z.boolean().default(false),
    canEditModpacks: z.boolean().default(false),
    canDeleteModpacks: z.boolean().default(false),
    canPublishVersions: z.boolean().default(false),
    canManageMembers: z.boolean().default(false),
    canManageSettings: z.boolean().default(false),
    // Granular modpack permissions
    modpackView: z.boolean().default(false),
    modpackModify: z.boolean().default(false),
    modpackManageVersions: z.boolean().default(false),
    modpackPublish: z.boolean().default(false),
    modpackDelete: z.boolean().default(false),
    modpackManageAccess: z.boolean().default(false),
    // Granular publisher permissions
    publisherManageCategoriesTags: z.boolean().default(false),
    publisherViewStats: z.boolean().default(false),
}).refine(data => data.publisherId || data.modpackId, {
    message: "Either publisherId or modpackId must be provided"
});

export class Publisher {
    readonly id: string;
    readonly createdAt: Date;

    publisherName: string;
    tosUrl: string;
    privacyUrl: string;
    bannerUrl: string;
    logoUrl: string;
    description: string;
    websiteUrl: string | null;
    discordUrl: string | null;
    banned: boolean;
    verified: boolean;
    partnered: boolean;
    isHostingPartner: boolean;

    // Cached relations
    private _members?: any[];
    private _modpacks?: any[];

    constructor(data: PublisherType) {
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
        this.banned = data.banned ?? false;
        this.verified = data.verified ?? false;
        this.partnered = data.partnered ?? false;
        this.isHostingPartner = data.isHostingPartner ?? false;
    }

    // Static factory methods
    static async create(data: z.infer<typeof newPublisherSchema>, ownerId: string): Promise<Publisher> {
        const parsed = newPublisherSchema.safeParse(data);
        if (!parsed.success) {
            throw new Error(`Invalid publisher data: ${JSON.stringify(parsed.error.format())}`);
        }

        const now = new Date();

        try {
            const newPublisher = await db.transaction(async (tx) => {
                // Create publisher
                const [insertedPublisherRecord] = await tx
                    .insert(PublishersTable)
                    .values({
                        ...parsed.data,
                        createdAt: now, // PublishersTable does not have updatedAt
                    })
                    .returning();

                if (!insertedPublisherRecord) {
                    throw new Error("Publisher creation failed: No record returned.");
                }

                // Add owner as member
                await tx.insert(PublisherMembersTable).values({
                    publisherId: insertedPublisherRecord.id,
                    userId: ownerId,
                    role: PublisherRole.OWNER,
                    createdAt: now,
                    updatedAt: now, // PublisherMembersTable has createdAt and updatedAt
                });

                return new Publisher(insertedPublisherRecord);
            });
            return newPublisher;
        } catch (error) {
            console.error(`Failed to create publisher and add owner:`, error);
            throw new Error(`Failed to create publisher: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Query methods
    static async findById(id: string): Promise<Publisher | null> {
        if (!id?.trim()) return null;

        try {
            const [publisher] = await db.select().from(PublishersTable).where(eq(PublishersTable.id, id));
            return publisher ? new Publisher(publisher) : null;
        } catch (error) {
            console.error(`Error finding publisher by ID ${id}:`, error);
            return null;
        }
    }

    static async findByName(publisherName: string): Promise<Publisher | null> {
        if (!publisherName?.trim()) return null;

        try {
            const [publisher] = await db.select().from(PublishersTable).where(eq(PublishersTable.publisherName, publisherName));
            return publisher ? new Publisher(publisher) : null;
        } catch (error) {
            console.error(`Error finding publisher by name ${publisherName}:`, error);
            return null;
        }
    }

    static async findByUser(userId: string): Promise<Publisher[]> {
        if (!userId?.trim()) return [];

        try {
            const publishers = await db
                .select({
                    id: PublishersTable.id,
                    publisherName: PublishersTable.publisherName,
                    tosUrl: PublishersTable.tosUrl,
                    privacyUrl: PublishersTable.privacyUrl,
                    bannerUrl: PublishersTable.bannerUrl,
                    logoUrl: PublishersTable.logoUrl,
                    description: PublishersTable.description,
                    websiteUrl: PublishersTable.websiteUrl,
                    discordUrl: PublishersTable.discordUrl,
                    banned: PublishersTable.banned,
                    verified: PublishersTable.verified,
                    partnered: PublishersTable.partnered,
                    isHostingPartner: PublishersTable.isHostingPartner,
                    createdAt: PublishersTable.createdAt,
                })
                .from(PublishersTable)
                .innerJoin(PublisherMembersTable, eq(PublisherMembersTable.publisherId, PublishersTable.id))
                .where(eq(PublisherMembersTable.userId, userId));

            return publishers.map(publisher => new Publisher(publisher));
        } catch (error) {
            console.error(`Error finding publishers by user ${userId}:`, error);
            return [];
        }
    }

    static async findActive(limit = 20, offset = 0): Promise<Publisher[]> {
        try {
            const publishers = await db
                .select()
                .from(PublishersTable)
                .where(eq(PublishersTable.banned, false))
                .orderBy(desc(PublishersTable.createdAt))
                .limit(limit)
                .offset(offset);

            return publishers.map(publisher => new Publisher(publisher));
        } catch (error) {
            console.error("Error finding active publishers:", error);
            return [];
        }
    }

    static async getCompletePublisher(id: string) {
        if (!id?.trim()) return null;

        try {
            const publisher = await db.query.PublishersTable.findFirst({
                where: eq(PublishersTable.id, id),
                with: {
                    members: {
                        with: {
                            user: true,
                            scopes: true
                        }
                    },
                    modpacks: {
                        orderBy: desc(ModpacksTable.updatedAt),
                        limit: 10
                    }
                }
            });
            return publisher ?? null;
        } catch (error) {
            console.error(`Error getting complete publisher ${id}:`, error);
            return null;
        }
    }

    // Static method for updates
    static async update(id: string, data: z.infer<typeof publisherUpdateSchema>): Promise<Publisher> {
        const validationResult = publisherUpdateSchema.safeParse(data);
        if (!validationResult.success) {
            throw new Error(`Invalid publisher update data: ${JSON.stringify(validationResult.error.format())}`);
        }

        if (Object.keys(validationResult.data).length === 0) {
            const currentPublisher = await Publisher.findById(id);
            if (!currentPublisher) throw new Error("Publisher not found for update with empty payload.");
            return currentPublisher;
        }

        // PublishersTable does not have an 'updatedAt' column in the provided schema.ts
        // If it were added, it would be:
        // const updatePayload = { ...validationResult.data, updatedAt: new Date() };
        const updatePayload = validationResult.data;


        try {
            const [updatedRecord] = await db
                .update(PublishersTable)
                .set(updatePayload)
                .where(eq(PublishersTable.id, id))
                .returning();

            if (!updatedRecord) {
                throw new Error("Publisher not found or update failed.");
            }
            return new Publisher(updatedRecord);
        } catch (error) {
            console.error(`Failed to update publisher ${id}:`, error);
            throw new Error(`Failed to update publisher: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Instance methods
    async save(): Promise<Publisher> {
        const dataToSave: z.infer<typeof publisherUpdateSchema> = {
            publisherName: this.publisherName,
            tosUrl: this.tosUrl,
            privacyUrl: this.privacyUrl,
            bannerUrl: this.bannerUrl,
            logoUrl: this.logoUrl,
            description: this.description,
            websiteUrl: this.websiteUrl ?? undefined,
            discordUrl: this.discordUrl ?? undefined,
            banned: this.banned,
            verified: this.verified,
            partnered: this.partnered,
            isHostingPartner: this.isHostingPartner,
        };

        const updatedPublisher = await Publisher.update(this.id, dataToSave);
        // Update current instance properties
        Object.assign(this, updatedPublisher);
        return this;
    }

    async delete(): Promise<void> {
        try {
            // Note: This should cascade delete members, scopes, etc. according to your DB constraints
            await db.delete(PublishersTable).where(eq(PublishersTable.id, this.id));
        } catch (error) {
            throw new Error(`Failed to delete publisher: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Member management
    async getMembers() {
        if (this._members && this._members.length > 0) { // Check if cache is populated
            return this._members;
        }

        try {
            const membersData = await db
                .select({
                    id: PublisherMembersTable.id,
                    role: PublisherMembersTable.role,
                    userId: PublisherMembersTable.userId,
                    userRecord: { // Avoid conflict with 'user' property if PublisherMember class is instantiated
                        id: UsersTable.id,
                        username: UsersTable.username,
                        email: UsersTable.email,
                        avatarUrl: UsersTable.avatarUrl,
                    },
                    createdAt: PublisherMembersTable.createdAt,
                    updatedAt: PublisherMembersTable.updatedAt,
                })
                .from(PublisherMembersTable)
                .innerJoin(UsersTable, eq(PublisherMembersTable.userId, UsersTable.id))
                .where(eq(PublisherMembersTable.publisherId, this.id));

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
        } catch (error) {
            console.error(`Error getting members for publisher ${this.id}:`, error);
            return [];
        }
    }

    async getMember(userId: string) {
        try {
            const [member] = await db
                .select()
                .from(PublisherMembersTable)
                .where(
                    and(
                        eq(PublisherMembersTable.publisherId, this.id),
                        eq(PublisherMembersTable.userId, userId)
                    )
                );

            return member || null;
        } catch (error) {
            console.error(`Error getting member ${userId} for publisher ${this.id}:`, error);
            return null;
        }
    }

    async addMember(userId: string, role: PublisherRole): Promise<void> {
        const memberData = publisherMemberSchema.safeParse({
            publisherId: this.id,
            userId: userId,
            role: role,
        });

        if (!memberData.success) {
            throw new Error(`Invalid member data: ${JSON.stringify(memberData.error.format())}`);
        }

        try {
            const now = new Date();
            await db.insert(PublisherMembersTable).values({
                publisherId: this.id,
                userId: userId,
                role: role,
                createdAt: now,
                updatedAt: now,
            });
            this._members = undefined; // Clear cache
        } catch (error) {
            throw new Error(`Failed to add member: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async removeMember(userId: string): Promise<void> {
        try {
            await db.delete(PublisherMembersTable).where(
                and(
                    eq(PublisherMembersTable.publisherId, this.id),
                    eq(PublisherMembersTable.userId, userId)
                )
            );
            this._members = undefined; // Clear cache
        } catch (error) {
            throw new Error(`Failed to remove member: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async updateMemberRole(userId: string, newRole: PublisherRole): Promise<void> {
        try {
            await db.update(PublisherMembersTable)
                .set({
                    role: newRole,
                    updatedAt: new Date()
                })
                .where(
                    and(
                        eq(PublisherMembersTable.publisherId, this.id),
                        eq(PublisherMembersTable.userId, userId)
                    )
                );
            this._members = undefined; // Clear cache
        } catch (error) {
            throw new Error(`Failed to update member role: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Scopes management
    async getMemberScopes(userId: string) {
        try {
            const member = await this.getMember(userId);
            if (!member) return [];

            const scopes = await db
                .select()
                .from(ScopesTable)
                .where(eq(ScopesTable.publisherMemberId, member.id));

            return scopes;
        } catch (error) {
            console.error(`Error getting scopes for member ${userId}:`, error);
            return [];
        }
    }

    async addMemberScope(userId: string, scopeData: z.infer<typeof scopeSchema>): Promise<void> {
        const parsed = scopeSchema.safeParse(scopeData);
        if (!parsed.success) {
            throw new Error(`Invalid scope data: ${JSON.stringify(parsed.error.format())}`);
        }

        try {
            const member = await this.getMember(userId);
            if (!member) {
                throw new Error(`User ${userId} is not a member of this publisher`);
            }

            const now = new Date();
            await db.insert(ScopesTable).values({
                publisherMemberId: member.id,
                publisherId: parsed.data.publisherId,
                modpackId: parsed.data.modpackId,
                // Legacy permissions
                canCreateModpacks: parsed.data.canCreateModpacks,
                canEditModpacks: parsed.data.canEditModpacks,
                canDeleteModpacks: parsed.data.canDeleteModpacks,
                canPublishVersions: parsed.data.canPublishVersions,
                canManageMembers: parsed.data.canManageMembers,
                canManageSettings: parsed.data.canManageSettings,
                // Granular modpack permissions
                modpackView: parsed.data.modpackView,
                modpackModify: parsed.data.modpackModify,
                modpackManageVersions: parsed.data.modpackManageVersions,
                modpackPublish: parsed.data.modpackPublish,
                modpackDelete: parsed.data.modpackDelete,
                modpackManageAccess: parsed.data.modpackManageAccess,
                // Granular publisher permissions
                publisherManageCategoriesTags: parsed.data.publisherManageCategoriesTags,
                publisherViewStats: parsed.data.publisherViewStats,
                createdAt: now,
                updatedAt: now,
            });
        } catch (error) {
            throw new Error(`Failed to add scope: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async removeMemberScope(userId: string, scopeId: number): Promise<void> {
        try {
            const member = await this.getMember(userId);
            if (!member) {
                throw new Error(`User ${userId} is not a member of this publisher`);
            }

            await db.delete(ScopesTable).where(
                and(
                    eq(ScopesTable.id, scopeId),
                    eq(ScopesTable.publisherMemberId, member.id)
                )
            );
        } catch (error) {
            throw new Error(`Failed to remove scope: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Modpacks management
    async getModpacks(limit = 20, offset = 0) {
        try {
            const modpacks = await db
                .select()
                .from(ModpacksTable)
                .where(eq(ModpacksTable.publisherId, this.id))
                .orderBy(desc(ModpacksTable.updatedAt))
                .limit(limit)
                .offset(offset);

            return modpacks;
        } catch (error) {
            console.error(`Error getting modpacks for publisher ${this.id}:`, error);
            return [];
        }
    }

    async getModpacksCount(): Promise<number> {
        try {
            const [result] = await db
                .select({ count: count() })
                .from(ModpacksTable)
                .where(eq(ModpacksTable.publisherId, this.id));

            return Number(result.count) || 0;
        } catch (error) {
            console.error(`Error getting modpacks count for publisher ${this.id}:`, error);
            return 0;
        }
    }

    // Permission checks
    async hasUserPermission(userId: string, permission: keyof typeof scopeSchema._def.schema.shape, modpackId?: string): Promise<boolean> {
        try {
            const member = await this.getMember(userId);
            if (!member) return false;

            // Owners and admins have all permissions
            if (member.role === PublisherRole.OWNER || member.role === PublisherRole.ADMIN) {
                return true;
            }

            const scopes = await this.getMemberScopes(userId);

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
        } catch (error) {
            console.error(`Error checking permission ${permission} for user ${userId}:`, error);
            return false;
        }
    }

    async isUserMember(userId: string): Promise<boolean> {
        const member = await this.getMember(userId);
        return !!member;
    }

    async isUserOwner(userId: string): Promise<boolean> {
        const member = await this.getMember(userId);
        return member?.role === PublisherRole.OWNER;
    }

    async isUserAdmin(userId: string): Promise<boolean> {
        const member = await this.getMember(userId);
        return member?.role === PublisherRole.ADMIN || member?.role === PublisherRole.OWNER;
    }

    // Business logic methods
    isBanned(): boolean {
        return this.banned;
    }

    isVerified(): boolean {
        return this.verified;
    }

    isPartnered(): boolean {
        return this.partnered;
    }


    canCreateModpacks(): boolean {
        return !this.banned;
    }

    // Serialization methods
    toJson(): PublisherType {
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

    toPublicJson(): Omit<PublisherType, 'banned'> {
        const { banned, ...publicData } = this.toJson();
        return publicData;
    }

    // Utility methods
    getDisplayName(): string {
        return this.publisherName;
    }

    getUrl(): string {
        return `/publisher/${this.publisherName.toLowerCase().replace(/\s+/g, '-')}`;
    }

    hasWebsite(): boolean {
        return !!this.websiteUrl;
    }

    hasDiscord(): boolean {
        return !!this.discordUrl;
    }

    getBadges(): string[] {
        const badges = [];
        if (this.verified) badges.push('verified');
        if (this.partnered) badges.push('partnered');
        if (this.isHostingPartner) badges.push('hosting-partner');
        return badges;
    }
}