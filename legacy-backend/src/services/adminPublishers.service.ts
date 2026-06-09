import { Publisher } from '../entities/Publisher';
import { PublisherMember } from '../entities/PublisherMember';
import { User } from '../entities/User';
import { Scope } from '../entities/Scope';
import { PublisherMemberRole } from '../types/enums';
import { AuditService } from './audit.service';
import { AuditAction } from '../entities/AuditLog';
import { AppDataSource } from '../db/data-source';
import { Like, FindOptionsWhere } from 'typeorm';

export interface PublisherQueryOptions {
    page?: number;
    limit?: number;
    search?: string; // Search by publisher name
    verified?: boolean;
    partnered?: boolean;
    sortBy?: 'publisherName' | 'createdAt' | 'verified' | 'partnered';
    sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedPublishers {
    publishers: Publisher[];
    total: number;
    page: number;
    totalPages: number;
}

export interface CreatePublisherData {
    publisherName: string;
    description: string;
    tosUrl: string;
    privacyUrl: string;
    bannerUrl: string;
    logoUrl: string;
    websiteUrl?: string;
    discordUrl?: string;
}

export interface UpdatePublisherData {
    publisherName?: string;
    description?: string;
    tosUrl?: string;
    privacyUrl?: string;
    bannerUrl?: string;
    logoUrl?: string;
    websiteUrl?: string;
    discordUrl?: string;
    verified?: boolean;
    partnered?: boolean;
    banned?: boolean;
    isHostingPartner?: boolean;
}

export interface AddMemberData {
    userId: string;
    role: PublisherMemberRole;
}

export class AdminPublishersService {
    private static getPublisherRepository() {
        return AppDataSource.getRepository(Publisher);
    }

    private static getMemberRepository() {
        return AppDataSource.getRepository(PublisherMember);
    }

    private static getUserRepository() {
        return AppDataSource.getRepository(User);
    }

    /**
     * Get all publishers with pagination and filtering
     */
    static async listPublishers(options: PublisherQueryOptions = {}): Promise<PaginatedPublishers> {
        const {
            page = 1,
            limit = 20,
            search,
            verified,
            partnered,
            sortBy = 'createdAt',
            sortOrder = 'DESC'
        } = options;

        const query = this.getPublisherRepository().createQueryBuilder('publisher')
            .leftJoinAndSelect('publisher.members', 'members')
            .leftJoinAndSelect('members.user', 'user')
            .leftJoinAndSelect('publisher.modpacks', 'modpacks');

        // Add search filter
        if (search) {
            query.andWhere('publisher.publisherName ILIKE :search', { search: `%${search}%` });
        }

        // Add verified filter
        if (verified !== undefined) {
            query.andWhere('publisher.verified = :verified', { verified });
        }

        // Add partnered filter
        if (partnered !== undefined) {
            query.andWhere('publisher.partnered = :partnered', { partnered });
        }

        // Add sorting
        query.orderBy(`publisher.${sortBy}`, sortOrder);

        // Add pagination
        const offset = (page - 1) * limit;
        query.skip(offset).take(limit);

        const [publishers, total] = await query.getManyAndCount();
        const totalPages = Math.ceil(total / limit);

        return {
            publishers,
            total,
            page,
            totalPages
        };
    }

    /**
     * Get publisher details with members and modpacks
     */
    static async getPublisherDetails(publisherId: string): Promise<Publisher | null> {
        return await this.getPublisherRepository().findOne({
            where: { id: publisherId },
            relations: ['members', 'members.user', 'modpacks', 'teamScopes', 'wallets']
        });
    }

    /**
     * Create a new publisher
     */
    static async createPublisher(data: CreatePublisherData, createdBy: string): Promise<Publisher> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Check if publisher name already exists
            const existingPublisher = await this.getPublisherRepository().findOne({
                where: { publisherName: data.publisherName }
            });

            if (existingPublisher) {
                throw new Error(`Publisher with name '${data.publisherName}' already exists`);
            }

            // Create the publisher
            const publisher = this.getPublisherRepository().create({
                ...data,
                verified: false,
                partnered: false,
                banned: false,
                isHostingPartner: false
            });

            const savedPublisher = await queryRunner.manager.save(publisher);

            // Add creator as owner
            const creatorMember = this.getMemberRepository().create({
                publisherId: savedPublisher.id,
                userId: createdBy,
                role: PublisherMemberRole.OWNER
            });

            await queryRunner.manager.save(creatorMember);

            // Log the action
            await AuditService.createLog({
                action: AuditAction.PUBLISHER_CREATED,
                userId: createdBy,
                targetResourceId: savedPublisher.id,
                details: { publisherName: data.publisherName },
            });

            await queryRunner.commitTransaction();
            return savedPublisher;

        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Update a publisher
     */
    static async updatePublisher(publisherId: string, data: UpdatePublisherData, updatedBy: string): Promise<Publisher> {
        const publisher = await this.getPublisherRepository().findOne({
            where: { id: publisherId }
        });

        if (!publisher) {
            throw new Error('Publisher not found');
        }

        // Check for duplicate publisher name if updating name
        if (data.publisherName && data.publisherName !== publisher.publisherName) {
            const existingPublisher = await this.getPublisherRepository().findOne({
                where: { publisherName: data.publisherName }
            });

            if (existingPublisher) {
                throw new Error(`Publisher with name '${data.publisherName}' already exists`);
            }
        }

        // Update the publisher
        Object.assign(publisher, data);
        const updatedPublisher = await this.getPublisherRepository().save(publisher);

        // Log the action
        await AuditService.createLog({
            action: AuditAction.PUBLISHER_UPDATED,
            userId: updatedBy,
            targetResourceId: publisherId,
            details: { changes: data }
        });

        return updatedPublisher;
    }

