import { Repository } from "typeorm";
import { AppDataSource } from "../db/data-source";
import { Publisher } from "../entities/Publisher";
import { PublisherMember } from "../entities/PublisherMember";
import { Scope } from "../entities/Scope";
import { User } from "../entities/User";
import { Modpack } from "../entities/Modpack";
import { PublisherMemberRole } from "../types/enums";
import { z } from "zod";
import { scopeSchema } from "../validators/publisher.validator";

export class PublisherService {
    private publisherRepository: Repository<Publisher>;
    private memberRepository: Repository<PublisherMember>;
    private scopeRepository: Repository<Scope>;
    private userRepository: Repository<User>;
    private modpackRepository: Repository<Modpack>;

    constructor() {
        this.publisherRepository = AppDataSource.getRepository(Publisher);
        this.memberRepository = AppDataSource.getRepository(PublisherMember);
        this.scopeRepository = AppDataSource.getRepository(Scope);
        this.userRepository = AppDataSource.getRepository(User);
        this.modpackRepository = AppDataSource.getRepository(Modpack);
    }

    // Publisher CRUD operations
    async findById(id: string): Promise<Publisher | null> {
        try {
            return await this.publisherRepository.findOne({
                where: { id },
                relations: ['members', 'modpacks', 'teamScopes']
            });
        } catch (error) {
            console.error(`Error finding publisher ${id}:`, error);
            return null;
        }
    }

    async create(data: any): Promise<Publisher> {
        const publisher = this.publisherRepository.create(data);
        return await this.publisherRepository.save(publisher);
    }

    async update(id: string, data: any): Promise<Publisher> {
        await this.publisherRepository.update(id, data);
        const updatedPublisher = await this.findById(id);
        if (!updatedPublisher) {
            throw new Error(`Publisher ${id} not found after update`);
        }
        return updatedPublisher;
    }

    // Member management
    async getMember(publisherId: string, userId: string): Promise<PublisherMember | null> {
        try {
            return await this.memberRepository.findOne({
                where: { publisherId, userId },
                relations: ['scopes', 'user', 'publisher', 'scopes.publisher', 'scopes.modpack']
            });
        } catch (error) {
            console.error(`Error getting member ${userId} for publisher ${publisherId}:`, error);
            return null;
        }
    }

    async getMembers(publisherId: string): Promise<PublisherMember[]> {
        try {
            return await this.memberRepository.find({
                where: { publisherId },
                relations: ['user', 'scopes', 'scopes.publisher', 'scopes.modpack'],
                order: { createdAt: 'DESC' }
            });
        } catch (error) {
            console.error(`Error getting members for publisher ${publisherId}:`, error);
            return [];
        }
    }

    async addMember(publisherId: string, userId: string, role: PublisherMemberRole): Promise<PublisherMember> {
        const member = this.memberRepository.create({
            publisherId,
            userId,
            role
        });
        return await this.memberRepository.save(member);
    }

    async updateMemberRole(publisherId: string, userId: string, role: PublisherMemberRole): Promise<PublisherMember> {
        await this.memberRepository.update({ publisherId, userId }, { role });
        const updatedMember = await this.getMember(publisherId, userId);
        if (!updatedMember) {
            throw new Error(`Member ${userId} not found after role update`);
        }
        return updatedMember;
    }

    async removeMember(publisherId: string, userId: string): Promise<void> {
        await this.memberRepository.delete({ publisherId, userId });
    }

    // Scope/Permission management
    async getMemberScopes(publisherId: string, userId: string): Promise<Scope[]> {
        try {
            const member = await this.getMember(publisherId, userId);
            if (!member) return [];

            return await this.scopeRepository.find({
                where: {
                    publisherMemberId: member.id
                },
                relations: ['publisher', 'modpack']
            });
        } catch (error) {
            console.error(`Error getting scopes for member ${userId}:`, error);
            return [];
        }
    }

    async addMemberScope(publisherId: string, userId: string, scopeData: z.infer<typeof scopeSchema>): Promise<Scope> {
        const member = await this.getMember(publisherId, userId);
        if (!member) {
            throw new Error(`Member ${userId} not found in publisher ${publisherId}`);
        }

        const scope = this.scopeRepository.create({
            publisherMemberId: member.id,
            ...scopeData
        });

        return await this.scopeRepository.save(scope);
    }

    async updateMemberScope(scopeId: number, scopeData: Partial<z.infer<typeof scopeSchema>>): Promise<Scope> {
        await this.scopeRepository.update(scopeId, scopeData);
        const updatedScope = await this.scopeRepository.findOne({ where: { id: scopeId } });
        if (!updatedScope) {
            throw new Error(`Scope ${scopeId} not found after update`);
        }
        return updatedScope;
    }

    async removeMemberScope(scopeId: number): Promise<void> {
        await this.scopeRepository.delete(scopeId);
    }

