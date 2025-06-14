import { Request, Response, NextFunction } from 'express';
import { client as db } from '@/db/client';
import { ModpacksTable, PublisherMembersTable, ScopesTable, UsersTable } from '@/db/schema';
import { eq, and, or, inArray } from 'drizzle-orm';

// Define a type for the user object attached to the request
interface AuthenticatedUser {
    id: string; // Assuming user ID is a string (UUID)
    // Add other properties if present in your req.user
}

// Extend Express Request type
interface AuthorizedRequest extends Request {
    user?: AuthenticatedUser;
    params: {
        modpackId?: string;
        versionId?: string;
        // other params
    };
    body: {
        publisherId?: string; // For creating modpacks under a specific publisher
        // other body props
    };
}

type Permission =
    | 'canCreateModpacks'
    | 'canEditModpacks'
    | 'canDeleteModpacks'
    | 'canPublishVersions'
    | 'canManageMembers'
    | 'canManageSettings';

export const checkModpackPermission = (requiredPermissions: Permission[]) => {
    return async (req: AuthorizedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized: No user session found.' });
        }

        const userId = req.user.id;
        let publisherContextId: string | undefined = req.body.publisherId; // For actions like 'createModpack' under a publisher
        const modpackIdFromParams = req.params.modpackId; // For actions on an existing modpack

        try {
            // Step 1: Determine the relevant Publisher ID for permission checking.
            // If a modpackId is provided in the URL params, its publisher is the context.
            // Otherwise, a publisherId might be in the request body (e.g., for creating a new modpack).
            if (modpackIdFromParams) {
                const modpack = await db.query.ModpacksTable.findFirst({
                    where: eq(ModpacksTable.id, modpackIdFromParams),
                    columns: { publisherId: true }
                });
                if (!modpack) {
                    return res.status(404).json({ message: 'Modpack not found.' });
                }
                publisherContextId = modpack.publisherId;
            }

            // If no publisherId could be determined (neither from modpack nor from body), it's a bad request.
            if (!publisherContextId) {
                return res.status(400).json({ message: 'A valid Publisher ID or Modpack ID must be provided to check permissions.' });
            }

            // Step 2: Check if the user is a member of the determined publisher.
            const publisherMember = await db.query.PublisherMembersTable.findFirst({
                where: and(
                    eq(PublisherMembersTable.userId, userId),
                    eq(PublisherMembersTable.publisherId, publisherContextId)
                ),
                columns: { id: true } // We only need the membership ID for scope checking.
            });

            if (!publisherMember) {
                return res.status(403).json({ message: 'Forbidden: You are not a member of this publisher.' });
            }

            // Step 3: Fetch relevant scopes for the user within this publisher context.
            // Scopes can be organization-wide (publisherId set, modpackId null)
            // or modpack-specific (modpackId set).
            const scopeOrConditions = [eq(ScopesTable.publisherId, publisherContextId)];
            if (modpackIdFromParams) {
                // If checking permissions for a specific modpack, include its specific scopes.
                scopeOrConditions.push(eq(ScopesTable.modpackId, modpackIdFromParams));
            }

            const userScopes = await db.query.ScopesTable.findMany({
                where: and(
                    eq(ScopesTable.publisherMemberId, publisherMember.id),
                    or(...scopeOrConditions)
                )
            });

            if (!userScopes || userScopes.length === 0) {
                return res.status(403).json({ message: 'Forbidden: No permissions found for this user.' });
            }

            // Check if any of the found scopes satisfy at least one of the required permissions
            const hasPermission = userScopes.some(scope =>
                requiredPermissions.some(requiredPerm => scope[requiredPerm] === true)
            );

            if (!hasPermission) {
                return res.status(403).json({
                    message: `Forbidden: User does not have the required permissions (${requiredPermissions.join(', ')}).`
                });
            }

            next();
        } catch (error) {
            console.error('Error in checkModpackPermission middleware:', error);
            return res.status(500).json({ message: 'Internal server error during permission check.' });
        }
    };
};