    /**
     * Delete a publisher
     */
    static async deletePublisher(publisherId: string, deletedBy: string): Promise<void> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const publisher = await this.getPublisherRepository().findOne({
                where: { id: publisherId },
                relations: ['modpacks']
            });

            if (!publisher) {
                throw new Error('Publisher not found');
            }

            // Check if publisher has modpacks
            if (publisher.modpacks && publisher.modpacks.length > 0) {
                throw new Error('Cannot delete publisher with existing modpacks');
            }

            // Delete all members first (including their scopes)
            const members = await queryRunner.manager.find(PublisherMember, { where: { publisherId } });
            for (const member of members) {
                await queryRunner.manager.delete(Scope, { publisherMemberId: member.id });
            }
            await queryRunner.manager.delete(PublisherMember, { publisherId });

            // Delete the publisher
            await queryRunner.manager.delete(Publisher, { id: publisherId });

            // Log the action
            await AuditService.createLog({
                action: AuditAction.PUBLISHER_DELETED,
                userId: deletedBy,
                targetResourceId: publisherId,
                details: { publisherName: publisher.publisherName }
            });

            await queryRunner.commitTransaction();

        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Get publisher members with pagination
     */
    static async getPublisherMembers(publisherId: string, page = 1, limit = 20): Promise<{ members: PublisherMember[], total: number }> {
        const [members, total] = await this.getMemberRepository().findAndCount({
            where: { publisherId },
            relations: ['user'],
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit
        });

        return { members, total };
    }

    /**
     * Add a member to a publisher
     */
    static async addMember(publisherId: string, data: AddMemberData, addedBy: string): Promise<PublisherMember> {
        // Check if publisher exists
        const publisher = await this.getPublisherRepository().findOne({
            where: { id: publisherId }
        });

        if (!publisher) {
            throw new Error('Publisher not found');
        }

        // Helper function to check if string is a valid UUID
        const isValidUUID = (str: string): boolean => {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            return uuidRegex.test(str);
        };

        // Clean the user identifier (remove @ prefix if present)
        const userIdentifier = data.userId.startsWith('@') ? data.userId.substring(1) : data.userId;

        let user;

        // Try to find user by ID first if it's a valid UUID
        if (isValidUUID(userIdentifier)) {
            user = await this.getUserRepository().findOne({
                where: { id: userIdentifier }
            });
        }

        // If not found by ID or not a UUID, try to find by username
        if (!user) {
            user = await this.getUserRepository().findOne({
                where: { username: userIdentifier }
            });
        }

        if (!user) {
            throw new Error(`User not found: ${userIdentifier}`);
        }

        // Check if user is already a member
        const existingMember = await this.getMemberRepository().findOne({
            where: { publisherId, userId: user.id }
        });

        if (existingMember) {
            throw new Error('User is already a member of this publisher');
        }

        // Create the member
        const member = this.getMemberRepository().create({
            publisherId,
            userId: user.id,
            role: data.role
        });

        const savedMember = await this.getMemberRepository().save(member);

        // Log the action
        await AuditService.createLog({
            action: AuditAction.PUBLISHER_MEMBER_ADDED,
            userId: addedBy,
            targetResourceId: publisherId,
            details: { targetUserId: user.id, role: data.role, username: user.username, identifierUsed: userIdentifier }
        });

        return savedMember;
    }

    /**
     * Remove a member from a publisher
     */
    static async removeMember(publisherId: string, userId: string, removedBy: string): Promise<void> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const member = await this.getMemberRepository().findOne({
                where: { publisherId, userId },
                relations: ['user', 'scopes']
            });

            if (!member) {
                throw new Error('Member not found');
            }

            // Cannot remove the last owner
            if (member.role === PublisherMemberRole.OWNER) {
                const ownerCount = await this.getMemberRepository().count({
                    where: { publisherId, role: PublisherMemberRole.OWNER }
                });

                if (ownerCount <= 1) {
                    throw new Error('Cannot remove the last owner from publisher');
                }
            }

            // Delete associated scopes first to avoid foreign key constraint violation
            await AppDataSource.getRepository(Scope).delete({ publisherMemberId: member.id });

            await this.getMemberRepository().remove(member);

            // Log the action
            await AuditService.createLog({
                action: AuditAction.PUBLISHER_MEMBER_REMOVED,
                userId: removedBy,
                targetResourceId: publisherId,
                details: { targetUserId: userId, role: member.role, username: member.user?.username }
            });

            await queryRunner.commitTransaction();
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Update member role
     */
    static async updateMemberRole(publisherId: string, userId: string, newRole: PublisherMemberRole, updatedBy: string): Promise<PublisherMember> {
        const member = await this.getMemberRepository().findOne({
            where: { publisherId, userId },
            relations: ['user']
        });

        if (!member) {
            throw new Error('Member not found');
        }

        const oldRole = member.role;

        // If changing from owner, ensure there's at least one owner remaining
        if (oldRole === PublisherMemberRole.OWNER && newRole !== PublisherMemberRole.OWNER) {
            const ownerCount = await this.getMemberRepository().count({
                where: { publisherId, role: PublisherMemberRole.OWNER }
            });

            if (ownerCount <= 1) {
                throw new Error('Cannot remove the last owner from publisher');
            }
        }

        member.role = newRole;
        const updatedMember = await this.getMemberRepository().save(member);

        // Log the action
        await AuditService.createLog({
            action: AuditAction.PUBLISHER_MEMBER_ROLE_UPDATED,
            userId: updatedBy,
            targetResourceId: publisherId,
            details: { targetUserId: userId, oldRole, newRole, username: member.user?.username }
        });

        return updatedMember;
    }
}