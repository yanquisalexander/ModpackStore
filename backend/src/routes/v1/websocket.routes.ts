import { Hono } from 'hono';
import { requireAuth, AuthVariables } from '../../middlewares/auth.middleware';
import { wsManager } from '../../services/websocket.service';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const websocketRoutes = new Hono<{ Variables: AuthVariables }>();

// Apply authentication middleware to all websocket routes
websocketRoutes.use('*', requireAuth);

// Schema for broadcast message
const broadcastSchema = z.object({
  type: z.string().min(1, 'Message type is required'),
  payload: z.any(),
  userIds: z.array(z.string()).optional().default([])
});

/**
 * POST /websocket/broadcast - Broadcast message to users
 */
websocketRoutes.post('/broadcast', zValidator('json', broadcastSchema), async (c) => {
  const { type, payload, userIds } = c.req.valid('json');
  
  let sentCount: number;
  
  if (userIds && userIds.length > 0) {
    // Send to specific users
    sentCount = wsManager.sendToUsers(userIds, type, payload);
  } else {
    // Broadcast to all users
    sentCount = wsManager.broadcast(type, payload);
  }
  
  return c.json({
    message: 'Message broadcasted successfully',
    sentToConnections: sentCount,
    targetUsers: userIds.length > 0 ? userIds.length : 'all',
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /websocket/send/:userId - Send message to specific user
 */
websocketRoutes.post('/send/:userId', zValidator('json', z.object({
  type: z.string().min(1, 'Message type is required'),
  payload: z.any()
})), async (c) => {
  const userId = c.req.param('userId');
  const { type, payload } = c.req.valid('json');
  
  const sent = wsManager.sendToUser(userId, type, payload);
  
  if (sent) {
    return c.json({
      message: `Message sent to user ${userId}`,
      timestamp: new Date().toISOString()
    });
  } else {
    return c.json({
      error: `User ${userId} is not connected`,
      timestamp: new Date().toISOString()
    }, 404);
  }
});

/**
 * GET /websocket/stats - Get WebSocket connection statistics
 */
websocketRoutes.get('/stats', async (c) => {
  const stats = wsManager.getStats();
  
  return c.json({
    ...stats,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /websocket/user/:userId/status - Check if user is connected
 */
websocketRoutes.get('/user/:userId/status', async (c) => {
  const userId = c.req.param('userId');
  const isConnected = wsManager.isUserConnected(userId);
  const connectionCount = wsManager.getUserConnectionCount(userId);
  
  return c.json({
    userId,
    isConnected,
    connectionCount,
    timestamp: new Date().toISOString()
  });
});

/**
 * DELETE /websocket/user/:userId/disconnect - Disconnect all connections for a user
 */
websocketRoutes.delete('/user/:userId/disconnect', async (c) => {
  const userId = c.req.param('userId');
  const disconnected = wsManager.disconnectUser(userId);
  
  if (disconnected) {
    return c.json({
      message: `All connections for user ${userId} have been disconnected`,
      timestamp: new Date().toISOString()
    });
  } else {
    return c.json({
      error: `User ${userId} has no active connections`,
      timestamp: new Date().toISOString()
    }, 404);
  }
});

/**
 * POST /websocket/test/notification - Test broadcast notification
 */
websocketRoutes.post('/test/notification', async (c) => {
  const user = c.get('user');
  
  const testMessage = {
    title: 'Test Notification',
    message: `Test message sent by ${user.username} at ${new Date().toLocaleString()}`,
    sender: user.username,
    senderId: user.id
  };
  
  const sentCount = wsManager.broadcast('notification', testMessage);
  
  return c.json({
    message: 'Test notification sent',
    sentToConnections: sentCount,
    notification: testMessage,
    timestamp: new Date().toISOString()
  });
});

export default websocketRoutes;