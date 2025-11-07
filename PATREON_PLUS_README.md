# Patreon Plus Integration

## Overview

The Patreon Plus integration provides a dynamic system to sync Patreon tiers and members, and manage benefits for supporters through the admin panel.

## Features

### ✅ Dynamic Tier Synchronization
- Automatically sync Patreon campaign tiers via API
- Track tier details: name, description, amount, and active status
- Auto-deactivate tiers that are removed from Patreon

### ✅ Member Management
- Sync Patreon members and their tier assignments
- Identify users by `patreon_user_id` from OAuth
- Update member status automatically
- Clear tier assignments for inactive supporters

### ✅ Benefits System
- Define benefits via YAML configuration (`benefits_modpackstore_plus.yml`)
- Support for boolean flags and numeric limits
- Validate benefit values with configurable validators
- Assign benefits per tier via metadata

### ✅ Admin Panel API
- View all tiers with member counts
- List members per tier
- Trigger manual synchronization
- View statistics and last sync timestamp
- Configure tier benefits via metadata

### ✅ Audit Logging
- All sync operations are logged to `audit_logs` table
- System-level actions with detailed information

## Database Schema

### New Table: `patreon_tiers`
```sql
CREATE TABLE patreon_tiers (
    id TEXT PRIMARY KEY,              -- Patreon tier UUID
    name TEXT NOT NULL,
    description TEXT,
    amount_cents INTEGER NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    metadata JSONB,                   -- Benefits configuration
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Updated Table: `users`
New columns added:
```sql
ALTER TABLE users ADD COLUMN patreon_user_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN patreon_tier_id TEXT REFERENCES patreon_tiers(id);
```

## Environment Variables

Required environment variables in `.env`:

```env
# Patreon OAuth Configuration (already exists)
PATREON_CLIENT_ID=your_client_id
PATREON_CLIENT_SECRET=your_client_secret
PATREON_REDIRECT_URI=your_redirect_uri

# New: Patreon Campaign & Creator Access Token
PATREON_CAMPAIGN_ID=your_campaign_id
PATREON_CREATOR_ACCESS_TOKEN=your_creator_access_token
```

### Getting Credentials

1. **Campaign ID**: Found in your Patreon creator dashboard URL: `https://www.patreon.com/portal/registration/CAMPAIGN_ID`

2. **Creator Access Token**: 
   - Go to https://www.patreon.com/portal/registration/register-clients
   - Create or use existing client
   - Generate a Creator's Access Token with scopes: `campaigns`, `campaigns.members`

## API Endpoints

All endpoints require admin authentication.

### GET `/admin/patreon-plus/tiers`
Get all Patreon tiers with member counts.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "tier_uuid",
      "name": "Basic Supporter",
      "description": "Basic tier description",
      "amountCents": 300,
      "active": true,
      "metadata": {
        "max_instances_allowed": 20,
        "can_upload_cover_image": true
      },
      "memberCount": 15,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

### GET `/admin/patreon-plus/tiers/:tierId/members`
Get members for a specific tier.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "user_uuid",
      "username": "supporter_user",
      "email": "user@example.com",
      "avatarUrl": "https://...",
      "patreonStatus": "active_patron",
      "patreonEntitledAmount": 300,
      "patreonLastVerified": "2025-01-15T00:00:00.000Z"
    }
  ]
}
```

### POST `/admin/patreon-plus/sync`
Trigger manual synchronization of tiers and members.

**Response:**
```json
{
  "success": true,
  "data": {
    "tiers": {
      "tiersAdded": 2,
      "tiersUpdated": 5,
      "tiersDeactivated": 1
    },
    "members": {
      "membersUpdated": 42,
      "membersCleared": 3
    }
  }
}
```

### GET `/admin/patreon-plus/last-sync`
Get last synchronization timestamp.

**Response:**
```json
{
  "success": true,
  "data": {
    "lastSync": "2025-01-15T02:00:00.000Z"
  }
}
```

### GET `/admin/patreon-plus/benefits-config`
Get benefits configuration schema.

**Response:**
```json
{
  "success": true,
  "data": {
    "benefits": {
      "max_instances_allowed": {
        "type": "number",
        "name": "Maximum Instances Allowed",
        "description": "...",
        "default": 10,
        "validator": "positive_integer"
      }
    },
    "validators": { ... }
  }
}
```

### PUT `/admin/patreon-plus/tiers/:tierId/metadata`
Update tier benefits configuration.

**Request:**
```json
{
  "metadata": {
    "max_instances_allowed": 50,
    "can_upload_cover_image": true,
    "priority_support": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "tier_uuid",
    "name": "Premium Supporter",
    "metadata": { ... }
  }
}
```

### GET `/admin/patreon-plus/members`
Get all active Patreon members across all tiers.

### GET `/admin/patreon-plus/statistics`
Get Patreon Plus statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalTiers": 5,
    "totalMembers": 123,
    "totalRevenueCents": 61500,
    "totalRevenueUSD": "615.00",
    "lastSync": "2025-01-15T02:00:00.000Z"
  }
}
```

