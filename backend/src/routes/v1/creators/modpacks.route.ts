import { Modpack } from "@/entities/Modpack";
import { ModpackVersion } from "@/entities/ModpackVersion";
import { ModpackVersionFile } from "@/entities/ModpackVersionFile";
import { User } from "@/entities/User";
import { APIError } from "@/lib/APIError";
import { isOrganizationMember, requireAuth, requireCreatorAccess, USER_CONTEXT_KEY } from "@/middlewares/auth.middleware";
import { ModpackVisibility } from "@/models/Modpack.model";
import { ALLOWED_FILE_TYPES, processModpackFileUpload } from "@/services/modpackFileUpload";
import { CurseForgeImportService } from "@/services/curseforgeImportService";
import { ModrinthImportService } from "@/services/modrinthImportService";
import { queue } from "@/services/Queue";
import { uploadToR2 } from "@/services/r2UploadService";
import { CategoryService } from "@/services/category.service";
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
        relations: ["creatorUser", "categories", "categories.category"],
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
            isPaid: true,
            price: true,
            acquisitionMethod: true,
            password: true,
            requiresTwitchSubscription: true,
            twitchCreatorIds: true,
            twitchChannels: true,
            creatorUser: {
                id: true,
                username: true,
                email: true,
                avatarUrl: true,
            },
            categories: {
                id: true,
                categoryId: true,
                isPrimary: true,
                category: {
                    id: true,
                    name: true,
                    iconUrl: true,
                    shortDescription: true,
                }
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

        const previousStatus = modpack.status;

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

        // --- Handle access mode changes ---
        if (body.acquisitionMethod !== undefined) {
            const newAcquisitionMethod = body.acquisitionMethod;

            // Ensure it's a string
            if (typeof newAcquisitionMethod !== 'string') {
                return c.json({ error: "Método de adquisición debe ser una cadena de texto." }, 400);
            }

            // Validate acquisition method
            if (!['free', 'paid', 'password'].includes(newAcquisitionMethod)) {
                return c.json({ error: "Método de adquisición inválido. Debe ser 'free', 'paid' o 'password'." }, 400);
            }

            // Business rules for access mode changes
            const currentMethod = modpack.acquisitionMethod || 'free';

            // Cannot change from free to paid (only restriction)
            if (currentMethod === 'free' && newAcquisitionMethod === 'paid') {
                return c.json({
                    error: "No se puede cambiar un modpack gratuito a de pago. Solo se puede establecer como pago al momento de creación."
                }, 400);
            }

            // Paid modpacks can change to any other method (free, password)
            // Password modpacks can change to any other method (free, paid)
            // This allows flexibility for creators to adjust their monetization strategy
            modpack.acquisitionMethod = newAcquisitionMethod as any;

            // Update isPaid based on acquisition method
            if (newAcquisitionMethod === 'paid') {
                modpack.isPaid = true;
                // Keep existing price or set default if not set
                if (!modpack.price || modpack.price === '0.00') {
                    modpack.price = '0.00'; // Will be validated below if price is provided
                }
            } else {
                modpack.isPaid = false;
                modpack.price = '0.00';
            }

            // Clear password when changing away from password protection
            if (newAcquisitionMethod !== 'password') {
                modpack.password = null;
            }

            // Clear Twitch requirements when not free
            if (newAcquisitionMethod !== 'free') {
                modpack.requiresTwitchSubscription = false;
                modpack.setTwitchChannels([]);
            } else {
                // For free modpacks, ensure Twitch subscription is false by default if not set
                if (modpack.requiresTwitchSubscription === undefined) {
                    modpack.requiresTwitchSubscription = false;
                }
            }
        }

        // --- Handle password for password-protected modpacks ---
        // Only process if password field is explicitly provided in the request
        if (body.password !== undefined) {
            const acquisitionMethod = (body.acquisitionMethod as string) || modpack.acquisitionMethod || 'free';

            if (acquisitionMethod === 'password') {
                if (body.password && typeof body.password === 'string' && body.password.trim().length > 0) {
                    // Hash the password (you might want to use bcrypt here)
                    modpack.password = body.password.trim();
                } else {
                    return c.json({ error: "Se requiere una contraseña para modpacks protegidos por contraseña." }, 400);
                }
            } else {
                // Clear password if not using password protection
                modpack.password = null;
            }
        }

        // --- Handle Twitch subscription requirements ---
        if (body.requiresTwitchSubscription !== undefined) {
            const acquisitionMethod = (body.acquisitionMethod as string) || modpack.acquisitionMethod || 'free';

            if (acquisitionMethod === 'free') {
                const requiresTwitch = body.requiresTwitchSubscription;
                if (typeof requiresTwitch === 'string') {
                    modpack.requiresTwitchSubscription = requiresTwitch === 'true';
                } else if (typeof requiresTwitch === 'boolean') {
                    modpack.requiresTwitchSubscription = requiresTwitch;
                } else {
                    modpack.requiresTwitchSubscription = false;
                }
            } else {
                // Only free modpacks can require Twitch subscription
                modpack.requiresTwitchSubscription = false;
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
            "password",
            "requiresTwitchSubscription",
            "twitchChannels",
        ];

        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                (modpack as any)[field] = body[field];
            }
        }

        // --- Handle Twitch channels if provided ---
        if (body.twitchChannels !== undefined) {
            try {
                const twitchChannels = typeof body.twitchChannels === 'string'
                    ? JSON.parse(body.twitchChannels)
                    : body.twitchChannels;

                if (Array.isArray(twitchChannels)) {
                    modpack.setTwitchChannels(twitchChannels);
                } else {
                    modpack.setTwitchChannels([]);
                }
            } catch (error) {
                console.error("Error parsing Twitch channels:", error);
                return c.json({ error: "Invalid Twitch channels format" }, 400);
            }
        }

        await modpack.save();

        // Handle category assignments
        const categoryService = new CategoryService();

        // Parse categories from body (they come as JSON string from FormData)
        let categories: string[] = [];
        let primaryCategoryId: string | undefined;

        if (body.categories) {
            try {
                categories = JSON.parse(body.categories as string);
            } catch (error) {
                console.error("Error parsing categories:", error);
            }
        }

        if (body.primaryCategoryId) {
            primaryCategoryId = body.primaryCategoryId as string;
        }

        // Si no hay primaryCategoryId pero hay categorías, usar la primera
        if (!primaryCategoryId && categories.length > 0) {
            primaryCategoryId = categories[0];
        }

        console.log("Parsed categories:", categories, "Primary:", primaryCategoryId);

        // Update category assignments if provided
        if (body.categories !== undefined) {
            // Remove all existing non-admin categories first
            const existingCategories = await categoryService.getModpackCategories(modpackId);

            // Keep admin-only categories (that publishers can't modify)
            const adminCategories: string[] = [];
            for (const modpackCategory of existingCategories) {
                if (modpackCategory.category.isAdminOnly) {
                    adminCategories.push(modpackCategory.categoryId);
                } else {
                    // Remove non-admin categories
                    await categoryService.removeCategoryFromModpack(modpackId, modpackCategory.categoryId);
                }
            }

            // Assign new categories
            if (categories && categories.length > 0) {
                for (const categoryId of categories) {
                    const isPrimary = categoryId === primaryCategoryId;
                    try {
                        await categoryService.assignCategoryToModpack(modpackId, categoryId, isPrimary);
                    } catch (error) {
                        console.error(`Error assigning category ${categoryId} to modpack:`, error);
                    }
                }
            }
        }

        // Validation: Check if modpack is being published without primary category
        if (previousStatus !== 'published' && modpack.status === 'published') {
            const modpackCategories = await categoryService.getModpackCategories(modpackId);
            const hasPrimaryCategory = modpackCategories.some((mc: any) => mc.isPrimary);

            if (!hasPrimaryCategory) {
                return c.json({
                    error: "No se puede publicar un modpack sin una categoría primaria"
                }, 400);
            }
        }

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
        "shortDescription",
        "versions",
        "creatorUserId",
        "acquisitionMethod",
        "isPaid",
        "price",
        "password",
        "requiresTwitchSubscription",
        "twitchChannels",
    ];

    const newModpack = new Modpack()

    newModpack.publisherId = publisherId;

    // Handle pricing fields with validation
    if (body.acquisitionMethod) {
        if (typeof body.acquisitionMethod !== 'string') {
            return c.json({ error: "Método de adquisición debe ser una cadena de texto." }, 400);
        }

        newModpack.acquisitionMethod = body.acquisitionMethod as any;

        // If setting as paid, validate price
        if (body.acquisitionMethod === 'paid') {
            if (body.price && typeof body.price === 'string' && parseFloat(body.price) > 0) {
                newModpack.isPaid = true;
                newModpack.price = parseFloat(body.price).toFixed(2);
            } else {
                return c.json({
                    error: "Precio requerido para modpacks de pago. La moneda es USD."
                }, 400);
            }
        } else {
            newModpack.isPaid = false;
            newModpack.price = "0.00";
        }
    }

    // Handle password for password-protected modpacks
    if (body.password !== undefined) {
        const acquisitionMethod = body.acquisitionMethod as string || 'free';

        if (acquisitionMethod === 'password') {
            if (body.password && typeof body.password === 'string' && body.password.trim().length > 0) {
                newModpack.password = body.password.trim();
            } else {
                return c.json({ error: "Se requiere una contraseña para modpacks protegidos por contraseña." }, 400);
            }
        }
    }

    // Handle Twitch subscription requirements
    if (body.requiresTwitchSubscription !== undefined) {
        const acquisitionMethod = body.acquisitionMethod as string || 'free';

        if (acquisitionMethod === 'free') {
            const requiresTwitch = body.requiresTwitchSubscription;
            if (typeof requiresTwitch === 'string') {
                newModpack.requiresTwitchSubscription = requiresTwitch === 'true';
            } else if (typeof requiresTwitch === 'boolean') {
                newModpack.requiresTwitchSubscription = requiresTwitch;
            }
        }
        // For non-free modpacks, requiresTwitchSubscription is automatically false
    }

    for (const field of allowedFields) {
        if (body[field] !== undefined && !['acquisitionMethod', 'isPaid', 'price'].includes(field)) {
            (newModpack as any)[field] = body[field];
        }
    }

    newModpack.creatorUserId = (c.get(USER_CONTEXT_KEY) as User).id;

    // Handle Twitch channels if provided
    if (body.twitchChannels !== undefined) {
        try {
            const twitchChannels = typeof body.twitchChannels === 'string'
                ? JSON.parse(body.twitchChannels)
                : body.twitchChannels;

            if (Array.isArray(twitchChannels)) {
                newModpack.setTwitchChannels(twitchChannels);
            }
        } catch (error) {
            console.error("Error parsing Twitch channels:", error);
            return c.json({ error: "Invalid Twitch channels format" }, 400);
        }
    }

    await newModpack.save();

    // Handle category assignments
    const categoryService = new CategoryService();

    // Parse categories from body (they come as JSON string from FormData)
    let categories: string[] = [];
    let primaryCategoryId: string | undefined;

    if (body.categories) {
        try {
            categories = JSON.parse(body.categories as string);
        } catch (error) {
            console.error("Error parsing categories:", error);
        }
    }

    if (body.primaryCategoryId) {
        primaryCategoryId = body.primaryCategoryId as string;
    }

    // Si no hay primaryCategoryId pero hay categorías, usar la primera
    if (!primaryCategoryId && categories.length > 0) {
        primaryCategoryId = categories[0];
    }

    console.log("Parsed categories:", categories, "Primary:", primaryCategoryId);

    // Assign categories to modpack
    if (categories && categories.length > 0) {
        for (const categoryId of categories) {
            const isPrimary = categoryId === primaryCategoryId;
            try {
                await categoryService.assignCategoryToModpack(newModpack.id, categoryId, isPrimary);
            } catch (error) {
                console.error(`Error assigning category ${categoryId} to modpack:`, error);
            }
        }
    }

    // Validation: Check if modpack is being published without primary category
    if (newModpack.status === 'published') {
        const modpackCategories = await categoryService.getModpackCategories(newModpack.id);
        const hasPrimaryCategory = modpackCategories.some((mc: any) => mc.isPrimary);

        if (!hasPrimaryCategory) {
            return c.json({
                error: "No se puede publicar un modpack sin una categoría primaria"
            }, 400);
        }
    }

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
        relations: ["versions", "categories", "categories.category"],
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
            isPaid: true,
            price: true,
            acquisitionMethod: true,
            password: true,
            requiresTwitchSubscription: true,
            twitchCreatorIds: true,
            twitchChannels: true,
            creatorUser: {
                id: true,
                username: true,
                email: true,
                avatarUrl: true,
            },
            categories: {
                id: true,
                categoryId: true,
                isPrimary: true,
                category: {
                    id: true,
                    name: true,
                    iconUrl: true,
                    shortDescription: true,
                }
            }
        }
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



    const { versionName, mcVersion, forgeVersion, loaderType, loaderVersion } = await c.req.json();

    if (!versionName || !mcVersion) {
        throw new APIError(400, "El nombre de la versión y la versión de Minecraft son requeridos");
    }

    // Get all previous versions to check for breaking changes
    const previousVersions = await ModpackVersion.find({
        where: { modpackId: modpack.id },
        order: { createdAt: "DESC" }
    });

    // Detect breaking changes
    const breakingChanges: Array<{ version: string; mcVersion: string; loaderType: string }> = [];
    const newLoaderType = loaderType || (forgeVersion ? 'forge' : 'vanilla');
    
    for (const prevVersion of previousVersions) {
        const prevLoaderType = prevVersion.loaderType || (prevVersion.forgeVersion ? 'forge' : 'vanilla');
        
        // Check if there's a breaking change (different MC version or different loader type)
        if (prevVersion.mcVersion !== mcVersion || prevLoaderType !== newLoaderType) {
            breakingChanges.push({
                version: prevVersion.version,
                mcVersion: prevVersion.mcVersion,
                loaderType: prevLoaderType
            });
        }
    }

    const newVersion = new ModpackVersion();
    newVersion.version = versionName;
    newVersion.mcVersion = mcVersion;
    
    // Handle new loader fields with backward compatibility
    if (loaderType && loaderVersion) {
        newVersion.loaderType = loaderType;
        newVersion.loaderVersion = loaderVersion;
        // Keep forgeVersion for backward compatibility
        if (loaderType === 'forge') {
            newVersion.forgeVersion = loaderVersion;
        }
    } else if (forgeVersion) {
        // Legacy: if only forgeVersion is provided
        newVersion.forgeVersion = forgeVersion;
        newVersion.loaderType = 'forge' as any;
        newVersion.loaderVersion = forgeVersion;
    } else {
        // No loader specified, default to vanilla
        newVersion.loaderType = 'vanilla' as any;
        newVersion.loaderVersion = null;
    }
    
    newVersion.modpackId = modpack.id;
    newVersion.createdBy = user.id;

    await newVersion.save();


    return c.json({ 
        success: true, 
        version: newVersion,
        breakingChanges: breakingChanges.length > 0 ? breakingChanges : undefined
    });
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
            loaderType: true,
            loaderVersion: true,
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
                // Primary keys required for TypeORM to properly load the relation
                fileHash: true,
                modpackVersionId: true,
                path: true,
                fileType: true,
                file: {
                    // Primary key required for nested relation
                    hash: true,
                    type: true,
                    size: true
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

    // Members can only edit versions they created
    if (userRole === PublisherMemberRole.MEMBER && version.createdBy !== user.id) {
        throw new APIError(403, "No tienes permiso para editar esta versión");
    }

    // Only DRAFT versions can be edited
    if (version.status !== ModpackVersionStatus.DRAFT) {
        throw new APIError(400, "Solo las versiones en estado 'draft' se pueden editar");
    }

    const { changelog } = await c.req.json();

    if (changelog !== undefined) {
        version.changelog = changelog;
    }

    await version.save();

    return c.json({ version });
});


