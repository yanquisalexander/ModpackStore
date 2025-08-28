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
exports.AccountsController = void 0;
const auth_service_1 = require("@/services/auth.service");
const APIError_1 = require("@/lib/APIError");
class AccountsController {
    /**
     * Maneja el callback de la autenticación de Discord.
     */
    static callbackDiscord(c) {
        return __awaiter(this, void 0, void 0, function* () {
            const code = c.req.query('code');
            // 2. Lanza un error estandarizado en lugar de retornar una respuesta manual
            if (!code) {
                throw new APIError_1.APIError(400, 'Authorization code is required.', 'MISSING_CODE');
            }
            // 3. Se elimina el try/catch. El manejador de errores global se encargará.
            console.log(`[ACCOUNTS] Processing Discord callback...`);
            const tokens = yield auth_service_1.AuthService.handleDiscordCallback(code);
            return c.json(tokens);
        });
    }
    /**
     * Obtiene el perfil del usuario actualmente autenticado.
     * Esta ruta debe estar protegida por el middleware `requireAuth`.
     */
    static getCurrentUser(c) {
        return __awaiter(this, void 0, void 0, function* () {
            // 4. El contexto ya está tipado, no se necesita `as User`.
            const authenticatedUser = c.get('user');
            // Esta comprobación es una capa extra de seguridad, aunque `requireAuth` ya lo garantiza.
            if (!authenticatedUser) {
                throw new APIError_1.APIError(401, 'No valid user found in context.', 'USER_NOT_IN_CONTEXT');
            }
            console.log(`[ACCOUNTS] Getting profile for user ID: ${authenticatedUser.id}`);
            const userProfile = yield auth_service_1.AuthService.getAuthenticatedUserProfile(authenticatedUser.id);
            return c.json(userProfile);
        });
    }
    /**
     * Refresca los tokens de autenticación usando un refresh token.
     */
    static refreshTokens(c) {
        return __awaiter(this, void 0, void 0, function* () {
            // 5. Se aplica el tipo al cuerpo de la petición para obtener autocompletado y seguridad.
            const body = yield c.req.json();
            const { refresh_token } = body;
            if (!refresh_token) {
                throw new APIError_1.APIError(400, 'Refresh token is required.', 'MISSING_REFRESH_TOKEN');
            }
            console.log(`[ACCOUNTS] Refreshing tokens...`);
            const newTokens = yield auth_service_1.AuthService.refreshAuthTokens(refresh_token);
            return c.json(newTokens);
        });
    }
}
exports.AccountsController = AccountsController;
