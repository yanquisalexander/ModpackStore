# Modpack Acquisition Method Migration Guide

## Overview

This guide covers the migration from the old multi-method acquisition system to the new single-method acquisition system.

## Changes Made

### Backend Changes

1. **Updated AcquisitionMethod Enum**
   - Added: `FREE`, `PAID`, `TWITCH_SUB`  
   - Changed: `PURCHASE` → split into `FREE` and `PAID`
   - Changed: `TWITCH` → `TWITCH_SUB`

2. **Added acquisitionMethod Field to Modpack Entity**
   - New field: `acquisitionMethod` (enum)
   - Default value: `FREE`

3. **Updated Services**
   - `AcquisitionService.getModpackAcquisitionInfo()` now uses single method
   - `ModpackAccessService` updated to use new logic
   - Acquisition methods now validate against the single method

4. **Updated API Endpoints**
   - `/explore/modpacks/:id/acquire/purchase` validates acquisition method
   - `/explore/modpacks/:id/acquire/twitch` validates acquisition method  
   - `/explore/modpacks/:id/validate-password` validates acquisition method

### Frontend Changes

1. **Removed Acquisition Method Dialog**
   - No more choice between multiple methods
   - Shows appropriate UI directly based on single method

2. **Updated Components**
   - `ModpackAcquisitionDialog` now uses single method directly
   - `InstallButton` updated to pass acquisition method
   - `ModpackAccessStatus` handles new method types

## Migration Steps

### 1. Deploy New Code
Deploy the updated backend and frontend code to your environment.

### 2. Run Data Migration
After deployment, run the data migration to populate the new `acquisitionMethod` field:

```bash
cd backend
npm run db:migrate-acquisition-methods
```

This script will:
- Analyze existing modpack data
- Set `acquisitionMethod` based on current field values:
  - Password set → `PASSWORD`
  - Twitch subscription required → `TWITCH_SUB` 
  - Paid (price > 0) → `PAID`
  - Default → `FREE`

### 3. Verify Migration
Check that modpacks have the correct acquisition method set and that the UI shows the appropriate flow without method selection dialogs.

## Backward Compatibility

The implementation maintains backward compatibility during transition:
- Old fields (`isPaid`, `requiresTwitchSubscription`, etc.) are preserved
- Frontend includes fallback logic for missing `acquisitionMethod` field
- API responses include both old and new fields

## Testing Checklist

- [ ] Free modpacks show "Obtener" button directly
- [ ] Paid modpacks show "Comprar ($X)" button directly  
- [ ] Password-protected modpacks show password input directly
- [ ] Twitch subscription modpacks show subscription verification directly
- [ ] No acquisition method selection dialog appears
- [ ] All acquisition flows work end-to-end
- [ ] Migration script runs without errors
- [ ] Database schema is updated correctly