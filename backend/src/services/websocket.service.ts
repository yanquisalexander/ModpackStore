import WebSocket from 'ws';
import { verify, JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { User } from '@/entities/User';
import url from 'url';

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
    private wss: WebSocket.Server | null = null;

    private constructor() {}

    public static getInstance(): WebSocketManager {
        if (!WebSocketManager.instance) {
            WebSocketManager.instance = new WebSocketManager();
        }
        return WebSocketManager.instance;
    }

    /**
     * Initialize WebSocket server
     */
    public initialize(server: any): void {
        this.wss = new WebSocket.Server({ 
            server,
            path: '/ws',
            verifyClient: this.verifyClient.bind(this)
        });

        this.wss.on('connection', this.handleConnection.bind(this));
        console.log('WebSocket server initialized on /ws');
    }

    /**
     * Verify client authentication before establishing WebSocket connection
     */
    private async verifyClient(info: any): Promise<boolean> {
        try {
            const token = this.extractToken(info.req);
            if (!token) {
                console.log('WebSocket connection rejected: No token provided');
                return false;
            }

            const payload = verify(token, JWT_SECRET) as { sub: string; iat: number; exp: number };
            const user = await User.findOne({ 
                where: { id: payload.sub }, 
                relations: ['publisherMemberships'] 
            });

            if (!user) {
                console.log('WebSocket connection rejected: User not found');
                return false;
            }

            // Store user info for later use in connection handler
            info.req.user = user;
            info.req.userId = payload.sub;
            return true;
        } catch (err) {
            console.log('WebSocket connection rejected: Auth error', err.message);
            return false;
        }
    }

    /**
     * Extract JWT token from request headers or query parameters
     */
    private extractToken(req: any): string | null {
        // Try Authorization header first
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }

        // Try query parameters
        const query = url.parse(req.url, true).query;
        if (query.token && typeof query.token === 'string') {
            return query.token;
        }

        return null;
    }

    /**
     * Handle new WebSocket connection
     */
    private handleConnection(ws: WebSocket, req: any): void {
        const user = req.user;
        const userId = req.userId;

        const authenticatedWs = ws as AuthenticatedWebSocket;
        authenticatedWs.userId = userId;
        authenticatedWs.user = user;

        const connectionInfo: ConnectionInfo = {
            ws: authenticatedWs,
            userId,
            user,
            connectedAt: new Date()
        };

        // Add to connections map
        if (!this.connections.has(userId)) {
            this.connections.set(userId, []);
        }
        this.connections.get(userId)!.push(connectionInfo);

        console.log(`WebSocket connection established for user: ${user.username} (${userId})`);

        // Send welcome message
        this.sendToConnection(connectionInfo, 'connected', {
            message: 'Successfully connected to WebSocket',
            timestamp: new Date().toISOString()
        });

        // Handle messages from client
        ws.on('message', (data: WebSocket.Data) => {
            this.handleMessage(connectionInfo, data);
        });

        // Handle connection close
        ws.on('close', () => {
            this.removeConnection(connectionInfo);
            console.log(`WebSocket connection closed for user: ${user.username} (${userId})`);
        });

        // Handle errors
        ws.on('error', (error) => {
            console.error(`WebSocket error for user ${user.username} (${userId}):`, error);
            this.removeConnection(connectionInfo);
        });
    }

    /**
     * Handle incoming messages from clients
     */
    private handleMessage(connection: ConnectionInfo, data: WebSocket.Data): void {
        try {
            const message = JSON.parse(data.toString());
            console.log(`Message received from ${connection.user.username}:`, message);

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
        if (connection.ws.readyState === WebSocket.OPEN) {
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
            if (connection.ws.readyState === WebSocket.OPEN) {
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
                if (connection.ws.readyState === WebSocket.OPEN) {
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
            if (connection.ws.readyState === WebSocket.OPEN) {
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
                if (connection.ws.readyState === WebSocket.OPEN) {
                    connection.ws.close();
                }
            });
        });
        this.connections.clear();
    }
}

// Export singleton instance
export const wsManager = WebSocketManager.getInstance();