// Logical delete - mark version as DELETED (irreversible)
ModpackCreatorsRoute.delete("/publishers/:publisherId/modpacks/:modpackId/versions/:versionId", isOrganizationMember, async (c) => {
    const user = c.get(USER_CONTEXT_KEY) as User;
    const { publisherId, modpackId, versionId } = c.req.param();

    const modpack = await Modpack.findOneBy({ id: modpackId, publisherId });
    if (!modpack) return c.notFound();

    const version = await ModpackVersion.findOneBy({ id: versionId, modpackId: modpack.id });
    if (!version) return c.notFound();

    const userRole = await user.getRoleInPublisher(publisherId);

    // Only admin/owner or creator can delete
    if (
        userRole !== PublisherMemberRole.ADMIN &&
        userRole !== PublisherMemberRole.OWNER &&
        version.createdBy !== user.id
    ) {
        throw new APIError(403, "No tienes permiso para eliminar esta versión");
    }

    // If already deleted, return error
    if (version.status === ModpackVersionStatus.DELETED) {
        throw new APIError(400, "Esta versión ya ha sido eliminada");
    }

    // Mark as deleted (irreversible)
    version.status = ModpackVersionStatus.DELETED;
    await version.save();

    return c.json({ success: true });
});

// Archive version (logical archive, can be reversible if needed)
ModpackCreatorsRoute.patch("/publishers/:publisherId/modpacks/:modpackId/versions/:versionId/archive", isOrganizationMember, async (c) => {
    const user = c.get(USER_CONTEXT_KEY) as User;
    const { publisherId, modpackId, versionId } = c.req.param();

    const modpack = await Modpack.findOneBy({ id: modpackId, publisherId });
    if (!modpack) return c.notFound();

    const version = await ModpackVersion.findOneBy({ id: versionId, modpackId: modpack.id });
    if (!version) return c.notFound();

    const userRole = await user.getRoleInPublisher(publisherId);

    // Only admin/owner or creator can archive
    if (
        userRole !== PublisherMemberRole.ADMIN &&
        userRole !== PublisherMemberRole.OWNER &&
        version.createdBy !== user.id
    ) {
        throw new APIError(403, "No tienes permiso para archivar esta versión");
    }

    if (version.status === ModpackVersionStatus.DELETED) {
        throw new APIError(400, "No se puede archivar una versión eliminada");
    }

    version.status = ModpackVersionStatus.ARCHIVED;
    await version.save();

    return c.json({ success: true });
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
            .filter(vf => {
                // Prefer fileType from ModpackVersionFile, fallback to ModpackFile.type for backward compatibility
                const fileType = vf.fileType || vf.file?.type || 'extras';
                return fileType === type;
            })
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


    const body = await c.req.json();
    const fileRefs: Array<{ versionId: string; fileHash: string; path: string }> = body.fileRefs;

    if (!Array.isArray(fileRefs) || fileRefs.length === 0) {
        throw new APIError(400, "Se requiere un array de referencias de archivos (versionId + fileHash + path)");
    }

    // Get existing files in the current version for this type to check for duplicates
    const existingFiles = await ModpackVersionFile.find({
        where: { modpackVersionId: versionId },
        relations: ["file"],
    }).then(files => files.filter(f => {
        // Prefer fileType from ModpackVersionFile, fallback to ModpackFile.type for backward compatibility
        const fileType = f.fileType || f.file?.type;
        return fileType === type;
    }));

    const existingFileHashes = new Set(existingFiles.map(f => f.fileHash));
    const existingPaths = new Set(existingFiles.map(f => f.path));


    // Get all referenced files in one query using OR conditions with versionId, fileHash, and path
    const filesToReuse = await ModpackVersionFile.find({
        where: fileRefs.map(ref => ({
            fileHash: ref.fileHash,
            modpackVersionId: ref.versionId,
            path: ref.path
        })),
        relations: ["file"],
    });

    // Filter out files that are already in the current version (by fileHash or path)
    const newVersionFiles = filesToReuse.map(originalFile => {
        const fileHash = originalFile.fileHash;

        // Skip if fileHash or path already exists in current version
        if (existingFileHashes.has(fileHash) || existingPaths.has(originalFile.path)) {
            console.log(`Skipping duplicate file: ${fileHash} or path: ${originalFile.path}`);
            return null;
        }

        return {
            modpackVersionId: versionId,
            fileHash,
            path: originalFile.path,
            fileType: type
        };
    }).filter((v): v is { modpackVersionId: string; fileHash: string; path: string; fileType: string } => v !== null);

    if (newVersionFiles.length === 0) {
        return c.json({ message: "No se añadieron archivos nuevos (todos ya existen o son inválidos)" });
    }

    // Insert files in chunks to avoid overwhelming the database
    const chunkSize = 1000;
    for (let i = 0; i < newVersionFiles.length; i += chunkSize) {
        const chunk = newVersionFiles.slice(i, i + chunkSize);
        await ModpackVersionFile.insert(chunk as Partial<ModpackVersionFile>[]);
    }

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

    console.log({ body, type });

    // For testing, throw an api error

    if (body.file instanceof File) {
        processModpackFileUpload(body.file, body.file.name, modpack.id, version.id, type);
    } else {
        throw new APIError(400, "Archivo no válido o no proporcionado");
    }

    return c.json({ version });
});

