# Modpack and Version Management: Testing Checklist

## I. Backend Functionality & Permissions

1.  **User Authentication & Authorization (`checkModpackPermission` middleware):**
    *   [ ] Accessing any `/v1/modpacks` or `/v1/versions` endpoint without authentication returns 401.
    *   **Modpack Creation (`POST /v1/modpacks`):**
        *   [ ] User *without* `canCreateModpacks` scope for the target `publisherId` gets 403.
        *   [ ] User *with* `canCreateModpacks` scope can successfully create a modpack (status 'draft').
    *   **Modpack Update (`PATCH /v1/modpacks/:modpackId`):**
        *   [ ] User *without* `canEditModpacks` scope for the modpack gets 403.
        *   [ ] User *with* `canEditModpacks` scope can update allowed fields.
        *   [ ] Attempting to update `slug`, `publisherId`, `creatorUserId`, `status` via this endpoint is ignored or results in validation error.
    *   **Modpack Delete (`DELETE /v1/modpacks/:modpackId`):**
        *   [ ] User *without* `canDeleteModpacks` scope for the modpack gets 403.
        *   [ ] User *with* `canDeleteModpacks` scope successfully soft-deletes (status changes to 'deleted').
    *   **Version Creation (`POST /v1/modpacks/:modpackId/versions`):**
        *   [ ] User *without* `canEditModpacks` (or a more specific 'canCreateVersions') for the parent modpack gets 403.
        *   [ ] User *with* permission can create a version (status 'draft').
    *   **Version Update (`PATCH /v1/versions/:versionId`):**
        *   [ ] User *without* `canEditModpacks` for the parent modpack gets 403 (Requires middleware to resolve versionId to modpackId).
        *   [ ] User *with* permission can update a 'draft' version.
        *   [ ] Attempting to update a 'published' or 'archived' version gets 403/400.
    *   **Version Publish (`POST /v1/versions/:versionId/publish`):**
        *   [ ] User *without* `canPublishVersions` for the parent modpack gets 403 (Requires middleware enhancement to resolve versionId to modpackId).
        *   [ ] User *with* permission can publish a 'draft' version.
        *   [ ] Attempting to publish a non-draft version gets 400.
    *   [ ] Test with users not belonging to the publisher at all – should get 403 for any operation requiring publisher membership.
    *   [ ] Test with both org-level scopes (e.g., `ScopesTable.publisherId` set, `ScopesTable.modpackId` is null) and modpack-specific scopes (e.g., `ScopesTable.modpackId` is set).

2.  **Modpack Endpoint Logic:**
    *   [ ] `POST /v1/modpacks`: Correctly sets `creatorUserId`, `publisherId`, initial `status` ('draft'). Slug conflict returns 409. Validation for required fields (name, slug, iconUrl, bannerUrl, visibility, publisherId) works.
    *   [ ] `GET /v1/modpacks`: Returns only modpacks the user has management rights to (via org or specific modpack scope). Does not show 'deleted' modpacks.
    *   [ ] `PATCH /v1/modpacks/:modpackId`: Updates `updatedAt`. Correctly updates fields.
    *   [ ] `DELETE /v1/modpacks/:modpackId`: Idempotent (calling delete on an already 'deleted' modpack is fine, returns success). Modpack `status` is 'deleted', `updatedAt` is updated.

3.  **Version Endpoint Logic:**
    *   [ ] `POST /v1/modpacks/:modpackId/versions`: Sets `modpackId`, `createdBy`, initial `status` ('draft'), `releaseDate` is null. Cannot create for a 'deleted' or 'archived' modpack. Validation for required fields (version, mcVersion, changelog) works.
    *   [ ] `PATCH /v1/versions/:versionId`: Only updates allowed fields (`mcVersion`, `forgeVersion`, `changelog`). Updates `updatedAt`.
    *   [ ] `POST /v1/versions/:versionId/publish`: Correctly sets `status` to 'published' and `releaseDate` to current time. Version's `updatedAt` is updated. Parent modpack's `updatedAt` is also updated.
    *   [ ] `GET /v1/modpacks/:modpackId/versions`: Returns versions for the specified modpack. Does not list versions for 'deleted' modpacks. (Default: does not show 'archived' versions, unless a filter is added later).

