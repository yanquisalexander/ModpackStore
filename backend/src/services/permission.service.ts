import { db } from "@/db/client.ts";
import { permissionsTable } from "@/db/schema.ts";
import { eq, and } from "drizzle-orm";
import { NotFoundError } from "@/lib/errors/index.ts";

const COLUMN_MAP: Record<string, string> = {
    "modpack.modify": "canEditModpacks",
    "modpack.manage_versions": "canEditModpacks",
    "modpack.publish": "canPublishVersions",
    "modpack.delete": "canDeleteModpacks",
    "modpack.manage_access": "canManageMembers",
    "publisher.manage_categories_tags": "canManageSettings",
};

function mapPermissionsToFrontend(row: typeof permissionsTable.$inferSelect) {
    return {
        id: row.id,
        creatorId: row.creatorId,
        modpackId: row.modpackId,
        permissions: {
            modpackView: true,
            modpackModify: row.canEditModpacks ?? false,
            modpackManageVersions: row.canEditModpacks ?? false,
            modpackPublish: row.canPublishVersions ?? false,
            modpackDelete: row.canDeleteModpacks ?? false,
            modpackManageAccess: row.canManageMembers ?? false,
            publisherManageCategoriesTags: row.canManageSettings ?? false,
            publisherViewStats: false,
        },
    };
}

export async function getMemberPermissions(creatorId: string, userId: string) {
    const rows = await db.select()
        .from(permissionsTable)
        .where(and(
            eq(permissionsTable.creatorId, creatorId),
            eq(permissionsTable.userId, userId),
        ));

    return rows.map(mapPermissionsToFrontend);
}

export async function setMemberPermission(
    creatorId: string,
    userId: string,
    permissionKey: string,
    enabled: boolean,
    modpackId?: string,
) {
    const columnName = COLUMN_MAP[permissionKey];
    if (!columnName) {
        return { ok: false, reason: `Unknown permission key: ${permissionKey}` };
    }

    const [existing] = await db.select()
        .from(permissionsTable)
        .where(and(
            eq(permissionsTable.creatorId, creatorId),
            eq(permissionsTable.userId, userId),
            modpackId
                ? eq(permissionsTable.modpackId, modpackId)
                : eq(permissionsTable.modpackId, null as any),
        ))
        .limit(1);

    if (existing) {
        await db.update(permissionsTable)
            .set({ [columnName]: enabled })
            .where(eq(permissionsTable.id, existing.id));
    } else {
        await db.insert(permissionsTable)
            .values({
                userId,
                creatorId,
                modpackId: modpackId ?? null,
                [columnName]: enabled,
            });
    }

    return { ok: true };
}
