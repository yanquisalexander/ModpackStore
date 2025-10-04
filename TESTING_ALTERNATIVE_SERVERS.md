# Testing Guide: Alternative Minecraft Servers

## Overview
This guide outlines how to test the alternative Minecraft launcher meta servers implementation to ensure proper failover functionality.

## Prerequisites
- ModpackStore application built with the new changes
- Network tools for simulating failures (optional but recommended)
- Access to application logs

## Test Cases

### Test 1: Normal Operation (All Servers Working)

**Objective:** Verify that the primary server is used when available.

**Steps:**
1. Ensure internet connection is working
2. Open the launcher application
3. Click "Create New Instance" or open an existing instance
4. Wait for Minecraft versions to load

**Expected Results:**
- ✅ Versions load quickly (1-3 seconds)
- ✅ Backend logs show: `Successfully fetched manifest from: https://launchermeta.mojang.com/`
- ✅ Frontend console shows: `Successfully fetched manifest from: https://launchermeta.mojang.com/`
- ✅ No error messages displayed to user

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test 2: Primary Server Failure (Failover to BMCLAPI)

**Objective:** Verify automatic failover when primary server is unavailable.

**Setup:**
Option A - Using hosts file (easier):
```bash
# Linux/Mac: Add to /etc/hosts
127.0.0.1 launchermeta.mojang.com

# Windows: Add to C:\Windows\System32\drivers\etc\hosts
127.0.0.1 launchermeta.mojang.com
```

Option B - Using firewall (more realistic):
```bash
# Linux
sudo iptables -A OUTPUT -d launchermeta.mojang.com -j DROP

# Windows (PowerShell as Admin)
New-NetFirewallRule -DisplayName "Block Mojang" -Direction Outbound -RemoteAddress launchermeta.mojang.com -Action Block
```

**Steps:**
1. Block access to launchermeta.mojang.com using one of the methods above
2. Open the launcher application
3. Click "Create New Instance" or open an existing instance
4. Wait for Minecraft versions to load
5. Restore access (remove hosts entry or firewall rule)

**Expected Results:**
- ✅ Versions eventually load (11-13 seconds)
- ✅ Backend logs show:
  - `Trying server: https://launchermeta.mojang.com/...`
  - `Server https://launchermeta.mojang.com/... failed: timeout` or similar
  - `Trying server: https://bmclapi2.bangbang93.com/...`
  - `Successfully fetched manifest from: https://bmclapi2.bangbang93.com/`
- ✅ Frontend console shows similar failover pattern
- ✅ No error dialog shown to user
- ✅ Application remains functional

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test 3: Multiple Server Failures (Testing All Mirrors)

**Objective:** Verify failover through all servers in the list.

**Setup:**
Block both Mojang and BMCLAPI:
```bash
# In hosts file
127.0.0.1 launchermeta.mojang.com
127.0.0.1 bmclapi2.bangbang93.com
```

**Steps:**
1. Block first two servers
2. Open the launcher application
3. Click "Create New Instance"
4. Wait for versions to load
5. Restore access

**Expected Results:**
- ✅ Versions load after longer delay (21-23 seconds)
- ✅ Logs show attempts to all three servers
- ✅ Final success from: `https://download.mcbbs.net/`
- ✅ Application remains functional

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test 4: Complete Failure (All Servers Down)

**Objective:** Verify proper error handling when all servers fail.

**Setup:**
Block all three servers:
```bash
# In hosts file
127.0.0.1 launchermeta.mojang.com
127.0.0.1 bmclapi2.bangbang93.com
127.0.0.1 download.mcbbs.net
```

**Steps:**
1. Block all three servers
2. Open the launcher application
3. Click "Create New Instance"
4. Wait for timeout
5. Restore access