4.  **Data Validation & Error Handling (Backend):**
    *   [ ] Test with invalid input for all relevant endpoints (e.g., missing required fields, invalid data types, invalid UUIDs, overly long strings) - Zod validation should return 400 with descriptive errors.
    *   [ ] Test edge cases (e.g., empty strings for optional fields, null for nullable fields).
    *   [ ] Non-existent `modpackId` or `versionId` in paths should result in 404 where appropriate (e.g., PATCH/DELETE specific resources).

## II. Frontend User Experience & UI

1.  **Modpack Management (`MyModpacksView` & Dialogs):**
    *   [ ] "Create New Modpack" button always visible. Dialog (`CreateModpackDialog`) opens.
    *   [ ] Form validation (client-side Zod) works for create dialog:
        *   [ ] Name (required, min/max length)
        *   [ ] Slug (required, min/max length, regex pattern)
        *   [ ] Publisher ID (required, UUID format - basic check)
        *   [ ] Icon URL (required, valid URL)
        *   [ ] Banner URL (required, valid URL)
        *   [ ] Visibility (selection required)
    *   [ ] Server errors (e.g., slug conflict from 409, other 400/500 errors) displayed correctly in create dialog.
    *   [ ] Successful modpack creation updates the list (refreshes), shows success toast, and closes dialog.
    *   [ ] "Edit" & "Delete" buttons visible for each listed modpack.
    *   [ ] "Edit Modpack" dialog (`EditModpackDialog`) pre-fills data correctly.
        *   [ ] Slug and Publisher ID are displayed as read-only.
        *   [ ] Client-side validation works for editable fields.
        *   [ ] Successful update refreshes list, shows success toast, and closes dialog.
    *   [ ] "Delete Modpack" shows confirmation dialog (`AlertDialog`).
        *   [ ] Confirming delete (optimistically) updates list, shows success toast.
        *   [ ] Cancelling closes dialog with no action.
    *   [ ] Modpack list (`ModpackListItem`) correctly displays name, status (with appropriate styling), icon, slug, and last updated date.
    *   [ ] Loading states (e.g., "Creating...", "Saving...", disabled buttons) active during form submissions in dialogs.

2.  **Version Management (`ManageModpackVersionsView` & Dialogs):**
    *   [ ] Navigation to this view from "Manage Versions" button in `MyModpacksView` works, passing correct `modpackId`.
    *   [ ] Parent modpack's name is displayed correctly on the page.
    *   [ ] "Create New Version" button visible only if parent modpack status is not 'deleted' or 'archived'. Dialog (`CreateVersionDialog`) opens.
    *   [ ] Form validation (client-side Zod) for create version dialog works:
        *   [ ] Version string (required, max length, regex pattern)
        *   [ ] Minecraft Version (required, max length)
        *   [ ] Changelog (required, min length)
    *   [ ] Successful version creation updates list, shows success toast, and closes dialog.
    *   [ ] "Edit" button on `VersionListItem` visible only for 'draft' versions.
        *   [ ] `EditVersionDialog` pre-fills data correctly. Version string is read-only.
        *   [ ] Client-side validation works for editable fields (MC Version, Forge Version, Changelog).
        *   [ ] Successful update refreshes list, shows success toast, and closes dialog.
        *   [ ] Cannot submit if version is not 'draft' (button disabled).
    *   [ ] "Publish" button on `VersionListItem` visible only for 'draft' versions.
        *   [ ] Shows confirmation dialog (`AlertDialog`).
        *   [ ] Confirming publish updates status/releaseDate in list (refreshes), shows success toast.
        *   [ ] Cancelling closes dialog with no action.
    *   [ ] Version list (`VersionListItem`) correctly displays version string, status (styled), MC version, Forge version (if any), changelog preview, created date, and release date (if published).
    *   [ ] Loading states active during form submissions in dialogs.
    *   [ ] "Back to My Modpacks" link works.

3.  **General UX & Error Handling (Frontend):**
    *   [ ] Toasts for success/error are consistently used across all CUD operations and are clear.
    *   [ ] API error messages from backend are displayed in toasts or form errors where appropriate.
    *   [ ] Navigation between views (`MyModpacksView` <-> `ManageModpackVersionsView`) is smooth.
    *   [ ] No console errors during typical user flows.
    *   [ ] Empty states (e.g., "No modpacks found", "No versions found") are displayed appropriately.
    *   [ ] UI remains responsive during API calls (buttons disabled, not freezing).
