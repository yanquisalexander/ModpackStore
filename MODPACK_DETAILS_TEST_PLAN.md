# Test Plan: Modpack Details Improvements

This document outlines the testing strategy for the modpack details improvements feature, including the "Go to Modpack" button, "Copy ID" functionality, and backend search enhancements.

## Feature Overview

### Frontend Features
1. **"Go to Modpack" button** - Navigate from creator edit view to public modpack view
2. **"Copy ID" button** - Copy modpack ID in format `mpack:{ID}` to clipboard
3. **Draft modpack banner** - Display warning banner when viewing draft modpacks

### Backend Features
1. **Search by ID pattern** - Support searching modpacks using `mpack:{ID}` format
2. **Permission-based access**:
   - Private modpacks: accessible by anyone with the ID
   - Draft modpacks: only accessible to creator, admins, or team members
   - Archived/deleted modpacks: not accessible

## Test Cases

### Frontend Tests

#### TC1: Copy ID Button
**Preconditions:**
- User is authenticated as a creator
- User has access to a modpack edit view

**Steps:**
1. Navigate to `/creators/org/{orgId}/modpacks/{modpackId}/edit`
2. Click the "Copiar ID" button next to the modpack title

**Expected Results:**
- Clipboard contains text in format: `mpack:{modpackId}`
- Toast notification appears with message "ID copiado al portapapeles"
- Toast description shows the copied ID

**Test Data:**
- Example modpack ID: `123e4567-e89b-12d3-a456-426614174000`
- Expected clipboard value: `mpack:123e4567-e89b-12d3-a456-426614174000`

#### TC2: Go to Modpack Button
**Preconditions:**
- User is authenticated as a creator
- User has access to a modpack edit view

**Steps:**
1. Navigate to `/creators/org/{orgId}/modpacks/{modpackId}/edit`
2. Click the "Ir al modpack" button

**Expected Results:**
- User is redirected to `/modpack/{modpackId}`
- Public modpack view is displayed

#### TC3: Draft Modpack Banner
**Preconditions:**
- Modpack has status "draft"
- User has permission to view the draft modpack

**Steps:**
1. Navigate to `/modpack/{modpackId}` for a draft modpack

**Expected Results:**
- Yellow banner is displayed below the header
- Banner text reads: "Estás previsualizando un modpack no disponible al público general."
- Banner has yellow background with semi-transparency

**Test for Different Statuses:**
- Draft modpack: Banner should appear
- Published modpack: Banner should NOT appear
- Archived modpack: User should not have access (404)

### Backend Tests

#### TC4: Regular Text Search
**Test to ensure existing functionality still works**

**Request:**
```
GET /explore/search?q=adventure
```

**Expected Response:**
- Status: 200
- Returns array of published, public modpacks matching "adventure"
- Results include modpacks with "adventure" in name, short description, or description
- Does NOT include draft, private, archived, or deleted modpacks

#### TC5: Search by mpack ID Pattern (Public Modpack)
**Preconditions:**
- Modpack exists with status "published" and visibility "public"

**Request:**
```
GET /explore/search?q=mpack:123e4567-e89b-12d3-a456-426614174000
```

**Expected Response:**
- Status: 200
- Returns array with single modpack matching the ID
- Modpack details include full information

#### TC6: Search by mpack ID Pattern (Private Modpack, Unauthenticated)
**Preconditions:**
- Modpack exists with status "published" and visibility "private"

**Request:**
```
GET /explore/search?q=mpack:123e4567-e89b-12d3-a456-426614174000
```

**Expected Response:**
- Status: 200
- Returns array with single modpack (private modpack is accessible via ID)
- Modpack details include full information

#### TC7: Search by mpack ID Pattern (Draft Modpack, Unauthenticated)
**Preconditions:**
- Modpack exists with status "draft"

**Request:**
```
GET /explore/search?q=mpack:123e4567-e89b-12d3-a456-426614174000
```

**Expected Response:**
- Status: 200
- Returns empty array (draft modpack not accessible without authentication)

#### TC8: Search by mpack ID Pattern (Draft Modpack, Creator Authenticated)
**Preconditions:**
- Modpack exists with status "draft"
- User is the creator of the modpack

**Request:**
```
GET /explore/search?q=mpack:123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer {creatorToken}
```

**Expected Response:**
- Status: 200
- Returns array with single modpack
- Modpack details include full information

#### TC9: Search by mpack ID Pattern (Draft Modpack, Admin Authenticated)
**Preconditions:**
- Modpack exists with status "draft"
- User is an admin (not the creator)

**Request:**
```
GET /explore/search?q=mpack:123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer {adminToken}
```

**Expected Response:**
- Status: 200
- Returns array with single modpack
- Modpack details include full information

