# Manual Testing Checklist - Wall-E Learning Diagnostics Tab

**Date:** January 2, 2026  
**Deployment:** Completed  
**Worker Version:** 9bcf0bdf-f2a3-4976-9a6e-81aa4479a708  
**Pages Deployment:** commit bb02edf (successful build, 48s)

---

## ✅ Pre-Manual Test Results

**Automated tests completed:** 6/6 passed

- ✅ Main site accessible (200 OK)
- ✅ Worker health check working
- ✅ Learning progress endpoint functional  
- ✅ Admin learning-health requires auth (401 without token)
- ✅ **Admin learning-recent requires auth (401 without token)** ← NEW ENDPOINT
- ✅ Frontend assets loading

**Next:** Manual browser testing required

---

## 📋 Manual Testing Workflow

### Step 1: Access Admin Portal

1. Navigate to: **https://chesschat.uk/admin**
2. You should see the admin unlock page
3. Enter admin password and click "Unlock"
4. You should see the admin portal with multiple tabs

**Expected Result:**
- [ ] Admin portal loads without errors
- [ ] Tab navigation bar shows 7 tabs

---

### Step 2: Verify New Tab Appears

Check tab navigation bar for:
1. ✅ System Health
2. 📚 Knowledge Vault
3. 📜 Audit Log
4. 🎮 Game Logs
5. 🧠 CoachEngine
6. 🔗 Worker Calls
7. **🤖 Wall-E Learning** ← NEW TAB

**Test Actions:**
- [ ] Click "🤖 Wall-E Learning" tab
- [ ] Tab should activate (highlighted/selected state)
- [ ] Content area should update

**Expected Result:**
- [ ] New tab is visible in position 7
- [ ] Clicking tab loads diagnostics interface

---

### Step 3: Verify System Health Panel

When Wall-E Learning tab loads, you should see:

#### Overall Status Section
- [ ] "Overall Status" header visible
- [ ] Status badge shows (green ✓ or red ✗)
- [ ] Last check timestamp displayed

#### Configuration Section
- [ ] "Enabled" row shows ✅ Yes (green) or ❌ No (red)
- [ ] "Read-Only Mode" row shows status
- [ ] "Shadow Mode" row shows status
- [ ] "Canary Testing" row shows status
- [ ] If canary enabled, percentage shown

#### Database Tables Section
- [ ] "UserConceptState records" shows count
- [ ] "LearningEvent records" shows count
- [ ] "AdviceIntervention records" shows count
- [ ] "PracticePlan records" shows count

**Expected Values** (from your production config):
- Enabled: ✅ Yes (LEARNING_V3_ENABLED = "true")
- Read-Only: ❌ No (LEARNING_V3_READONLY = "false")
- Shadow Mode: ❌ No (LEARNING_V3_SHADOW_MODE = "false")

**Test Actions:**
- [ ] Click "🔄 Refresh Health" button
- [ ] Loading spinner should appear briefly
- [ ] Counts should reload (may change if games played)

---

### Step 4: Verify Recent Events Panel

This is the NEW feature - proof-of-learning diagnostics:

#### Panel Structure
- [ ] "Recent Learning Events" header visible
- [ ] Filter buttons visible: [All] [Failed Only] [Last Hour] [Last 24h]
- [ ] Event list renders (may be empty if no events yet)

#### If Events Exist
Each event should show:
- [ ] Timestamp (e.g., "Jan 2, 2026 3:45 PM")
- [ ] Status badge (SUCCESS, PARTIAL, or FAILED)
- [ ] Hashed user ID (8 characters, e.g., "a3f2e1c9...")
- [ ] Game ID link
- [ ] Concepts updated count
- [ ] Duration in milliseconds
- [ ] "Copy JSON" button
- [ ] Flags snapshot (enabled/shadow/readonly/async)
- [ ] Error code (if status is FAILED)

#### Test Filter Buttons
- [ ] Click [Failed Only] - should filter to errors only
- [ ] Click [Last Hour] - should show recent events
- [ ] Click [All] - should show all events
- [ ] If no events match filter, shows "No events found"

#### Test Copy JSON
- [ ] Click "Copy JSON" on an event
- [ ] Paste into DevTools console or notepad
- [ ] Should be valid JSON with full event payload

