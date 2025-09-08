import { Modpack } from "@/entities/Modpack";
import { ModpackVersion } from "@/entities/ModpackVersion";
import { ModpackVersionFile } from "@/entities/ModpackVersionFile";
import { User } from "@/entities/User";
import { APIError } from "@/lib/APIError";
import { isOrganizationMember, requireAuth, requireCreatorAccess, USER_CONTEXT_KEY } from "@/middlewares/auth.middleware";
import { ModpackVisibility } from "@/models/Modpack.model";
import { ALLOWED_FILE_TYPES, processModpackFileUpload } from "@/services/modpackFileUpload";
import { CurseForgeImportService } from "@/services/curseforgeImportService";
import { queue } from "@/services/Queue";
import { uploadToR2 } from "@/services/r2UploadService";
import { ModpackStatus, ModpackVersionStatus, PublisherMemberRole } from "@/types/enums";
import { Hono } from "hono";
import sharp from "sharp";
import { In } from "typeorm";

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
            shortDescription: true,
            status: true,
            description: true,
            prelaunchAppearance: true,
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

        console.log({ body })

        // --- Procesar icono si viene ---

        if (body.icon && body.icon instanceof File && body.icon.size > 0) {
            try {
                const arrayBuffer = await body.icon.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const webpIcon = await sharp(buffer)
                    .resize(512, 512, {
                        fit: 'cover',
                        position: 'center'
                    })
                    .webp()
                    .toBuffer();

                const { cdnUrl, url } = await uploadToR2(
                    `modpacks/${modpackId}/icon`,
                    webpIcon,
                    "image/webp"
                );

                modpack.iconUrl = `${cdnUrl || url}?t=${Date.now()}`;
            } catch (error) {
                console.error("Error processing icon:", error);
                return c.json({ error: "Failed to process icon" }, 500);
            }
        }

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
            "shortDescription",
            "versions",
            "creatorUserId",
            "prelaunchAppearance",
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

// Get Modpack

