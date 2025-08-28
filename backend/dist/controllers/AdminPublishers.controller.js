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
exports.AdminPublishersController = void 0;
const Publisher_model_1 = require("@/models/Publisher.model");
const adminPublishers_service_1 = require("@/services/adminPublishers.service");
const jsonapi_1 = require("../utils/jsonapi");
const APIError_1 = require("@/lib/APIError"); // Assuming APIError is in lib
// Interface for user object potentially set by middleware
// interface AuthenticatedUser {
//     id: string;
// }
class AdminPublishersController {
    static createPublisher(c) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // TODO: MIGRATE_MIDDLEWARE - This relies on 'c.get('user')' which comes from requireAuth/validateAdmin middleware
                const user = c.get('user');
                if (!user || !user.id) {
                    throw new APIError_1.APIError(401, 'Unauthorized', 'Admin privileges required.');
                }
                const userId = user.id;
                const body = yield c.req.json();
                const validationResult = Publisher_model_1.newPublisherSchema.safeParse(body);
                if (!validationResult.success) {
                    return c.json((0, jsonapi_1.serializeError)({
                        status: '400',
                        title: 'Validation Error',
                        detail: "Invalid request body for creating publisher",
                        meta: { errors: validationResult.error.flatten().fieldErrors }
                    }), 400);
                }
                const publisher = yield adminPublishers_service_1.AdminPublishersService.createPublisher(validationResult.data, userId);
                return c.json((0, jsonapi_1.serializeResource)('publisher', publisher), 201);
            }
            catch (error) {
                console.error("[CONTROLLER_ADMIN_PUBLISHER] Error creating publisher:", error);
                if (error instanceof APIError_1.APIError)
                    throw error;
                throw new APIError_1.APIError(error.statusCode || 500, error.name || 'Create Publisher Error', error.message || "Error creating publisher", error.errorCode);
            }
        });
    }
    static listPublishers(c) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const publishers = yield adminPublishers_service_1.AdminPublishersService.listPublishers();
                return c.json((0, jsonapi_1.serializeCollection)('publisher', publishers), 200);
            }
            catch (error) {
                console.error("[CONTROLLER_ADMIN_PUBLISHER] Error listing publishers:", error);
                if (error instanceof APIError_1.APIError)
                    throw error;
                throw new APIError_1.APIError(error.statusCode || 500, error.name || 'List Publishers Error', error.message || "Error listing publishers");
            }
        });
    }
    static getPublisher(c) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const publisherId = c.req.param('publisherId');
                if (!publisherId) { // Should be guaranteed by route, but good practice
                    throw new APIError_1.APIError(400, 'Bad Request', 'Publisher ID is missing from path.');
                }
                const publisherDetails = yield adminPublishers_service_1.AdminPublishersService.getPublisherDetails(publisherId);
                if (!publisherDetails) {
                    throw new APIError_1.APIError(404, 'Not Found', 'Publisher not found.');
                }
                return c.json((0, jsonapi_1.serializeResource)('publisher', publisherDetails), 200);
            }
            catch (error) {
                console.error("[CONTROLLER_ADMIN_PUBLISHER] Error getting publisher details:", error);
                if (error instanceof APIError_1.APIError)
                    throw error;
                throw new APIError_1.APIError(error.statusCode || 500, error.name || 'Get Publisher Error', error.message || "Error getting publisher details.");
            }
        });
    }
    static updatePublisher(c) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // TODO: MIGRATE_MIDDLEWARE - This relies on 'c.get('user')'
                const user = c.get('user');
                if (!user || !user.id) {
                    throw new APIError_1.APIError(401, 'Unauthorized', 'Admin privileges required.');
                }
                const adminUserId = user.id;
                const publisherId = c.req.param('publisherId');
                if (!publisherId) {
                    throw new APIError_1.APIError(400, 'Bad Request', 'Publisher ID is missing from path.');
                }
                const body = yield c.req.json();
                const validationResult = Publisher_model_1.publisherUpdateSchema.safeParse(body);
                if (!validationResult.success) {
                    return c.json((0, jsonapi_1.serializeError)({
                        status: '400',
                        title: 'Validation Error',
                        detail: "Invalid request body for updating publisher",
                        meta: { errors: validationResult.error.flatten().fieldErrors }
                    }), 400);
                }
                if (Object.keys(validationResult.data).length === 0) {
                    return c.json((0, jsonapi_1.serializeError)({
                        status: '400',
                        title: 'Bad Request',
                        detail: "Request body is empty or contains no updatable fields."
                    }), 400);
                }
                const updatedPublisher = yield adminPublishers_service_1.AdminPublishersService.updatePublisher(publisherId, validationResult.data, adminUserId);
                return c.json((0, jsonapi_1.serializeResource)('publisher', updatedPublisher), 200);
            }
            catch (error) {
                console.error("[CONTROLLER_ADMIN_PUBLISHER] Error updating publisher:", error);
                if (error instanceof APIError_1.APIError)
                    throw error;
                const statusCode = error.statusCode || (error.message && error.message.includes("not found") ? 404 : 500);
                throw new APIError_1.APIError(statusCode, error.name || (statusCode === 404 ? 'Not Found' : 'Update Publisher Error'), error.message || "Error updating publisher", error.errorCode);
            }
        });
    }
    static deletePublisher(c) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // TODO: MIGRATE_MIDDLEWARE - This relies on 'c.get('user')'
                const user = c.get('user');
                if (!user || !user.id) {
                    throw new APIError_1.APIError(401, 'Unauthorized', 'Admin privileges required.');
                }
                const adminUserId = user.id;
                const publisherId = c.req.param('publisherId');
                if (!publisherId) {
                    throw new APIError_1.APIError(400, 'Bad Request', 'Publisher ID is missing from path.');
                }
                yield adminPublishers_service_1.AdminPublishersService.deletePublisher(publisherId, adminUserId);
                return c.body(null, 204);
            }
            catch (error) {
                console.error("[CONTROLLER_ADMIN_PUBLISHER] Error deleting publisher:", error);
                if (error instanceof APIError_1.APIError)
                    throw error;
                const statusCode = error.statusCode || (error.message && error.message.includes("not found") ? 404 : 500);
                throw new APIError_1.APIError(statusCode, error.name || (statusCode === 404 ? 'Not Found' : 'Delete Publisher Error'), error.message || "Error deleting publisher", error.errorCode);
            }
        });
    }
}
exports.AdminPublishersController = AdminPublishersController;
