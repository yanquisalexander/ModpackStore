# WebSocket Authentication Implementation

This implementation provides authenticated WebSocket support for the ModpackStore application with both backend and frontend components.

## 🚀 Quick Start

### Backend Setup
1. WebSocket server runs automatically on the same port as your HTTP server
2. WebSocket endpoint available at `/ws`
3. Authentication via JWT token (header or query param)

### Frontend Setup
```typescript
import { useRealtime } from '@/hooks/useRealtime';

function MyComponent() {
  const { isConnected, on, send } = useRealtime(authToken);
  
  useEffect(() => {
    const unsubscribe = on('notification', (payload) => {
      toast.success(payload.message);
    });
    return unsubscribe;
  }, [on]);

  return <div>Status: {isConnected ? 'Connected' : 'Disconnected'}</div>;
}
```

## 📚 Complete API Reference

### Backend Functions

#### Broadcast Functions
```typescript
import { broadcast, sendToUser } from '@/services/realtime.service';

// Broadcast to all users
broadcast('notification', { title: 'New update!', message: 'Check it out' });

// Broadcast to specific users
broadcast('private_message', { from: 'admin', text: 'Hello' }, ['user1', 'user2']);

// Send to one user
sendToUser('user123', 'personal_update', { credits: 1000 });
```

#### Connection Management
```typescript
import { isUserConnected, getConnectionStats, disconnectUser } from '@/services/realtime.service';

// Check if user is online
const isOnline = isUserConnected('user123');

// Get stats
const stats = getConnectionStats(); // { totalConnections: 5, totalUsers: 3, users: [...] }

// Force disconnect user
disconnectUser('user123');
```

### Frontend Hook API

#### useRealtime Hook
```typescript
const {
  isConnected,      // boolean - Connection status
  isConnecting,     // boolean - Currently connecting
  error,           // string | null - Last error message
  connect,         // () => void - Manual connect
  disconnect,      // () => void - Manual disconnect
  send,           // (type: string, payload: any) => void - Send message
  on,             // (type: string, callback: Function) => unsubscribe
  off,            // (type: string, callback?: Function) => void - Remove listener
  connectionCount // number - Total connections made
} = useRealtime(token, options);
```

#### Hook Options
```typescript
const options = {
  autoConnect: true,           // Auto-connect on mount
  reconnectInterval: 1000,     // Base reconnect delay (ms)
  maxReconnectAttempts: 10,    // Max reconnection attempts
  debug: false                 // Enable console logging
};
```

## 🌐 HTTP API Endpoints

### WebSocket Management Routes
All routes require authentication (`Authorization: Bearer <token>`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/websocket/broadcast` | Broadcast message to users |
| `POST` | `/v1/websocket/send/:userId` | Send message to specific user |
| `GET` | `/v1/websocket/stats` | Get connection statistics |
| `GET` | `/v1/websocket/user/:userId/status` | Check user connection status |
| `DELETE` | `/v1/websocket/user/:userId/disconnect` | Disconnect user |
| `POST` | `/v1/websocket/test/notification` | Send test notification |

### Example HTTP Requests

#### Broadcast Message
```bash
curl -X POST http://localhost:3000/v1/websocket/broadcast \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "announcement",
    "payload": {
      "title": "Server Maintenance",
      "message": "Scheduled maintenance in 30 minutes"
    },
    "userIds": ["user1", "user2"]
  }'
```

#### Get Connection Stats
```bash
curl -X GET http://localhost:3000/v1/websocket/stats \
  -H "Authorization: Bearer <token>"
```

## 🔧 Message Format

All WebSocket messages use this structure:
```typescript
interface WebSocketMessage {
  type: string;    // Message type for routing
  payload: any;    // Message data
}
```

### Example Messages
```json
{
  "type": "notification",
  "payload": {
    "title": "New Modpack Available",
    "message": "SkyFactory 5 is now available for download!",
    "urgency": "low"
  }
}

{
  "type": "user_update",
  "payload": {
    "userId": "123",
    "credits": 1500,
    "level": 8
  }
}

{
  "type": "modpack_status",
  "payload": {
    "modpackId": "skyblock-1.0",
    "status": "installing",
    "progress": 45
  }
}
```

## 🛠 Integration Examples

### React Context Provider
```typescript
import { RealtimeProvider } from '@/providers/RealtimeProvider';

function App() {
  return (
    <RealtimeProvider token={authToken}>
      <YourAppComponents />
    </RealtimeProvider>
  );
}

function SomeComponent() {
  const { isConnected, on } = useRealtimeContext();
  // Use WebSocket functionality
}
```

### Event Listeners
```typescript
function NotificationHandler() {
  const { on } = useRealtime(token);

  useEffect(() => {
    const unsubscribers = [
      on('notification', (payload) => toast.info(payload.message)),
      on('error', (payload) => toast.error(payload.message)),
      on('user_joined', (payload) => console.log('User joined:', payload.username)),
      on('modpack_ready', (payload) => toast.success(`${payload.name} is ready!`))
    ];

    return () => unsubscribers.forEach(unsub => unsub());
  }, [on]);
}
```

## 🔒 Security Features

- **JWT Authentication**: All connections require valid JWT tokens
- **User Association**: Messages are routed based on authenticated user identity
- **Token Validation**: Tokens verified on connection establishment
- **Secure Routing**: Users can only receive messages intended for them
- **Connection Limits**: Configurable per-user connection limits
- **Error Handling**: No sensitive information leaked in error messages

## 🧪 Testing

### Backend Testing
Use the test route to send notifications:
```bash
curl -X POST http://localhost:3000/v1/websocket/test/notification \
  -H "Authorization: Bearer <token>"
```

### Frontend Testing
Use the `RealtimeTest` component:
```typescript
import { RealtimeTest } from '@/components/RealtimeTest';

function TestPage() {
  return <RealtimeTest token={yourJwtToken} />;
}
```

## 🚨 Error Handling

### Backend Errors
- Invalid/expired JWT tokens → Connection rejected
- User not found → Connection rejected
- Malformed messages → Error message sent to client

### Frontend Errors
- Connection failures → Auto-reconnect with exponential backoff
- Invalid JSON → Error event emitted
- Token issues → Error state updated with description

## 📊 Monitoring

### Connection Statistics
```typescript
const stats = getConnectionStats();
console.log(`${stats.totalUsers} users with ${stats.totalConnections} connections`);
```

### Debug Logging
Enable debug mode in development:
```typescript
const { ... } = useRealtime(token, { debug: true });
```

## 🔄 Auto-Reconnection

The frontend automatically handles reconnections with:
- **Exponential Backoff**: Delay increases with each failed attempt
- **Jitter**: Random delay added to prevent thundering herd
- **Max Attempts**: Configurable maximum reconnection attempts
- **Manual Override**: Users can manually connect/disconnect

## 📱 Production Considerations

1. **Environment Variables**: Ensure `JWT_SECRET` is set in production
2. **CORS**: Configure CORS for WebSocket origins
3. **Rate Limiting**: Consider implementing rate limits for message sending
4. **Monitoring**: Monitor connection counts and message throughput
5. **Scaling**: For horizontal scaling, consider Redis for message distribution

Ready for production use! 🎉