## Benefits Configuration

Benefits are defined in `backend/src/config/benefits_modpackstore_plus.yml`.

### Example Benefit Definition

```yaml
max_instances_allowed:
  type: number
  name: "Maximum Instances Allowed"
  description: "Maximum number of modpack instances a user can have"
  default: 10
  validator: positive_integer

can_upload_cover_image:
  type: boolean
  name: "Can Upload Custom Cover Image"
  description: "Allow user to upload custom profile cover images"
  default: false
  validator: boolean
```

### Using Benefits in Code

```typescript
import { BenefitsService } from "@/services/benefits.service";

// Get a specific benefit
const maxInstances = await BenefitsService.getNumericBenefit(userId, 'max_instances_allowed');

// Get all benefits for a user
const allBenefits = await BenefitsService.getAllBenefits(userId);

// Check if user can perform an action
const { allowed, limit, remaining } = await BenefitsService.canPerformAction(
  userId,
  'max_instances_allowed',
  currentInstanceCount
);

// Check boolean benefit
const canUpload = await BenefitsService.hasBenefit(userId, 'can_upload_cover_image');
```

## Cron Job / Scheduler

### Manual Sync
```bash
npm run job:sync-patreon
```

### Daily Automatic Sync

Add to your cron configuration (runs at 2 AM daily):
```cron
0 2 * * * cd /path/to/backend && npm run job:sync-patreon
```

Or use a job scheduler like:
- **Node-cron** in the main application
- **PM2 cron** if using PM2
- **Kubernetes CronJob** if deployed on K8s
- **GitHub Actions** for scheduled workflows

## Testing

Run the test suite:
```bash
npm run test:patreon-plus
```

This will verify:
- Benefits configuration is valid
- Benefit validation is working
- PatreonTier entity is properly configured
- User entity updates are in place

## Workflow

### 1. User Links Patreon Account
- User authorizes via Patreon OAuth
- Backend receives `patreon_user_id` from `/api/oauth2/v2/identity`
- Saved to `users.patreon_user_id`

### 2. Sync Tiers (Manual or Cron)
- Fetch tiers from `/api/oauth2/v2/campaigns/{id}/tiers`
- Create or update `patreon_tiers` table
- Deactivate removed tiers

### 3. Sync Members (Manual or Cron)
- Fetch members from `/api/oauth2/v2/campaigns/{id}/members`
- Match by `patreon_user_id`
- Assign `patreon_tier_id` based on entitled tiers
- Clear tier for inactive members

### 4. Admin Configures Benefits
- View tiers in admin panel
- Set benefits via tier metadata
- Benefits apply automatically to tier members

### 5. Application Uses Benefits
- Check user benefits via `BenefitsService`
- Enforce limits and feature flags
- Display tier status to users

## Troubleshooting

### Sync Fails with "Missing Patreon configuration"
- Ensure `PATREON_CAMPAIGN_ID` and `PATREON_CREATOR_ACCESS_TOKEN` are set in `.env`
- Verify the creator access token has correct scopes

### Members Not Syncing
- Ensure users have linked their Patreon accounts via OAuth
- Check that `patreon_user_id` is saved in the database
- Verify the user's Patreon email matches their platform email

### Tier Benefits Not Applying
- Check that tier metadata is set correctly
- Verify user has `patreonIsActive: true`
- Ensure `patreonTierId` is correctly assigned

## Security Considerations

- Creator Access Token is sensitive - store securely in environment variables
- Admin endpoints require authentication
- Validate all benefit values before saving to prevent abuse
- Audit all sync operations for transparency

## Future Enhancements

Potential additions:
- Webhooks for real-time member updates
- Benefit usage analytics
- Historical tier membership tracking
- Automated benefit enforcement across the platform
- Frontend admin UI components
- Email notifications for tier changes
- Grace period for expired memberships

## Support

For issues or questions:
1. Check the test output: `npm run test:patreon-plus`
2. Review audit logs for sync operations
3. Check Patreon API documentation: https://docs.patreon.com/
4. Verify environment variables and credentials
