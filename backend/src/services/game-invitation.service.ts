import { GameInvitation } from "@/entities/GameInvitation";
import { User } from "@/entities/User";
import { Modpack } from "@/entities/Modpack";
import { Friendship } from "@/entities/Friendship";
import { InvitationStatus, FriendshipStatus } from "@/types/enums";
import { sendToUser } from "./realtime.service";

export class GameInvitationService {
    /**
     * Send a game invitation to a friend
     */
    static async sendGameInvitation(
        senderId: string,
        receiverId: string,
        modpackId: string,
        message?: string
    ): Promise<GameInvitation> {
        // Verify users exist
        const sender = await User.findOne({ where: { id: senderId } });
        const receiver = await User.findOne({ where: { id: receiverId } });
        const modpack = await Modpack.findOne({ where: { id: modpackId } });

        if (!sender || !receiver || !modpack) {
            throw new Error("Sender, receiver, or modpack not found");
        }

        // Check if users are friends
        const areFriends = await Friendship.areFriends(senderId, receiverId);
        if (!areFriends) {
            throw new Error("Can only send game invitations to friends");
        }

        // Check for existing pending invitation
        const existingInvitation = await GameInvitation.findOne({
            where: {
                senderId,
                receiverId,
                modpackId,
                status: InvitationStatus.PENDING
            }
        });

        if (existingInvitation && !existingInvitation.isExpired()) {
            throw new Error("Invitation already sent and pending");
        }

        // Create invitation (expires in 10 minutes)
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10);

        const invitation = GameInvitation.create({
            senderId,
            receiverId,
            modpackId,
            message,
            expiresAt,
            status: InvitationStatus.PENDING
        });

        await invitation.save();

        // Send real-time notification
        sendToUser(receiverId, 'game_invitation_received', {
            invitationId: invitation.id,
            sender: sender.toPublicJson(),
            modpack: {
                id: modpack.id,
                name: modpack.name,
                iconUrl: modpack.iconUrl
            },
            message,
            expiresAt
        });

