import "dotenv/config"
import passport from 'passport'
import { Strategy as JwtStrategy, ExtractJwt, StrategyOptionsWithRequest } from 'passport-jwt'
import { Strategy as DiscordStrategy } from '@williamdasilva/passport-discord'
import { Strategy as PatreonStrategy } from '@oauth-everything/passport-patreon'

import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type { Profile } from 'passport'
import chalk from 'chalk'

import { User } from '@/models/User.model'
import { client as db } from '@/db/client'
import { UsersTable } from '@/db/schema'
import { Session } from '@/models/Session.model'

const SCOPES = {
    DISCORD: ['identify', 'email', 'connections', 'guilds', 'guilds.join'],
    PATREON: ['identity', 'identity[email]', 'identity.memberships']
}

const jwtOptions: StrategyOptionsWithRequest = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET || 'secret',
    passReqToCallback: true
}

function logMissingEnv(strategy: string): boolean {
    const required = ['CLIENT_ID', 'CLIENT_SECRET', 'CALLBACK_URL']
    let ok = true

    for (const key of required) {
        const varName = `${strategy.toUpperCase()}_${key}`
        if (!process.env[varName]) {
            console.warn(chalk.yellow('[PASSPORT]'), `Missing ${varName}`)
            ok = false
        }
    }

    if (!ok) {
        console.warn(chalk.yellow('[PASSPORT]'), `Cannot setup ${strategy} strategy`)
    }

    return ok
}

class Passport {
    private constructor() {
        throw new Error('This class cannot be instantiated')
    }

    public static async setup(): Promise<void> {
        console.log(chalk.bgCyan('[PASSPORT]'), 'Initializing strategies...')

        Passport.setupJwt()
        Passport.setupDiscord()
        Passport.setupPatreon()

        console.log(chalk.bgCyan('[PASSPORT]'), 'Passport is ready.')
    }

    private static setupJwt(): void {
        console.log(chalk.blue('[PASSPORT]'), 'Setting up JWT strategy...')

        passport.use('jwt', new JwtStrategy(jwtOptions, async (req: Request, payload: any, done) => {
            try {

                console.log(chalk.blue('[PASSPORT]'), 'JWT payload:', payload)

                const session = await Session.findBySessionId(payload.sessionId)
                if (!session) return done(null, false, { message: 'Invalid session' })

                const user = await User.findById(payload.sub)
                if (!user) return done(null, false, { message: 'User not found' })

                const [isPatron] = await Promise.all([
                    user.isPatron()
                ])

                const userData = {
                    ...user,
                    session,
                    is_patron: isPatron,

                }

                return done(null, userData)
            } catch (err) {
                console.error(chalk.red('[PASSPORT]'), err)
                return done(err, false, { message: 'JWT auth error' })
            }
        }))
    }

    private static setupDiscord(): void {
        if (!logMissingEnv('DISCORD')) return

        passport.use('discord', new DiscordStrategy({
            clientID: process.env.DISCORD_CLIENT_ID!,
            clientSecret: process.env.DISCORD_CLIENT_SECRET!,
            callbackURL: process.env.DISCORD_CALLBACK_URL!,
            scope: SCOPES.DISCORD,
            // @ts-ignore
            prompt: 'consent'
        }, async (accessToken, refreshToken, profile: Profile, done) => {
            try {
                return done(null, profile)
            } catch (err) {
                console.error(err)
                return done(err, false)
            }
        }))

        console.log(chalk.green('[PASSPORT]'), 'Discord strategy configured.')
    }

    private static setupPatreon(): void {
        if (!logMissingEnv('PATREON')) return

        passport.use('patreon', new PatreonStrategy({
            clientID: process.env.PATREON_CLIENT_ID!,
            clientSecret: process.env.PATREON_CLIENT_SECRET!,
            callbackURL: process.env.PATREON_CALLBACK_URL!,
            scope: SCOPES.PATREON,
            prompt: 'consent'
        }, async (accessToken, refreshToken, profile: Profile, done) => {
            try {
                return done(null, profile, { accessToken, refreshToken })
            } catch (err) {
                console.error(err)
                return done(err, false)
            }
        }))

        console.log(chalk.green('[PASSPORT]'), 'Patreon strategy configured.')
    }

    public static middleware(req: Request, res: Response, next: NextFunction): RequestHandler {
        return passport.authenticate('jwt', { session: false }, (err: Error | null, user: Express.User | false, info: { message?: string } | undefined) => {
            console.log(chalk.blue('[PASSPORT]'), 'JWT auth result:', { err, user, info })
            if (err || !user) {
                console.error(chalk.red('[PASSPORT]'), err || 'No user')
                return res.status(401).json({
                    errors: ['You are not authenticated. Please log in and try again.'],
                    error_type: err || 'unauthorized'
                })
            }

            req.user = user
            next()
        })(req, res, next)
    }

    public get jwtSecret(): string {

        return process.env.JWT_SECRET || 'default_secret'
    }


    public static get instance(): typeof passport {
        return passport
    }
}

export default Passport
