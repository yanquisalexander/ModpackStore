import { DISCORD_GUILD_ID } from "@/consts";
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import axios from 'axios';

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET!;
const DISCORD_REDIRECT_URI = process.env.DISCORD_CALLBACK_URL!;
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';
const DISCORD_USER_URL = 'https://discord.com/api/users/@me';


export const discord = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN ?? '');


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

    try {
        const response = await axios.post(DISCORD_TOKEN_URL, body.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 30000, // Set timeout to 30 seconds
        });

        return response.data as DiscordTokenResponse;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(`Error exchanging code for token: ${error.response?.statusText || error.message}`);
        }
        throw error;
    }
}

export async function getDiscordUser(accessToken: string): Promise<DiscordUser> {
    try {
        const response = await axios.get(DISCORD_USER_URL, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            timeout: 30000, // Set timeout to 30 seconds
        });

        return response.data as DiscordUser;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(`Error fetching Discord user: ${error.response?.statusText || error.message}`);
        }
        throw error;
    }
}
