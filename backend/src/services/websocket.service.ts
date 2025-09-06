import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { logger } from 'hono/logger';
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

export interface AuthenticatedWebSocket {
    userId: string;
    user: User;
    send: (data: string) => void;
    close: () => void;
    readyState: number;
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
    public initialize(app: Hono, upgradeWebSocket: any): void {
        this.honoApp = app;

        // Add logger middleware
        app.use(logger());

        // Middleware to handle token from query parameters
        app.use('/ws', async (c, next) => {
            const url = new URL(c.req.url);
            const token = url.searchParams.get('token');
            if (token && !c.req.header('authorization')) {
                c.req.raw.headers.set('authorization', `Bearer ${token}`);
            }
            await next();
        });

        // JWT middleware for /ws route
        app.use('/ws', jwt({ secret: JWT_SECRET }));

        // WebSocket route with upgradeWebSocket helper
        app.get('/ws', upgradeWebSocket(async (c: any) => {
            try {
                const payload = c.get('jwtPayload') as { sub: string; iat: number; exp: number };
                const user = await User.findOne({
                    where: { id: payload.sub },
                    relations: ['publisherMemberships']
                });

                if (!user) {
                    console.log('WebSocket connection rejected: User not found');
                    return {
                        onOpen: (_event: any, ws: any) => {
                            ws.close();
                        }
                    };
                }

                return {
                    onOpen: (_event: any, ws: any) => {
                        console.log(`WebSocket connection established for user: ${user.username}`);

                        // Attach user info to ws
                        (ws as any).userId = user.id;
                        (ws as any).user = user;

                        // Create connection info
                        const connection: ConnectionInfo = {
                            ws: ws as any,
                            userId: user.id,
                            user: user,
                            connectedAt: new Date()
                        };

                        // Store connection
                        if (!this.connections.has(user.id)) {
                            this.connections.set(user.id, []);
                        }
                        this.connections.get(user.id)!.push(connection);
                    },
                    onMessage: (event: any, ws: any) => {
                        const connection = this.findConnectionByWebSocket(ws);
                        if (connection) {
                            this.handleMessage(connection, event.data.toString());
                        }
                    },
                    onClose: (_event: any, ws: any) => {
                        console.log(`WebSocket connection closed for user: ${(ws as any).user?.username}`);
                        const connection = this.findConnectionByWebSocket(ws);
                        if (connection) {
                            this.removeConnection(connection);
                        }
                    },
                    onError: (event: any, ws: any) => {
                        console.error(`WebSocket error for user: ${(ws as any).user?.username}`, event);
                        const connection = this.findConnectionByWebSocket(ws);
                        if (connection) {
                            this.removeConnection(connection);
                        }
                    }
                };
            } catch (err: any) {
                console.log('WebSocket connection rejected: Auth error', err?.message);
                return {
                    onOpen: (_event: any, ws: any) => {
                        ws.close();
                    }
                };
            }
        }));

        console.log('WebSocket server initialized on /ws');
    }

    /**
     * Find connection by WebSocket instance
     */
    private findConnectionByWebSocket(ws: any): ConnectionInfo | null {
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
     * Handle incoming messages from clients
     */
    private handleMessage(connection: ConnectionInfo, data: string): void {
        try {
            const message = JSON.parse(data);
            console.log(`Message received from ${connection.user?.username}:`, message);

            // Handle different message types
            switch (message.type) {
                case 'user_typing':
                    this.handleUserTyping(connection, message.payload);
                    break;
                case 'ping':
                    this.sendToConnection(connection, 'pong', {
                        timestamp: new Date().toISOString()
                    });
                    break;
                default:
                    // Echo the message back for now (can be extended with specific handlers)
                    this.sendToConnection(connection, 'echo', {
                        originalMessage: message,
                        timestamp: new Date().toISOString()
                    });
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
            this.sendToConnection(connection, 'error', {
                message: 'Invalid JSON message format',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Handle user typing notification for tickets
     */
    private handleUserTyping(connection: ConnectionInfo, payload: any): void {
        const { ticketId } = payload;
        if (!ticketId) return;

        // Forward typing notification to relevant users
        // For now, broadcast to all staff - could be optimized to only staff viewing the ticket
        if (connection.user.isStaff()) {
            // Staff is typing - notify ticket owner
            // We'd need to look up ticket owner from the database
            // For simplicity, this could be enhanced with ticket caching
        } else {
            // User is typing - notify all staff
            this.broadcastToStaff('user_typing', {
                ticketId,
                userId: connection.userId,
                username: connection.user.username,
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
     * Broadcast message to all connected staff members (admin, superadmin, support)
     */
    public broadcastToStaff(type: string, payload: any): number {
        const message: WebSocketMessage = { type, payload };
        const messageStr = JSON.stringify(message);
        let sentCount = 0;

        this.connections.forEach((userConnections) => {
            userConnections.forEach(connection => {
                // Check if user is staff
                if (connection.user && connection.user.isStaff() && connection.ws.readyState === 1) {
                    connection.ws.send(messageStr);
                    sentCount++;
                }
            });
        });

        return sentCount;
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