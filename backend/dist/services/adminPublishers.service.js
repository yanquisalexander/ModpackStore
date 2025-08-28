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
exports.AdminPublishersService = void 0;
const Publisher_model_1 = require("@/models/Publisher.model");
class AdminPublishersService {
    static createPublisher(data, ownerId) {
        return __awaiter(this, void 0, void 0, function* () {
            // The Publisher.create model method already handles creating the publisher
            // and adding the owner in a transaction.
            console.log(`[SERVICE_ADMIN_PUBLISHERS] Attempting to create publisher "${data.publisherName}" by user ${ownerId}`);
            const publisher = yield Publisher_model_1.Publisher.create(data, ownerId);
            console.log(`[SERVICE_ADMIN_PUBLISHERS] Publisher "${publisher.publisherName}" (ID: ${publisher.id}) created successfully.`);
            return publisher.toJson();
        });
    }
    static listPublishers() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("[SERVICE_ADMIN_PUBLISHERS] Listing active publishers.");
            // For admin, maybe a different method like Publisher.findAllIncludingBanned() might be needed later.
            const publishers = yield Publisher_model_1.Publisher.findActive(); // findActive returns Publisher instances
            return publishers.map(p => p.toJson());
        });
    }
    static getPublisherDetails(publisherId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[SERVICE_ADMIN_PUBLISHERS] Getting complete details for publisher ID: ${publisherId}`);
            const publisherData = yield Publisher_model_1.Publisher.getCompletePublisher(publisherId);
            if (!publisherData) {
                return null;
            }
            // Transform the raw data from getCompletePublisher into a safe DTO
            // The raw publisherData contains all necessary top-level fields for the DTO's base.
            // Publisher.model.ts's toJson() essentially returns all direct properties of the instance.
            const publicDetails = {
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
                publicDetails.members = publisherData.members.map(member => {
                    var _a;
                    return ({
                        userId: member.userId,
                        username: ((_a = member.user) === null || _a === void 0 ? void 0 : _a.username) || 'Unknown User',
                        role: member.role,
                    });
                });
            }
            if (publisherData.modpacks && Array.isArray(publisherData.modpacks)) {
                // Publisher.getCompletePublisher fetches up to 10 modpacks.
                // If the DTO needs these modpacks, they should be mapped here.
                // If only count is needed, this is acceptable.
                publicDetails.modpacksCount = publisherData.modpacks.length;
            }
            else {
                publicDetails.modpacksCount = 0;
            }
            return publicDetails;
        });
    }
    static updatePublisher(publisherId, data, adminUserId // For authorization checks later
    ) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[SERVICE_ADMIN_PUBLISHERS] User ${adminUserId} attempting to update publisher ID: ${publisherId}`);
            // Authorization TODO: Check if adminUserId has permission to update this publisher
            // e.g., using a global admin role or specific publisher management permissions.
            // For now, proceeding with the update directly using the static Publisher.update.
            const updatedPublisher = yield Publisher_model_1.Publisher.update(publisherId, data); // Uses static update
            console.log(`[SERVICE_ADMIN_PUBLISHERS] Publisher ID: ${publisherId} updated successfully.`);
            return updatedPublisher.toJson();
        });
    }
    static deletePublisher(publisherId, adminUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[SERVICE_ADMIN_PUBLISHERS] User ${adminUserId} attempting to delete publisher ID: ${publisherId}`);
            // Authorization TODO: Check if adminUserId has permission to delete this publisher.
            const publisher = yield Publisher_model_1.Publisher.findById(publisherId);
            if (!publisher) {
                return false; // Or throw a NotFoundError
            }
            yield publisher.delete(); // Uses instance delete, which is fine.
            console.log(`[SERVICE_ADMIN_PUBLISHERS] Publisher ID: ${publisherId} deleted successfully.`);
            return true;
        });
    }
}
exports.AdminPublishersService = AdminPublishersService;
