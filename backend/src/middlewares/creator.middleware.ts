import type { Context, Next } from "@hono/hono";
import { ForbiddenError, ValidationError } from "@/lib/errors/index.ts";
import { db } from "@/db/client.ts";
import { creatorUsersTable, CreatorRole, CreatorStatus, creatorsTable } from "@/db/schema.ts";
import { eq, and } from "drizzle-orm";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertValidUUID(value: string, label: string): void {
    if (!UUID_RE.test(value)) {
        throw new ValidationError(`Invalid ${label}: must be a valid UUID`);
    }
}

const cu = creatorUsersTable

export async function requireCreatorAccess(c: Context, next: Next) {
    const userId = c.get("userId") as string;
    const creatorId = c.req.param("creatorId");

    if (!creatorId) throw new ForbiddenError("Missing creator ID", "MISSING_CREATOR_ID");
    assertValidUUID(creatorId, "creator ID");

    const [membership] = await db.select()
        .from(cu)
        .where(and(eq(cu.userId, userId), eq(cu.creatorId, creatorId)))
        .limit(1);

    if (!membership) throw new ForbiddenError("Not a member of this creator", "NOT_CREATOR_MEMBER");

    c.set("membership", membership);
    await next();
}

export function requireCreatorRole(...roles: CreatorRole[]) {
    return async (c: Context, next: Next) => {
        const userId = c.get("userId") as string;
        const creatorId = c.req.param("creatorId");

        if (!creatorId) throw new ForbiddenError("Missing creator ID", "MISSING_CREATOR_ID");
        assertValidUUID(creatorId, "creator ID");

        const [membership] = await db.select()
            .from(cu)
            .where(and(eq(cu.userId, userId), eq(cu.creatorId, creatorId)))
            .limit(1);

        if (!membership) throw new ForbiddenError("Not a member of this creator", "NOT_CREATOR_MEMBER");

        if (!roles.includes(membership.role as CreatorRole)) {
            throw new ForbiddenError("Insufficient role in creator", "INSUFFICIENT_ROLE");
        }

        c.set("membership", membership);
        await next();
    };
}

export async function requireApprovedCreator(c: Context, next: Next) {
    const creatorId = c.req.param("creatorId");
    if (!creatorId) throw new ForbiddenError("Missing creator ID", "MISSING_CREATOR_ID");

    const [creator] = await db.select()
        .from(creatorsTable)
        .where(eq(creatorsTable.id, creatorId))
        .limit(1);

    if (!creator || creator.status !== CreatorStatus.APPROVED) {
        throw new ForbiddenError("Creator is not approved", "CREATOR_NOT_APPROVED");
    }

    await next();
}
