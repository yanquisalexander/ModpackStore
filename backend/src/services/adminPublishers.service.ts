import { Publisher, newPublisherSchema, publisherUpdateSchema, PublisherRole } from "@/models/Publisher.model";
import { APIError } from "@/lib/APIError";
import { z } from "zod";
import { AuditService } from "./audit.service";

export class AdminPublishersService {
    /**
     * Create a new publisher
     */
    static async createPublisher(data: z.infer<typeof newPublisherSchema>, adminUserId: string): Promise<Publisher> {
        try {
            // Validate the data
            const validatedData = newPublisherSchema.parse(data);
            
            // Create the publisher
            const publisher = await Publisher.create(validatedData, adminUserId);
            
            // Log the creation
            await AuditService.log({
                userId: adminUserId,
                action: 'PUBLISHER_CREATED',
                entityType: 'Publisher',
                entityId: publisher.id,
                details: {
                    publisherName: publisher.publisherName,
                    createdBy: adminUserId
                }
            });
            
            return publisher;
        } catch (error: any) {
            console.error("[ADMIN_PUBLISHERS_SERVICE] Error creating publisher:", error);
            if (error instanceof APIError) throw error;
            throw new APIError(500, 'Publisher Creation Error', error.message || 'Failed to create publisher');
        }
    }

    /**
     * List all publishers
     */
    static async listPublishers(): Promise<Publisher[]> {
        try {
            return await Publisher.findActive();
        } catch (error: any) {
            console.error("[ADMIN_PUBLISHERS_SERVICE] Error listing publishers:", error);
            throw new APIError(500, 'Publisher List Error', error.message || 'Failed to list publishers');
        }
    }

    /**
     * Get a single publisher by ID
     */
    static async getPublisher(publisherId: string): Promise<Publisher> {
        try {
            const publisher = await Publisher.findById(publisherId);
            if (!publisher) {
                throw new APIError(404, 'Publisher Not Found', `Publisher with ID ${publisherId} not found`);
            }
            return publisher;
        } catch (error: any) {
            console.error("[ADMIN_PUBLISHERS_SERVICE] Error getting publisher:", error);
            if (error instanceof APIError) throw error;
            throw new APIError(500, 'Publisher Fetch Error', error.message || 'Failed to fetch publisher');
        }
    }

    /**
     * Update a publisher
     */
    static async updatePublisher(publisherId: string, data: z.infer<typeof publisherUpdateSchema>, adminUserId: string): Promise<Publisher> {
        try {
            // Validate the data
            const validatedData = publisherUpdateSchema.parse(data);
            
            // Check if publisher exists
            const existingPublisher = await Publisher.findById(publisherId);
            if (!existingPublisher) {
                throw new APIError(404, 'Publisher Not Found', `Publisher with ID ${publisherId} not found`);
            }

            // Update the publisher
            const updatedPublisher = await Publisher.update(publisherId, validatedData);
            
            // Log the update
            await AuditService.log({
                userId: adminUserId,
                action: 'PUBLISHER_UPDATED',
                entityType: 'Publisher',
                entityId: publisherId,
                details: {
                    publisherName: updatedPublisher.publisherName,
                    updatedFields: Object.keys(validatedData),
                    updatedBy: adminUserId
                }
            });
            
            return updatedPublisher;
        } catch (error: any) {
            console.error("[ADMIN_PUBLISHERS_SERVICE] Error updating publisher:", error);
            if (error instanceof APIError) throw error;
            throw new APIError(500, 'Publisher Update Error', error.message || 'Failed to update publisher');
        }
    }

