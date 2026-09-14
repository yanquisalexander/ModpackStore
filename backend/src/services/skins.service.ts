import { db } from "@/db/client.ts";
import { userSkinsTable, userCapesTable, SkinModel } from "@/db/schema.ts";
import { eq, and, desc } from "drizzle-orm";
import { NotFoundError, ValidationError, ForbiddenError } from "@/lib/errors/index.ts";
import {
    uploadObject,
    deleteObject,
    getUserSkinKey,
    getUserSkinUrl,
    getUserCapeKey,
    getUserCapeUrl,
} from "@/lib/r2.ts";
import {
    validateAndNormalizeSkin,
    validateAndNormalizeCape,
} from "@/lib/skin-validation.ts";

const MAX_SKINS = 12;
const MAX_CAPES = 4;

// ── Upload ──────────────────────────────────────────

export async function uploadSkin(
    userId: string,
    fileBytes: Uint8Array,
    model: SkinModel = SkinModel.CLASSIC,
    name?: string,
) {
    const count = await countUserSkins(userId);
    if (count >= MAX_SKINS) {
        throw new ForbiddenError(
            `Skin gallery is full (max ${MAX_SKINS})`,
            "SKIN_GALLERY_FULL",
        );
    }

    const { bytes, hash } = await validateAndNormalizeSkin(fileBytes);
    const r2Key = getUserSkinKey(userId, hash);

    await uploadObject(r2Key, bytes, "image/png");

    const [skin] = await db.insert(userSkinsTable).values({
        userId,
        r2Key,
        model,
        name: name || null,
        isActive: count === 0,
    }).returning();

    return formatSkinResponse(skin);
}

export async function uploadCape(
    userId: string,
    fileBytes: Uint8Array,
    name?: string,
) {
    const count = await countUserCapes(userId);
    if (count >= MAX_CAPES) {
        throw new ForbiddenError(
            `Cape gallery is full (max ${MAX_CAPES})`,
            "CAPE_GALLERY_FULL",
        );
    }

    const { bytes, hash } = await validateAndNormalizeCape(fileBytes);
    const r2Key = getUserCapeKey(userId, hash);

    await uploadObject(r2Key, bytes, "image/png");

    const [cape] = await db.insert(userCapesTable).values({
        userId,
        r2Key,
        name: name || null,
        isActive: count === 0,
    }).returning();

    return formatCapeResponse(cape);
}

// ── List ────────────────────────────────────────────

export async function listSkins(userId: string) {
    return db
        .select()
        .from(userSkinsTable)
        .where(eq(userSkinsTable.userId, userId))
        .orderBy(desc(userSkinsTable.createdAt));
}

export async function listCapes(userId: string) {
    return db
        .select()
        .from(userCapesTable)
        .where(eq(userCapesTable.userId, userId))
        .orderBy(desc(userCapesTable.createdAt));
}

// ── Activate ────────────────────────────────────────

export async function activateSkin(userId: string, skinId: string) {
    const [skin] = await db
        .select()
        .from(userSkinsTable)
        .where(and(eq(userSkinsTable.id, skinId), eq(userSkinsTable.userId, userId)))
        .limit(1);

    if (!skin) {
        throw new NotFoundError("Skin not found", "SKIN_NOT_FOUND");
    }

    await db.transaction(async (tx) => {
        await tx
            .update(userSkinsTable)
            .set({ isActive: false })
            .where(eq(userSkinsTable.userId, userId));
        await tx
            .update(userSkinsTable)
            .set({ isActive: true, updatedAt: new Date() })
            .where(eq(userSkinsTable.id, skinId));
    });

    return formatSkinResponse({ ...skin, isActive: true });
}

export async function activateCape(userId: string, capeId: string) {
    const [cape] = await db
        .select()
        .from(userCapesTable)
        .where(and(eq(userCapesTable.id, capeId), eq(userCapesTable.userId, userId)))
        .limit(1);

    if (!cape) {
        throw new NotFoundError("Cape not found", "CAPE_NOT_FOUND");
    }

    await db.transaction(async (tx) => {
        await tx
            .update(userCapesTable)
            .set({ isActive: false })
            .where(eq(userCapesTable.userId, userId));
        await tx
            .update(userCapesTable)
            .set({ isActive: true, updatedAt: new Date() })
            .where(eq(userCapesTable.id, capeId));
    });

    return formatCapeResponse({ ...cape, isActive: true });
}

