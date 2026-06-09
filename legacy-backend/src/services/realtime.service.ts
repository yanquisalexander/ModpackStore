import { wsManager } from './websocket.service';

// --- Types for Modpack Processing Notifications ---
export interface ModpackProgressMessage {
    type: 'progress';
    modpackId: string;
    versionId: string;
    category?: string; // "mods", "resourcepacks", etc.
    message: string;
    percent?: number;
}

export interface ModpackCompletedMessage {
    type: 'completed';
    modpackId: string;
    versionId: string;
    message: string;
}

export interface ModpackErrorMessage {
    type: 'error';
    modpackId: string;
    versionId: string;
    message: string;
    details?: any;
}

export type ModpackProcessingMessage = ModpackProgressMessage | ModpackCompletedMessage | ModpackErrorMessage;

// --- Types for Social System Notifications ---
export interface FriendRequestMessage {
    type: 'friend_request_received' | 'friend_request_accepted' | 'friend_request_declined' | 'friendship_established' | 'friendship_removed' | 'user_blocked';
    friendshipId?: string;
    requester?: any;
    friend?: any;
    addressee?: any;
    blockerId?: string;
    removedByUserId?: string;
    removedFriendId?: string;
}

export interface GameInvitationMessage {
    type: 'game_invitation_received' | 'game_invitation_accepted' | 'game_invitation_declined' | 'game_invitation_cancelled' | 'launch_modpack';
    invitationId: string;
    sender?: any;
    receiver?: any;
    modpack?: {
        id: string;
        name: string;
        iconUrl?: string;
    };
    message?: string;
    expiresAt?: Date;
    modpackId?: string;
}

export interface ActivityMessage {
    type: 'activity_update' | 'user_status_update' | 'activity_visibility_changed';
    activity?: any;
    userStatus?: any;
    activityId?: string;
    isVisible?: boolean;
}

export type SocialMessage = FriendRequestMessage | GameInvitationMessage | ActivityMessage;

/**
 * Broadcast a message to all connected users or specific users
 * @param type - Message type
 * @param payload - Message payload
 * @param userIds - Optional array of user IDs to send to specific users. If not provided, broadcasts to all.
 * @returns Number of connections the message was sent to
 */
export function broadcast(type: string, payload: any, userIds?: string[]): number {
    return wsManager.broadcastToUsers(type, payload, userIds);
}

/**
 * Send a message to a specific user
 * @param userId - Target user ID
 * @param type - Message type
 * @param payload - Message payload
 * @returns True if message was sent, false if user is not connected
 */
export function sendToUser(userId: string, type: string, payload: any): boolean {
    return wsManager.sendToUser(userId, type, payload);
}

/**
 * Check if a user is currently connected
 * @param userId - User ID to check
 * @returns True if user has active connections
 */
export function isUserConnected(userId: string): boolean {
    return wsManager.isUserConnected(userId);
}

/**
 * Get WebSocket connection statistics
 * @returns Object with connection stats
 */
export function getConnectionStats(): { totalConnections: number; totalUsers: number; users: string[] } {
    return wsManager.getStats();
}

/**
 * Disconnect all connections for a specific user
 * @param userId - User ID to disconnect
 * @returns True if user had connections that were disconnected
 */
export function disconnectUser(userId: string): boolean {
    return wsManager.disconnectUser(userId);
}

/**
 * Send a modpack processing progress update to all connected users
 * @param modpackId - Modpack ID being processed
 * @param versionId - Version ID being processed
 * @param message - Progress message
 * @param options - Additional options (category, percent, userIds)
 * @returns Number of connections the message was sent to
 */
export function sendProgressUpdate(
    modpackId: string, 
    versionId: string, 
    message: string, 
    options: {
        category?: string;
        percent?: number;
        userIds?: string[];
    } = {}
): number {
    const payload: ModpackProgressMessage = {
        type: 'progress',
        modpackId,
        versionId,
        message,
        ...(options.category && { category: options.category }),
        ...(options.percent !== undefined && { percent: options.percent })
    };

    return broadcast('modpack_processing', payload, options.userIds);
}

/**
 * Send a modpack processing completion notification
 * @param modpackId - Modpack ID that was processed
 * @param versionId - Version ID that was processed
 * @param message - Completion message
 * @param userIds - Optional array of user IDs to send to specific users
 * @returns Number of connections the message was sent to
 */
export function sendCompletionUpdate(
    modpackId: string,
    versionId: string,
    message: string,
    userIds?: string[]
): number {
    const payload: ModpackCompletedMessage = {
        type: 'completed',
        modpackId,
        versionId,
        message
    };

    return broadcast('modpack_processing', payload, userIds);
}

/**
 * Send a modpack processing error notification
 * @param modpackId - Modpack ID that failed processing
 * @param versionId - Version ID that failed processing
 * @param message - Error message
 * @param details - Optional error details
 * @param userIds - Optional array of user IDs to send to specific users
 * @returns Number of connections the message was sent to
 */
export function sendErrorUpdate(
    modpackId: string,
    versionId: string,
    message: string,
    details?: any,
    userIds?: string[]
): number {
    const payload: ModpackErrorMessage = {
        type: 'error',
        modpackId,
        versionId,
        message,
        ...(details && { details })
    };

    return broadcast('modpack_processing', payload, userIds);
}

// Re-export the manager for advanced usage
export { wsManager } from './websocket.service';