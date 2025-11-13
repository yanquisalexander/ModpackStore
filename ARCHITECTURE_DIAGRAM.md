# Architecture Diagram: Subscriptions & Whitelist System

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ModpackStore Platform                        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                           Frontend Layer                             │
├─────────────────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                   │
│  │ Admin      │  │ Publisher  │  │  Client    │                   │
│  │ Panel      │  │ Panel      │  │ Launcher   │                   │
│  │ (Future)   │  │ (Future)   │  │ (Future)   │                   │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘                   │
│        │               │               │                            │
└────────┼───────────────┼───────────────┼────────────────────────────┘
         │               │               │
         │               │               │
┌────────▼───────────────▼───────────────▼────────────────────────────┐
│                           API Layer                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐                 │
│  │ Admin Routes        │  │ Creator Routes      │                 │
│  │ /admin/subscriptions│  │ /creators/whitelist │                 │
│  ├─────────────────────┤  ├─────────────────────┤                 │
│  │ • List all subs     │  │ • Manage whitelist  │                 │
│  │ • Create/renew/     │  │ • Add/remove users  │                 │
│  │   cancel            │  │ • Bulk operations   │                 │
│  │ • Override features │  │ • Get statistics    │                 │
│  │ • View stats        │  │ • Export data       │                 │
│  └─────────────────────┘  └─────────────────────┘                 │
│                                                                      │
│  ┌─────────────────────┐                                           │
│  │ Public Routes       │                                           │
│  │ /whitelist-access   │                                           │
│  ├─────────────────────┤                                           │
│  │ • Check access      │                                           │
│  │ • Get my whitelists │                                           │
│  │ • Has any?          │                                           │
│  └─────────────────────┘                                           │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
         │               │               │
         │               │               │
┌────────▼───────────────▼───────────────▼────────────────────────────┐
│                        Service Layer                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────┐        │
│  │ PublisherSubscriptionService                            │        │
│  ├────────────────────────────────────────────────────────┤        │
│  │ • createSubscription()                                  │        │
│  │ • renewSubscription()                                   │        │
│  │ • cancelSubscription()                                  │        │
│  │ • getActiveSubscription()                               │        │
│  │ • canUseWhitelist()                                     │        │
│  │ • getMaxWhitelistPlayers()                              │        │
│  │ • overrideFeature()                                     │        │
│  │ • processExpiredSubscriptions()                         │        │
│  └────────────────────────────────────────────────────────┘        │
│                                                                      │
│  ┌────────────────────────────────────────────────────────┐        │
│  │ WhitelistService                                        │        │
│  ├────────────────────────────────────────────────────────┤        │
│  │ • addToWhitelist()                                      │        │
│  │ • addToWhitelistByDiscord()                             │        │
│  │ • removeFromWhitelist()                                 │        │
│  │ • hasAccess()                                           │        │
│  │ • getUserWhitelistedModpacks()                          │        │
│  │ • bulkAddToWhitelist()                                  │        │
│  │ • getWhitelistStats()                                   │        │
│  └────────────────────────────────────────────────────────┘        │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
         │               │               │
         │               │               │
┌────────▼───────────────▼───────────────▼────────────────────────────┐
│                       Database Layer                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────┐  ┌──────────────────────┐               │
│  │ publishers           │  │ modpacks             │               │
│  ├──────────────────────┤  ├──────────────────────┤               │
│  │ • id                 │  │ • id                 │               │
│  │ • publisher_name     │  │ • name               │               │
│  │ • ...                │  │ • visibility         │               │
│  └──────────┬───────────┘  └──────────┬───────────┘               │
│             │                          │                            │
│             │                          │                            │
│  ┌──────────▼───────────┐  ┌──────────▼───────────┐               │
│  │ publisher_           │  │ modpack_whitelists   │               │
│  │ subscriptions        │  ├──────────────────────┤               │
│  ├──────────────────────┤  │ • id                 │               │
│  │ • id                 │  │ • modpack_id        ─┼───────┐       │
│  │ • publisher_id      ─┼──┤ • user_id            │       │       │
│  │ • tier               │  │ • added_by_user_id   │       │       │
│  │ • status             │  │ • notes              │       │       │
│  │ • expires_at         │  │ • created_at         │       │       │
│  │ • payment_provider   │  └──────────────────────┘       │       │
│  │ • ...                │                                  │       │
│  └──────────┬───────────┘                                  │       │
│             │                                              │       │
│  ┌──────────▼───────────┐  ┌─────────────────┐           │       │
│  │ publisher_           │  │ users            │◄──────────┘       │
│  │ subscription_features│  ├─────────────────┤                    │
│  ├──────────────────────┤  │ • id             │                    │
│  │ • id                 │  │ • username       │                    │
│  │ • subscription_id   ─┼──┤ • discord_id     │                    │
│  │ • feature_key        │  │ • ...            │                    │
│  │ • feature_value      │  └─────────────────┘                    │
│  │ • is_override        │                                          │
│  └──────────────────────┘                                          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
         │
         │
