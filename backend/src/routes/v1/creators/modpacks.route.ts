import { Modpack } from "@/entities/Modpack";
import { ModpackVersion } from "@/entities/ModpackVersion";
import { User } from "@/entities/User";
import { APIError } from "@/lib/APIError";
import { isOrganizationMember, requireAuth, requireCreatorAccess, USER_CONTEXT_KEY } from "@/middlewares/auth.middleware";
import { ModpackVisibility } from "@/models/Modpack.model";
import { uploadToR2 } from "@/services/r2UploadService";
import { ModpackStatus, ModpackVersionStatus, PublisherMemberRole } from "@/types/enums";
import { Hono } from "hono";
import sharp from "sharp";

export const ModpackCreatorsRoute = new Hono();



ModpackCreatorsRoute.use(requireAuth, requireCreatorAccess, async (c, next) => {
    return await next()
})

ModpackCreatorsRoute.get("/publishers/:publisherId/modpacks", isOrganizationMember, async (c) => {
    const user = c.get(USER_CONTEXT_KEY) as User;
    const { publisherId } = c.req.param();

    // Determinar el filtro según el rol del usuario
    const userRole = await user.getRoleInPublisher(publisherId);
    const filter = userRole === PublisherMemberRole.MEMBER
        ? { publisherId, creatorUserId: user.id }
        : { publisherId };

    const modpacks = await Modpack.find({
        where: filter,
        relations: ["creatorUser"],
        select: {
            id: true,
            name: true,
            slug: true,
            iconUrl: true,
            bannerUrl: true,
            visibility: true,
            showUserAsPublisher: true,
            publisherId: true,
            status: true,
            description: true,
            updatedAt: true,
            createdAt: true,
            versions: true,
            creatorUser: {
                id: true,
                username: true,
                email: true,
                avatarUrl: true,
            }
        }
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

ModpackCreatorsRoute.get("/publishers/:publisherId/modpacks/:modpackId/versions", isOrganizationMember, async (c) => {
    const { publisherId, modpackId } = c.req.param();
    console.log("Fetching versions for modpack:", modpackId, "in publisher:", publisherId);

    const modpack = await Modpack.findOneBy({ id: modpackId, publisherId });
    if (!modpack) return c.notFound();

    const versions = await ModpackVersion.find({
        where: { modpackId: modpack.id },
        order: { createdAt: "DESC" }
    });
    return c.json({ versions });
});

ModpackCreatorsRoute.post("/publishers/:publisherId/modpacks/:modpackId/versions", isOrganizationMember, async (c) => {
    const user = c.get(USER_CONTEXT_KEY) as User;
    const { publisherId, modpackId } = c.req.param();

    const modpack = await Modpack.findOneBy({ id: modpackId, publisherId });
    if (!modpack) return c.notFound();

    const userRole = await user.getRoleInPublisher(publisherId);

    if (userRole === PublisherMemberRole.MEMBER && modpack.creatorUserId !== user.id) {
        throw new APIError(403, "No tienes permiso para crear versiones de este modpack");
    }



    const { versionName, mcVersion, forgeVersion } = await c.req.json();

    if (!versionName || !mcVersion) {
        throw new APIError(400, "El nombre de la versión y la versión de Minecraft son requeridos");
    }

    const newVersion = new ModpackVersion();
    newVersion.version = versionName;
    newVersion.mcVersion = mcVersion;
    newVersion.forgeVersion = forgeVersion;
    newVersion.modpackId = modpack.id;
    newVersion.createdBy = user.id;

    await newVersion.save();


    return c.json({ success: true });
});

ModpackCreatorsRoute.patch("/publishers/:publisherId/modpacks/:modpackId/versions/:versionId/publish", isOrganizationMember, async (c) => {
    const { publisherId, modpackId, versionId } = c.req.param();

    const modpack = await Modpack.findOneBy({ id: modpackId, publisherId });
    if (!modpack) return c.notFound();

    const version = await ModpackVersion.findOneBy({ id: versionId, modpackId: modpack.id });
    if (!version) return c.notFound();

    if (version.status === ModpackVersionStatus.PUBLISHED) {
        throw new APIError(400, "Esta versión ya ha sido publicada");
    }

    version.status = ModpackVersionStatus.PUBLISHED;
    version.releaseDate = new Date();

    await version.save();

    return c.json({ success: true });
});

ModpackCreatorsRoute.get("/publishers/:publisherId/modpacks/:modpackId/versions/:versionId", isOrganizationMember, async (c) => {
    const { publisherId, modpackId, versionId } = c.req.param();

    const modpack = await Modpack.findOneBy({ id: modpackId, publisherId });
    if (!modpack) return c.notFound();

    const version = await ModpackVersion.findOne({
        where: { id: versionId, modpackId: modpack.id },
        relations: ["modpack", "files", "createdByUser"],
        select: {
            id: true,
            version: true,
            mcVersion: true,
            forgeVersion: true,
            changelog: true,
            status: true,
            releaseDate: true,
            createdAt: true,
            updatedAt: true,
            modpack: {
                id: true,
                name: true,
                publisherId: true,
            },
            files: {
                id: true,
                path: true,
                fileHash: true,
            },
            createdByUser: {
                id: true,
                username: true,
            }
        }
    });

    if (!version) return c.notFound();

    return c.json({ version });
});

ModpackCreatorsRoute.patch("/publishers/:publisherId/modpacks/:modpackId/versions/:versionId", isOrganizationMember, async (c) => {
    const user = c.get(USER_CONTEXT_KEY) as User;
    const { publisherId, modpackId, versionId } = c.req.param();

    const modpack = await Modpack.findOneBy({ id: modpackId, publisherId });
    if (!modpack) return c.notFound();

    const version = await ModpackVersion.findOneBy({ id: versionId, modpackId: modpack.id });
    if (!version) return c.notFound();

    const userRole = await user.getRoleInPublisher(publisherId);

    if (userRole === PublisherMemberRole.MEMBER && version.createdBy !== user.id) {
        throw new APIError(403, "No tienes permiso para editar esta versión");
    }

    const { changelog } = await c.req.json();

    if (changelog !== undefined) {
        version.changelog = changelog;
    }

    await version.save();

    return c.json({ version });
});


