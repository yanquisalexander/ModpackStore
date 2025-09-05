import { wsManager } from './websocket.service';

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

// Re-export the manager for advanced usage
export { wsManager } from './websocket.service';