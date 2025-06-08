// /controllers/AccountsController.ts
import "dotenv/config";
import { type NextFunction, type Request, type Response } from 'express'
import { exchangeCodeForToken, getDiscordUser } from '@/services/discord'
import { User } from "@/models/User.model";
import { Session } from "@/models/Session.model";
import { DISCORD_GUILD_ID, IS_BETA_PROGRAM } from "@/consts";
import axios from "axios";
const DISCORD_GUILDS_URL = "https://discord.com/api/users/@me/guilds";


export class AccountsController {
    static async callbackDiscord(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            console.log("[DISCORD] Callback received")
            const code = req.query.code as string

            if (!code) {
                res.status(400).json({ error: 'Missing authorization code' })
                return
            }

            const token = await exchangeCodeForToken(code)
            console.log("[DISCORD] Token received", token)

            const discordUser = await getDiscordUser(token.access_token)
            console.log("[DISCORD] User data", discordUser)

            /* 
                ¿Estamos en beta? Entonces requerir que el usuario sea miembro de la guild
            */

            if (IS_BETA_PROGRAM) {
                const guildResponse = await axios.get(DISCORD_GUILDS_URL, {
                    headers: {
                        Authorization: `Bearer ${token.access_token}`,
                    },
                    timeout: 30000, // Set timeout to 30 seconds
                });

                const guilds = guildResponse.data;
                const isMember = guilds.some((guild: { id: string }) => guild.id === DISCORD_GUILD_ID);
                if (!isMember) {
                    res.status(403).json({ error_code: "not_in_guild", error: 'User is not a member of the guild' });
                    return;
                }
            }

            // Aquí buscamos (o creamos) el usuario en nuestra base de datos
            // Posteriormente, generamos un JWT de tipo bearer para el usuario
            // y lo devolvemos al cliente para que lo almacene y lo use en futuras peticiones
            // (Además de su respectivo refresh token si lo usamos)

            let user = await User.findByDiscordId(discordUser.id)
            if (!user) {
                // Si no existe el usuario, lo creamos
                user = await User.create({
                    discordId: discordUser.id,
                    username: discordUser.username,
                    discordAccessToken: token.access_token,
                    discordRefreshToken: token.refresh_token,
                    email: discordUser.email,
                    avatarUrl: discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : undefined,
                })
            } else {
                // Si ya existe, actualizamos su token de acceso y refresh
                user.discordAccessToken = token.access_token
                user.discordRefreshToken = token.refresh_token,
                    user.avatarUrl = discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : null,
                    await user.save()
            }

            // Aquí generamos el access token y el refresh token

            const session = await Session.create(user.id, {}, {})

            const jwt = await user.generateTokens(session)

            const { accessToken, refreshToken } = jwt

            console.log("[DISCORD] JWT generated", { accessToken, refreshToken })

            res.status(200).json({
                token_type: 'bearer',
                expires_in: 3600,
                access_token: accessToken,
                refresh_token: refreshToken
            })

            return
        } catch (error) {
            console.error('[DISCORD] Error in callback', error)
            res.status(500).json({ error: 'Internal server error' })
        }
    }

    static async getCurrentUser(req: Request, res: Response): Promise<void> {
        try {
            const reqUser = req.user
            const user = await User.getCompleteUser(reqUser?.id!)
            if (!user) {
                console.error("[ACCOUNTS] User not found")
                res.status(404).json({ error: 'User not found' })
                return
            }
            console.log("[ACCOUNTS] Current user", user)
            const session = await Session.findBySessionId(reqUser?.session.id!)
            if (!user || !session) {
                console.error("[ACCOUNTS] User or session not found")
                res.status(401).json({ error: 'User or session not found' })
                return
            }


            res.status(200).json(user)
        } catch (error) {
            console.error('[ACCOUNTS] Error getting current user', error)
            res.status(500).json({ error: 'Internal server error' })
        }
    }

    static async refreshTokens(req: Request, res: Response): Promise<void> {
        try {
            const { refresh_token: refreshToken } = req.body

            console.log("[ACCOUNTS] Refreshing tokens", { refreshToken })

            if (!refreshToken) {
                res.status(400).json({ error: 'Missing refresh token' })
                return
            }


            const decoded = JSON.parse(Buffer.from(refreshToken.split('.')[1], 'base64').toString('utf-8'))
            const userId = decoded.sub
            const user = await User.findById(userId)
            if (!user) {
                res.status(401).json({ error: 'User not found' })
                return
            }


            const session = await Session.findBySessionId(decoded.sessionId)
            if (!session) {
                res.status(401).json({ error: 'Session not found' })
                return
            }

            // Aquí generamos el access token y el refresh token
            const jwt = await user.generateTokens(session)


            console.log("[ACCOUNTS] New tokens generated", { accessToken: jwt.accessToken, refreshToken: jwt.refreshToken });
            res.status(200).json({
                token_type: 'bearer',
                expires_in: 3600,
                access_token: jwt.accessToken,
                refresh_token: jwt.refreshToken
            })
        } catch (error) {
            console.error('[ACCOUNTS] Error refreshing tokens', error)
            res.status(500).json({ error: 'Internal server error' })
        }
    }
}
