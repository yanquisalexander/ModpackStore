# Offline Mode Testing Guide

This document provides manual testing steps to verify that the offline mode tolerance works correctly.

## Test Scenarios

### 1. Network Error During Update Check

**Steps:**
1. Open a modpack instance in the launcher
2. Disconnect network or block API access
3. Click "Verificar actualizaciones" in the update checker

**Expected Result:**
- Should show a warning toast: "No se pudo verificar actualizaciones"
- Should display "Ejecutando en modo offline. Usando información local."
- Should show "Modo offline" badge in the update checker
- Should NOT show error dialog or block functionality
- Play button should remain functional

### 2. Network Error During Prelaunch Appearance Fetch

**Steps:**
1. Open a modpack instance with custom appearance
2. Disconnect network
3. Refresh or reopen the prelaunch view

**Expected Result:**
- Should show warning toast: "Modo offline"
- Should display "No se pudo verificar actualizaciones del modpack. Usando datos locales."
- Should fallback to cached/local appearance data
- Should NOT block the instance launch process
- Play button should remain functional

### 3. Play Button Robustness

**Steps:**
1. Open any instance (modpack or vanilla)
2. Click "Jugar ahora" button
3. Immediately try to click again

**Expected Result:**
- Button should become disabled immediately after first click
- Should show loading spinner/text: "Instalando..."
- Should prevent multiple simultaneous launches
- Should remain disabled until launch process completes

### 4. Complete Offline Mode

**Steps:**
1. Completely disconnect from internet
2. Open various modpack instances
3. Try to launch instances

**Expected Result:**
- All instances should be accessible
- Play buttons should work for all instances
- Should see offline mode notifications but no blocking errors
- Local instance data should be used throughout

## Key Implementation Details

### Frontend Changes:
- `ModpackUpdateChecker.tsx`: Handles network errors gracefully with warning toasts
- `usePrelaunchInstance.tsx`: Shows offline notifications for appearance fetch failures
- Button state properly managed to prevent multiple clicks

### Backend Changes:
- `instance_manager.rs`: `check_modpack_updates` returns offline mode response instead of errors
- `prelaunch_appearance/mod.rs`: Network failures return None instead of errors
- Comprehensive logging for debugging offline behavior

## Success Criteria

✅ Launcher never blocks due to network issues
✅ Play button always functional for local instances
✅ Clear but non-intrusive offline mode notifications
✅ Graceful degradation to local/cached data
✅ Button loading states prevent multiple clicks
✅ Comprehensive error logging for debugging

## Notes

This implementation prioritizes user experience by ensuring the launcher remains functional even when the backend is unreachable. Network errors are treated as non-critical, allowing users to continue using their locally installed modpacks.