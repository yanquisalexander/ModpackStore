import { Publisher, newPublisherSchema, publisherUpdateSchema, PublisherRole } from "@/models/Publisher.model";
import type { User } from "@/models/User.model"; // For type checking if needed, though userId is string
import { z } from "zod";

// TODO: Replace console.log with a dedicated logger solution throughout the service.

// Define a DTO for publisher details to ensure consistent and safe responses
// This is especially important for methods like getCompletePublisher
interface PublisherDetailsDTO extends z.infer<ReturnType<Publisher['toJson']>> {
    members?: Array<{ // Example structure, adjust based on actual needs
        userId: string;
        username: string; // Assuming username is available and safe to return
        role: PublisherRole;
        // Avoid leaking sensitive user details like email from members
    }>;
    modpacksCount?: number;
    // other details from getCompletePublisher if needed
}


export class AdminPublishersService {
    static async createPublisher(
        data: z.infer<typeof newPublisherSchema>,
        ownerId: string
    ): Promise<ReturnType<Publisher['toJson']>> {
        // The Publisher.create model method already handles creating the publisher
        // and adding the owner in a transaction.
        console.log(`[SERVICE_ADMIN_PUBLISHERS] Attempting to create publisher "${data.publisherName}" by user ${ownerId}`);
        const publisher = await Publisher.create(data, ownerId);
        console.log(`[SERVICE_ADMIN_PUBLISHERS] Publisher "${publisher.publisherName}" (ID: ${publisher.id}) created successfully.`);
        return publisher.toJson();
    }

    static async listPublishers(): Promise<Array<ReturnType<Publisher['toJson']>>> {
        console.log("[SERVICE_ADMIN_PUBLISHERS] Listing active publishers.");
        // For admin, maybe a different method like Publisher.findAllIncludingBanned() might be needed later.
        const publishers = await Publisher.findActive(); // findActive returns Publisher instances
        return publishers.map(p => p.toJson());
    }

    static async getPublisherDetails(publisherId: string): Promise<PublisherDetailsDTO | null> {
        console.log(`[SERVICE_ADMIN_PUBLISHERS] Getting complete details for publisher ID: ${publisherId}`);
        const publisherData = await Publisher.getCompletePublisher(publisherId);
        if (!publisherData) {
            return null;
        }

        // Transform the raw data from getCompletePublisher into a safe DTO
        // The raw publisherData contains all necessary top-level fields for the DTO's base.
        // Publisher.model.ts's toJson() essentially returns all direct properties of the instance.
        const publicDetails: PublisherDetailsDTO = {
            id: publisherData.id,
            publisherName: publisherData.publisherName,
            tosUrl: publisherData.tosUrl,
            privacyUrl: publisherData.privacyUrl,
            bannerUrl: publisherData.bannerUrl,
            logoUrl: publisherData.logoUrl,
            description: publisherData.description,
            websiteUrl: publisherData.websiteUrl,
            discordUrl: publisherData.discordUrl,
            banned: publisherData.banned,
            verified: publisherData.verified,
            partnered: publisherData.partnered,
            isHostingPartner: publisherData.isHostingPartner,
            createdAt: publisherData.createdAt,
            // No need to instantiate Publisher model just for these fields if they are directly available
        };

        if (publisherData.members) {
            publicDetails.members = publisherData.members.map(member => ({
                userId: member.userId,
                username: member.user?.username || 'Unknown User',
                role: member.role as PublisherRole,
            }));
        }

        if (publisherData.modpacks && Array.isArray(publisherData.modpacks)) {
            // Publisher.getCompletePublisher fetches up to 10 modpacks.
            // If the DTO needs these modpacks, they should be mapped here.
            // If only count is needed, this is acceptable.
            publicDetails.modpacksCount = publisherData.modpacks.length;
        } else {
            publicDetails.modpacksCount = 0;
        }

        return publicDetails;
    }

    static async updatePublisher(
        publisherId: string,
        data: z.infer<typeof publisherUpdateSchema>,
        adminUserId: string // For authorization checks later
    ): Promise<ReturnType<Publisher['toJson']>> {
        console.log(`[SERVICE_ADMIN_PUBLISHERS] User ${adminUserId} attempting to update publisher ID: ${publisherId}`);

        // Authorization TODO: Check if adminUserId has permission to update this publisher
        // e.g., using a global admin role or specific publisher management permissions.
        // For now, proceeding with the update directly using the static Publisher.update.

        const updatedPublisher = await Publisher.update(publisherId, data); // Uses static update
        console.log(`[SERVICE_ADMIN_PUBLISHERS] Publisher ID: ${publisherId} updated successfully.`);
        return updatedPublisher.toJson();
    }

    static async deletePublisher(publisherId: string, adminUserId: string): Promise<boolean> {
        console.log(`[SERVICE_ADMIN_PUBLISHERS] User ${adminUserId} attempting to delete publisher ID: ${publisherId}`);

        // Authorization TODO: Check if adminUserId has permission to delete this publisher.

        const publisher = await Publisher.findById(publisherId);
        if (!publisher) {
            return false; // Or throw a NotFoundError
        }
        await publisher.delete(); // Uses instance delete, which is fine.
        console.log(`[SERVICE_ADMIN_PUBLISHERS] Publisher ID: ${publisherId} deleted successfully.`);
        return true;
    }
}
