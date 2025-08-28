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
exports.discord = void 0;
exports.exchangeCodeForToken = exchangeCodeForToken;
exports.getDiscordUser = getDiscordUser;
const rest_1 = require("@discordjs/rest");
const axios_1 = __importDefault(require("axios"));
// TODO: Reemplazar console.log con una solución de logging dedicada en todo el servicio.
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_CALLBACK_URL;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';
const DISCORD_USER_URL = 'https://discord.com/api/users/@me';
// Validación de configuración crítica al cargar el módulo para "fallar rápido".
if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !DISCORD_REDIRECT_URI) {
    console.error("[SERVICE_DISCORD] ¡Variables de entorno críticas para Discord OAuth no encontradas!");
    // Dependiendo de la estrategia de inicio, se podría lanzar un error para detener la aplicación.
    // throw new Error("¡Variables de entorno críticas para Discord OAuth no encontradas!");
}
// Nota: La instancia del cliente REST `discord` se exporta pero no se utiliza en las funciones de este archivo.
// Probablemente está destinada a otras interacciones con la API de Discord (ej. comandos de bot).
exports.discord = new rest_1.REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN !== null && DISCORD_BOT_TOKEN !== void 0 ? DISCORD_BOT_TOKEN : '');
/**
 * Intercambia un código de autorización de Discord por un token de acceso.
 * @param code El código de autorización recibido de Discord.
 * @returns Una promesa que se resuelve con la respuesta del token de Discord.
 */
function exchangeCodeForToken(code) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        console.log(`[SERVICE_DISCORD] Intercambiando código por token (código parcial: ${code ? code.substring(0, 10) + "..." : "indefinido/vacío"})`);
        // La validación de las variables de entorno ya se hizo al inicio del módulo.
        const body = new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            client_secret: DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: DISCORD_REDIRECT_URI,
        });
        try {
            const response = yield axios_1.default.post(DISCORD_TOKEN_URL, body.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 15000,
            });
            return response.data;
        }
        catch (error) {
            console.error("[SERVICE_DISCORD] Error al intercambiar código por token:", error.message);
            if (axios_1.default.isAxiosError(error)) {
                const axiosError = error;
                const errorMessage = `Error de la API de Discord durante el intercambio de token: ${((_b = (_a = axiosError.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.error_description) || axiosError.message}`;
                const err = new Error(errorMessage);
                err.statusCode = ((_c = axiosError.response) === null || _c === void 0 ? void 0 : _c.status) || 500;
                err.originalErrorData = (_d = axiosError.response) === null || _d === void 0 ? void 0 : _d.data;
                throw err;
            }
            const serviceErr = new Error(`Error inesperado durante el intercambio de token: ${error.message}`);
            serviceErr.statusCode = 500;
            throw serviceErr;
        }
    });
}
/**
 * Obtiene los datos del usuario de Discord utilizando un token de acceso.
 * @param accessToken El token de acceso OAuth2 del usuario.
 * @returns Una promesa que se resuelve con los datos del usuario de Discord.
 */
function getDiscordUser(accessToken) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        if (!accessToken) {
            const err = new Error("Se requiere un token de acceso para obtener el perfil de usuario de Discord.");
            err.statusCode = 400; // Bad Request
            throw err;
        }
        console.log("[SERVICE_DISCORD] Obteniendo perfil de usuario de Discord.");
        try {
            const response = yield axios_1.default.get(DISCORD_USER_URL, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                timeout: 15000,
            });
            return response.data;
        }
        catch (error) {
            console.error("[SERVICE_DISCORD] Error al obtener el usuario de Discord:", error.message);
            if (axios_1.default.isAxiosError(error)) {
                const axiosError = error;
                const errorMessage = `Error de la API de Discord al obtener el usuario: ${((_b = (_a = axiosError.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || axiosError.message}`;
                const err = new Error(errorMessage);
                err.statusCode = ((_c = axiosError.response) === null || _c === void 0 ? void 0 : _c.status) || 500;
                err.originalErrorData = (_d = axiosError.response) === null || _d === void 0 ? void 0 : _d.data;
                throw err;
            }
            const serviceErr = new Error(`Error inesperado al obtener el usuario de Discord: ${error.message}`);
            serviceErr.statusCode = 500;
            throw serviceErr;
        }
    });
}