ModpackCreatorsRoute.get("/publishers/:publisherId/modpacks/:modpackId", isOrganizationMember, async (c) => {
    const { publisherId, modpackId } = c.req.param();
    console.log("Fetching modpack:", modpackId, "in publisher:", publisherId);

    const modpack = await Modpack.findOne({
        where: { id: modpackId, publisherId },
        relations: ["versions"]
    });
    if (!modpack) return c.notFound();

    return c.json({ modpack });
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
    return c.json({ versions, modpack });
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
        relations: ["modpack", "files", "files.file", "createdByUser"],
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
                path: true,
                fileHash: true,
                file: {
                    type: true
                }
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




// Get previous version files for reuse
ModpackCreatorsRoute.get("/publishers/:publisherId/modpacks/:modpackId/versions/:versionId/previous-files/:type", isOrganizationMember, async (c) => {
    const { publisherId, modpackId, versionId, type } = c.req.param();

    if (!ALLOWED_FILE_TYPES.includes(type)) {
        throw new APIError(400, "Tipo de archivo no permitido");
    }

    const modpack = await Modpack.findOneBy({ id: modpackId, publisherId });
    if (!modpack) return c.notFound();

    const currentVersion = await ModpackVersion.findOneBy({ id: versionId, modpackId: modpack.id });
    if (!currentVersion) return c.notFound();

    // Get all previous versions for this modpack
    const previousVersions = await ModpackVersion.find({
        where: { modpackId: modpack.id },
        relations: ["files", "files.file"],
        order: { createdAt: "DESC" }
    });

    // Filter files by type from previous versions
    const previousFiles: Array<{
        version: string,
        versionId: string,
        files: Array<{
            fileHash: string,
            path: string,
            size: number
        }>
    }> = [];

    for (const version of previousVersions) {
        if (version.id === versionId) continue; // Skip current version

        const filesOfType = version.files
            .filter(vf => vf.file.type === type)
            .map(vf => ({
                fileHash: vf.fileHash,
                path: vf.path,
                size: vf.file.size
            }));

        if (filesOfType.length > 0) {
            previousFiles.push({
                version: version.version,
                versionId: version.id,
                files: filesOfType
            });
        }
    }

    return c.json({ previousFiles });
});

// Reuse files from previous version
ModpackCreatorsRoute.post("/publishers/:publisherId/modpacks/:modpackId/versions/:versionId/reuse-files/:type", isOrganizationMember, async (c) => {
    const user = c.get(USER_CONTEXT_KEY) as User;
    const { publisherId, modpackId, versionId, type } = c.req.param();

    if (!ALLOWED_FILE_TYPES.includes(type)) {
        throw new APIError(400, "Tipo de archivo no permitido");
    }

    const modpack = await Modpack.findOneBy({ id: modpackId, publisherId });
    if (!modpack) return c.notFound();

    const version = await ModpackVersion.findOneBy({ id: versionId, modpackId: modpack.id });
    if (!version) return c.notFound();

    const userRole = await user.getRoleInPublisher(publisherId);

    if (userRole === PublisherMemberRole.MEMBER && version.createdBy !== user.id) {
        throw new APIError(403, "No tienes permiso para editar esta versión");
    }

    const { fileHashes } = await c.req.json();

    if (!Array.isArray(fileHashes) || fileHashes.length === 0) {
        throw new APIError(400, "Se requiere un array de hashes de archivos");
    }

    // Get existing files in the current version for this type to check for duplicates
    const existingFiles = await ModpackVersionFile.find({
        where: { modpackVersionId: versionId },
        relations: ["file"],
    }).then(files => files.filter(f => f.file.type === type));

    const existingFileHashes = new Set(existingFiles.map(f => f.fileHash));
    const existingPaths = new Set(existingFiles.map(f => f.path));

    console.log("Reusing files with hashes:", fileHashes, "for version:", versionId);

    // Get the actual files and their paths from previous versions
    const filesToReuse = await ModpackVersionFile.find({
        where: {
            fileHash: In(fileHashes)
        },
        relations: ["file"],
    });

    // Filter out files that are already in the current version (by fileHash or path)
    const newVersionFiles = fileHashes.map(fileHash => {
        const originalFile = filesToReuse.find(f => f.fileHash === fileHash);
        if (!originalFile) return null;

        // Skip if fileHash or path already exists in current version
        if (existingFileHashes.has(fileHash) || existingPaths.has(originalFile.path)) {
            console.log(`Skipping duplicate file: ${fileHash} or path: ${originalFile.path}`);
            return null;
        }

        return {
            modpackVersionId: versionId,
            fileHash,
            path: originalFile.path
        };
    }).filter((v): v is { modpackVersionId: string; fileHash: string; path: string } => v !== null);

    if (newVersionFiles.length === 0) {
        return c.json({ message: "No se añadieron archivos nuevos (todos ya existen o son inválidos)" });
    }

    // Insert only the new files
    await ModpackVersionFile.insert(newVersionFiles as Partial<ModpackVersionFile>[]);

    return c.json({
        message: `${newVersionFiles.length} archivos reutilizados para ${type}`,
        reusedFiles: newVersionFiles.length
    });
});

ModpackCreatorsRoute.post("/publishers/:publisherId/modpacks/:modpackId/versions/:versionId/files/:type", isOrganizationMember, async (c) => {
    const user = c.get(USER_CONTEXT_KEY) as User;
    const { publisherId, modpackId, versionId, type } = c.req.param();


    if (!ALLOWED_FILE_TYPES.includes(type)) {
        throw new APIError(400, "Tipo de archivo no permitido");
    }

    const modpack = await Modpack.findOneBy({ id: modpackId, publisherId });
    if (!modpack) return c.notFound();

    const version = await ModpackVersion.findOneBy({ id: versionId, modpackId: modpack.id });
    if (!version) return c.notFound();

    const userRole = await user.getRoleInPublisher(publisherId);

    if (userRole === PublisherMemberRole.MEMBER && version.createdBy !== user.id) {
        throw new APIError(403, "No tienes permiso para editar esta versión");
    }

    const body = await c.req.parseBody();

    console.log({ body });

    // For testing, throw an api error

    if (body.file instanceof File) {
        processModpackFileUpload(body.file, body.file.name, modpack.id, version.id, type);
    } else {
        throw new APIError(400, "Archivo no válido o no proporcionado");
    }

    return c.json({ version });
});

// CurseForge Import Endpoint
ModpackCreatorsRoute.post("/publishers/:publisherId/modpacks/import/curseforge", isOrganizationMember, async (c) => {
    const user = c.get(USER_CONTEXT_KEY) as User;
    const { publisherId } = c.req.param();

    const userRole = await user.getRoleInPublisher(publisherId);

    // Only admins, owners, and members can import modpacks
    if (!userRole) {
        throw new APIError(403, "No tienes permiso para importar modpacks en esta organización");
    }

    const body = await c.req.parseBody();

    if (!(body.zipFile instanceof File)) {
        throw new APIError(400, "Se requiere un archivo ZIP de CurseForge");
    }

    try {
        // Convert File to Buffer
        const zipBuffer = Buffer.from(await body.zipFile.arrayBuffer());

        // Import options
        const options = {
            slug: body.slug as string | undefined,
            visibility: body.visibility as string | undefined,
            parallelDownloads: body.parallelDownloads ? parseInt(body.parallelDownloads as string) : 5
        };

        // Validate parallel downloads
        if (options.parallelDownloads && (options.parallelDownloads < 1 || options.parallelDownloads > 10)) {
            options.parallelDownloads = 5;
        }

        // Create import service and process
        const importService = new CurseForgeImportService();
        const result = await importService.importModpack(
            zipBuffer,
            publisherId,
            user.id,
            options
        );

        return c.json({
            success: true,
            message: "Modpack importado exitosamente desde CurseForge",
            data: result
        });

    } catch (error) {
        console.error("CurseForge import error:", error);

        if (error instanceof Error) {
            throw new APIError(400, `Error al importar modpack: ${error.message}`);
        }

        throw new APIError(500, "Error interno del servidor durante la importación");
    }
});

// Public endpoints moved to explore routes


