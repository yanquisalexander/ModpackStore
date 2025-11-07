# Creator Analytics API Documentation

## Overview

The Creator Analytics API provides comprehensive metrics and insights for modpack creators to understand how their modpacks perform on the platform. This system tracks real installations (not just acquisitions), votes evolution, and provides time-series data for trend analysis.

## Key Concepts

### Downloads vs Acquisitions

- **ModpackAcquisition**: Represents when a user obtains access/rights to a modpack (purchase, password entry, etc.)
- **ModpackDownload**: Represents when a user actually installs the modpack on their client

This distinction allows creators to see:
- How many users have access vs. how many actually use the modpack
- Installation rates after acquisition
- Real engagement metrics

## Authentication

All analytics endpoints require:
1. User authentication (Bearer token)
2. Creator access (user must be a creator)
3. Organization membership (for publisher-specific endpoints)

```typescript
headers: {
  'Authorization': 'Bearer YOUR_ACCESS_TOKEN'
}
```

## Endpoints

### 1. Publisher Overview

Get aggregate analytics across all modpacks in a publisher.

**Endpoint:** `GET /creators/publishers/:publisherId/analytics/overview`

**Response:**
```json
{
  "success": true,
  "data": {
    "totalDownloads": 1523,
    "totalModpacks": 5,
    "totalLikes": 342,
    "totalDislikes": 28,
    "topModpacks": [
      {
        "modpackId": "uuid",
        "name": "Modpack Name",
        "downloads": 856,
        "likes": 203,
        "dislikes": 12
      }
    ]
  }
}
```

**Use Cases:**
- Dashboard overview for publishers
- Quick insights into portfolio performance
- Identify top-performing modpacks

---

### 2. Modpack Analytics

Get detailed analytics for a specific modpack.

**Endpoint:** `GET /creators/publishers/:publisherId/analytics/modpacks/:modpackId`

**Response:**
```json
{
  "success": true,
  "data": {
    "modpackId": "uuid",
    "name": "Modpack Name",
    "totalDownloads": 856,
    "likes": 203,
    "dislikes": 12,
    "netScore": 191,
    "downloadsByVersion": [
      {
        "versionId": "uuid",
        "version": "1.2.0",
        "downloads": 456
      },
      {
        "versionId": "uuid",
        "version": "1.1.0",
        "downloads": 400
      }
    ],
    "recentDownloads": [
      {
        "userId": "uuid",
        "username": "player123",
        "versionId": "uuid",
        "version": "1.2.0",
        "downloadedAt": "2025-01-15T10:30:00Z"
      }
    ]
  }
}
```

**Use Cases:**
- Detailed modpack performance page
- Version popularity comparison
- Recent activity monitoring

---

### 3. Version Analytics

Get analytics for a specific modpack version.

**Endpoint:** `GET /creators/publishers/:publisherId/analytics/modpacks/:modpackId/versions/:versionId`

**Response:**
```json
{
  "success": true,
  "data": {
    "versionId": "uuid",
    "version": "1.2.0",
    "downloads": 456,
    "mcVersion": "1.20.1",
    "loaderType": "forge",
    "loaderVersion": "47.2.0",
    "publishedAt": "2025-01-10T00:00:00Z"
  }
}
```

**Use Cases:**
- Version-specific performance tracking
- Understanding version adoption rates
- Planning deprecation of old versions

---

### 4. Downloads Timeline

Get time-series data for downloads over a date range.

**Endpoint:** `GET /creators/publishers/:publisherId/analytics/modpacks/:modpackId/downloads-timeline`

**Query Parameters:**
- `startDate` (optional): ISO 8601 date string (e.g., "2025-01-01")
- `endDate` (optional): ISO 8601 date string (e.g., "2025-01-31")

**Example:**
```
GET /creators/publishers/:publisherId/analytics/modpacks/:modpackId/downloads-timeline?startDate=2025-01-01&endDate=2025-01-31
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "date": "2025-01-15",
      "downloads": 45
    },
    {
      "date": "2025-01-16",
      "downloads": 52
    }
  ]
}
```

**Use Cases:**
- Creating download trend charts
- Identifying growth patterns
- Correlating downloads with events (updates, promotions, etc.)

---

### 5. Votes Timeline

Get time-series data for likes/dislikes evolution.

**Endpoint:** `GET /creators/publishers/:publisherId/analytics/modpacks/:modpackId/votes-timeline`

**Query Parameters:**
- `startDate` (optional): ISO 8601 date string
- `endDate` (optional): ISO 8601 date string
- `cumulative` (optional): Boolean ("true" or "false")
  - `false` (default): Daily vote counts
  - `true`: Cumulative running totals

**Example:**
```
GET /creators/publishers/:publisherId/analytics/modpacks/:modpackId/votes-timeline?cumulative=true&startDate=2025-01-01
```

**Response (Daily):**
```json
{
  "success": true,
  "data": [
    {
      "date": "2025-01-15",
      "likes": 12,
      "dislikes": 2,
      "netScore": 10
    }
  ]
}
```

**Response (Cumulative):**
```json
{
  "success": true,
  "data": [
    {
      "date": "2025-01-15",
      "likes": 203,
      "dislikes": 12,
      "netScore": 191
    }
  ]
}
```