    /**
     * Delete a publisher
     */
    static async deletePublisher(publisherId: string, adminUserId: string): Promise<void> {
        try {
            // Check if publisher exists
            const publisher = await Publisher.findById(publisherId);
            if (!publisher) {
                throw new APIError(404, 'Publisher Not Found', `Publisher with ID ${publisherId} not found`);
            }

            // Delete the publisher
            await publisher.delete();
            
            // Log the deletion
            await AuditService.log({
                userId: adminUserId,
                action: 'PUBLISHER_DELETED',
                entityType: 'Publisher',
                entityId: publisherId,
                details: {
                    publisherName: publisher.publisherName,
                    deletedBy: adminUserId
                }
            });
        } catch (error: any) {
            console.error("[ADMIN_PUBLISHERS_SERVICE] Error deleting publisher:", error);
            if (error instanceof APIError) throw error;
            throw new APIError(500, 'Publisher Delete Error', error.message || 'Failed to delete publisher');
        }
    }

    /**
     * Add a member to a publisher
     */
    static async addMember(publisherId: string, userId: string, role: PublisherRole, adminUserId: string): Promise<void> {
        try {
            const publisher = await Publisher.findById(publisherId);
            if (!publisher) {
                throw new APIError(404, 'Publisher Not Found', `Publisher with ID ${publisherId} not found`);
            }

            await publisher.addMember(userId, role);
            
            // Log the action
            await AuditService.log({
                userId: adminUserId,
                action: 'PUBLISHER_MEMBER_ADDED',
                entityType: 'Publisher',
                entityId: publisherId,
                details: {
                    publisherName: publisher.publisherName,
                    addedUserId: userId,
                    role: role,
                    addedBy: adminUserId
                }
            });
        } catch (error: any) {
            console.error("[ADMIN_PUBLISHERS_SERVICE] Error adding member:", error);
            if (error instanceof APIError) throw error;
            throw new APIError(500, 'Add Member Error', error.message || 'Failed to add member');
        }
    }

    /**
     * Remove a member from a publisher
     */
    static async removeMember(publisherId: string, userId: string, adminUserId: string): Promise<void> {
        try {
            const publisher = await Publisher.findById(publisherId);
            if (!publisher) {
                throw new APIError(404, 'Publisher Not Found', `Publisher with ID ${publisherId} not found`);
            }

            await publisher.removeMember(userId);
            
            // Log the action
            await AuditService.log({
                userId: adminUserId,
                action: 'PUBLISHER_MEMBER_REMOVED',
                entityType: 'Publisher',
                entityId: publisherId,
                details: {
                    publisherName: publisher.publisherName,
                    removedUserId: userId,
                    removedBy: adminUserId
                }
            });
        } catch (error: any) {
            console.error("[ADMIN_PUBLISHERS_SERVICE] Error removing member:", error);
            if (error instanceof APIError) throw error;
            throw new APIError(500, 'Remove Member Error', error.message || 'Failed to remove member');
        }
    }

    /**
     * Get publisher members
     */
    static async getPublisherMembers(publisherId: string): Promise<any[]> {
        try {
            const publisher = await Publisher.findById(publisherId);
            if (!publisher) {
                throw new APIError(404, 'Publisher Not Found', `Publisher with ID ${publisherId} not found`);
            }

            return await publisher.getMembers();
        } catch (error: any) {
            console.error("[ADMIN_PUBLISHERS_SERVICE] Error getting publisher members:", error);
            if (error instanceof APIError) throw error;
            throw new APIError(500, 'Get Members Error', error.message || 'Failed to get members');
        }
    }

    /**
     * Get publisher modpacks
     */
    static async getPublisherModpacks(publisherId: string, limit = 20, offset = 0): Promise<{ modpacks: any[], total: number }> {
        try {
            const publisher = await Publisher.findById(publisherId);
            if (!publisher) {
                throw new APIError(404, 'Publisher Not Found', `Publisher with ID ${publisherId} not found`);
            }

            const [modpacks, total] = await Promise.all([
                publisher.getModpacks(limit, offset),
                publisher.getModpacksCount()
            ]);

            return { modpacks, total };
        } catch (error: any) {
            console.error("[ADMIN_PUBLISHERS_SERVICE] Error getting publisher modpacks:", error);
            if (error instanceof APIError) throw error;
            throw new APIError(500, 'Get Modpacks Error', error.message || 'Failed to get modpacks');
        }
    }
}