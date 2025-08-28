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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
require("dotenv/config");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_model_1 = require("@/models/User.model");
const Session_model_1 = require("@/models/Session.model");
const discord_1 = require("@/services/discord");
const consts_1 = require("@/consts");
const APIError_1 = require("@/lib/APIError"); // 1. Importar APIError
// Asumimos que JWT_SECRET se valida al iniciar la app
const JWT_SECRET = process.env.JWT_SECRET;
class AuthService {
    /**
     * Procesa el callback de OAuth de Discord, valida al usuario y genera tokens.
     */
    static handleDiscordCallback(code) {
        return __awaiter(this, void 0, void 0, function* () {
            const discordToken = yield (0, discord_1.exchangeCodeForToken)(code);
            const discordApiUser = yield (0, discord_1.getDiscordUser)(discordToken.access_token);
            if (consts_1.IS_BETA_PROGRAM && consts_1.DISCORD_GUILD_ID) {
                yield this.verifyGuildMembership(discordToken.access_token, discordApiUser.id);
            }
            // 2. Simplifica la lógica de creación/actualización del usuario.
            const user = yield this.findOrCreateUser(discordApiUser, discordToken);
            const session = yield Session_model_1.Session.create({ userId: user.id, deviceInfo: {}, locationInfo: {} });
            const jwtTokens = yield user.generateTokens(session);
            return {
                token_type: 'bearer',
                expires_in: 3600 * 4, // 4 horas
                access_token: jwtTokens.accessToken,
                refresh_token: jwtTokens.refreshToken,
            };
        });
    }
    /**
     * Refresca los tokens de autenticación.
     */
    static refreshAuthTokens(refreshTokenString) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!refreshTokenString) {
                throw new APIError_1.APIError(400, 'Refresh token is required.', 'MISSING_REFRESH_TOKEN');
            }
            let decoded;
            try {
                // 3. El JWT_SECRET se asume que existe. El chequeo en runtime es innecesario.
                decoded = jsonwebtoken_1.default.verify(refreshTokenString, JWT_SECRET);
            }
            catch (error) {
                throw new APIError_1.APIError(401, 'Invalid or expired refresh token.', 'INVALID_REFRESH_TOKEN');
            }
            const { sub: userId, sessionId } = decoded;
            const user = yield User_model_1.User.findById(userId);
            const session = yield Session_model_1.Session.findById(sessionId);
            if (!user || !session || session.userId !== user.id) {
                throw new APIError_1.APIError(401, 'Invalid session or user.', 'INVALID_SESSION');
            }
            const newJwtTokens = yield user.generateTokens(session);
            return {
                token_type: 'bearer',
                expires_in: 3600,
                access_token: newJwtTokens.accessToken,
                refresh_token: newJwtTokens.refreshToken,
            };
        });
    }
    /**
     * Obtiene el perfil público de un usuario autenticado.
     */
    static getAuthenticatedUserProfile(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!userId) {
                throw new APIError_1.APIError(400, 'User ID is required.', 'MISSING_USER_ID');
            }
            const userWithRelations = yield User_model_1.User.getCompleteUser(userId);
            if (!userWithRelations) {
                throw new APIError_1.APIError(404, 'User not found.', 'USER_NOT_FOUND');
            }
            // Crea una instancia para usar sus métodos, como toPublicJson()
            const userInstance = new User_model_1.User(userWithRelations);
            const publicUserProfile = userInstance.toPublicJson();
            return Object.assign(Object.assign({}, publicUserProfile), { publisherMemberships: userWithRelations.publisherMemberships || [] });
        });
    }
    // --- Métodos de Ayuda (Helper Methods) ---
    /**
     * Verifica si un usuario pertenece al servidor de Discord requerido usando fetch.
     * @private
     */
    static verifyGuildMembership(discordAccessToken, discordUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield fetch("https://discord.com/api/users/@me/guilds", {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${discordAccessToken}`,
                },
            });
            if (!response.ok) {
                if (response.status === 401) {
                    throw new APIError_1.APIError(401, 'Invalid Discord token.', 'DISCORD_TOKEN_INVALID');
                }
                throw new APIError_1.APIError(502, 'Failed to verify Discord server membership.', 'GUILD_CHECK_FAILED');
            }
            const guilds = (yield response.json());
            const isMember = guilds.some(guild => guild.id === consts_1.DISCORD_GUILD_ID);
            if (!isMember) {
                throw new APIError_1.APIError(403, 'Access denied. User is not in the required Discord server.', 'NOT_IN_GUILD');
            }
        });
    }
    /**
     * Encuentra un usuario por su ID de Discord o crea uno nuevo si no existe.
     * @private
     */
    static findOrCreateUser(discordApiUser, discordToken) {
        return __awaiter(this, void 0, void 0, function* () {
            const userPayload = {
                discordAccessToken: discordToken.access_token,
                discordRefreshToken: discordToken.refresh_token,
                avatarUrl: discordApiUser.avatar ? `https://cdn.discordapp.com/avatars/${discordApiUser.id}/${discordApiUser.avatar}.png` : null,
                username: discordApiUser.username,
                email: discordApiUser.email,
            };
            let user = yield User_model_1.User.findByDiscordId(discordApiUser.id);
            if (!user) {
                // Si el usuario no existe, créalo.
                user = yield User_model_1.User.create({
                    username: discordApiUser.username,
                    email: discordApiUser.email,
                    admin: false
                });
            }
            else {
                // Si el usuario existe, actualízalo.
                user = yield User_model_1.User.update(user.id, userPayload);
            }
            if (!user) {
                throw new APIError_1.APIError(500, 'Failed to create or update user.', 'USER_UPSERT_FAILED');
            }
            return user;
        });
    }
}
exports.AuthService = AuthService;
