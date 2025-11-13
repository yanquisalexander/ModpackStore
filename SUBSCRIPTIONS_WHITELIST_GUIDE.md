# Publisher Subscriptions & Whitelist Mode Implementation Guide

This document provides a comprehensive guide to the new Publisher Subscription system and Whitelist visibility mode for modpacks.

## Table of Contents
- [Overview](#overview)
- [Database Schema](#database-schema)
- [Subscription System](#subscription-system)
- [Whitelist System](#whitelist-system)
- [API Endpoints](#api-endpoints)
- [Testing](#testing)
- [Migration Notes](#migration-notes)

## Overview

This implementation adds two major features to ModpackStore:

1. **Publisher Subscription System**: Allows publishers to subscribe to different tiers (FREE, BASIC, PREMIUM, ENTERPRISE) with configurable features
2. **Whitelist Visibility Mode**: New visibility mode for modpacks that restricts access to explicitly authorized users

### Key Design Decisions

- **Visibility Change**: Removed 'patreon' visibility, added 'whitelist'
- **Security First**: Private and whitelist modpacks must be free (no payment/password)
- **Feature Flags**: All subscription features are configurable per publisher
- **Admin Override**: Admins can manually override any feature for any publisher

## Database Schema

### New Entities

#### PublisherSubscription
Stores subscription information for publishers:
```typescript
{
  id: uuid
  publisherId: uuid
  tier: enum (FREE, BASIC, PREMIUM, ENTERPRISE)
  status: enum (ACTIVE, EXPIRED, CANCELLED, SUSPENDED)
  subscriptionExpiresAt: timestamp?
  paymentProvider: enum (PAYPAL, MERCADOPAGO, MANUAL)?
  paymentReference: string?
  amount: decimal?
  currency: string (default: USD)
  autoRenew: boolean
  cancelledAt: timestamp?
  lastPaymentAt: timestamp?
}
```

#### PublisherSubscriptionFeature
Stores configurable feature flags:
```typescript
{
  id: uuid
  subscriptionId: uuid
  featureKey: enum (see FeatureKey enum)
  featureValue: string (parsed based on type)
  isOverride: boolean (admin manual override)
}
```

#### ModpackWhitelist
Manages user access to whitelist modpacks:
```typescript
{
  id: uuid
  modpackId: uuid
  userId: uuid
  addedByUserId: uuid
  notes: string?
  createdAt: timestamp
}
```

### Feature Keys

Available feature flags:
- `can_use_whitelist`: boolean - Can use whitelist visibility
- `whitelist_max_players_per_modpack`: number - Max players per modpack whitelist
- `max_members`: number - Max team members
- `max_modpacks`: number - Max modpacks (-1 = unlimited)
- `storage_limit_mb`: number - Storage limit in MB
- `custom_branding`: boolean - Custom branding features
- `priority_support`: boolean - Priority support access
- `analytics_access`: boolean - Analytics dashboard access
- `featured_modpacks`: number - Number of featured modpacks allowed
- `custom_categories`: boolean - Can create custom categories

### Default Tier Features

#### FREE
- ❌ Whitelist: 0 players
- 👥 Members: 3
- 📦 Modpacks: 5
- 💾 Storage: 512 MB

#### BASIC
- ✅ Whitelist: 50 players
- 👥 Members: 10
- 📦 Modpacks: 20
- 💾 Storage: 2048 MB
- 📊 Analytics access

#### PREMIUM
- ✅ Whitelist: 200 players
- 👥 Members: 25
- 📦 Modpacks: 100
- 💾 Storage: 10240 MB
- 🎨 Custom branding
- 🚨 Priority support
- 📊 Analytics access
- ⭐ 3 featured modpacks

#### ENTERPRISE
- ✅ Whitelist: 1000 players
- 👥 Members: 100
- 📦 Modpacks: Unlimited
- 💾 Storage: 51200 MB
- 🎨 Custom branding
- 🚨 Priority support
- 📊 Analytics access
- ⭐ 10 featured modpacks

## Subscription System

### Creating a Subscription

```typescript
const subscription = await PublisherSubscriptionService.createSubscription({
    publisherId: 'publisher-uuid',
    tier: SubscriptionTier.PREMIUM,
    paymentProvider: PaymentProvider.PAYPAL,
    paymentReference: 'PAYPAL-TX-123',
    amount: '29.99',
    currency: 'USD',
    durationDays: 30,
    autoRenew: false
});
```

### Checking Features

```typescript
// Check if publisher can use whitelist
const canUse = await PublisherSubscriptionService.canUseWhitelist(publisherId);

// Get specific feature value
const maxPlayers = await PublisherSubscriptionService.getMaxWhitelistPlayers(publisherId);

// Get all features
const features = await PublisherSubscriptionService.getPublisherFeatures(publisherId);
```

### Admin Operations

```typescript
// Override a feature
await PublisherSubscriptionService.overrideFeature(
    publisherId,
    FeatureKey.WHITELIST_MAX_PLAYERS_PER_MODPACK,
    500
);

// Remove override
await PublisherSubscriptionService.removeFeatureOverride(
    publisherId,
    FeatureKey.WHITELIST_MAX_PLAYERS_PER_MODPACK
);

// Renew subscription
await PublisherSubscriptionService.renewSubscription(
    subscriptionId,
    30, // days
    'NEW-PAYMENT-REF',
    '29.99'
);

// Cancel subscription
await PublisherSubscriptionService.cancelSubscription(subscriptionId);
```

### Automatic Expiry

A cron job runs daily at 2:00 AM to process expired subscriptions:
```typescript
// Manual trigger (for testing)
const count = await PublisherSubscriptionService.processExpiredSubscriptions();
```

## Whitelist System

### Adding Users to Whitelist

```typescript
// By user ID
await WhitelistService.addToWhitelist({
    modpackId: 'modpack-uuid',
    userId: 'user-uuid',
    addedByUserId: 'admin-uuid',
    notes: 'VIP member'
});

// By Discord username
await WhitelistService.addToWhitelistByDiscord(
    modpackId,
    'username#1234',
    addedByUserId,
    'Invited by creator'
);

// Bulk add
await WhitelistService.bulkAddToWhitelist(
    modpackId,
    ['user1-uuid', 'user2-uuid', 'user3-uuid'],
    addedByUserId,
    'Beta testers'
);
```

### Checking Access

```typescript
// Check if user has access
const hasAccess = await WhitelistService.hasAccess(modpackId, userId);

// Get user's whitelisted modpacks
const modpacks = await WhitelistService.getUserWhitelistedModpacks(userId);
```

### Managing Whitelist

```typescript
// Get all whitelisted users
const users = await WhitelistService.getWhitelistedUsers(modpackId, requestingUserId);

// Get statistics
const stats = await WhitelistService.getWhitelistStats(modpackId, requestingUserId);
// Returns: { totalWhitelisted, maxAllowed, remainingSlots }

// Remove user
await WhitelistService.removeFromWhitelist(modpackId, userId, removedByUserId);

// Clear entire whitelist
const count = await WhitelistService.clearWhitelist(modpackId, clearedByUserId);

// Export whitelist
const data = await WhitelistService.exportWhitelist(modpackId, requestingUserId);
```

### Validation

The whitelist system enforces:
1. Publisher must have an active subscription with `can_use_whitelist` feature
2. Whitelist count cannot exceed `whitelist_max_players_per_modpack` limit
3. Only publisher members can manage whitelist
4. Modpack must be in WHITELIST visibility mode

## API Endpoints

### Admin - Subscriptions

**Base URL**: `/v1/admin/subscriptions`

#### GET `/`
List all subscriptions with optional filters
- Query params: `status`, `tier`, `publisherId`

#### GET `/stats`
Get subscription statistics

#### GET `/:id`
Get subscription by ID

#### GET `/publisher/:publisherId`
Get all subscriptions for a publisher

#### POST `/`
Create new subscription
```json
{
  "publisherId": "uuid",
  "tier": "PREMIUM",
  "paymentProvider": "PAYPAL",
  "amount": "29.99",
  "currency": "USD",
  "durationDays": 30
}
```

#### POST `/:id/renew`
Renew subscription
```json
{
  "durationDays": 30,
  "paymentReference": "PAYMENT-REF",
  "amount": "29.99"
}
```

#### POST `/:id/cancel`
Cancel subscription

#### POST `/publisher/:publisherId/features/override`
Override a feature
```json
{
  "featureKey": "whitelist_max_players_per_modpack",
  "value": 500
}
```

#### DELETE `/publisher/:publisherId/features/:featureKey/override`
Remove feature override

#### GET `/publisher/:publisherId/features`
Get all features for a publisher

#### POST `/process-expired`
Manually trigger expiry processing (admin only)

### Creators - Whitelist

**Base URL**: `/v1/creators/whitelist`

#### GET `/:modpackId`
Get all whitelisted users

#### GET `/:modpackId/stats`
Get whitelist statistics

#### POST `/:modpackId`
Add user to whitelist
```json
{
  "userId": "uuid",  // Optional
  "discordUsername": "user#1234",  // Optional (if no userId)
  "notes": "Optional notes"
}
```

#### POST `/:modpackId/bulk`
Bulk add users
```json
{
  "userIds": ["uuid1", "uuid2"],
  "notes": "Optional notes"
}
```

#### DELETE `/:modpackId/user/:userId`
Remove user from whitelist

#### DELETE `/:modpackId/clear`
Clear entire whitelist

#### GET `/:modpackId/export`
Export whitelist data

### Public - Whitelist Access

**Base URL**: `/v1/whitelist-access`

#### GET `/modpack/:modpackId`
Check if authenticated user has access to modpack

#### GET `/my-whitelists`
Get all modpacks user has whitelist access to

#### GET `/has-any`
Check if user is in any whitelists (for client UI switching)

## Testing

### Running Tests

```bash
# Run subscription and whitelist tests
npm run test:subscriptions-whitelist

# Run subscription expiry job manually
npm run job:process-expired-subscriptions
```

### Test Coverage

The test suite covers:
1. Creating publishers and subscriptions
2. Feature management and overrides
3. Whitelist operations (add, remove, check access)
4. Validation constraints
5. Subscription statistics
6. Expiry detection

## Migration Notes

### Database Migration

When deploying, the TypeORM synchronize will create:
1. `publisher_subscriptions` table
2. `publisher_subscription_features` table
3. `modpack_whitelists` table
4. Updated `modpacks` table (visibility enum changed)

### Breaking Changes

1. **Visibility Enum**: `PATREON` visibility removed, replaced with `WHITELIST`
   - Existing modpacks with `PATREON` visibility should be migrated to `PUBLIC` or `WHITELIST`

2. **Private/Whitelist Constraints**: 
   - Private and whitelist modpacks cannot be paid
   - Private and whitelist modpacks cannot have passwords
   - These constraints are enforced in `Modpack.validateVisibilityConstraints()`

### Recommended Migration Steps

1. **Before Deployment**:
   - Identify any modpacks with `PATREON` visibility
   - Decide migration strategy (PUBLIC or WHITELIST)
   - Create migration script if needed

2. **Deployment**:
   - Deploy backend with new entities
   - Database sync will create new tables
   - Verify cron job starts successfully

3. **Post-Deployment**:
   - Create default FREE subscriptions for existing publishers
   - Migrate PATREON modpacks to new visibility
   - Test subscription and whitelist functionality

### Environment Variables

No new environment variables required. Existing payment gateway configurations (PayPal, MercadoPago) can be used for subscription payments.

### Cron Job

The subscription expiry job runs automatically. To verify:
```bash
# Check logs for:
[SUBSCRIPTION_CRON] Daily subscription expiry job started (runs at 2:00 AM daily)
```

## Security Considerations

1. **Authorization**: All whitelist management requires publisher membership
2. **Feature Validation**: Subscription features checked on every whitelist operation
3. **Data Validation**: All inputs validated with Zod schemas
4. **Audit Trail**: Whitelist entries track who added each user
5. **Expiry Handling**: Automatic subscription expiry prevents unauthorized feature access

## Future Enhancements

Potential improvements:
- Payment webhooks integration for automatic subscription renewal
- Whitelist import from CSV/JSON
- Subscription usage analytics
- Email notifications for expiring subscriptions
- Whitelist invite system (send invites to users not yet registered)
- Modpack-level whitelist limits override

## Support

For issues or questions:
- Check the test file for usage examples
- Review API endpoint documentation
- Check server logs for detailed error messages
- Use the admin subscription management panel for troubleshooting
