import { db } from "@/db/client.ts";
import {
    modpacksTable,
    modpackVersionsTable,
    ModpackStatus,
    ModpackVisibility,
    ModLoaderType,
    ProcessingJobStatus,
    modpackVersionProcessingJobsTable,
} from "@/db/schema.ts";
import { eq } from "drizzle-orm";
import { ValidationError } from "@/lib/errors/index.ts";
import { CurseForgeImportQueue } from "@/worker/queues.ts";
import { log } from "@/lib/logger.ts";
import type { CurseForgeManifest } from "@/types/curseforge.ts";

function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 64) || "imported-modpack";
}

async function uniqueSlug(base: string): Promise<string> {
    let slug = base;
    let attempt = 0;
    while (true) {
        const [existing] = await db.select({ slug: modpacksTable.slug })
            .from(modpacksTable)
            .where(eq(modpacksTable.slug, slug))
            .limit(1);
        if (!existing) return slug;
        attempt++;
        if (attempt > 10) throw new ValidationError("Unable to generate unique slug", "SLUG_CONFLICT");
        slug = `${base}-${attempt}`;
    }
}

function parseLoaderInfo(manifest: CurseForgeManifest): { loaderType: ModLoaderType; loaderVersion: string | null } {
    const primary = manifest.minecraft.modLoaders.find((l) => l.primary);
    if (!primary) return { loaderType: ModLoaderType.VANILLA, loaderVersion: null };

    const id = primary.id;
    if (id.startsWith("forge-")) {
        return { loaderType: ModLoaderType.FORGE, loaderVersion: id.replace("forge-", "") };
    }
    if (id.startsWith("fabric-")) {
        return { loaderType: ModLoaderType.FABRIC, loaderVersion: id.replace("fabric-", "") };
    }
    if (id.startsWith("neoforge-")) {
        return { loaderType: ModLoaderType.NEOFORGE, loaderVersion: id.replace("neoforge-", "") };
    }
    if (id.startsWith("quilt-")) {
        return { loaderType: ModLoaderType.QUILT, loaderVersion: id.replace("quilt-", "") };
    }
    return { loaderType: ModLoaderType.VANILLA, loaderVersion: null };
}

export function validateManifest(manifest: CurseForgeManifest): void {
    if (manifest.manifestType !== "minecraftModpack") {
        throw new ValidationError("Only Minecraft modpack manifests are supported", "INVALID_MANIFEST_TYPE");
    }
    if (!manifest.name?.trim()) {
        throw new ValidationError("Manifest must have a name", "MISSING_NAME");
    }
    if (manifest.name.length > 64) {
        throw new ValidationError("Modpack name cannot exceed 64 characters", "NAME_TOO_LONG");
    }
    if (!manifest.version?.trim()) {
        throw new ValidationError("Manifest must have a version", "MISSING_VERSION");
    }
    if (!manifest.minecraft?.version) {
        throw new ValidationError("Manifest must specify Minecraft version", "MISSING_MC_VERSION");
    }
    if (!/^\d+\.\d+(\.\d+)?/.test(manifest.minecraft.version)) {
        throw new ValidationError("Invalid Minecraft version format", "INVALID_MC_VERSION");
    }
    if (!Array.isArray(manifest.files)) {
        throw new ValidationError("Manifest must have a files array", "MISSING_FILES");
    }
    if (manifest.files.length > 500) {
        throw new ValidationError("Too many mods (maximum 500 supported)", "TOO_MANY_MODS");
    }
    for (const file of manifest.files) {
        if (!file.projectID || !file.fileID || file.projectID <= 0 || file.fileID <= 0) {
            throw new ValidationError("All mod files must have valid projectID and fileID", "INVALID_MOD_ENTRY");
        }
    }
}

export async function importCurseforge(
    creatorId: string,
    userId: string,
    zipR2Key: string,
    manifest: CurseForgeManifest,
    options: { slug?: string } = {},
): Promise<{
    modpack: { id: string; name: string; slug: string };
    version: { id: string; version: string; mcVersion: string };
    jobId: string;
}> {
    validateManifest(manifest);

    const slug = await uniqueSlug(options.slug || generateSlug(manifest.name));
    const { loaderType, loaderVersion } = parseLoaderInfo(manifest);

    // Create modpack
    const [modpack] = await db.insert(modpacksTable)
        .values({
            name: manifest.name,
            slug,
            shortDescription: `Minecraft ${manifest.minecraft.version} modpack with ${manifest.files.length} mods`,
            description: `Imported from CurseForge by ${manifest.author}`,
            iconUrl: "",
            bannerUrl: "",
            visibility: ModpackVisibility.PRIVATE,
            creatorId,
            creatorUserId: userId,
            status: ModpackStatus.DRAFT,
        })
        .returning();

    // Create version
    const [version] = await db.insert(modpackVersionsTable)
        .values({
            modpackId: modpack.id,
            version: manifest.version,
            mcVersion: manifest.minecraft.version,
            loaderType,
            loaderVersion,
            changelog: `Imported from CurseForge. Original author: ${manifest.author}. Contains ${manifest.files.length} mods.`,
            createdBy: userId,
            status: ModpackStatus.DRAFT,
        })
        .returning();

    // Dispatch worker job
    const jobId = `curseforge-${modpack.id}-${version.id}-${Date.now()}`;

    await CurseForgeImportQueue.add(
        "curseforge-import",
        {
            versionId: version.id,
            modpackId: modpack.id,
            zipR2Key,
            manifest,
        },
        { jobId },
    );

    // Insert processing job record
    await db.insert(modpackVersionProcessingJobsTable).values({
        versionId: version.id,
        fileType: "curseforge-import",
        jobId,
        status: ProcessingJobStatus.PENDING,
    });

    log(`[CURSEFORGE_IMPORT] Dispatched job ${jobId} for modpack ${modpack.id}`);

    return {
        modpack: { id: modpack.id, name: modpack.name, slug: modpack.slug },
        version: { id: version.id, version: version.version, mcVersion: version.mcVersion },
        jobId,
    };
}
