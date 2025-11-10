# User Flags System - Modpack Store+

This document describes the User Flags system that allows the application to obtain and use Modpack Store+ benefits (flags) for the current user.

## Overview

The User Flags system provides a way for both the backend and frontend to access user benefits based on their Patreon tier. These flags control feature access, limits, and other aspects of the user experience.

## Features

- ✅ Backend utility functions to get user flags
- ✅ REST API endpoint to retrieve flags
- ✅ Frontend React hooks for easy integration
- ✅ TypeScript type safety throughout
- ✅ Automatic flag updates based on Patreon tier
- ✅ Graceful fallback to default values
- ✅ Admin users automatically get highest tier benefits

## Backend Implementation

### Utility Functions

Located in `backend/src/utils/userFlags.ts`:

```typescript
// Get all flags for a user
const flags = await getUserFlags(userId);

// Get flags from auth context
const flags = await getFlagsForUser(user);

// Get default flags
const defaults = getDefaultFlags();

// Check if user has a flag enabled
const hasAccess = await hasFlag(userId, 'priority_support');

// Get numeric flag value
const maxInstances = await getNumericFlag(userId, 'max_instances_allowed');
```

### API Endpoint

**GET /auth/flags**

Returns all feature flags and benefits for the authenticated user.

**Request:**
```http
GET /auth/flags HTTP/1.1
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "data": {
    "max_instances_allowed": 10,
    "max_modpack_size_mb": 100,
    "can_upload_cover_image": false,
    "can_create_private_modpacks": false,
    "can_create_patreon_exclusive": false,
    "priority_support": false,
    "early_access_features": false,
    "custom_badges": false,
    "max_storage_gb": 5,
    "max_publishers": 1,
    "max_modpacks_per_publisher": 10,
    "advanced_analytics": false,
    "api_rate_limit_multiplier": 1.0
  }
}
```

### Using in Backend Controllers

```typescript
import { getFlagsForUser } from '@/utils/userFlags';

async function myEndpoint(c: Context<{ Variables: AuthVariables }>) {
    const user = c.get('user');
    const flags = await getFlagsForUser(user);
    
    if (!flags.can_create_private_modpacks) {
        throw new APIError(403, 'Premium feature required');
    }
    
    // ... rest of logic
}
```

## Frontend Implementation

### React Hooks

Located in `application/src/hooks/useUserFlags.ts`:

#### 1. `useUserFlags()` - Main Hook

Get all user flags with automatic caching and refresh:

```tsx
import { useUserFlags } from '@/hooks/useUserFlags';

function MyComponent() {
    const { flags, loading, error, refetch } = useUserFlags();
    
    if (loading) return <LoadingSpinner />;
    if (error) return <ErrorMessage error={error} />;
    
    return (
        <div>
            <p>Max instances: {flags.max_instances_allowed}</p>
            {flags.can_upload_cover_image && <UploadButton />}
            <button onClick={refetch}>Refresh</button>
        </div>
    );
}
```

#### 2. `useFlag()` - Single Flag Check

Check a specific flag:

```tsx
import { useFlag } from '@/hooks/useUserFlags';

function PremiumFeature() {
    const { value: hasEarlyAccess, loading } = useFlag('early_access_features');
    
    if (loading) return <LoadingSpinner />;
    
    if (!hasEarlyAccess) {
        return <UpgradePrompt />;
    }
    
    return <BetaFeatureComponent />;
}
```

#### 3. `useActionLimit()` - Check Numeric Limits

Check if user can perform an action based on limits:

```tsx
import { useActionLimit } from '@/hooks/useUserFlags';

function InstanceCreator({ currentInstances = 5 }) {
    const { allowed, limit, remaining, loading } = useActionLimit(
        'max_instances_allowed',
        currentInstances
    );
    
    if (loading) return <LoadingSpinner />;
    
    return (
        <div>
            <button disabled={!allowed}>
                Create New Instance
            </button>
            <p>Instances: {currentInstances} / {limit}</p>
            <p>Remaining: {remaining} slots</p>
        </div>
    );
}
```

### Service Functions

Located in `application/src/services/userFlags.ts`:

```typescript
import { getUserFlags, hasFlag, getNumericFlag, canPerformAction } from '@/services/userFlags';

// Fetch flags directly
const flags = await getUserFlags();

// Check a flag
const canUpload = hasFlag(flags, 'can_upload_cover_image');

// Get numeric value
const maxSize = getNumericFlag(flags, 'max_modpack_size_mb');

// Check action limit
const { allowed, limit, remaining } = canPerformAction(
    flags,
    'max_instances_allowed',
    currentCount
);
```

## Available Flags

### Instance Limits
- `max_instances_allowed` (number): Maximum number of modpack instances

### Upload Limits
- `max_modpack_size_mb` (number): Maximum modpack upload size in MB
- `max_storage_gb` (number): Maximum total storage in GB

### Feature Flags
- `can_upload_cover_image` (boolean): Can upload custom profile cover images
- `can_create_private_modpacks` (boolean): Can create private modpacks
- `can_create_patreon_exclusive` (boolean): Can create Patreon-exclusive modpacks
- `priority_support` (boolean): Has priority support access
- `early_access_features` (boolean): Has early access to beta features
- `custom_badges` (boolean): Can display custom profile badges
- `advanced_analytics` (boolean): Has access to advanced analytics

