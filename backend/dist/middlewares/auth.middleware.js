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
exports.USER_CONTEXT_KEY = exports.JWT_CONTEXT_KEY = void 0;
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;
exports.requireCreatorAccess = requireCreatorAccess;
exports.isOrganizationMember = isOrganizationMember;
const jsonwebtoken_1 = require("jsonwebtoken");
const User_model_1 = require("@/models/User.model");
const APIError_1 = require("../lib/APIError");
// --- Startup Configuration ---
// This check runs ONCE when the server starts, not on every request.
if (!process.env.JWT_SECRET) {
    throw new Error('FATAL_ERROR: JWT_SECRET environment variable is not set.');
}
const JWT_SECRET = process.env.JWT_SECRET;
// Use constants for keys and headers to avoid typos.
exports.JWT_CONTEXT_KEY = 'jwt_payload';
exports.USER_CONTEXT_KEY = 'user';
const AUTH_HEADER = 'Authorization';
const AUTH_SCHEME = 'Bearer ';
// --- Middleware ---
/**
 * Verifies the JWT from the Authorization header and attaches the corresponding
 * user object to the context.
 */
function requireAuth(c, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const authHeader = c.req.header(AUTH_HEADER);
        if (!authHeader || !authHeader.startsWith(AUTH_SCHEME)) {
            throw new APIError_1.APIError(401, 'Unauthorized', 'MISSING_OR_MALFORMED_TOKEN');
        }
        const token = authHeader.substring(AUTH_SCHEME.length);
        try {
            const payload = (0, jsonwebtoken_1.verify)(token, JWT_SECRET);
            // Use .lean() for a significant performance boost if you only need a plain
            // JavaScript object and not a full Mongoose document instance.
            const user = yield User_model_1.User.findById(payload.sub);
            if (!user) {
                throw new APIError_1.APIError(401, 'Unauthorized', 'USER_NOT_FOUND');
            }
            c.set(exports.USER_CONTEXT_KEY, user);
            c.set(exports.JWT_CONTEXT_KEY, payload);
            yield next();
        }
        catch (err) {
            if (err instanceof jsonwebtoken_1.TokenExpiredError) {
                throw new APIError_1.APIError(401, 'Unauthorized', 'TOKEN_EXPIRED');
            }
            if (err instanceof jsonwebtoken_1.JsonWebTokenError) {
                // This catches other JWT errors like invalid signature.
                throw new APIError_1.APIError(401, 'Unauthorized', 'INVALID_TOKEN');
            }
            // Re-throw any other unexpected errors (like our own APIError).
            throw err;
        }
    });
}
/**
 * Checks if the user attached by `requireAuth` has admin privileges.
 * This middleware MUST be placed after `requireAuth` in the chain.
 */
function requireAdmin(c, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = c.get(exports.USER_CONTEXT_KEY);
        // This check provides a clear error if middleware order is incorrect.
        if (!user) {
            throw new APIError_1.APIError(500, 'Middleware Misconfiguration', 'USER_NOT_IN_CONTEXT');
        }
        if (!(user instanceof User_model_1.User)) {
            throw new APIError_1.APIError(500, 'Middleware Misconfiguration', 'USER_TYPE_INVALID');
        }
        if (!user.admin) {
            throw new APIError_1.APIError(403, 'Forbidden', 'INSUFFICIENT_PERMISSIONS');
        }
        yield next();
    });
}
function requireCreatorAccess(c, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = c.get(exports.USER_CONTEXT_KEY);
        if (!user) {
            throw new APIError_1.APIError(500, 'Middleware Misconfiguration', 'USER_NOT_IN_CONTEXT');
        }
        if (!(user instanceof User_model_1.User)) {
            throw new APIError_1.APIError(500, 'Middleware Misconfiguration', 'USER_TYPE_INVALID');
        }
        const completeUser = yield User_model_1.User.getCompleteUser(user.id);
        if ((completeUser === null || completeUser === void 0 ? void 0 : completeUser.publisherMemberships.length) === 0) {
            throw new APIError_1.APIError(403, 'Forbidden', 'INSUFFICIENT_PERMISSIONS');
        }
        yield next();
    });
}
function isOrganizationMember(c, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = c.get(exports.USER_CONTEXT_KEY);
        const { teamId } = c.req.param();
        if (!user) {
            throw new APIError_1.APIError(500, 'Middleware Misconfiguration', 'USER_NOT_IN_CONTEXT');
        }
        if (!(user instanceof User_model_1.User)) {
            throw new APIError_1.APIError(500, 'Middleware Misconfiguration', 'USER_TYPE_INVALID');
        }
        const userTeams = yield user.getTeams();
        const isMember = userTeams.some(team => team.id === teamId);
        if (!isMember) {
            throw new APIError_1.APIError(403, 'Forbidden', 'USER_NOT_IN_ORGANIZATION');
        }
        yield next();
    });
}
