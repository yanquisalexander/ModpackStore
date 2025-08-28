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
require("dotenv/config");
const passport_1 = __importDefault(require("passport"));
const passport_jwt_1 = require("passport-jwt");
const passport_discord_1 = require("@williamdasilva/passport-discord");
const passport_patreon_1 = require("@oauth-everything/passport-patreon");
const chalk_1 = __importDefault(require("chalk"));
const User_model_1 = require("@/models/User.model");
const Session_model_1 = require("@/models/Session.model");
const SCOPES = {
    DISCORD: ['identify', 'email', 'connections', 'guilds', 'guilds.join'],
    PATREON: ['identity', 'identity[email]', 'identity.memberships']
};
const jwtOptions = {
    jwtFromRequest: passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET || 'secret',
    passReqToCallback: true
};
function logMissingEnv(strategy) {
    const required = ['CLIENT_ID', 'CLIENT_SECRET', 'CALLBACK_URL'];
    let ok = true;
    for (const key of required) {
        const varName = `${strategy.toUpperCase()}_${key}`;
        if (!process.env[varName]) {
            console.warn(chalk_1.default.yellow('[PASSPORT]'), `Missing ${varName}`);
            ok = false;
        }
    }
    if (!ok) {
        console.warn(chalk_1.default.yellow('[PASSPORT]'), `Cannot setup ${strategy} strategy`);
    }
    return ok;
}
class Passport {
    constructor() {
        throw new Error('This class cannot be instantiated');
    }
    static setup() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(chalk_1.default.bgCyan('[PASSPORT]'), 'Initializing strategies...');
            Passport.setupJwt();
            Passport.setupDiscord();
            Passport.setupPatreon();
            console.log(chalk_1.default.bgCyan('[PASSPORT]'), 'Passport is ready.');
        });
    }
    static setupJwt() {
        console.log(chalk_1.default.blue('[PASSPORT]'), 'Setting up JWT strategy...');
        passport_1.default.use('jwt', new passport_jwt_1.Strategy(jwtOptions, (req, payload, done) => __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(chalk_1.default.blue('[PASSPORT]'), 'JWT payload:', payload);
                const session = yield Session_model_1.Session.findBySessionId(payload.sessionId);
                if (!session)
                    return done(null, false, { message: 'Invalid session' });
                const user = yield User_model_1.User.findById(payload.sub);
                if (!user)
                    return done(null, false, { message: 'User not found' });
                const [isPatron] = yield Promise.all([
                    user.isPatron()
                ]);
                const userData = Object.assign(Object.assign({}, user), { session, is_patron: isPatron });
                return done(null, userData);
            }
            catch (err) {
                console.error(chalk_1.default.red('[PASSPORT]'), err);
                return done(err, false, { message: 'JWT auth error' });
            }
        })));
    }
    static setupDiscord() {
        if (!logMissingEnv('DISCORD'))
            return;
        passport_1.default.use('discord', new passport_discord_1.Strategy({
            clientID: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET,
            callbackURL: process.env.DISCORD_CALLBACK_URL,
            scope: SCOPES.DISCORD,
            prompt: 'consent',
        }, (accessToken, refreshToken, profile, done) => __awaiter(this, void 0, void 0, function* () {
            try {
                return done(null, profile);
            }
            catch (err) {
                console.error(err);
                return done(err, false);
            }
        })));
        console.log(chalk_1.default.green('[PASSPORT]'), 'Discord strategy configured.');
    }
    static setupPatreon() {
        if (!logMissingEnv('PATREON'))
            return;
        passport_1.default.use('patreon', new passport_patreon_1.Strategy({
            clientID: process.env.PATREON_CLIENT_ID,
            clientSecret: process.env.PATREON_CLIENT_SECRET,
            callbackURL: process.env.PATREON_CALLBACK_URL,
            scope: SCOPES.PATREON,
            prompt: 'consent'
        }, (accessToken, refreshToken, profile, done) => __awaiter(this, void 0, void 0, function* () {
            try {
                return done(null, profile, { accessToken, refreshToken });
            }
            catch (err) {
                console.error(err);
                return done(err, false);
            }
        })));
        console.log(chalk_1.default.green('[PASSPORT]'), 'Patreon strategy configured.');
    }
    static middleware(req, res, next) {
        return passport_1.default.authenticate('jwt', { session: false }, (err, user, info) => {
            console.log(chalk_1.default.blue('[PASSPORT]'), 'JWT auth result:', { err, user, info });
            if (err || !user) {
                console.error(chalk_1.default.red('[PASSPORT]'), err || 'No user');
                return res.status(401).json({
                    errors: ['You are not authenticated. Please log in and try again.'],
                    error_type: err || 'unauthorized'
                });
            }
            req.user = user;
            next();
        })(req, res, next);
    }
    get jwtSecret() {
        return process.env.JWT_SECRET || 'default_secret';
    }
    static get instance() {
        return passport_1.default;
    }
}
exports.default = Passport;
