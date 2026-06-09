import { REST } from '@discordjs/rest';
import axios, { AxiosError } from 'axios';

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
export const discord = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN ?? '');

export interface DiscordTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
}

export interface DiscordUser {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
    email: string; // Este campo requiere el scope 'email'
    verified?: boolean;
    locale?: string;
    mfa_enabled?: boolean;
    flags?: number;
    premium_type?: number;
}

/**
 * Intercambia un código de autorización de Discord por un token de acceso.
 * @param code El código de autorización recibido de Discord.
 * @returns Una promesa que se resuelve con la respuesta del token de Discord.
 */
export async function exchangeCodeForToken(code: string): Promise<DiscordTokenResponse> {
    console.log(`[SERVICE_DISCORD] Intercambiando código por token (código parcial: ${code ? code.substring(0, 10) + "..." : "indefinido/vacío"})`);

    // La validación de las variables de entorno ya se hizo al inicio del módulo.

    const body = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID!,
        client_secret: DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_REDIRECT_URI!,
    });

    try {
        const response = await axios.post<DiscordTokenResponse>(DISCORD_TOKEN_URL, body.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000,
        });
        return response.data;
    } catch (error) {
        console.error("[SERVICE_DISCORD] Error al intercambiar código por token:", (error as Error).message);
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError<any>;
            const errorMessage = `Error de la API de Discord durante el intercambio de token: ${axiosError.response?.data?.error_description || axiosError.message}`;
            const err = new Error(errorMessage);
            (err as any).statusCode = axiosError.response?.status || 500;
            (err as any).originalErrorData = axiosError.response?.data;
            throw err;
        }
        const serviceErr = new Error(`Error inesperado durante el intercambio de token: ${(error as Error).message}`);
        (serviceErr as any).statusCode = 500;
        throw serviceErr;
    }
}

/**
 * Obtiene los datos del usuario de Discord utilizando un token de acceso.
 * @param accessToken El token de acceso OAuth2 del usuario.
 * @returns Una promesa que se resuelve con los datos del usuario de Discord.
 */
export async function getDiscordUser(accessToken: string): Promise<DiscordUser> {
    if (!accessToken) {
        const err = new Error("Se requiere un token de acceso para obtener el perfil de usuario de Discord.");
        (err as any).statusCode = 400; // Bad Request
        throw err;
    }

    console.log("[SERVICE_DISCORD] Obteniendo perfil de usuario de Discord.");
    try {
        const response = await axios.get<DiscordUser>(DISCORD_USER_URL, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            timeout: 15000,
        });
        return response.data;
    } catch (error) {
        console.error("[SERVICE_DISCORD] Error al obtener el usuario de Discord:", (error as Error).message);
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError<any>;
            const errorMessage = `Error de la API de Discord al obtener el usuario: ${axiosError.response?.data?.message || axiosError.message}`;
            const err = new Error(errorMessage);
            (err as any).statusCode = axiosError.response?.status || 500;
            (err as any).originalErrorData = axiosError.response?.data;
            throw err;
        }
        const serviceErr = new Error(`Error inesperado al obtener el usuario de Discord: ${(error as Error).message}`);
        (serviceErr as any).statusCode = 500;
        throw serviceErr;
    }
}