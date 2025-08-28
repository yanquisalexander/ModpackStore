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
exports.ModpackCreatorsRoute = void 0;
const auth_middleware_1 = require("@/middlewares/auth.middleware");
const Modpack_model_1 = require("@/models/Modpack.model");
const hono_1 = require("hono");
exports.ModpackCreatorsRoute = new hono_1.Hono();
exports.ModpackCreatorsRoute.use(auth_middleware_1.requireAuth, auth_middleware_1.requireCreatorAccess, (c, next) => __awaiter(void 0, void 0, void 0, function* () {
    return yield next();
}));
exports.ModpackCreatorsRoute.get("/teams/:teamId/modpacks", auth_middleware_1.isOrganizationMember, (c) => __awaiter(void 0, void 0, void 0, function* () {
    const { teamId } = c.req.param();
    const modpacks = yield Modpack_model_1.Modpack.findByPublisher(teamId);
    return c.json({ modpacks });
}));
exports.ModpackCreatorsRoute.patch("/teams/:teamId/modpacks/:modpackId", auth_middleware_1.isOrganizationMember, (c) => __awaiter(void 0, void 0, void 0, function* () {
    const { teamId, modpackId } = c.req.param();
    const modpack = yield Modpack_model_1.Modpack.findById(modpackId);
    if (!modpack)
        return c.notFound();
    if (!modpack.publisherId || modpack.publisherId !== teamId) {
        return c.json({ error: "No tienes permiso para editar este modpack" }, 403);
    }
    // Update modpack details
    const body = yield c.req.parseBody();
    console.log("Updating modpack:", modpackId, "with data:", body);
    const updatedModpack = yield Modpack_model_1.Modpack.update(modpackId, Object.assign({}, body));
    return c.json({ modpack: updatedModpack });
}));
exports.ModpackCreatorsRoute.post("/teams/:teamId/modpacks", auth_middleware_1.isOrganizationMember, (c) => __awaiter(void 0, void 0, void 0, function* () {
    const { teamId } = c.req.param();
    const body = yield c.req.parseBody();
    console.log("Creating new modpack with data:", body);
    const { name, slug, iconUrl, bannerUrl, visibility, showUserAsPublisher, status, description, tags, versions, creatorUserId } = body;
    /* export const newModpackSchema = z.object({
        name: z.string().min(1).max(100),
        shortDescription: z.string().max(200).optional(),
        description: z.string().optional(),
        slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
        iconUrl: z.string().url(),
        bannerUrl: z.string().url(),
        trailerUrl: z.string().url().optional(),
        password: z.string().optional(),
        visibility: z.nativeEnum(ModpackVisibility),
        status: z.nativeEnum(ModpackStatus).default(ModpackStatus.DRAFT).optional(),
        publisherId: z.string().uuid(),
        showUserAsPublisher: z.boolean().default(false),
        creatorUserId: z.string().uuid().optional(),
    }); */
    const newModpack = yield Modpack_model_1.Modpack.create({
        name,
        slug,
        iconUrl: iconUrl !== null && iconUrl !== void 0 ? iconUrl : "/icon.png",
        bannerUrl: bannerUrl !== null && bannerUrl !== void 0 ? bannerUrl : "/default-banner.png",
        visibility,
        showUserAsPublisher,
        status,
        description,
        tags,
        versions,
        creatorUserId,
        publisherId: teamId,
    });
    return c.json({ modpack: newModpack });
}));
