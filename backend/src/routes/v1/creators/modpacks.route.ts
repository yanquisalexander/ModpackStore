import { Modpack } from "@/entities/Modpack";
import { User } from "@/entities/User";
import { APIError } from "@/lib/APIError";
import { isOrganizationMember, requireAuth, requireCreatorAccess, USER_CONTEXT_KEY } from "@/middlewares/auth.middleware";
import { ModpackVisibility } from "@/models/Modpack.model";
import { uploadToR2 } from "@/services/r2UploadService";
import { ModpackStatus, PublisherMemberRole } from "@/types/enums";
import { Hono } from "hono";
import sharp from "sharp";

export const ModpackCreatorsRoute = new Hono();



ModpackCreatorsRoute.use(requireAuth, requireCreatorAccess, async (c, next) => {
    return await next()
})

ModpackCreatorsRoute.get("/publishers/:publisherId/modpacks", isOrganizationMember, async (c) => {
    const { publisherId } = c.req.param();

    const modpacks = await Modpack.findBy({
        publisherId
    });
    return c.json({ modpacks });
});


ModpackCreatorsRoute.patch(
    "/publishers/:publisherId/modpacks/:modpackId",
    isOrganizationMember,
    async (c) => {
        const { publisherId, modpackId } = c.req.param();

        const modpack = await Modpack.findOneBy({ id: modpackId, publisherId });
        if (!modpack) return c.notFound();

        if (modpack.publisherId !== publisherId) {
            return c.json({ error: "No tienes permiso para editar este modpack" }, 403);
        }

        const body = await c.req.parseBody();

        // --- Procesar banner si viene ---
        if (body.banner && body.banner instanceof File && body.banner.size > 0) {
            try {
                const arrayBuffer = await body.banner.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const webpBanner = await sharp(buffer).webp().toBuffer();

                const { cdnUrl, url } = await uploadToR2(
                    `modpacks/${modpackId}/banner`,
                    webpBanner,
                    "image/webp"
                );

                modpack.bannerUrl = `${cdnUrl || url}?t=${Date.now()}`;
            } catch (error) {
                console.error("Error processing banner:", error);
                return c.json({ error: "Failed to process banner" }, 500);
            }
        }

        // --- Campos permitidos para update ---
        const allowedFields: (keyof Modpack)[] = [
            "name",
            "slug",
            "iconUrl",
            "visibility",
            "showUserAsPublisher",
            "status",
            "description",
            "versions",
            "creatorUserId",
        ];

        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                (modpack as any)[field] = body[field];
            }
        }

        await modpack.save();

        return c.json({ modpack });
    }
);


ModpackCreatorsRoute.post("/publishers/:publisherId/modpacks", isOrganizationMember, async (c) => {
    const { publisherId } = c.req.param();

    const body = await c.req.parseBody();

    console.log("Creating new modpack with data:", body);

    const allowedFields: (keyof Modpack)[] = [
        "name",
        "slug",
        "iconUrl",
        "bannerUrl",
        "visibility",
        "showUserAsPublisher",
        "status",
        "description",
        "versions",
        "creatorUserId",
    ];

    const newModpack = new Modpack()

    newModpack.publisherId = publisherId;

    for (const field of allowedFields) {
        if (body[field] !== undefined) {
            (newModpack as any)[field] = body[field];
        }
    }

    newModpack.creatorUserId = (c.get(USER_CONTEXT_KEY) as User).id;

    await newModpack.save();

    return c.json({ modpack: newModpack });
});

ModpackCreatorsRoute.delete("/publishers/:publisherId/modpacks/:modpackId", isOrganizationMember, async (c) => {
    const { publisherId, modpackId } = c.req.param();

    const modpack = await Modpack.findOneBy({ id: modpackId, publisherId });
    if (!modpack) return c.notFound();

    if (modpack.status === ModpackStatus.DELETED) {
        throw new APIError(400, "Este modpack ya ha sido eliminado");
    }

    const user = c.get(USER_CONTEXT_KEY) as User;

    console.log("User trying to delete modpack:", user, "Modpack:", modpack);
    console.log(user.publisherMemberships)
    const userRole = user?.publisherMemberships?.find(m => m.publisherId === publisherId)?.role;
    console.log("User role:", userRole);

    // Solo ADMIN, OWNER o el creador del modpack pueden eliminarlo
    if (
        userRole !== PublisherMemberRole.ADMIN &&
        userRole !== PublisherMemberRole.OWNER &&
        modpack.creatorUserId !== user.id
    ) {
        throw new APIError(403, "No tienes permiso para eliminar este modpack")
    }

    modpack.status = ModpackStatus.DELETED;

    await modpack.save();

    return c.json({ success: true });
});