┌────────▼─────────────────────────────────────────────────────────────┐
│                          Background Jobs                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────┐           │
│  │ Subscription Expiry Cron                              │           │
│  │ (Daily at 2:00 AM)                                    │           │
│  ├──────────────────────────────────────────────────────┤           │
│  │ 1. Find subscriptions with expired date               │           │
│  │ 2. Mark status as EXPIRED                             │           │
│  │ 3. Features automatically revoked                     │           │
│  └──────────────────────────────────────────────────────┘           │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### 1. Creating a Subscription

```
┌─────────┐                  ┌─────────────┐                ┌──────────┐
│  Admin  │                  │   Backend   │                │ Database │
└────┬────┘                  └──────┬──────┘                └────┬─────┘
     │                              │                             │
     │ POST /admin/subscriptions    │                             │
     │──────────────────────────────>│                             │
     │                              │                             │
     │                              │ Verify publisher exists     │
     │                              │─────────────────────────────>│
     │                              │                             │
     │                              │ Check for active sub        │
     │                              │─────────────────────────────>│
     │                              │                             │
     │                              │ Cancel if exists            │
     │                              │─────────────────────────────>│
     │                              │                             │
     │                              │ Create subscription         │
     │                              │─────────────────────────────>│
     │                              │                             │
     │                              │ Apply tier features         │
     │                              │─────────────────────────────>│
     │                              │                             │
     │       Subscription created   │                             │
     │<──────────────────────────────│                             │
     │                              │                             │
```

### 2. Adding User to Whitelist

```
┌──────────┐              ┌─────────────┐              ┌──────────┐
│ Publisher│              │   Backend   │              │ Database │
└─────┬────┘              └──────┬──────┘              └────┬─────┘
      │                          │                          │
      │ POST /creators/whitelist │                          │
      │──────────────────────────>│                          │
      │                          │                          │
      │                          │ Verify modpack exists    │
      │                          │──────────────────────────>│
      │                          │                          │
      │                          │ Check visibility=WHITELIST│
      │                          │──────────────────────────>│
      │                          │                          │
      │                          │ Verify membership        │
      │                          │──────────────────────────>│
      │                          │                          │
      │                          │ Check subscription       │
      │                          │──────────────────────────>│
      │                          │                          │
      │                          │ Validate can_use_whitelist│
      │                          │                          │
      │                          │ Check whitelist limit    │
      │                          │──────────────────────────>│
      │                          │                          │
      │                          │ Add to whitelist         │
      │                          │──────────────────────────>│
      │                          │                          │
      │      User whitelisted    │                          │
      │<──────────────────────────│                          │
      │                          │                          │
```

### 3. Checking Whitelist Access (Client)

```
┌────────┐                 ┌─────────────┐              ┌──────────┐
│ Client │                 │   Backend   │              │ Database │
└───┬────┘                 └──────┬──────┘              └────┬─────┘
    │                             │                          │
    │ GET /whitelist-access/      │                          │
    │     my-whitelists           │                          │
    │─────────────────────────────>│                          │
    │                             │                          │
    │                             │ Get user's whitelists    │
    │                             │──────────────────────────>│
    │                             │                          │
    │                             │ Load modpack details     │
    │                             │──────────────────────────>│
    │                             │                          │
    │   List of whitelisted       │                          │
    │   modpacks with details     │                          │
    │<─────────────────────────────│                          │
    │                             │                          │
```

## Feature Access Flow

```
┌───────────────────────────────────────────────────────────┐
│          Feature Access Validation Flow                   │
└───────────────────────────────────────────────────────────┘

Request to use whitelist feature
         │
         ▼
┌──────────────────────┐
│ Get Publisher        │
│ Active Subscription  │
└──────────┬───────────┘
           │
           ▼
    ┌──────────────┐     NO      ┌───────────────┐
    │ Has Active   ├────────────>│ Use FREE Tier │
    │ Subscription?│             │ Features      │
    └──────┬───────┘             └───────┬───────┘
           │ YES                         │
           ▼                             │
    ┌──────────────┐                    │
    │ Load Features│                    │
    │ for Tier     │                    │
    └──────┬───────┘                    │
           │                             │
           ▼                             │
    ┌──────────────┐                    │
    │ Check for    │                    │
    │ Admin        │                    │
    │ Overrides    │                    │
    └──────┬───────┘                    │
           │                             │
           ├─────────────────────────────┘
           ▼
    ┌──────────────┐
    │ Return       │
    │ Feature      │
    │ Value        │
    └──────────────┘
```

