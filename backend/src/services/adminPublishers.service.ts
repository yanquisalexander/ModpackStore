import { Publisher } from '../entities/Publisher';
import { PublisherMember } from '../entities/PublisherMember';
import { User } from '../entities/User';
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
    private static publisherRepository = AppDataSource.getRepository(Publisher);
    private static memberRepository = AppDataSource.getRepository(PublisherMember);
    private static userRepository = AppDataSource.getRepository(User);

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

        const query = this.publisherRepository.createQueryBuilder('publisher')
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
        return await this.publisherRepository.findOne({
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
            const existingPublisher = await this.publisherRepository.findOne({
                where: { publisherName: data.publisherName }
            });

            if (existingPublisher) {
                throw new Error(`Publisher with name '${data.publisherName}' already exists`);
            }

            // Create the publisher
            const publisher = this.publisherRepository.create({
                ...data,
                verified: false,
                partnered: false,
                banned: false,
                isHostingPartner: false
            });

            const savedPublisher = await queryRunner.manager.save(publisher);

            // Add creator as owner
            const creatorMember = this.memberRepository.create({
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
                details: { publisherName: data.publisherName }
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
        const publisher = await this.publisherRepository.findOne({
            where: { id: publisherId }
        });

        if (!publisher) {
            throw new Error('Publisher not found');
        }

        // Check for duplicate publisher name if updating name
        if (data.publisherName && data.publisherName !== publisher.publisherName) {
            const existingPublisher = await this.publisherRepository.findOne({
                where: { publisherName: data.publisherName }
            });

            if (existingPublisher) {
                throw new Error(`Publisher with name '${data.publisherName}' already exists`);
            }
        }

        // Update the publisher
        Object.assign(publisher, data);
        const updatedPublisher = await this.publisherRepository.save(publisher);

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
            const publisher = await this.publisherRepository.findOne({
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

            // Delete all members first
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
        const [members, total] = await this.memberRepository.findAndCount({
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
        const publisher = await this.publisherRepository.findOne({
            where: { id: publisherId }
        });

        if (!publisher) {
            throw new Error('Publisher not found');
        }

        // Check if user exists
        const user = await this.userRepository.findOne({
            where: { id: data.userId }
        });

        if (!user) {
            throw new Error('User not found');
        }

        // Check if user is already a member
        const existingMember = await this.memberRepository.findOne({
            where: { publisherId, userId: data.userId }
        });

        if (existingMember) {
            throw new Error('User is already a member of this publisher');
        }

        // Create the member
        const member = this.memberRepository.create({
            publisherId,
            userId: data.userId,
            role: data.role
        });

        const savedMember = await this.memberRepository.save(member);

        // Log the action
        await AuditService.createLog({
            action: AuditAction.PUBLISHER_MEMBER_ADDED,
            userId: addedBy,
            targetResourceId: publisherId,
            details: { targetUserId: data.userId, role: data.role, username: user.username }
        });

        return savedMember;
    }

    /**
     * Remove a member from a publisher
     */
    static async removeMember(publisherId: string, userId: string, removedBy: string): Promise<void> {
        const member = await this.memberRepository.findOne({
            where: { publisherId, userId },
            relations: ['user']
        });

        if (!member) {
            throw new Error('Member not found');
        }

        // Cannot remove the last owner
        if (member.role === PublisherMemberRole.OWNER) {
            const ownerCount = await this.memberRepository.count({
                where: { publisherId, role: PublisherMemberRole.OWNER }
            });

            if (ownerCount <= 1) {
                throw new Error('Cannot remove the last owner from publisher');
            }
        }

        await this.memberRepository.remove(member);

        // Log the action
        await AuditService.createLog({
            action: AuditAction.PUBLISHER_MEMBER_REMOVED,
            userId: removedBy,
            targetResourceId: publisherId,
            details: { targetUserId: userId, role: member.role, username: member.user?.username }
        });
    }

    /**
     * Update member role
     */
    static async updateMemberRole(publisherId: string, userId: string, newRole: PublisherMemberRole, updatedBy: string): Promise<PublisherMember> {
        const member = await this.memberRepository.findOne({
            where: { publisherId, userId },
            relations: ['user']
        });

        if (!member) {
            throw new Error('Member not found');
        }

        const oldRole = member.role;

        // If changing from owner, ensure there's at least one owner remaining
        if (oldRole === PublisherMemberRole.OWNER && newRole !== PublisherMemberRole.OWNER) {
            const ownerCount = await this.memberRepository.count({
                where: { publisherId, role: PublisherMemberRole.OWNER }
            });

            if (ownerCount <= 1) {
                throw new Error('Cannot remove the last owner from publisher');
            }
        }

        member.role = newRole;
        const updatedMember = await this.memberRepository.save(member);

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