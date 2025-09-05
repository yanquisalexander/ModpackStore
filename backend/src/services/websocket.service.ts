import { Hono } from 'hono';
import { verify } from 'jsonwebtoken';
import { User } from '@/entities/User';

// --- Startup Configuration ---
if (!process.env.JWT_SECRET) {
    throw new Error('FATAL_ERROR: JWT_SECRET environment variable is not set.');
}
const JWT_SECRET = process.env.JWT_SECRET;

// --- Types ---
export interface WebSocketMessage {
    type: string;
    payload: any;
}

export interface AuthenticatedWebSocket extends WebSocket {
    userId: string;
    user: User;
}

export interface ConnectionInfo {
    ws: AuthenticatedWebSocket;
    userId: string;
    user: User;
    connectedAt: Date;
}

// --- WebSocket Manager Class ---
export class WebSocketManager {
    private static instance: WebSocketManager;
    private connections: Map<string, ConnectionInfo[]> = new Map(); // userId -> connections
    private honoApp: Hono | null = null;

    private constructor() { }

    public static getInstance(): WebSocketManager {
        if (!WebSocketManager.instance) {
            WebSocketManager.instance = new WebSocketManager();
        }
        return WebSocketManager.instance;
    }

    /**
     * Initialize WebSocket with Hono app
     */
    public initialize(app: Hono): void {
        this.honoApp = app;

        // WebSocket route with authentication
        app.get('/ws', async (c) => {
            try {
                // Extract and verify JWT token
                const token = this.extractToken(c.req);
                if (!token) {
                    console.log('WebSocket connection rejected: No token provided');
                    return c.json({ error: 'No token provided' }, 401);
                }

                const payload = verify(token, JWT_SECRET) as { sub: string; iat: number; exp: number };
                const user = await User.findOne({
                    where: { id: payload.sub },
                    relations: ['publisherMemberships']
                });

                if (!user) {
                    console.log('WebSocket connection rejected: User not found');
                    return c.json({ error: 'User not found' }, 401);
                }

                // Upgrade to WebSocket using Hono's built-in WebSocket support
                return c.json({ message: 'WebSocket upgrade initiated' });
            } catch (err: any) {
                console.log('WebSocket connection rejected: Auth error', err?.message);
                return c.json({ error: 'Authentication failed' }, 401);
            }
        });

        console.log('WebSocket server initialized on /ws');
    }

    /**
     * Find connection by WebSocket instance
     */
    private findConnectionByWebSocket(ws: WebSocket): ConnectionInfo | null {
        for (const userConnections of this.connections.values()) {
            for (const connection of userConnections) {
                if (connection.ws === ws) {
                    return connection;
                }
            }
        }
        return null;
    }

    /**
     * Extract JWT token from Hono request headers or query parameters
     */
    private extractToken(req: any): string | null {
        // Try Authorization header first
        const authHeader = req.header('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }

        // Try query parameters
        const url = new URL(req.url);
        const token = url.searchParams.get('token');
        if (token) {
            return token;
        }

        return null;
    }

    /**
     * Handle incoming messages from clients
     */
    private handleMessage(connection: ConnectionInfo, data: string): void {
        try {
            const message = JSON.parse(data);
            console.log(`Message received from ${connection.user?.username}:`, message);

            // Echo the message back for now (can be extended with specific handlers)
            this.sendToConnection(connection, 'echo', {
                originalMessage: message,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
            this.sendToConnection(connection, 'error', {
                message: 'Invalid JSON message format',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Remove connection from the connections map
     */
    private removeConnection(connection: ConnectionInfo): void {
        const userConnections = this.connections.get(connection.userId);
        if (userConnections) {
            const index = userConnections.indexOf(connection);
            if (index !== -1) {
                userConnections.splice(index, 1);
            }

            // Remove user entry if no connections left
            if (userConnections.length === 0) {
                this.connections.delete(connection.userId);
            }
        }
    }

    /**
     * Send message to a specific connection
     */
    private sendToConnection(connection: ConnectionInfo, type: string, payload: any): void {
        if (connection.ws.readyState === 1) { // OPEN state
            const message: WebSocketMessage = { type, payload };
            connection.ws.send(JSON.stringify(message));
        }
    }

    /**
     * Send message to specific user (all their connections)
     */
    public sendToUser(userId: string, type: string, payload: any): boolean {
        const userConnections = this.connections.get(userId);
        if (!userConnections || userConnections.length === 0) {
            return false;
        }

        const message: WebSocketMessage = { type, payload };
        const messageStr = JSON.stringify(message);

        userConnections.forEach(connection => {
            if (connection.ws.readyState === 1) { // OPEN state
                connection.ws.send(messageStr);
            }
        });

        return true;
    }

    /**
     * Send message to multiple users
     */
    public sendToUsers(userIds: string[], type: string, payload: any): number {
        let sentCount = 0;
        userIds.forEach(userId => {
            if (this.sendToUser(userId, type, payload)) {
                sentCount++;
            }
        });
        return sentCount;
    }

    /**
     * Broadcast message to all connected users
     */
    public broadcast(type: string, payload: any, excludeUserIds?: string[]): number {
        const message: WebSocketMessage = { type, payload };
        const messageStr = JSON.stringify(message);
        let sentCount = 0;

        this.connections.forEach((userConnections, userId) => {
            if (excludeUserIds && excludeUserIds.includes(userId)) {
                return;
            }

            userConnections.forEach(connection => {
                if (connection.ws.readyState === 1) { // OPEN state
                    connection.ws.send(messageStr);
                    sentCount++;
                }
            });
        });

        return sentCount;
    }

    /**
     * Broadcast message with optional user filtering
     */
    public broadcastToUsers(type: string, payload: any, userIds?: string[]): number {
        if (userIds && userIds.length > 0) {
            return this.sendToUsers(userIds, type, payload);
        } else {
            return this.broadcast(type, payload);
        }
    }

    /**
     * Get connection statistics
     */
    public getStats(): { totalConnections: number; totalUsers: number; users: string[] } {
        let totalConnections = 0;
        const users: string[] = [];

        this.connections.forEach((userConnections, userId) => {
            totalConnections += userConnections.length;
            users.push(userId);
        });

        return {
            totalConnections,
            totalUsers: users.length,
            users
        };
    }

    /**
     * Check if user is connected
     */
    public isUserConnected(userId: string): boolean {
        const userConnections = this.connections.get(userId);
        return !!(userConnections && userConnections.length > 0);
    }

    /**
     * Get user connections count
     */
    public getUserConnectionCount(userId: string): number {
        const userConnections = this.connections.get(userId);
        return userConnections ? userConnections.length : 0;
    }

    /**
     * Close all connections for a user
     */
    public disconnectUser(userId: string): boolean {
        const userConnections = this.connections.get(userId);
        if (!userConnections) {
            return false;
        }

        userConnections.forEach(connection => {
            if (connection.ws.readyState === 1) { // OPEN state
                connection.ws.close();
            }
        });

        this.connections.delete(userId);
        return true;
    }

    /**
     * Close all connections
     */
    public disconnectAll(): void {
        this.connections.forEach((userConnections) => {
            userConnections.forEach(connection => {
                if (connection.ws.readyState === 1) { // OPEN state
                    connection.ws.close();
                }
            });
        });
        this.connections.clear();
    }
}

// Export singleton instance
export const wsManager = WebSocketManager.getInstance();