## Subscription Tier Hierarchy

```
┌────────────────────────────────────────────────────────┐
│                   Subscription Tiers                   │
└────────────────────────────────────────────────────────┘

    ┌──────────┐
    │   FREE   │  ← Default for all publishers
    └─────┬────┘
          │
    ┌─────▼────┐
    │  BASIC   │  ← Entry level paid tier
    └─────┬────┘
          │
    ┌─────▼────┐
    │ PREMIUM  │  ← Advanced features
    └─────┬────┘
          │
    ┌─────▼────────┐
    │ ENTERPRISE   │  ← Unlimited features
    └──────────────┘

Each tier includes ALL features from tiers below it,
plus additional capabilities.
```

## Whitelist Visibility Access Matrix

```
┌─────────────────────────────────────────────────────────────┐
│           Modpack Visibility Access Control                 │
└─────────────────────────────────────────────────────────────┘

Visibility Mode    │ Who Can Access?
───────────────────┼──────────────────────────────────────────
PUBLIC             │ ✅ Everyone
                   │
PRIVATE            │ ✅ Publisher members only
                   │
WHITELIST          │ ✅ Users in whitelist table
                   │ ✅ Publisher members (implicit)
                   │
───────────────────┴──────────────────────────────────────────

Constraints:
• PRIVATE and WHITELIST must be FREE (no payment)
• PRIVATE and WHITELIST cannot have passwords
• Whitelist requires publisher subscription with feature enabled
```

## Security Architecture

```
┌───────────────────────────────────────────────────────────┐
│                  Security Layers                          │
└───────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Layer 1: Authentication                                 │
│ • JWT token validation                                  │
│ • User identity verification                            │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│ Layer 2: Authorization                                  │
│ • Role-based access control (Admin, User)               │
│ • Publisher membership verification                     │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│ Layer 3: Feature Validation                             │
│ • Subscription tier check                               │
│ • Feature flag validation                               │
│ • Limit enforcement                                     │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│ Layer 4: Input Validation                               │
│ • Zod schema validation                                 │
│ • Type safety                                           │
│ • Sanitization                                          │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│ Layer 5: Audit Trail                                    │
│ • All operations logged                                 │
│ • User tracking (who added/removed)                     │
│ • Timestamp tracking                                    │
└─────────────────────────────────────────────────────────┘
```

## Technology Stack

```
┌────────────────────────────────────────────────────────┐
│                Technology Stack                        │
└────────────────────────────────────────────────────────┘

Backend Framework:     Hono (Node.js)
Database:             PostgreSQL
ORM:                  TypeORM
Validation:           Zod
Authentication:       JWT
Cron Jobs:            node-cron
Type Safety:          TypeScript
Build Tool:           esbuild
Testing:              tsx (test runner)
Documentation:        Markdown

Database Entities:
├── PublisherSubscription
├── PublisherSubscriptionFeature
└── ModpackWhitelist

Services:
├── PublisherSubscriptionService
├── WhitelistService
└── SubscriptionCronService

Middleware:
├── requireAuth
├── requireRole
└── requireCreatorAccess
```

## Integration Points

```
┌────────────────────────────────────────────────────────┐
│             External System Integration                │
└────────────────────────────────────────────────────────┘

┌──────────────┐
│   PayPal     │──┐
└──────────────┘  │
                  │  Payment
┌──────────────┐  │  Providers
│ MercadoPago  │──┤  (Existing)
└──────────────┘  │
                  │
                  ▼
            ┌──────────────┐
            │ Subscription │
            │   System     │
            └──────────────┘
                  │
                  │
            ┌─────▼─────┐
            │ Whitelist │
            │  System   │
            └───────────┘
                  │
                  ▼
            ┌──────────────┐
            │   Modpacks   │
            └──────────────┘
```

This architecture provides:
- ✅ Clear separation of concerns
- ✅ Scalable subscription management
- ✅ Flexible feature flag system
- ✅ Secure access control
- ✅ Audit capabilities
- ✅ Easy maintenance and extension
