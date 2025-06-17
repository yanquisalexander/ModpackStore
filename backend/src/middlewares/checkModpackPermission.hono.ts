import { Context, Next } from 'hono';
import { client as db } from '@/db/client';
import { ModpacksTable, PublisherMembersTable, ScopesTable } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';

// Permisos posibles
export type Permission =
    | 'canCreateModpacks'
    | 'canEditModpacks'
    | 'canDeleteModpacks'
    | 'canPublishVersions'
    | 'canManageMembers'
    | 'canManageSettings';

export function checkModpackPermissionHono(requiredPermissions: Permission[]) {
    return async (c: Context, next: Next) => {
        const user = c.get('user');
        if (!user || !user.id) {
            return c.json({ message: 'Unauthorized: No user session found.' }, 401);
        }
        const userId = user.id;
        let publisherContextId: string | undefined = c.req.param('publisherId') || c.req.param('publisher_id');
        const modpackIdFromParams = c.req.param('modpackId');

        try {
            if (modpackIdFromParams) {
                const modpack = await db.query.ModpacksTable.findFirst({
                    where: eq(ModpacksTable.id, modpackIdFromParams),
                    columns: { publisherId: true }
                });
                if (!modpack) {
                    return c.json({ message: 'Modpack not found.' }, 404);
                }
                publisherContextId = modpack.publisherId;
            }
            if (!publisherContextId) {
                return c.json({ message: 'A valid Publisher ID or Modpack ID must be provided to check permissions.' }, 400);
            }
            const publisherMember = await db.query.PublisherMembersTable.findFirst({
                where: and(
                    eq(PublisherMembersTable.userId, userId),
                    eq(PublisherMembersTable.publisherId, publisherContextId)
                ),
                columns: { id: true }
            });
            if (!publisherMember) {
                return c.json({ message: 'Forbidden: You are not a member of this publisher.' }, 403);
            }
            const scopeOrConditions = [eq(ScopesTable.publisherId, publisherContextId)];
            if (modpackIdFromParams) {
                scopeOrConditions.push(eq(ScopesTable.modpackId, modpackIdFromParams));
            }
            const userScopes = await db.query.ScopesTable.findMany({
                where: and(
                    eq(ScopesTable.publisherMemberId, publisherMember.id),
                    or(...scopeOrConditions)
                )
            });
            if (!userScopes || userScopes.length === 0) {
                return c.json({ message: 'Forbidden: No permissions found for this user.' }, 403);
            }
            const hasPermission = userScopes.some(scope =>
                requiredPermissions.some(requiredPerm => scope[requiredPerm] === true)
            );
            if (!hasPermission) {
                return c.json({
                    message: `Forbidden: User does not have the required permissions (${requiredPermissions.join(', ')}).`
                }, 403);
            }
            await next();
        } catch (error) {
            console.error('Error in checkModpackPermissionHono middleware:', error);
            return c.json({ message: 'Internal server error during permission check.' }, 500);
        }
    };
}