// ── Deactivate ──────────────────────────────────────

export async function deactivateSkin(userId: string) {
    await db
        .update(userSkinsTable)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(userSkinsTable.userId, userId), eq(userSkinsTable.isActive, true)));
}

export async function deactivateCape(userId: string) {
    await db
        .update(userCapesTable)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(userCapesTable.userId, userId), eq(userCapesTable.isActive, true)));
}

// ── Delete ──────────────────────────────────────────

export async function deleteSkin(userId: string, skinId: string) {
    const [skin] = await db
        .select()
        .from(userSkinsTable)
        .where(and(eq(userSkinsTable.id, skinId), eq(userSkinsTable.userId, userId)))
        .limit(1);

    if (!skin) {
        throw new NotFoundError("Skin not found", "SKIN_NOT_FOUND");
    }

    if (skin.isActive) {
        await db
            .update(userSkinsTable)
            .set({ isActive: false })
            .where(eq(userSkinsTable.id, skinId));
    }

    await deleteObject(skin.r2Key);

    await db
        .delete(userSkinsTable)
        .where(eq(userSkinsTable.id, skinId));
}

export async function deleteCape(userId: string, capeId: string) {
    const [cape] = await db
        .select()
        .from(userCapesTable)
        .where(and(eq(userCapesTable.id, capeId), eq(userCapesTable.userId, userId)))
        .limit(1);

    if (!cape) {
        throw new NotFoundError("Cape not found", "CAPE_NOT_FOUND");
    }

    if (cape.isActive) {
        await db
            .update(userCapesTable)
            .set({ isActive: false })
            .where(eq(userCapesTable.id, capeId));
    }

    await deleteObject(cape.r2Key);

    await db
        .delete(userCapesTable)
        .where(eq(userCapesTable.id, capeId));
}

// ── Get Active (for Yggdrasil) ──────────────────────

export async function getActiveSkin(userId: string) {
    const [skin] = await db
        .select()
        .from(userSkinsTable)
        .where(and(eq(userSkinsTable.userId, userId), eq(userSkinsTable.isActive, true)))
        .limit(1);

    return skin ? formatSkinResponse(skin) : null;
}

export async function getActiveCape(userId: string) {
    const [cape] = await db
        .select()
        .from(userCapesTable)
        .where(and(eq(userCapesTable.userId, userId), eq(userCapesTable.isActive, true)))
        .limit(1);

    return cape ? formatCapeResponse(cape) : null;
}

// ── Helpers ─────────────────────────────────────────

async function countUserSkins(userId: string): Promise<number> {
    const rows = await db
        .select({ count: userSkinsTable.id })
        .from(userSkinsTable)
        .where(eq(userSkinsTable.userId, userId));
    return rows.length;
}

async function countUserCapes(userId: string): Promise<number> {
    const rows = await db
        .select({ count: userCapesTable.id })
        .from(userCapesTable)
        .where(eq(userCapesTable.userId, userId));
    return rows.length;
}

function formatSkinResponse(skin: typeof userSkinsTable.$inferSelect) {
    const hash = skin.r2Key.split("/").pop()?.replace(".png", "") || "";
    return {
        id: skin.id,
        name: skin.name,
        model: skin.model,
        isActive: skin.isActive,
        url: getUserSkinUrl(skin.userId, hash),
        r2Key: skin.r2Key,
        createdAt: skin.createdAt,
    };
}

function formatCapeResponse(cape: typeof userCapesTable.$inferSelect) {
    const hash = cape.r2Key.split("/").pop()?.replace(".png", "") || "";
    return {
        id: cape.id,
        name: cape.name,
        isActive: cape.isActive,
        url: getUserCapeUrl(cape.userId, hash),
        r2Key: cape.r2Key,
        createdAt: cape.createdAt,
    };
}
