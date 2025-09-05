# WebSocket Authentication Implementation

This implementation provides authenticated WebSocket support for the ModpackStore application with both backend and frontend components.

## Backend Features

### WebSocket Service (`/backend/src/services/websocket.service.ts`)
- Authenticated WebSocket connections using JWT tokens
- Token validation from headers (`Authorization: Bearer <token>`) or query parameters (`?token=<token>`)
- Connection management with user association
- Message broadcasting to specific users or all users
- Connection statistics and monitoring

### WebSocket Routes (`/backend/src/routes/v1/websocket.routes.ts`)
- `POST /v1/websocket/broadcast` - Broadcast messages to all or specific users
- `POST /v1/websocket/send/:userId` - Send message to specific user
- `GET /v1/websocket/stats` - Get connection statistics
- `GET /v1/websocket/user/:userId/status` - Check user connection status
- `DELETE /v1/websocket/user/:userId/disconnect` - Disconnect user

### Realtime Service (`/backend/src/services/realtime.service.ts`)
Helper functions for easy broadcasting:
- `broadcast(type, payload, userIds?)` - Broadcast messages
- `sendToUser(userId, type, payload)` - Send to specific user
- `isUserConnected(userId)` - Check connection status

## Frontend Features

### useRealtime Hook (`/application/src/hooks/useRealtime.ts`)
- Automatic connection management with JWT authentication
- Auto-reconnection with exponential backoff
- Event-based message handling with `on(type, callback)`
- Connection state management
- Error handling and logging

### Test Component (`/application/src/components/RealtimeTest.tsx`)
A complete test interface demonstrating WebSocket functionality.

## Usage Examples

### Backend Usage

```typescript
import { broadcast, sendToUser } from '@/services/realtime.service';

// Broadcast to all users
broadcast('notification', {
  title: 'New modpack available!',
  message: 'Check out the latest modpack in the store.'
});

// Send to specific users
broadcast('direct_message', {
  from: 'admin',
  message: 'Welcome to ModpackStore!'
}, ['user1', 'user2']);

// Send to one user
sendToUser('user123', 'personal_update', {
  credits: 1000,
  level: 5
});
```

### Frontend Usage

```typescript
import { useRealtime } from '@/hooks/useRealtime';

function MyComponent() {
  const { isConnected, on, send } = useRealtime(authToken);

  useEffect(() => {
    // Listen for notifications
    const unsubscribe = on('notification', (payload) => {
      toast(payload.title, { description: payload.message });
    });

    return unsubscribe;
  }, [on]);

  const sendTestMessage = () => {
    send('test', { message: 'Hello from frontend!' });
  };

  return (
    <div>
      <p>Connection: {isConnected ? 'Connected' : 'Disconnected'}</p>
      <button onClick={sendTestMessage}>Send Test</button>
    </div>
  );
}
```

## WebSocket Endpoint

The WebSocket server is available at `/ws` and accepts connections with JWT authentication:

- Via query parameter: `ws://localhost:3000/ws?token=<jwt_token>`
- Via Authorization header: Connect with `Authorization: Bearer <jwt_token>`

## Message Format

All WebSocket messages use the format:
```json
{
  "type": "message_type",
  "payload": {
    // Any data
  }
}
```

## Connection Management

- **Authentication**: JWT tokens are validated on connection
- **User Association**: Each connection is associated with the authenticated user
- **Multi-Connection**: Users can have multiple simultaneous connections
- **Auto-Reconnect**: Frontend automatically reconnects with exponential backoff
- **Error Handling**: Comprehensive error handling and logging

## Testing

Use the `RealtimeTest` component to test WebSocket functionality:

```typescript
import { RealtimeTest } from '@/components/RealtimeTest';

function TestPage() {
  return <RealtimeTest token={yourJwtToken} />;
}
```

## Security Features

- JWT token validation on connection
- User authentication required
- Connection-user association
- Secure message routing
- Error handling without information leakage