#### TC10: Search by mpack ID Pattern (Draft Modpack, Team Member Authenticated)
**Preconditions:**
- Modpack exists with status "draft"
- User is a team member of the publisher

**Request:**
```
GET /explore/search?q=mpack:123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer {teamMemberToken}
```

**Expected Response:**
- Status: 200
- Returns array with single modpack
- Modpack details include full information

#### TC11: Search by mpack ID Pattern (Invalid ID Format)
**Request:**
```
GET /explore/search?q=mpack:invalid-id-format
```

**Expected Response:**
- Status: 200
- Treats as regular text search
- Returns modpacks matching text "mpack:invalid-id-format" (likely empty)

#### TC12: Search by mpack ID Pattern (Non-existent Modpack)
**Request:**
```
GET /explore/search?q=mpack:00000000-0000-0000-0000-000000000000
```

**Expected Response:**
- Status: 200
- Returns empty array

#### TC13: Direct Modpack Access (Draft, Unauthenticated)
**Preconditions:**
- Modpack exists with status "draft"

**Request:**
```
GET /explore/modpacks/123e4567-e89b-12d3-a456-426614174000
```

**Expected Response:**
- Status: 404
- Error message: "Modpack not found."

#### TC14: Direct Modpack Access (Private, Unauthenticated)
**Preconditions:**
- Modpack exists with status "published" and visibility "private"

**Request:**
```
GET /explore/modpacks/123e4567-e89b-12d3-a456-426614174000
```

**Expected Response:**
- Status: 200
- Returns modpack details (private modpack is accessible directly)

#### TC15: Direct Modpack Access (Archived)
**Preconditions:**
- Modpack exists with status "archived"

**Request:**
```
GET /explore/modpacks/123e4567-e89b-12d3-a456-426614174000
```

**Expected Response:**
- Status: 404
- Error message: "Modpack not found."

## Edge Cases

### EC1: Clipboard API Not Available
**Scenario:** Browser doesn't support clipboard API

**Steps:**
1. Test in browser without clipboard support or with permissions denied
2. Click "Copiar ID" button

**Expected:**
- Error toast: "Error al copiar el ID al portapapeles"

### EC2: Very Long Search Query
**Scenario:** Search query is very long

**Request:**
```
GET /explore/search?q=mpack:123e4567-e89b-12d3-a456-426614174000-extra-text-that-breaks-pattern
```

**Expected:**
- Treats as regular text search (pattern doesn't match)
- Returns text search results

### EC3: Case Sensitivity in mpack Pattern
**Request:**
```
GET /explore/search?q=MPACK:123E4567-E89B-12D3-A456-426614174000
```

**Expected:**
- Pattern should match (case-insensitive regex)
- Returns modpack if it exists and user has permission

## Manual Testing Checklist

### Frontend
- [ ] Copy ID button displays correctly in edit view
- [ ] Copy ID button copies correct format to clipboard
- [ ] Toast notification appears after copying
- [ ] Go to Modpack button displays correctly
- [ ] Go to Modpack button navigates to correct URL
- [ ] Draft banner appears only for draft modpacks
- [ ] Draft banner displays correct message and styling
- [ ] UI is responsive on different screen sizes

### Backend
- [ ] Regular text search continues to work
- [ ] mpack:ID pattern is detected correctly
- [ ] Private modpacks are accessible via ID
- [ ] Draft modpacks require authentication
- [ ] Creator can access their draft modpacks
- [ ] Admins can access any draft modpack
- [ ] Team members can access their publisher's draft modpacks
- [ ] Non-team members cannot access draft modpacks
- [ ] Archived/deleted modpacks are not accessible
- [ ] Invalid ID format falls back to text search
- [ ] optionalAuth middleware works correctly

## Performance Considerations

### Backend Performance
- Search by ID should be fast (direct database lookup by UUID)
- Permission checks should not significantly impact performance
- Regular text search performance should not be affected

## Security Considerations

### Access Control
- ✅ Draft modpacks are protected by authentication
- ✅ Only authorized users can access draft modpacks
- ✅ Private modpacks are accessible via ID (as designed)
- ✅ Archived/deleted modpacks are not accessible

### Input Validation
- ✅ UUID pattern validation prevents injection attacks
- ✅ Invalid input falls back to safe text search

## Browser Compatibility

### Clipboard API
- Chrome/Edge: ✅ Supported
- Firefox: ✅ Supported
- Safari: ✅ Supported (requires secure context)

**Note:** Feature requires HTTPS or localhost for clipboard access.

## Conclusion

This test plan covers all aspects of the modpack details improvements feature. Execute these tests in the following order:

1. Frontend tests (TC1-TC3)
2. Backend regular functionality (TC4)
3. Backend ID search with various permissions (TC5-TC12)
4. Backend direct access (TC13-TC15)
5. Edge cases (EC1-EC3)

Report any failures or unexpected behavior for investigation.
