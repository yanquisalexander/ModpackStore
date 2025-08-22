import "dotenv/config";
import axios from "axios";
import jwt from "jsonwebtoken";
import { User, TokenPayload } from "@/models/User.model";
import { Session } from "@/models/Session.model";
import { exchangeCodeForToken, getDiscordUser } from '@/services/discord';
import { DISCORD_GUILD_ID, IS_BETA_PROGRAM } from "@/consts";
import { APIError } from "@/lib/APIError"; // 1. Importar APIError

// Asumimos que JWT_SECRET se valida al iniciar la app
const JWT_SECRET = process.env.JWT_SECRET!;

// Define un tipo más claro para el perfil público del usuario
interface UserPublicProfile {
    id: string;
    username: string;
    avatarUrl?: string | null;
    publisherMemberships: any[]; // Debería ser un tipo más específico
}

export interface AuthTokens {
    token_type: 'bearer';
    expires_in: number;
    access_token: string;
    refresh_token: string;
}

export class AuthService {
    /**
     * Procesa el callback de OAuth de Discord, valida al usuario y genera tokens.
     */
    static async handleDiscordCallback(code: string): Promise<AuthTokens> {
        const discordToken = await exchangeCodeForToken(code);
        const discordApiUser = await getDiscordUser(discordToken.access_token);

        if (IS_BETA_PROGRAM && DISCORD_GUILD_ID) {
            await this.verifyGuildMembership(discordToken.access_token, discordApiUser.id);
        }

        // 2. Simplifica la lógica de creación/actualización del usuario.
        const user = await this.findOrCreateUser(discordApiUser, discordToken);

        const session = await Session.create({ userId: user.id, deviceInfo: {}, locationInfo: {} });
        const jwtTokens = await user.generateTokens(session);

        return {
            token_type: 'bearer',
            expires_in: 3600, // 1 hora
            access_token: jwtTokens.accessToken,
            refresh_token: jwtTokens.refreshToken,
        };
    }

    /**
     * Refresca los tokens de autenticación.
     */
    static async refreshAuthTokens(refreshTokenString: string): Promise<AuthTokens> {
        if (!refreshTokenString) {
            throw new APIError(400, 'Refresh token is required.', 'MISSING_REFRESH_TOKEN');
        }

        let decoded: TokenPayload;
        try {
            // 3. El JWT_SECRET se asume que existe. El chequeo en runtime es innecesario.
            decoded = jwt.verify(refreshTokenString, JWT_SECRET) as TokenPayload;
        } catch (error) {
            throw new APIError(401, 'Invalid or expired refresh token.', 'INVALID_REFRESH_TOKEN');
        }

        const { sub: userId, sessionId } = decoded;
        const user = await User.findById(userId);
        const session = await Session.findById(sessionId);

        if (!user || !session || session.userId !== user.id) {
            throw new APIError(401, 'Invalid session or user.', 'INVALID_SESSION');
        }

        const newJwtTokens = await user.generateTokens(session);

        return {
            token_type: 'bearer',
            expires_in: 3600,
            access_token: newJwtTokens.accessToken,
            refresh_token: newJwtTokens.refreshToken,
        };
    }

    /**
     * Obtiene el perfil público de un usuario autenticado.
     */
    static async getAuthenticatedUserProfile(userId: string): Promise<UserPublicProfile> {
        if (!userId) {
            throw new APIError(400, 'User ID is required.', 'MISSING_USER_ID');
        }

        const userWithRelations = await User.getCompleteUser(userId);
        if (!userWithRelations) {
            throw new APIError(404, 'User not found.', 'USER_NOT_FOUND');
        }

        // Crea una instancia para usar sus métodos, como toPublicJson()
        const userInstance = new User(userWithRelations);
        const publicUserProfile = userInstance.toPublicJson();

        return {
            ...publicUserProfile,
            publisherMemberships: userWithRelations.publisherMemberships || [],
        };
    }

    // --- Métodos de Ayuda (Helper Methods) ---

    /**
     * Verifica si un usuario pertenece al servidor de Discord requerido.
     * @private
     */
    private static async verifyGuildMembership(discordAccessToken: string, discordUserId: string): Promise<void> {
        try {
            const response = await axios.get("https://discord.com/api/users/@me/guilds", {
                headers: { Authorization: `Bearer ${discordAccessToken}` },
            });
            const guilds = response.data as { id: string }[];
            const isMember = guilds.some(guild => guild.id === DISCORD_GUILD_ID);

            if (!isMember) {
                throw new APIError(403, 'Access denied. User is not in the required Discord server.', 'NOT_IN_GUILD');
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error(`[AUTH_SERVICE] Axios error while checking guild for user ${discordUserId}:`, {
                    status: error.response?.status,
                    data: error.response?.data,
                });

                if (error.response?.status === 401) {
                    throw new APIError(401, 'Invalid Discord token.', 'DISCORD_TOKEN_INVALID');
                }
            } else {
                console.error(`[AUTH_SERVICE] Unexpected error while checking guild for user ${discordUserId}:`, error);
            }

            throw new APIError(502, 'Failed to verify Discord server membership.', 'GUILD_CHECK_FAILED');
        }
    }

    /**
     * Encuentra un usuario por su ID de Discord o crea uno nuevo si no existe.
     * @private
     */
    private static async findOrCreateUser(discordApiUser: any, discordToken: any): Promise<User> {
        const userPayload = {
            discordAccessToken: discordToken.access_token,
            discordRefreshToken: discordToken.refresh_token,
            avatarUrl: discordApiUser.avatar ? `https://cdn.discordapp.com/avatars/${discordApiUser.id}/${discordApiUser.avatar}.png` : null,
            username: discordApiUser.username,
            email: discordApiUser.email,
        };

        let user = await User.findByDiscordId(discordApiUser.id);

        if (!user) {
            // Si el usuario no existe, créalo.
            user = await User.create({
                username: discordApiUser.username,
                email: discordApiUser.email,
                admin: false
            });
        } else {
            // Si el usuario existe, actualízalo.
            user = await User.update(user.id, userPayload);
        }

        if (!user) {
            throw new APIError(500, 'Failed to create or update user.', 'USER_UPSERT_FAILED');
        }

        return user;
    }
}