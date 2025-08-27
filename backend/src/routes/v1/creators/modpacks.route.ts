import { isOrganizationMember, requireAuth, requireCreatorAccess } from "@/middlewares/auth.middleware";
import { Modpack, ModpackVisibility } from "@/models/Modpack.model";
import { Hono } from "hono";

export const ModpackCreatorsRoute = new Hono();



ModpackCreatorsRoute.use(requireAuth, requireCreatorAccess, async (c, next) => {
    return await next()
})

ModpackCreatorsRoute.get("/teams/:teamId/modpacks", isOrganizationMember, async (c) => {
    const { teamId } = c.req.param();

    const modpacks = await Modpack.findByPublisher(teamId);
    return c.json({ modpacks });
});


ModpackCreatorsRoute.patch("/teams/:teamId/modpacks/:modpackId", isOrganizationMember, async (c) => {
    const { teamId, modpackId } = c.req.param();

    const modpack = await Modpack.findById(modpackId);
    if (!modpack) return c.notFound();

    if (!modpack.publisherId || modpack.publisherId !== teamId) {
        return c.json({ error: "No tienes permiso para editar este modpack" }, 403);
    }

    // Update modpack details
    const body = await c.req.parseBody();

    console.log("Updating modpack:", modpackId, "with data:", body);

    const updatedModpack = await Modpack.update(modpackId, {
        ...body,
    });
    return c.json({ modpack: updatedModpack });
});


ModpackCreatorsRoute.post("/teams/:teamId/modpacks", isOrganizationMember, async (c) => {
    const { teamId } = c.req.param();

    const body = await c.req.parseBody();

    console.log("Creating new modpack with data:", body);

    const {
        name,
        slug,
        iconUrl,
        bannerUrl,
        visibility,
        showUserAsPublisher,
        status,
        description,
        tags,
        versions,
        creatorUserId
    } = body;



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

    const newModpack = await Modpack.create({
        name,
        slug,
        iconUrl: iconUrl ?? "/icon.png",
        bannerUrl: bannerUrl ?? "/default-banner.png",
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
});