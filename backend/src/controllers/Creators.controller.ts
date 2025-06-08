// /controllers/AccountsController.ts
import "dotenv/config";
import { type NextFunction, type Request, type Response } from 'express'
import { exchangeCodeForToken, getDiscordUser } from '@/services/discord'
import { User } from "@/models/User.model";
import { Session } from "@/models/Session.model";


export class CreatorsController {

}