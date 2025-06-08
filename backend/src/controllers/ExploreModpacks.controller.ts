// /controllers/AccountsController.ts
import "dotenv/config";
import { type NextFunction, type Request, type Response } from 'express'
import { exchangeCodeForToken, getDiscordUser } from '@/services/discord'
import { User } from "@/models/User.model";
import { Session } from "@/models/Session.model";
import { getExploreModpacks, getModpackById, searchModpacks } from "@/services/modpacks";
const DISCORD_GUILDS_URL = "https://discord.com/api/users/@me/guilds";


export class ExploreModpacksController {
    static async getHomepage(req: Request, res: Response, next: NextFunction): Promise<void> {

        const data = await getExploreModpacks()

        res.json({ data })
        return

    }

    static async search(req: Request, res: Response, next: NextFunction): Promise<void> {
        const { q } = req.query

        if (!q) {
            res.status(400).json({ error: 'Missing search query' })
            return
        }

        if (typeof q !== 'string' || q.length < 3) {
            res.status(400).json({ error: 'Search query too short' })
            return
        }

        const data = await searchModpacks(q.toString())



        res.json({ data })
        return
    }

    static async getModpack(req: Request, res: Response, next: NextFunction): Promise<void> {
        const { modpackId } = req.params

        if (!modpackId) {
            res.status(400).json({ error: 'Missing modpack id' })
            return
        }

        const data = await getModpackById(modpackId)

        res.json({ data })
        return
    }
}