// Delete all files of a specific type
ModpackCreatorsRoute.delete("/publishers/:publisherId/modpacks/:modpackId/versions/:versionId/files/:type", isOrganizationMember, async (c) => {
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

    // Delete all ModpackVersionFile entries for this version and type
    const deleteResult = await ModpackVersionFile.createQueryBuilder()
        .delete()
        .from(ModpackVersionFile)
        .where(`modpackVersionId = :versionId AND fileHash IN (
            SELECT hash FROM modpack_files WHERE type = :fileType
        )`, { versionId, fileType: type })
        .execute();

    return c.json({
        message: `Eliminados ${deleteResult.affected || 0} archivos de tipo ${type}`,
        deletedCount: deleteResult.affected || 0
    });
});

// Delete multiple specific files
ModpackCreatorsRoute.post("/publishers/:publisherId/modpacks/:modpackId/versions/:versionId/files/:type/delete-multiple", isOrganizationMember, async (c) => {
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

    const body = await c.req.json();
    const { fileHashes }: { fileHashes: string[] } = body;

    if (!Array.isArray(fileHashes) || fileHashes.length === 0) {
        throw new APIError(400, "Lista de hashes de archivos requerida");
    }

    // Delete specific ModpackVersionFile entries
    const deleteResult = await ModpackVersionFile.createQueryBuilder()
        .delete()
        .from(ModpackVersionFile)
        .where(`modpackVersionId = :versionId AND fileHash IN (:...fileHashes) AND fileHash IN (
            SELECT hash FROM modpack_files WHERE type = :fileType
        )`, { versionId, fileHashes, fileType: type })
        .execute();

    return c.json({
        message: `Eliminados ${deleteResult.affected || 0} archivos específicos de tipo ${type}`,
        deletedCount: deleteResult.affected || 0
    });
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

// Modrinth Import Endpoint
ModpackCreatorsRoute.post("/publishers/:publisherId/modpacks/import/modrinth", isOrganizationMember, async (c) => {
    const user = c.get(USER_CONTEXT_KEY) as User;
    const { publisherId } = c.req.param();

    const userRole = await user.getRoleInPublisher(publisherId);

    // Only admins, owners, and members can import modpacks
    if (!userRole) {
        throw new APIError(403, "No tienes permiso para importar modpacks en esta organización");
    }

    const body = await c.req.parseBody();

    if (!(body.mrpackFile instanceof File)) {
        throw new APIError(400, "Se requiere un archivo .mrpack de Modrinth");
    }

    try {
        // Convert File to Buffer
        const zipBuffer = Buffer.from(await body.mrpackFile.arrayBuffer());

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
        const importService = new ModrinthImportService();
        const result = await importService.importModpack(
            zipBuffer,
            publisherId,
            user.id,
            options
        );

        return c.json({
            success: true,
            message: "Modpack importado exitosamente desde Modrinth",
            data: result
        });

    } catch (error) {
        console.error("Modrinth import error:", error);

        if (error instanceof Error) {
            throw new APIError(400, `Error al importar modpack: ${error.message}`);
        }

        throw new APIError(500, "Error interno del servidor durante la importación");
    }
});

// Public endpoints moved to explore routes
ModpackCreatorsRoute.delete("/publishers/:publisherId/modpacks/:modpackId/versions/:versionId/files/:type/:fileHash", isOrganizationMember, async (c) => {
    const user = c.get(USER_CONTEXT_KEY) as User;
    const { publisherId, modpackId, versionId, type, fileHash } = c.req.param();

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

    // Find and delete the specific ModpackVersionFile entry
    const fileToDelete = await ModpackVersionFile.findOne({
        where: {
            modpackVersionId: versionId,
            fileHash,
            file: { type: type as any }
        },
        relations: ["file"]
    });

    if (!fileToDelete) {
        throw new APIError(404, "Archivo no encontrado");
    }

    await fileToDelete.remove();

    return c.json({ message: "Archivo eliminado correctamente" });
});


