import { DISCORD_GUILD_ID } from "@/consts"; // DISCORD_GUILD_ID seems unused in this file's functions.
import { REST } from '@discordjs/rest';
// import { Routes } from 'discord-api-types/v10'; // Routes seems unused.
import axios, { AxiosError } from 'axios';

// TODO: Replace console.log with a dedicated logger solution throughout the service.

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_CALLBACK_URL;
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';
const DISCORD_USER_URL = 'https://discord.com/api/users/@me';

// Validate essential OAuth configuration on module load or within functions
if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !DISCORD_REDIRECT_URI) {
    console.error("[SERVICE_DISCORD] Critical Discord OAuth environment variables are missing!");
    // Depending on application startup strategy, this could throw an error to halt startup:
    // throw new Error("Critical Discord OAuth environment variables are missing!");
}

export const discord = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN ?? '');
// Note: The `discord` REST client instance is exported but not used by exchangeCodeForToken or getDiscordUser.
// It's likely intended for other Discord API interactions (e.g., bot commands).


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
    email: string;
    verified?: boolean;
    locale?: string;
    mfa_enabled?: boolean;
    flags?: number;
    premium_type?: number;
}

export async function exchangeCodeForToken(code: string): Promise<DiscordTokenResponse> {
    console.log("[DISCORD] Exchanging code for token", code);
    const body = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_REDIRECT_URI,
    });

    console.log("[DISCORD] Body", body.toString());
    console.log("[DISCORD] Token URL", DISCORD_TOKEN_URL);

    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !DISCORD_REDIRECT_URI) {
        throw new Error("Discord service is not properly configured due to missing environment variables.");
    }

    console.log("[SERVICE_DISCORD] Exchanging code for token (code partial):", code ? code.substring(0, 10) + "..." : "undefined/empty");
    const body = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_REDIRECT_URI,
    });

    try {
        const response = await axios.post<DiscordTokenResponse>(DISCORD_TOKEN_URL, body.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000, // Adjusted timeout
        });
        return response.data;
    } catch (error: any) {
        console.error("[SERVICE_DISCORD] Error exchanging code for token:", error.message);
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError<any>;
            const err = new Error(`Discord API error during token exchange: ${axiosError.response?.data?.error_description || axiosError.response?.statusText || axiosError.message}`);
            (err as any).statusCode = axiosError.response?.status || 500;
            (err as any).originalErrorData = axiosError.response?.data;
            throw err;
        }
        // For non-Axios errors, rethrow a generic error or the original one
        const serviceErr = new Error(`Unexpected error during token exchange: ${error.message}`);
        (serviceErr as any).statusCode = 500;
        throw serviceErr;
    }
}

export async function getDiscordUser(accessToken: string): Promise<DiscordUser> {
    if (!accessToken) {
        const err = new Error("Access token is required to fetch Discord user.");
        (err as any).statusCode = 400; // Bad Request or 401 if it implies unauthenticated state for this action
        throw err;
    }

    console.log("[SERVICE_DISCORD] Fetching Discord user profile.");
    try {
        const response = await axios.get<DiscordUser>(DISCORD_USER_URL, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            timeout: 15000, // Adjusted timeout
        });
        return response.data;
    } catch (error: any) {
        console.error("[SERVICE_DISCORD] Error fetching Discord user:", error.message);
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError<any>;
            const err = new Error(`Discord API error fetching user: ${axiosError.response?.data?.message || axiosError.response?.statusText || axiosError.message}`);
            (err as any).statusCode = axiosError.response?.status || 500;
            (err as any).originalErrorData = axiosError.response?.data; // For more detailed logging if needed
            throw err;
        }
        const serviceErr = new Error(`Unexpected error fetching Discord user: ${error.message}`);
        (serviceErr as any).statusCode = 500;
        throw serviceErr;
    }
}