        return invitation;
    }

    /**
     * Accept a game invitation
     */
    static async acceptGameInvitation(invitationId: string, userId: string): Promise<GameInvitation> {
        const invitation = await GameInvitation.findOne({
            where: { id: invitationId },
            relations: ["sender", "receiver", "modpack"]
        });

        if (!invitation) {
            throw new Error("Invitation not found");
        }

        if (invitation.receiverId !== userId) {
            throw new Error("Only the receiver can accept this invitation");
        }

        if (invitation.status !== InvitationStatus.PENDING) {
            throw new Error("Invitation is not pending");
        }

        if (invitation.isExpired()) {
            invitation.status = InvitationStatus.EXPIRED;
            await invitation.save();
            throw new Error("Invitation has expired");
        }

        invitation.status = InvitationStatus.ACCEPTED;
        await invitation.save();

        // Notify sender
        sendToUser(invitation.senderId, 'game_invitation_accepted', {
            invitationId: invitation.id,
            receiver: invitation.receiver ? invitation.receiver.toPublicJson() : null,
            modpack: invitation.modpack ? {
                id: invitation.modpack.id,
                name: invitation.modpack.name
            } : null
        });

        // Send launch instruction to receiver
        sendToUser(invitation.receiverId, 'launch_modpack', {
            modpackId: invitation.modpack?.id,
            invitationId: invitation.id
        });

        return invitation;
    }

    /**
     * Decline a game invitation
     */
    static async declineGameInvitation(invitationId: string, userId: string): Promise<void> {
        const invitation = await GameInvitation.findOne({
            where: { id: invitationId },
            relations: ["sender", "receiver"]
        });

        if (!invitation) {
            throw new Error("Invitation not found");
        }

        if (invitation.receiverId !== userId) {
            throw new Error("Only the receiver can decline this invitation");
        }

        if (invitation.status !== InvitationStatus.PENDING) {
            throw new Error("Invitation is not pending");
        }

        invitation.status = InvitationStatus.DECLINED;
        await invitation.save();

        // Notify sender
        sendToUser(invitation.senderId, 'game_invitation_declined', {
            invitationId: invitation.id,
            receiver: invitation.receiver.toPublicJson()
        });
    }

    /**
     * Get pending invitations for a user
     */
    static async getPendingInvitations(userId: string): Promise<GameInvitation[]> {
        return await GameInvitation.createQueryBuilder("invitation")
            .leftJoinAndSelect("invitation.sender", "sender")
            .leftJoinAndSelect("invitation.modpack", "modpack")
            .where("invitation.receiverId = :userId", { userId })
            .andWhere("invitation.status = :status", { status: InvitationStatus.PENDING })
            .orderBy("invitation.createdAt", "DESC")
            .getMany();
    }

    /**
     * Get sent invitations by a user
     */
    static async getSentInvitations(userId: string): Promise<GameInvitation[]> {
        return await GameInvitation.createQueryBuilder("invitation")
            .leftJoinAndSelect("invitation.receiver", "receiver")
            .leftJoinAndSelect("invitation.modpack", "modpack")
            .where("invitation.senderId = :userId", { userId })
            .orderBy("invitation.createdAt", "DESC")
            .getMany();
    }

    /**
     * Cancel a sent invitation
     */
    static async cancelInvitation(invitationId: string, userId: string): Promise<void> {
        const invitation = await GameInvitation.findOne({
            where: { id: invitationId },
            relations: ["receiver"]
        });

        if (!invitation) {
            throw new Error("Invitation not found");
        }

        if (invitation.senderId !== userId) {
            throw new Error("Only the sender can cancel this invitation");
        }

        if (invitation.status !== InvitationStatus.PENDING) {
            throw new Error("Can only cancel pending invitations");
        }

        await invitation.remove();

        // Notify receiver
        sendToUser(invitation.receiverId, 'game_invitation_cancelled', {
            invitationId: invitation.id
        });
    }

    /**
     * Check if user has the modpack installed (this would integrate with launcher)
     * For now, we'll just check if they have acquired it
     */
    static async checkModpackStatus(userId: string, modpackId: string): Promise<{
        hasModpack: boolean;
        isInstalled: boolean;
        isRunning: boolean;
    }> {
        // This would need to integrate with the launcher/installation system
        // For now, return mock data
        return {
            hasModpack: true, // Check ModpackAcquisition table
            isInstalled: true, // Check local installation status
            isRunning: false // Check if currently running
        };
    }

    /**
     * Handle invitation response based on modpack status
     */
    static async handleInvitationResponse(
        invitationId: string,
        userId: string,
        action: 'accept' | 'decline'
    ): Promise<{
        invitation: GameInvitation;
        nextAction?: 'launch' | 'install' | 'download';
    }> {
        if (action === 'decline') {
            await this.declineGameInvitation(invitationId, userId);
            const invitation = await GameInvitation.findOne({ where: { id: invitationId } });
            return { invitation: invitation! };
        }

        const invitation = await this.acceptGameInvitation(invitationId, userId);
        const modpackStatus = await this.checkModpackStatus(userId, invitation.modpackId);

        let nextAction: 'launch' | 'install' | 'download' | undefined;

        if (!modpackStatus.hasModpack) {
            nextAction = 'download';
        } else if (!modpackStatus.isInstalled) {
            nextAction = 'install';
        } else {
            nextAction = 'launch';
        }

        return {
            invitation,
            nextAction
        };
    }

    /**
     * Cleanup expired invitations (to be called periodically)
     */
    static async cleanupExpiredInvitations(): Promise<number> {
        await GameInvitation.markExpiredInvitations();

        const expiredInvitations = await GameInvitation.find({
            where: { status: InvitationStatus.EXPIRED }
        });

        if (expiredInvitations.length > 0) {
            await GameInvitation.remove(expiredInvitations);
        }

        return expiredInvitations.length;
    }
}