    // Permission checking logic
    async hasUserPermission(
        publisherId: string,
        userId: string,
        permission: string,
        modpackId?: string
    ): Promise<boolean> {
        try {
            const member = await this.getMember(publisherId, userId);
            if (!member) return false;

            // Owners and admins have all permissions
            if (member.role === PublisherMemberRole.OWNER || member.role === PublisherMemberRole.ADMIN) {
                return true;
            }

            const scopes = await this.getMemberScopes(publisherId, userId);

            // Check organization-level permissions
            const orgScope = scopes.find(scope => scope.publisherId === publisherId && !scope.modpackId);
            if (orgScope && this.checkPermissionInScope(orgScope, permission)) {
                return true;
            }

            // Check modpack-specific permissions if modpackId is provided
            if (modpackId) {
                const modpackScope = scopes.find(scope => scope.modpackId === modpackId && scope.publisherId === publisherId);
                if (modpackScope && this.checkPermissionInScope(modpackScope, permission)) {
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error(`Error checking permission ${permission} for user ${userId}:`, error);
            return false;
        }
    }

    private checkPermissionInScope(scope: Scope, permission: string): boolean {
        const permissionMap: Record<string, keyof Scope> = {
            'modpack.view': 'modpackView',
            'modpack.modify': 'modpackModify',
            'modpack.manage_versions': 'modpackManageVersions',
            'modpack.publish': 'modpackPublish',
            'modpack.delete': 'modpackDelete',
            'modpack.manage_access': 'modpackManageAccess',
            'publisher.manage_categories_tags': 'publisherManageCategoriesTags',
            'publisher.view_stats': 'publisherViewStats',
            // Legacy permission mapping
            'create_modpacks': 'canCreateModpacks',
            'edit_modpacks': 'canEditModpacks',
            'delete_modpacks': 'canDeleteModpacks',
            'publish_versions': 'canPublishVersions',
            'manage_members': 'canManageMembers',
            'manage_settings': 'canManageSettings',
        };

        const scopeField = permissionMap[permission];
        if (!scopeField) return false;

        return Boolean(scope[scopeField]);
    }

    // Role checking helpers
    async isUserMember(publisherId: string, userId: string): Promise<boolean> {
        const member = await this.getMember(publisherId, userId);
        return member !== null;
    }

    async isUserOwner(publisherId: string, userId: string): Promise<boolean> {
        const member = await this.getMember(publisherId, userId);
        return member?.role === PublisherMemberRole.OWNER;
    }

    async isUserAdmin(publisherId: string, userId: string): Promise<boolean> {
        const member = await this.getMember(publisherId, userId);
        return member?.role === PublisherMemberRole.ADMIN;
    }

    async canManageRole(publisherId: string, userId: string, targetRole: PublisherMemberRole): Promise<boolean> {
        const member = await this.getMember(publisherId, userId);
        if (!member) return false;

        const roleHierarchy = {
            [PublisherMemberRole.OWNER]: 3,
            [PublisherMemberRole.ADMIN]: 2,
            [PublisherMemberRole.MEMBER]: 1
        };

        return roleHierarchy[member.role] > roleHierarchy[targetRole];
    }

    // Modpack management
    async getModpacks(publisherId: string, limit = 20, offset = 0): Promise<Modpack[]> {
        try {
            return await this.modpackRepository.find({
                where: { publisherId },
                relations: ['versions', 'categories'],
                order: { createdAt: 'DESC' },
                take: limit,
                skip: offset
            });
        } catch (error) {
            console.error(`Error getting modpacks for publisher ${publisherId}:`, error);
            return [];
        }
    }

    async getModpacksCount(publisherId: string): Promise<number> {
        try {
            return await this.modpackRepository.count({ where: { publisherId } });
        } catch (error) {
            console.error(`Error counting modpacks for publisher ${publisherId}:`, error);
            return 0;
        }
    }

    // Permission assignment helper for UI
    async assignPermissionToMember(
        publisherId: string,
        userId: string,
        permission: string,
        enable: boolean,
        modpackId?: string
    ): Promise<void> {
        const member = await this.getMember(publisherId, userId);
        if (!member) {
            throw new Error(`Member ${userId} not found in publisher ${publisherId}`);
        }

        // Only allow permission changes for members (not owners/admins)
        if (member.role !== PublisherMemberRole.MEMBER) {
            throw new Error(`Cannot modify permissions for role: ${member.role}`);
        }

        const scopes = await this.getMemberScopes(publisherId, userId);
        let targetScope: Scope | undefined;

        if (modpackId) {
            targetScope = scopes.find(scope => scope.modpackId === modpackId && scope.publisherId === publisherId);
        } else {
            targetScope = scopes.find(scope => scope.publisherId === publisherId && !scope.modpackId);
        }

        if (!targetScope) {
            // Create new scope if it doesn't exist
            const scopeData: z.infer<typeof scopeSchema> = {
                publisherId: publisherId,
                modpackId: modpackId,
                modpackView: false,
                modpackModify: false,
                modpackManageVersions: false,
                modpackPublish: false,
                modpackDelete: false,
                modpackManageAccess: false,
                publisherManageCategoriesTags: false,
                publisherViewStats: false,
                canCreateModpacks: false,
                canEditModpacks: false,
                canDeleteModpacks: false,
                canPublishVersions: false,
                canManageMembers: false,
                canManageSettings: false,
            };

            // Set the specific permission
            this.setPermissionInScopeData(scopeData, permission, enable);

            targetScope = await this.addMemberScope(publisherId, userId, scopeData);
        } else {
            // Update existing scope
            const updateData: Partial<z.infer<typeof scopeSchema>> = {};
            this.setPermissionInScopeData(updateData, permission, enable);

            await this.updateMemberScope(targetScope.id, updateData);
        }
    }

    private setPermissionInScopeData(scopeData: any, permission: string, enable: boolean): void {
        const permissionMap: Record<string, string> = {
            'modpack.view': 'modpackView',
            'modpack.modify': 'modpackModify',
            'modpack.manage_versions': 'modpackManageVersions',
            'modpack.publish': 'modpackPublish',
            'modpack.delete': 'modpackDelete',
            'modpack.manage_access': 'modpackManageAccess',
            'publisher.manage_categories_tags': 'publisherManageCategoriesTags',
            'publisher.view_stats': 'publisherViewStats',
        };

        const scopeField = permissionMap[permission];
        if (scopeField) {
            scopeData[scopeField] = enable;
        }
    }
}