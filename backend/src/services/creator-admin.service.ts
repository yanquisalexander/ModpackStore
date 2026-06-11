import { db } from "@/db/client.ts";
import { creatorsTable, CreatorStatus } from "@/db/schema.ts";
import { eq } from "drizzle-orm";
import { NotFoundError } from "@/lib/errors/index.ts";

export async function getPendingCreators() {
    return db.select()
        .from(creatorsTable)
        .where(eq(creatorsTable.status, CreatorStatus.PENDING));
}

export async function approveCreator(creatorId: string) {
    const [creator] = await db.update(creatorsTable)
        .set({ status: CreatorStatus.APPROVED, updatedAt: new Date() })
        .where(eq(creatorsTable.id, creatorId))
        .returning();

    if (!creator) throw new NotFoundError("Creator not found", "CREATOR_NOT_FOUND");
    return creator;
}

export async function rejectCreator(creatorId: string) {
    const [creator] = await db.update(creatorsTable)
        .set({ status: CreatorStatus.REJECTED, updatedAt: new Date() })
        .where(eq(creatorsTable.id, creatorId))
        .returning();

    if (!creator) throw new NotFoundError("Creator not found", "CREATOR_NOT_FOUND");
    return creator;
}
