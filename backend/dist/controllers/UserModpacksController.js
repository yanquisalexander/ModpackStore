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
exports.UserModpacksController = void 0;
const Modpack_model_1 = require("@/models/Modpack.model");
const ModpackVersion_model_1 = require("@/models/ModpackVersion.model"); // Added modpackVersionUpdateSchema
const userModpacks_service_1 = require("@/services/userModpacks.service");
const jsonapi_1 = require("../utils/jsonapi");
class UserModpacksController {
    // POST /v1/modpacks/versions/:versionId/file
    static uploadModpackVersionFile(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!req.user || !req.user.id) {
                res.status(401).json((0, jsonapi_1.serializeError)({ status: '401', title: 'Unauthorized', detail: 'User authentication required.' }));
                return;
            }
            const userId = req.user.id;
            const { versionId } = req.params;
            if (!versionId) {
                res.status(400).json((0, jsonapi_1.serializeError)({ status: '400', title: 'Bad Request', detail: 'Version ID is required.' }));
                return;
            }
            // Handle file upload
            if (!req.file) {
                res.status(400).json((0, jsonapi_1.serializeError)({ status: '400', title: 'Bad Request', detail: 'No file uploaded.' }));
                return;
            }
            try {
                const updatedVersion = yield userModpacks_service_1.UserModpacksService.uploadModpackVersionFile(versionId, req.file, userId);
                res.status(200).json((0, jsonapi_1.serializeResource)('modpackVersion', updatedVersion));
            }
            catch (error) {
                console.error('[CONTROLLER_USER_MODPACKS] Error uploading modpack version file:', error);
                const statusCode = error.statusCode || (error.message.includes("not found") ? 404 : 500);
                res.status(statusCode).json((0, jsonapi_1.serializeError)({
                    status: statusCode.toString(),
                    title: error.name || (statusCode === 404 ? 'Not Found' : 'Upload File Error'),
                    detail: error.message || 'Failed to upload modpack version file.'
                }));
            }
        });
    }
    // POST /v1/modpacks
    static createModpack(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!req.user || !req.user.id) {
                res.status(401).json((0, jsonapi_1.serializeError)({ status: '401', title: 'Unauthorized', detail: 'User authentication required.' }));
                return;
            }
            const userId = req.user.id;
            const { publisherId, name, slug, iconUrl, bannerUrl, shortDescription, description, visibility, trailerUrl, password, showUserAsPublisher } = req.body;
            const validationInput = {
                publisherId, name, slug, iconUrl, bannerUrl, shortDescription, description, visibility,
                trailerUrl, password, showUserAsPublisher,
                creatorUserId: userId,
            };
            const parseResult = Modpack_model_1.newModpackSchema.safeParse(validationInput);
            if (!parseResult.success) {
                res.status(400).json((0, jsonapi_1.serializeError)({
                    status: '400',
                    title: 'Validation Error',
                    detail: 'Invalid modpack data provided.',
                    meta: { errors: parseResult.error.format() }
                }));
                return;
            }
            try {
                const clientProvidedData = { publisherId, name, slug, iconUrl, bannerUrl, shortDescription, description, visibility, trailerUrl, password, showUserAsPublisher };
                const newModpack = yield userModpacks_service_1.UserModpacksService.createModpack(clientProvidedData, userId);
                res.status(201).json((0, jsonapi_1.serializeResource)('modpack', newModpack));
            }
            catch (error) {
                console.error('[CONTROLLER_USER_MODPACKS] Error creating modpack:', error);
                const statusCode = error.statusCode || 500;
                const errorDetail = error.field ? `${error.message} (field: ${error.field})` : error.message;
                res.status(statusCode).json((0, jsonapi_1.serializeError)({
                    status: statusCode.toString(),
                    title: error.name || 'Create Modpack Error',
                    detail: errorDetail || 'Failed to create modpack'
                }));
            }
        });
    }
    // PATCH /v1/modpacks/:modpackId
    static updateModpack(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!req.user || !req.user.id) {
                res.status(401).json((0, jsonapi_1.serializeError)({ status: '401', title: 'Unauthorized', detail: 'User authentication required.' }));
                return;
            }
            const userId = req.user.id;
            const { modpackId } = req.params;
            if (!modpackId) { // Should be caught by routing, but good practice
                res.status(400).json((0, jsonapi_1.serializeError)({ status: '400', title: 'Bad Request', detail: 'Modpack ID is required.' }));
                return;
            }
            const _a = req.body, { publisherId, creatorUserId, slug, status } = _a, clientPayload = __rest(_a, ["publisherId", "creatorUserId", "slug", "status"]);
            const parseResult = Modpack_model_1.modpackUpdateSchema.safeParse(clientPayload);
            if (!parseResult.success) {
                res.status(400).json((0, jsonapi_1.serializeError)({
                    status: '400',
                    title: 'Validation Error',
                    detail: 'Invalid modpack update data provided.',
                    meta: { errors: parseResult.error.format() }
                }));
                return;
            }
            if (Object.keys(parseResult.data).length === 0) {
                res.status(400).json((0, jsonapi_1.serializeError)({ status: '400', title: 'Bad Request', detail: "Request body is empty or contains no updatable fields for modpack." }));
                return;
            }
            try {
                const updatedModpack = yield userModpacks_service_1.UserModpacksService.updateModpack(modpackId, parseResult.data, userId);
                res.status(200).json((0, jsonapi_1.serializeResource)('modpack', updatedModpack));
            }
            catch (error) {
                console.error('[CONTROLLER_USER_MODPACKS] Error updating modpack:', error);
                const statusCode = error.statusCode || (error.message.includes("not found") ? 404 : 500);
                res.status(statusCode).json((0, jsonapi_1.serializeError)({
                    status: statusCode.toString(),
                    title: error.name || (statusCode === 404 ? 'Not Found' : 'Update Modpack Error'),
                    detail: error.message || 'Failed to update modpack'
                }));
            }
        });
    }
    // DELETE /v1/modpacks/:modpackId
    static deleteModpack(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!req.user || !req.user.id) {
                res.status(401).json((0, jsonapi_1.serializeError)({ status: '401', title: 'Unauthorized', detail: 'User authentication required.' }));
                return;
            }
            const userId = req.user.id;
            const { modpackId } = req.params;
            if (!modpackId) { // Should be caught by routing
                res.status(400).json((0, jsonapi_1.serializeError)({ status: '400', title: 'Bad Request', detail: 'Modpack ID is required.' }));
                return;
            }
            try {
                yield userModpacks_service_1.UserModpacksService.deleteModpack(modpackId, userId);
                res.status(204).send();
            }
            catch (error) {
                console.error('[CONTROLLER_USER_MODPACKS] Error deleting modpack:', error);
                const statusCode = error.statusCode || (error.message.includes("not found") ? 404 : 500);
                res.status(statusCode).json((0, jsonapi_1.serializeError)({
                    status: statusCode.toString(),
                    title: error.name || (statusCode === 404 ? 'Not Found' : 'Delete Modpack Error'),
                    detail: error.message || 'Failed to delete modpack'
                }));
            }
        });
    }
    // GET /v1/modpacks
    static listUserModpacks(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!req.user || !req.user.id) {
                res.status(401).json((0, jsonapi_1.serializeError)({ status: '401', title: 'Unauthorized', detail: 'User authentication required.' }));
                return;
            }
            const userId = req.user.id;
            try {
                const modpacks = yield userModpacks_service_1.UserModpacksService.listUserModpacks(userId);
                res.status(200).json((0, jsonapi_1.serializeCollection)('modpack', modpacks));
            }
            catch (error) {
                console.error('[CONTROLLER_USER_MODPACKS] Error listing user modpacks:', error);
                const statusCode = error.statusCode || 500;
                res.status(statusCode).json((0, jsonapi_1.serializeError)({
                    status: statusCode.toString(),
                    title: error.name || 'List Modpacks Error',
                    detail: error.message || 'Failed to list modpacks'
                }));
            }
        });
    }
    // POST /v1/modpacks/:modpackId/versions
    static createModpackVersion(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!req.user || !req.user.id) {
                res.status(401).json((0, jsonapi_1.serializeError)({ status: '401', title: 'Unauthorized', detail: 'User authentication required.' }));
                return;
            }
            const userId = req.user.id;
            const { modpackId } = req.params;
            const { version, mcVersion, forgeVersion, changelog } = req.body;
            if (!modpackId) {
                res.status(400).json((0, jsonapi_1.serializeError)({ status: '400', title: 'Bad Request', detail: 'Modpack ID is required.' }));
                return;
            }
            const versionPayload = { version, mcVersion, forgeVersion, changelog };
            const fullDataForValidation = Object.assign(Object.assign({}, versionPayload), { modpackId, createdBy: userId });
            const parseResult = ModpackVersion_model_1.newModpackVersionSchema.safeParse(fullDataForValidation);
            if (!parseResult.success) {
                res.status(400).json((0, jsonapi_1.serializeError)({
                    status: '400',
                    title: 'Validation Error',
                    detail: 'Invalid modpack version data provided.',
                    meta: { errors: parseResult.error.format() }
                }));
                return;
            }
            try {
                const newVersion = yield userModpacks_service_1.UserModpacksService.createModpackVersion(modpackId, versionPayload, userId);
                res.status(201).json((0, jsonapi_1.serializeResource)('modpackVersion', newVersion));
            }
            catch (error) {
                console.error('[CONTROLLER_USER_MODPACKS] Error creating modpack version:', error);
                const statusCode = error.statusCode || 500;
                res.status(statusCode).json((0, jsonapi_1.serializeError)({
                    status: statusCode.toString(),
                    title: error.name || 'Create Version Error',
                    detail: error.message || 'Failed to create modpack version.'
                }));
            }
        });
    }
    // PATCH /v1/versions/:versionId
    static updateModpackVersion(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!req.user || !req.user.id) {
                res.status(401).json((0, jsonapi_1.serializeError)({ status: '401', title: 'Unauthorized', detail: 'User authentication required.' }));
                return;
            }
            const userId = req.user.id;
            const { versionId } = req.params;
            const { mcVersion, forgeVersion, changelog, status, releaseDate } = req.body;
            const clientPayload = { mcVersion, forgeVersion, changelog, status, releaseDate };
            if (!versionId) {
                res.status(400).json((0, jsonapi_1.serializeError)({ status: '400', title: 'Bad Request', detail: 'Version ID is required.' }));
                return;
            }
            const parseResult = ModpackVersion_model_1.modpackVersionUpdateSchema.safeParse(clientPayload);
            if (!parseResult.success) {
                res.status(400).json((0, jsonapi_1.serializeError)({
                    status: '400',
                    title: 'Validation Error',
                    detail: 'Invalid modpack version update data provided.',
                    meta: { errors: parseResult.error.format() }
                }));
                return;
            }
            if (Object.keys(parseResult.data).length === 0) {
                res.status(400).json((0, jsonapi_1.serializeError)({ status: '400', title: 'Bad Request', detail: "Request body is empty or contains no updatable fields for modpack version." }));
                return;
            }
            try {
                const updatedVersion = yield userModpacks_service_1.UserModpacksService.updateModpackVersion(versionId, parseResult.data, userId);
                res.status(200).json((0, jsonapi_1.serializeResource)('modpackVersion', updatedVersion));
            }
            catch (error) {
                console.error('[CONTROLLER_USER_MODPACKS] Error updating modpack version:', error);
                const statusCode = error.statusCode || (error.message.includes("not found") ? 404 : 500);
                res.status(statusCode).json((0, jsonapi_1.serializeError)({
                    status: statusCode.toString(),
                    title: error.name || (statusCode === 404 ? 'Not Found' : 'Update Version Error'),
                    detail: error.message || 'Failed to update modpack version.'
                }));
            }
        });
    }
    // POST /v1/versions/:versionId/publish
    static publishModpackVersion(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!req.user || !req.user.id) {
                res.status(401).json((0, jsonapi_1.serializeError)({ status: '401', title: 'Unauthorized', detail: 'User authentication required.' }));
                return;
            }
            const userId = req.user.id;
            const { versionId } = req.params;
            if (!versionId) {
                res.status(400).json((0, jsonapi_1.serializeError)({ status: '400', title: 'Bad Request', detail: 'Version ID is required.' }));
                return;
            }
            try {
                const publishedVersion = yield userModpacks_service_1.UserModpacksService.publishModpackVersion(versionId, userId);
                res.status(200).json((0, jsonapi_1.serializeResource)('modpackVersion', publishedVersion));
            }
            catch (error) {
                console.error('[CONTROLLER_USER_MODPACKS] Error publishing modpack version:', error);
                const statusCode = error.statusCode || (error.message.includes("not found") ? 404 : 500);
                res.status(statusCode).json((0, jsonapi_1.serializeError)({
                    status: statusCode.toString(),
                    title: error.name || (statusCode === 404 ? 'Not Found' : 'Publish Version Error'),
                    detail: error.message || 'Failed to publish modpack version.'
                }));
            }
        });
    }
    // GET /v1/modpacks/:modpackId/versions
    static listModpackVersions(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!req.user || !req.user.id) {
                res.status(401).json((0, jsonapi_1.serializeError)({ status: '401', title: 'Unauthorized', detail: 'User authentication required.' }));
                return;
            }
            const userId = req.user.id;
            const { modpackId } = req.params;
            if (!modpackId) {
                res.status(400).json((0, jsonapi_1.serializeError)({ status: '400', title: 'Bad Request', detail: 'Modpack ID is required.' }));
                return;
            }
            try {
                const versions = yield userModpacks_service_1.UserModpacksService.listModpackVersions(modpackId, userId);
                res.status(200).json((0, jsonapi_1.serializeCollection)('modpackVersion', versions));
            }
            catch (error) {
                console.error('[CONTROLLER_USER_MODPACKS] Error listing modpack versions:', error);
                const statusCode = error.statusCode || 500;
                res.status(statusCode).json((0, jsonapi_1.serializeError)({
                    status: statusCode.toString(),
                    title: error.name || 'List Versions Error',
                    detail: error.message || 'Failed to list modpack versions.'
                }));
            }
        });
    }
}
exports.UserModpacksController = UserModpacksController;
