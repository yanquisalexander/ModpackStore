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
        let publisherIdToCheck: string | undefined = req.body.publisherId;
        const modpackId = req.params.modpackId;

        try {
            // If modpackId is present, derive publisherId from it
            if (modpackId) {
                const modpack = await db.query.ModpacksTable.findFirst({
                    where: eq(ModpacksTable.id, modpackId),
                    columns: { publisherId: true }
                });
                if (!modpack) {
                    return res.status(404).json({ message: 'Modpack not found.' });
                }
                publisherIdToCheck = modpack.publisherId;
            }

            if (!publisherIdToCheck) {
                return res.status(400).json({ message: 'Publisher ID or Modpack ID must be provided.' });
            }

            // Find the user's membership in the publisher
            const publisherMember = await db.query.PublisherMembersTable.findFirst({
                where: and(
                    eq(PublisherMembersTable.userId, userId),
                    eq(PublisherMembersTable.publisherId, publisherIdToCheck)
                ),
                columns: { id: true }
            });

            if (!publisherMember) {
                return res.status(403).json({ message: 'Forbidden: User is not a member of this publisher.' });
            }

            // Check scopes for the publisher member
            // Scopes can be general (publisherId set, modpackId null) or modpack-specific
            const userScopes = await db.query.ScopesTable.findMany({
                where: and(
                    eq(ScopesTable.publisherMemberId, publisherMember.id),
                    or(
                        eq(ScopesTable.publisherId, publisherIdToCheck), // Org-level scope
                        modpackId ? eq(ScopesTable.modpackId, modpackId) : undefined // Modpack-level scope (if modpackId exists)
                    )
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