**If No Events:**
- [ ] Panel shows "No learning events recorded yet"
- [ ] This is OK if learning system just enabled or no games played since deployment

---

### Step 5: Test User Lookup

#### Get Test User ID
Option A - Use your own ID:
- [ ] Click "👤 Get My ID" button
- [ ] User ID should auto-fill in lookup field
- [ ] User ID format: "guest-XXXXXXXXX" or "auth0-XXXXXXXXX"

Option B - Play a game first:
- [ ] Open https://chesschat.uk in another tab
- [ ] Play a full game (any difficulty)
- [ ] Return to admin tab
- [ ] Click "👤 Get My ID"

#### Perform Lookup
- [ ] Click "🔍 Look Up" button
- [ ] Loading spinner appears in User Progress section
- [ ] One of two outcomes:

**Outcome 1: User Has Games (Expected if Learning System Active)**
- [ ] "Games Analyzed" shows number > 0
- [ ] "Concepts Tracked" shows number > 0
- [ ] "Average Mastery" shows percentage (0-100%)
- [ ] "Last Ingestion" shows timestamp
- [ ] "Weakest Concepts" list shows up to 5 items
  - [ ] Each has name, mastery bar (red/yellow/green), percentage
- [ ] "Strongest Concepts" list shows up to 5 items
  - [ ] Each has name, mastery bar, percentage
- [ ] "Recent Key Moments" shows up to 5 games
  - [ ] Each has game ID, blunders, mistakes, accuracy, concepts updated

**Outcome 2: User Has No Games (Expected if Fresh User or Learning Disabled)**
- [ ] Shows "No games analyzed yet for this user"
- [ ] Explanation text about learning system status
- [ ] Suggests checking System Health panel

#### Test Invalid User ID
- [ ] Clear lookup field, enter "fake-user-123"
- [ ] Click "🔍 Look Up"
- [ ] Should show "No games analyzed yet" (404 is OK)

---

### Step 6: Verify Troubleshooting Guide

Scroll down to find expandable sections:

- [ ] **"Why does postgame show '0 concepts updated'?"**
  - [ ] Click to expand
  - [ ] Shows causes (shadow mode, async delay, cold start)
  - [ ] Shows solution steps
  
- [ ] **"Training Portal shows '32 games tracked'"**
  - [ ] Click to expand
  - [ ] Explains localStorage sample data issue
  - [ ] Suggests hard refresh solution
  
- [ ] **"User has 0 concept states but played games"**
  - [ ] Click to expand
  - [ ] Lists possible causes
  - [ ] Links to checking Learning Events count
  
- [ ] **"Learning Events count increasing?"**
  - [ ] Click to expand
  - [ ] Explains how to verify ingestion wiring
  
- [ ] **"How to enable learning system"**
  - [ ] Click to expand
  - [ ] Shows environment variables needed
  - [ ] Shows deployment commands

**Test Expand/Collapse:**
- [ ] All sections should expand/collapse on click
- [ ] Multiple sections can be open simultaneously
- [ ] No layout breaking or text overflow

---

### Step 7: Test Quick Actions (Bottom of Page)