**Expected Results:**
- ✅ Loading indicator shows for 60+ seconds
- ✅ Error toast appears: "No se pudieron cargar las versiones de Minecraft"
- ✅ Backend logs show:
  - Attempts to all three servers
  - All attempts failed
  - `Failed to fetch manifest: All manifest servers failed`
- ✅ Application doesn't crash
- ✅ User can try again after restoring connection

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test 5: Version JSON Failover

**Objective:** Verify that version-specific JSON also uses failover.

**Setup:**
Block Mojang server (as in Test 2)

**Steps:**
1. Block launchermeta.mojang.com
2. Create a new Vanilla instance
3. Select a Minecraft version
4. Click Create
5. Observe the instance creation process

**Expected Results:**
- ✅ Instance creation succeeds
- ✅ Version JSON is fetched from mirror server
- ✅ Logs show URL conversion to mirror
- ✅ All version files download correctly
- ✅ Instance is playable

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test 6: Cache Functionality

**Objective:** Verify that caching works and reduces server requests.

**Steps:**
1. Open launcher and create instance (loads manifest)
2. Close the instance view
3. Open instance view again within 1 hour
4. Check logs

**Expected Results:**
- ✅ Second load is instant
- ✅ Backend logs show cache hit
- ✅ No new network requests to manifest servers

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test 7: Forge Version Loading

**Objective:** Verify Forge version selection works with failover.

**Steps:**
1. Click "Create New Instance"
2. Select "Forge" as instance type
3. Select a Minecraft version
4. Observe Forge versions loading

**Expected Results:**
- ✅ Forge versions load successfully
- ✅ Can select Forge version
- ✅ Instance creation succeeds with Forge

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test 8: Creator Component (CreateVersionDialog)

**Objective:** Verify failover works in modpack version creation.

**Steps:**
1. Navigate to Creator section
2. Open a modpack
3. Click "Create New Version"
4. Observe version list loading

**Expected Results:**
- ✅ Minecraft versions load successfully
- ✅ Same failover behavior as main instance creation
- ✅ Can create modpack version

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test 9: Creator Component (ModpackVersionsDialog)

**Objective:** Verify failover in modpack versions management.

**Steps:**
1. Navigate to Creator section
2. Open a modpack
3. View versions list
4. Observe version data loading

**Expected Results:**
- ✅ Version information loads successfully
- ✅ Failover works if primary server is down
- ✅ Can manage versions

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test 10: Performance Test

**Objective:** Measure failover performance impact.

**Setup:** Use network throttling or measure times

**Steps:**
1. Test with all servers working: measure load time
2. Test with primary server blocked: measure load time
3. Test with two servers blocked: measure load time

**Expected Results:**
- ✅ Normal operation: 1-3 seconds
- ✅ One server down: 11-13 seconds
- ✅ Two servers down: 21-23 seconds
- ✅ Times are acceptable for user experience

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

## Log Verification

### Where to Find Logs

**Backend (Rust) Logs:**
- Linux: `~/.local/share/dev.alexitoo.modpackstore/logs/`
- Windows: `%APPDATA%/dev.alexitoo.modpackstore/logs/`
- macOS: `~/Library/Application Support/dev.alexitoo.modpackstore/logs/`

**Frontend (Browser) Logs:**
- Open DevTools (F12)
- Go to Console tab
- Filter for: `fetch` or `manifest`

### What to Look For

**Success Pattern:**
```
[INFO] [fetch_manifest_with_failover] Trying server: https://launchermeta.mojang.com/...
[INFO] [fetch_manifest_with_failover] Successfully fetched manifest from: https://launchermeta.mojang.com/...
```

**Failover Pattern:**
```
[INFO] [fetch_manifest_with_failover] Trying server: https://launchermeta.mojang.com/...
[WARN] [fetch_manifest_with_failover] Server https://launchermeta.mojang.com/... failed: timeout
[INFO] [fetch_manifest_with_failover] Trying server: https://bmclapi2.bangbang93.com/...
[INFO] [fetch_manifest_with_failover] Successfully fetched manifest from: https://bmclapi2.bangbang93.com/...
```

