import "dotenv/config";
import axios from "axios";
import jwt from "jsonwebtoken";
import { User } from "@/entities/User";
import { Session } from "@/entities/Session";
import { UserService } from "@/services/user.service";
import { exchangeCodeForToken, getDiscordUser } from '@/services/discord';
import { DISCORD_GUILD_ID, IS_BETA_PROGRAM } from "@/consts";
import { APIError } from "@/lib/APIError";
import { UserRole } from "@/types/enums";

// Asumimos que JWT_SECRET se valida al iniciar la app
const JWT_SECRET = process.env.JWT_SECRET!;

// JWT Token payload interface
export interface TokenPayload extends jwt.JwtPayload {
    sub: string;
    sessionId: number;
}

// Define un tipo más claro para el perfil público del usuario
interface UserPublicProfile {
    id: string;
    username: string;
    avatarUrl?: string | null;
    role: UserRole;
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

        const session = Session.create({ 
            userId: user.id, 
            deviceInfo: {}, 
            locationInfo: {} 
        });
        await session.save();
        
        const jwtTokens = await user.generateTokens(session);

        return {
            token_type: 'bearer',
            expires_in: 3600 * 4, // 4 horas
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
        const user = await User.findOne({ where: { id: userId } });
        const session = await Session.findOne({ where: { id: sessionId } });

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

        const userWithRelations = await User.findByIdWithRelations(userId);
        if (!userWithRelations) {
            throw new APIError(404, 'User not found.', 'USER_NOT_FOUND');
        }

        // Use the public JSON method from the entity
        const publicUserProfile = userWithRelations.toPublicJson();

        return {
            ...publicUserProfile,
            publisherMemberships: userWithRelations.publisherMemberships || [],
            role: userWithRelations.role || UserRole.USER,
        };
    }

    // --- Métodos de Ayuda (Helper Methods) ---

    /**
     * Verifica si un usuario pertenece al servidor de Discord requerido usando fetch.
     * @private
     */
    private static async verifyGuildMembership(discordAccessToken: string, discordUserId: string): Promise<void> {
        const response = await fetch("https://discord.com/api/users/@me/guilds", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${discordAccessToken}`,
            },
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new APIError(401, 'Invalid Discord token.', 'DISCORD_TOKEN_INVALID');
            }
            throw new APIError(502, 'Failed to verify Discord server membership.', 'GUILD_CHECK_FAILED');
        }

        const guilds = (await response.json()) as { id: string }[];
        const isMember = guilds.some(guild => guild.id === DISCORD_GUILD_ID);

        if (!isMember) {
            throw new APIError(403, 'Access denied. User is not in the required Discord server.', 'NOT_IN_GUILD');
        }
    }

    /**
     * Encuentra un usuario por su ID de Discord o crea uno nuevo si no existe.
     * Optimizado con upsert usando TypeORM.
     * @private
     */
    private static async findOrCreateUser(discordApiUser: any, discordToken: any): Promise<User> {
        try {
            // 1. Crear/actualizar usuario usando el servicio optimizado
            const user = await UserService.upsertDiscordUser({
                discordId: discordApiUser.id,
                username: discordApiUser.username,
                email: discordApiUser.email,
                avatar: discordApiUser.avatar,
                provider: "discord"
            });

            // 2. Actualizar tokens de Discord si existen
            if (discordToken.access_token && discordToken.refresh_token) {
                await UserService.updateDiscordTokens(
                    user.id,
                    discordToken.access_token,
                    discordToken.refresh_token
                );
            }

            console.log(`[AuthService] Successfully processed Discord user: ${user.id}`);
            return user;

        } catch (error) {
            console.error('[AuthService] Error in findOrCreateUser:', error);
            
            // Re-throw APIErrors as is
            if (error instanceof APIError) {
                throw error;
            }
            
            // Wrap other errors
            throw new APIError(500, 'Failed to create or update user.', 'USER_UPSERT_FAILED');
        }
    }
}