**Use Cases:**
- Visualizing sentiment over time
- Understanding reception to updates
- Identifying problematic periods

---

### 6. Track Installation

Track when a user installs a modpack (called by the client application).

**Endpoint:** `POST /creators/track/install/:modpackId/:versionId`

**Headers:**
- Client IP is extracted from `x-forwarded-for` or `x-real-ip`
- User agent is extracted from `user-agent`

**Response:**
```json
{
  "success": true,
  "message": "Installation tracked successfully",
  "downloadId": "uuid"
}
```

**Notes:**
- This endpoint is called automatically by the application
- Authentication is required (user must own or have access to the modpack)
- Tracking failures are logged but don't block installation

---

## Integration Example

### Frontend Integration

```typescript
import { trackModpackInstall } from '@/services/analytics';

async function handleInstallModpack(modpackId: string, versionId: string) {
  try {
    // Install the modpack
    await invoke("create_modpack_instance", {
      instanceName,
      modpackId,
      versionId,
      password: null
    });

    // Track the installation (non-blocking)
    if (sessionTokens?.accessToken) {
      trackModpackInstall(sessionTokens.accessToken, modpackId, versionId)
        .catch(err => console.error('Failed to track installation:', err));
    }

    // Show success message
    toast.success("Installation started!");
  } catch (err) {
    console.error("Installation failed:", err);
  }
}
```

### Fetching Analytics

```typescript
async function fetchModpackAnalytics(publisherId: string, modpackId: string) {
  const response = await fetch(
    `${API_ENDPOINT}/creators/publishers/${publisherId}/analytics/modpacks/${modpackId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch analytics');
  }

  const data = await response.json();
  return data.data; // Returns ModpackAnalytics object
}
```

---

## Database Schema

### ModpackDownload Table

```sql
CREATE TABLE modpack_downloads (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  modpack_id UUID NOT NULL REFERENCES modpacks(id),
  version_id UUID NOT NULL REFERENCES modpack_versions(id),
  client_ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_downloads_modpack_date ON modpack_downloads(modpack_id, created_at);
CREATE INDEX idx_downloads_version_date ON modpack_downloads(version_id, created_at);
CREATE INDEX idx_downloads_user_date ON modpack_downloads(user_id, created_at);
CREATE INDEX idx_downloads_modpack_version_date ON modpack_downloads(modpack_id, version_id, created_at);
```

---

## Best Practices

### 1. Caching

Consider caching analytics results for frequently accessed data:

```typescript
// Cache overview for 5 minutes
const CACHE_TTL = 5 * 60 * 1000;
let cachedOverview: { data: any; timestamp: number } | null = null;

async function getCachedOverview(publisherId: string) {
  if (cachedOverview && Date.now() - cachedOverview.timestamp < CACHE_TTL) {
    return cachedOverview.data;
  }
  
  const data = await fetchOverview(publisherId);
  cachedOverview = { data, timestamp: Date.now() };
  return data;
}
```

### 2. Date Range Queries

Always specify reasonable date ranges to avoid overwhelming queries:

```typescript
// Get last 30 days
const endDate = new Date();
const startDate = new Date();
startDate.setDate(startDate.getDate() - 30);

const timeline = await fetchDownloadsTimeline(
  modpackId,
  startDate.toISOString().split('T')[0],
  endDate.toISOString().split('T')[0]
);
```

### 3. Error Handling

Always handle potential errors gracefully:

```typescript
try {
  const analytics = await fetchModpackAnalytics(publisherId, modpackId);
  displayAnalytics(analytics);
} catch (error) {
  console.error('Failed to load analytics:', error);
  showErrorMessage('Analytics temporarily unavailable');
}
```

### 4. Progressive Enhancement

Load analytics progressively to avoid blocking the UI:

```typescript
// Load overview first (fast)
const overview = await fetchOverview(publisherId);
displayOverview(overview);

// Then load detailed data (slower)
const detailedData = await Promise.all([
  fetchDownloadsTimeline(modpackId),
  fetchVotesTimeline(modpackId),
]);
displayDetailedCharts(detailedData);
```

---

## Rate Limiting

Current implementation doesn't have explicit rate limits, but consider:
- Reasonable polling intervals (don't poll more than once per minute)
- Batch requests when possible
- Use webhooks/websockets for real-time updates (future enhancement)

---

## Future Enhancements

Planned features:
1. **Retention Metrics**: Track how long users keep modpacks installed
2. **Update Analytics**: Measure update adoption rates
3. **Comparative Analytics**: Compare your modpacks to platform averages
4. **Export Data**: CSV/JSON export for external analysis
5. **Webhooks**: Real-time notifications for milestones
6. **A/B Testing**: Compare different versions/descriptions
7. **Geographic Data**: See where your downloads come from (with privacy)

---

## Support

For questions or issues with the analytics API:
- Check this documentation first
- Review the test file: `backend/test/analytics.test.ts`
- Open an issue on GitHub
- Contact the development team

---

## Changelog

### Version 1.0.0 (2025-01-15)
- Initial release
- Publisher overview endpoint
- Modpack analytics endpoint
- Version analytics endpoint
- Downloads timeline endpoint
- Votes timeline endpoint
- Installation tracking endpoint
