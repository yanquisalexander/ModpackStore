import { Context } from 'hono';
import { GameInvitationService } from '@/services/game-invitation.service';
import { APIError } from '@/lib/APIError';
import { AuthVariables } from "@/middlewares/auth.middleware";

type GameInvitationPayload = {
    receiverId: string;
    modpackId: string;
    message?: string;
};

type InvitationActionPayload = {
    invitationId: string;
    action: 'accept' | 'decline';
};

export class GameInvitationController {
    /**
     * Send a game invitation
     */
    static async sendInvitation(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');
        const body = await c.req.json() as GameInvitationPayload;

        if (!body.receiverId || !body.modpackId) {
            throw new APIError(400, 'Receiver ID and Modpack ID are required', 'MISSING_REQUIRED_FIELDS');
        }

        const invitation = await GameInvitationService.sendGameInvitation(
            userId,
            body.receiverId,
            body.modpackId,
            body.message
        );

        return c.json({
            success: true,
            data: {
                invitationId: invitation.id,
                message: 'Game invitation sent successfully',
                expiresAt: invitation.expiresAt
            }
        });
    }

    /**
     * Respond to a game invitation
     */
    static async respondToInvitation(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');
        const body = await c.req.json() as InvitationActionPayload;

        if (!body.invitationId || !body.action) {
            throw new APIError(400, 'Invitation ID and action are required', 'MISSING_REQUIRED_FIELDS');
        }

        if (!['accept', 'decline'].includes(body.action)) {
            throw new APIError(400, 'Action must be "accept" or "decline"', 'INVALID_ACTION');
        }

        const result = await GameInvitationService.handleInvitationResponse(
            body.invitationId,
            userId,
            body.action
        );

        return c.json({
            success: true,
            data: {
                invitation: {
                    id: result.invitation.id,
                    status: result.invitation.status
                },
                nextAction: result.nextAction,
                message: body.action === 'accept'
                    ? 'Invitation accepted successfully'
                    : 'Invitation declined'
            }
        });
    }

    /**
     * Get pending invitations for the current user
     */
    static async getPendingInvitations(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');

        const invitations = await GameInvitationService.getPendingInvitations(userId);

        return c.json({
            success: true,
            data: {
                invitations: invitations.map(inv => ({
                    id: inv.id,
                    sender: inv.sender ? inv.sender.toPublicJson() : null,
                    modpack: inv.modpack ? {
                        id: inv.modpack.id,
                        name: inv.modpack.name,
                        iconUrl: inv.modpack.iconUrl
                    } : null,
                    message: inv.message,
                    createdAt: inv.createdAt,
                    expiresAt: inv.expiresAt
                }))
            }
        });
    }

    /**
     * Get sent invitations by the current user
     */
    static async getSentInvitations(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');

        const invitations = await GameInvitationService.getSentInvitations(userId);

        return c.json({
            success: true,
            data: {
                invitations: invitations.map(inv => ({
                    id: inv.id,
                    receiver: inv.receiver ? inv.receiver.toPublicJson() : null,
                    modpack: inv.modpack ? {
                        id: inv.modpack.id,
                        name: inv.modpack.name,
                        iconUrl: inv.modpack.iconUrl
                    } : null,
                    message: inv.message,
                    status: inv.status,
                    createdAt: inv.createdAt,
                    expiresAt: inv.expiresAt
                }))
            }
        });
    }

    /**
     * Cancel a sent invitation
     */
    static async cancelInvitation(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');
        const invitationId = c.req.param('invitationId');

        if (!invitationId) {
            throw new APIError(400, 'Invitation ID is required', 'MISSING_INVITATION_ID');
        }

        await GameInvitationService.cancelInvitation(invitationId, userId);

        return c.json({
            success: true,
            data: {
                message: 'Invitation cancelled successfully'
            }
        });
    }

    /**
     * Check modpack status for invitation handling
     */
    static async checkModpackStatus(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');
        const modpackId = c.req.param('modpackId');

        if (!modpackId) {
            throw new APIError(400, 'Modpack ID is required', 'MISSING_MODPACK_ID');
        }

        const status = await GameInvitationService.checkModpackStatus(userId, modpackId);

        return c.json({
            success: true,
            data: status
        });
    }

    /**
     * Get invitation statistics for admin/analytics
     */
    static async getInvitationStats(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');

        // This could be enhanced with more detailed analytics
        const [pendingInvitations, sentInvitations] = await Promise.all([
            GameInvitationService.getPendingInvitations(userId),
            GameInvitationService.getSentInvitations(userId)
        ]);

        const stats = {
            totalPending: pendingInvitations.length,
            totalSent: sentInvitations.length,
            recentActivity: {
                pending: pendingInvitations.slice(0, 5).map(inv => ({
                    id: inv.id,
                    sender: inv.sender.username,
                    modpack: inv.modpack.name,
                    createdAt: inv.createdAt
                })),
                sent: sentInvitations.slice(0, 5).map(inv => ({
                    id: inv.id,
                    receiver: inv.receiver.username,
                    modpack: inv.modpack.name,
                    status: inv.status,
                    createdAt: inv.createdAt
                }))
            }
        };

        return c.json({
            success: true,
            data: stats
        });
    }

    /**
     * Cleanup expired invitations (maintenance endpoint)
     */
    static async cleanupExpiredInvitations(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        // This could be restricted to admin users
        const cleanedCount = await GameInvitationService.cleanupExpiredInvitations();

        return c.json({
            success: true,
            data: {
                message: `Cleaned up ${cleanedCount} expired invitations`,
                cleanedCount
            }
        });
    }
}