**Error Pattern:**
```
[INFO] [fetch_manifest_with_failover] Trying server: https://launchermeta.mojang.com/...
[WARN] [fetch_manifest_with_failover] Server https://launchermeta.mojang.com/... failed: timeout
[INFO] [fetch_manifest_with_failover] Trying server: https://bmclapi2.bangbang93.com/...
[WARN] [fetch_manifest_with_failover] Server https://bmclapi2.bangbang93.com/... failed: timeout
[INFO] [fetch_manifest_with_failover] Trying server: https://download.mcbbs.net/...
[WARN] [fetch_manifest_with_failover] Server https://download.mcbbs.net/... failed: timeout
[ERROR] [get_version_manifest] Failed to fetch manifest: All manifest servers failed
```

## Cleanup After Testing

### Remove Host File Entries
```bash
# Linux/Mac
sudo nano /etc/hosts
# Remove the test entries

# Windows
notepad C:\Windows\System32\drivers\etc\hosts
# Remove the test entries
```

### Remove Firewall Rules
```bash
# Linux
sudo iptables -D OUTPUT -d launchermeta.mojang.com -j DROP
sudo iptables -D OUTPUT -d bmclapi2.bangbang93.com -j DROP
sudo iptables -D OUTPUT -d download.mcbbs.net -j DROP

# Windows (PowerShell as Admin)
Remove-NetFirewallRule -DisplayName "Block Mojang"
```

## Summary Checklist

- [ ] Test 1: Normal operation works
- [ ] Test 2: Failover to secondary server works
- [ ] Test 3: Failover to tertiary server works
- [ ] Test 4: Error handling when all servers fail
- [ ] Test 5: Version JSON failover works
- [ ] Test 6: Caching reduces requests
- [ ] Test 7: Forge loading works
- [ ] Test 8: CreateVersionDialog works
- [ ] Test 9: ModpackVersionsDialog works
- [ ] Test 10: Performance is acceptable
- [ ] Logs show correct failover pattern
- [ ] No crashes or errors in normal use
- [ ] User experience is smooth

## Known Limitations

1. **Timeout Duration**: With default settings (10s timeout, 1 retry), complete failover can take up to ~60 seconds if all servers are down.
   
2. **Mirror Availability**: Alternative servers (BMCLAPI, MCBBS) may occasionally be slower or unavailable depending on region.

3. **Version JSON Coverage**: Not all version JSONs may be available on all mirrors. The implementation handles this by trying multiple URLs.

## Troubleshooting

### Issue: Versions not loading even with working internet
- Check if hosts file has test entries (remove them)
- Clear application cache
- Check firewall/antivirus settings

### Issue: Very slow loading times
- Check which server is actually being used (check logs)
- Consider reordering servers based on your region
- Reduce timeout in configuration

### Issue: Logs not showing
- Check log file location (see "Where to Find Logs" above)
- Ensure log level is set to INFO or DEBUG
- Check browser console for frontend logs

## Test Results Summary

| Test # | Test Name | Status | Notes |
|--------|-----------|--------|-------|
| 1 | Normal Operation | ⬜ | |
| 2 | Primary Failure | ⬜ | |
| 3 | Multiple Failures | ⬜ | |
| 4 | Complete Failure | ⬜ | |
| 5 | Version JSON | ⬜ | |
| 6 | Cache | ⬜ | |
| 7 | Forge | ⬜ | |
| 8 | CreateVersionDialog | ⬜ | |
| 9 | ModpackVersionsDialog | ⬜ | |
| 10 | Performance | ⬜ | |

**Overall Status:** ⬜ Not Started | 🔄 In Progress | ✅ Complete

---

*Note: This testing should be performed by the repository maintainers or QA team with access to the built application. The implementation has been completed and committed to the PR branch.*
