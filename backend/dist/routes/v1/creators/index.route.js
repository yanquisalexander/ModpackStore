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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatorsRoute = void 0;
const auth_middleware_1 = require("@/middlewares/auth.middleware");
const hono_1 = require("hono");
const modpacks_route_1 = require("./modpacks.route");
exports.CreatorsRoute = new hono_1.Hono();
// Mini middleware to check if the user is a creator
exports.CreatorsRoute.use(auth_middleware_1.requireAuth, auth_middleware_1.requireCreatorAccess, (c, next) => __awaiter(void 0, void 0, void 0, function* () {
    return yield next();
}));
exports.CreatorsRoute.get("/teams", (c) => __awaiter(void 0, void 0, void 0, function* () {
    const user = c.get(auth_middleware_1.USER_CONTEXT_KEY);
    const userTeams = yield user.getTeams();
    return c.json({
        teams: userTeams
    });
}));
exports.CreatorsRoute.route('/', modpacks_route_1.ModpackCreatorsRoute);