- [ ] **"📊 Test Progress Endpoint"** button
  - [ ] Click button
  - [ ] Should open `/api/learning/progress?userId=test` in new tab
  - [ ] Should show JSON response (200 OK or 404 if test user doesn't exist)

- [ ] **"🔬 Check Render Health"** button  
  - [ ] Click button
  - [ ] Should open Render server `/health` endpoint
  - [ ] Should show health status JSON

---

### Step 8: Browser Console Check

Open DevTools (F12) and check Console tab:

**Should NOT see:**
- [ ] ❌ TypeScript compilation errors
- [ ] ❌ React hydration errors
- [ ] ❌ 404 errors for `/api/admin/learning-health`
- [ ] ❌ 404 errors for `/api/admin/learning-recent`
- [ ] ❌ CORS errors
- [ ] ❌ Unhandled promise rejections

**MAY see (these are OK):**
- [ ] ✅ Network requests to admin endpoints (200 or 401)
- [ ] ✅ Console logs from debug mode (if enabled)
- [ ] ✅ Vite HMR messages (in dev mode only)

---

### Step 9: Test Error Handling

#### Test Without Auth (Browser Incognito)
- [ ] Open https://chesschat.uk/admin in incognito window
- [ ] Try to access before unlocking
- [ ] Should show unlock page, not admin tabs

#### Test Network Failure (DevTools)
- [ ] Open DevTools → Network tab
- [ ] Set throttling to "Offline"
- [ ] Click "🔄 Refresh Health" button
- [ ] Should show error message "Failed to fetch health data"
- [ ] UI should remain stable (no crashes)
- [ ] Set throttling back to "No throttling"

---

### Step 10: Test Race Condition Protection

This verifies the hardening improvements:

- [ ] Click "🔄 Refresh Health" button rapidly 5 times
- [ ] Only last request's data should appear
- [ ] No duplicate data or stale responses
- [ ] No console errors about race conditions

- [ ] Enter user ID, click "🔍 Look Up" rapidly 3 times
- [ ] Only last request's data should appear
- [ ] No duplicate progress panels

---

## 🎯 Success Criteria

### Critical (Must Pass)
- [x] Automated pre-tests all passed (6/6)
- [ ] Admin portal loads without errors
- [ ] New "🤖 Wall-E Learning" tab appears
- [ ] System Health panel loads data
- [ ] Recent Events panel renders (even if empty)
- [ ] User lookup accepts input and returns results
- [ ] No 404 errors for new `/api/admin/learning-recent` endpoint
- [ ] No console errors or crashes

### Important (Should Pass)
- [ ] All configuration values match production flags
- [ ] Database table counts are non-zero (if learning enabled)
- [ ] Recent Events shows actual events (if games played)
- [ ] User lookup shows real data for active players
- [ ] Troubleshooting sections all expand/collapse
- [ ] Quick action buttons open correct URLs

### Nice to Have
- [ ] Events filters work correctly
- [ ] Copy JSON functionality works
- [ ] Mastery bars color-coded correctly (red<30%, yellow<70%, green≥70%)
- [ ] Timestamps formatted as "MMM D, YYYY H:MM AM/PM"
- [ ] User IDs properly hashed in events (8 chars)

---

## 🐛 Known Issues to Document

If you encounter issues, record:

1. **Reproduction Steps:**
   - What did you click?
   - What was the page state before?
   - Can you reproduce it consistently?

2. **Error Messages:**
   - Screenshot console errors
   - Copy full error stack trace
   - Note HTTP status codes

3. **Expected vs Actual:**
   - What should have happened?
   - What actually happened?
   - Any visual glitches or layout issues?

4. **Browser Info:**
   - Browser (Chrome, Firefox, Edge, Safari)
   - Version number
   - Device (Desktop, Mobile, Tablet)

---

## 📊 Test Result Summary

Fill in after completing manual tests:

**Date Tested:** _________________  
**Tested By:** _________________  
**Browser:** _________________

| Test Suite | Status | Notes |
|------------|--------|-------|
| Pre-Manual Tests | ✅ 6/6 | All automated tests passed |
| Admin Portal Access | ⬜ | |
| New Tab Visible | ⬜ | |
| System Health Panel | ⬜ | |
| Recent Events Panel | ⬜ | |
| User Lookup | ⬜ | |
| Troubleshooting Guide | ⬜ | |
| Quick Actions | ⬜ | |
| Console Error Check | ⬜ | |
| Error Handling | ⬜ | |
| Race Condition Protection | ⬜ | |

**Overall Result:** ⬜ Pass / ⬜ Fail / ⬜ Partial

**Critical Issues Found:** _________________

**Next Steps:** _________________

---

## 🔗 Reference Links

- **Admin Portal:** https://chesschat.uk/admin
- **Main Site:** https://chesschat.uk
- **Health Endpoint:** https://chesschat.uk/api/health
- **Learning Progress:** https://chesschat.uk/api/learning/progress?userId=test
- **Cloudflare Dashboard:** https://dash.cloudflare.com
- **Architecture Docs:** [ADMIN_LEARNING_DIAGNOSTICS.md](ADMIN_LEARNING_DIAGNOSTICS.md)
- **Handoff Context:** [AGENT_HANDOFF_LEARNING_TAB_JAN2_2026.md](AGENT_HANDOFF_LEARNING_TAB_JAN2_2026.md)

---

**Ready to Begin Manual Testing!** 🚀