### Publishing Limits
- `max_publishers` (number): Maximum number of publishers user can own
- `max_modpacks_per_publisher` (number): Maximum modpacks per publisher

### API Access
- `api_rate_limit_multiplier` (number): Multiplier for API rate limits (1.0 = standard)

## Default Values

Users without an active Patreon subscription get these default values:

```typescript
{
    max_instances_allowed: 10,
    max_modpack_size_mb: 100,
    can_upload_cover_image: false,
    can_create_private_modpacks: false,
    can_create_patreon_exclusive: false,
    priority_support: false,
    early_access_features: false,
    custom_badges: false,
    max_storage_gb: 5,
    max_publishers: 1,
    max_modpacks_per_publisher: 10,
    advanced_analytics: false,
    api_rate_limit_multiplier: 1.0,
}
```

## Configuration

Flags are defined in `backend/src/config/benefits_modpackstore_plus.yml`. To add or modify flags:

1. Edit the YAML configuration file
2. Update the TypeScript interfaces in:
   - `backend/src/utils/userFlags.ts`
   - `application/src/types/userFlags.ts`
3. Update default values if needed

## Patreon Tier Integration

Flags are automatically populated based on the user's Patreon tier:

1. User links Patreon account
2. Patreon tier is synced (via webhook or manual sync)
3. Tier metadata contains benefit overrides
4. Flags endpoint returns tier-specific values
5. Frontend receives updated flags

### Admin Override

Admin and superadmin users automatically receive the highest tier benefits, regardless of their Patreon status.

## Testing

### Backend Test

Run the backend test suite:

```bash
cd backend
npm run test:user-flags
```

This will test:
- Default flag retrieval
- Flag retrieval for existing users
- Admin user flag escalation
- Helper function behavior

### Manual API Testing

Test the endpoint with curl:

```bash
# Get an access token first (via Discord OAuth or other method)
ACCESS_TOKEN="your_access_token_here"

# Fetch user flags
curl -X GET "http://localhost:3000/v1/auth/flags" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

### Frontend Testing

Use the demo component to test the hooks:

```tsx
import { UserFlagsDemo } from '@/components/UserFlagsDemo';

// Add to your app's debug/admin panel
<UserFlagsDemo />
```

## Integration Examples

### Conditional Feature Rendering

```tsx
function FeatureGate({ feature, children }) {
    const { value, loading } = useFlag(feature);
    
    if (loading) return null;
    return value ? children : <UpgradePrompt />;
}

// Usage
<FeatureGate feature="early_access_features">
    <NewBetaFeature />
</FeatureGate>
```

### Upload Size Validation

```tsx
function FileUploader() {
    const { flags } = useUserFlags();
    const maxSizeMB = flags.max_modpack_size_mb;
    
    const handleFileSelect = (file: File) => {
        const sizeMB = file.size / (1024 * 1024);
        
        if (sizeMB > maxSizeMB) {
            showError(`File too large. Max size: ${maxSizeMB}MB`);
            return;
        }
        
        // Continue with upload
    };
    
    return <input type="file" onChange={e => handleFileSelect(e.target.files[0])} />;
}
```

### Instance Limit Enforcement

```tsx
function InstanceList({ instances }) {
    const { allowed, remaining } = useActionLimit('max_instances_allowed', instances.length);
    
    return (
        <div>
            <h2>My Instances ({instances.length})</h2>
            {instances.map(instance => <InstanceCard key={instance.id} {...instance} />)}
            
            <button disabled={!allowed}>
                Create New Instance
            </button>
            
            {!allowed && (
                <p>Upgrade to create more instances. {remaining} slots remaining.</p>
            )}
        </div>
    );
}
```

## Error Handling

The system includes comprehensive error handling:

### Backend
- Returns default flags if user not found
- Gracefully handles missing Patreon data
- Logs errors while maintaining service availability

### Frontend
- Returns default flags on API errors
- Provides loading states
- Includes retry functionality
- Shows user-friendly error messages

## Performance Considerations

### Backend
- Flags computed on-demand from existing benefits system
- Could be cached in Redis for high-traffic scenarios
- Minimal database queries (uses existing user/tier data)

### Frontend
- Hooks cache results in React state
- Automatic refresh only on auth state changes
- Manual refetch available when needed
- No unnecessary re-renders

## Future Enhancements

Potential improvements:

1. **Real-time Updates**: Use WebSocket to push flag updates
2. **Redis Caching**: Cache flags in Redis for better performance
3. **Flag History**: Track flag changes over time
4. **A/B Testing**: Use flags for feature experimentation
5. **Custom Flag Rules**: Allow complex conditions beyond tier-based flags
6. **Analytics Integration**: Track feature usage by tier

## Troubleshooting

### Flags not updating after tier change

1. Check if Patreon sync is working (`npm run job:sync-patreon`)
2. Verify tier metadata is configured correctly
3. Call `refetch()` in the hook to force update
4. Check browser console for API errors

### Getting default flags for authenticated user

1. Verify user's Patreon account is linked
2. Check if tier is active (`patreonIsActive` field)
3. Ensure tier metadata contains flag overrides
4. Check backend logs for errors

### TypeScript errors

1. Ensure types are imported from correct locations
2. Verify `UserFlags` interface matches backend
3. Check `tsconfig.json` path mappings

## Support

For issues or questions:
- Check backend logs for API errors
- Use browser DevTools to inspect network requests
- Test with the provided demo component
- Run the test suite to verify functionality
