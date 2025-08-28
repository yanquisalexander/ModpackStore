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
exports.ExploreModpacksController = void 0;
const modpacks_1 = require("@/services/modpacks");
const jsonapi_1 = require("../utils/jsonapi");
class ExploreModpacksController {
    static getHomepage(c) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const modpacks = yield (0, modpacks_1.getExploreModpacks)(); // Assuming this returns an array of modpacks
                return c.json((0, jsonapi_1.serializeCollection)('modpack', modpacks), 200);
            }
            catch (error) {
                console.error("[CONTROLLER_EXPLORE] Error in getHomepage:", error);
                const statusCode = error.statusCode || 500;
                return c.json((0, jsonapi_1.serializeError)({
                    status: statusCode.toString(),
                    title: error.name || 'Homepage Error',
                    detail: error.message || "Failed to fetch homepage modpacks."
                }), statusCode);
            }
        });
    }
    static search(c) {
        return __awaiter(this, void 0, void 0, function* () {
            const q = c.req.query('q');
            if (!q) {
                return c.json((0, jsonapi_1.serializeError)({
                    status: '400',
                    title: 'Bad Request',
                    detail: 'Missing search query parameter (q).',
                }), 400);
            }
            if (typeof q !== 'string' || q.length < 3) {
                return c.json((0, jsonapi_1.serializeError)({
                    status: '400',
                    title: 'Bad Request',
                    detail: 'Search query (q) must be a string of at least 3 characters.',
                }), 400);
            }
            try {
                const modpacks = yield (0, modpacks_1.searchModpacks)(q); // Service should handle toString() or type checking
                return c.json((0, jsonapi_1.serializeCollection)('modpack', modpacks), 200);
            }
            catch (error) {
                console.error("[CONTROLLER_EXPLORE] Error in search:", error);
                const statusCode = error.statusCode || 500;
                return c.json((0, jsonapi_1.serializeError)({
                    status: statusCode.toString(),
                    title: error.name || 'Search Error',
                    detail: error.message || "Failed to search modpacks."
                }), statusCode);
            }
        });
    }
    static getModpack(c) {
        return __awaiter(this, void 0, void 0, function* () {
            const modpackId = c.req.param('modpackId');
            // modpackId is guaranteed by the route, no need to check for its existence here.
            try {
                const modpack = yield (0, modpacks_1.getModpackById)(modpackId);
                if (!modpack) {
                    return c.json((0, jsonapi_1.serializeError)({
                        status: '404',
                        title: 'Not Found',
                        detail: "Modpack not found.",
                    }), 404);
                }
                return c.json((0, jsonapi_1.serializeResource)('modpack', modpack), 200);
            }
            catch (error) {
                console.error(`[CONTROLLER_EXPLORE] Error in getModpack for ID ${modpackId}:`, error);
                const statusCode = error.statusCode || 500;
                return c.json((0, jsonapi_1.serializeError)({
                    status: statusCode.toString(),
                    title: error.name || 'Modpack Error',
                    detail: error.message || "Failed to fetch modpack details."
                }), statusCode);
            }
        });
    }
}
exports.ExploreModpacksController = ExploreModpacksController;
