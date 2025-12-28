# Manual Configuration Checklist - Worker Required Mode

**Date:** December 28, 2025  
**Purpose:** Manual steps that cannot be automated via code/CI  
**Branch:** feat/no-fallback-worker-verification

## Prerequisites

- [ ] Worker `walle-assistant-production` is deployed and functional
- [ ] Pages site `chesschat-web` exists in Cloudflare Dashboard
- [ ] You have access to Cloudflare Dashboard with appropriate permissions

## Step 1: Configure Service Binding (CRITICAL)

**This is the most important step - without this, all requests will fail with 503.**

1. [ ] Log into Cloudflare Dashboard
2. [ ] Navigate to: **Workers & Pages**
3. [ ] Find and click: **chesschat-web** (your Pages project)
4. [ ] Click: **Settings** tab
5. [ ] Scroll down to: **Functions** section
6. [ ] Find subsection: **Service bindings**
7. [ ] Click: **Add binding** button
8. [ ] Enter variable name: `WALLE_ASSISTANT` (must be exact)
9. [ ] Select service: `walle-assistant-production` (your Worker name)
10. [ ] Select environment: **Production**
11. [ ] (Optional) Repeat for **Preview** environment if desired
12. [ ] Click: **Save**
13. [ ] **IMPORTANT:** Service bindings require a redeploy to take effect
14. [ ] Trigger a redeploy: Go to **Deployments** → **View build** → **Retry deployment**

**Verification:**
```bash
# After redeployment completes, test health endpoint
curl "https://chesschat.uk/api/admin/worker-health?password=YOUR_ADMIN_PASSWORD"

# Should return success: true, bindingPresent: true
```

---

## Step 2: Configure KV Namespace for Logs (RECOMMENDED)

**Purpose:** Store persistent Worker call logs for admin portal

1. [ ] In Cloudflare Dashboard, navigate to: **Workers & Pages**
2. [ ] Click: **KV** (in left sidebar)
3. [ ] Click: **Create namespace** button (if namespace doesn't exist)
4. [ ] Enter name: `chesschat-worker-logs`
5. [ ] Click: **Add**
6. [ ] Return to: **Workers & Pages** → **chesschat-web** → **Settings**
7. [ ] Scroll to: **Functions** → **KV namespace bindings**
8. [ ] Click: **Add binding**
9. [ ] Enter variable name: `WORKER_CALL_LOGS` (must be exact)
10. [ ] Select KV namespace: `chesschat-worker-logs`
11. [ ] Select environment: **Production**
12. [ ] Click: **Save**
13. [ ] Redeploy Pages to activate binding

**Verification:**
```bash
# Make a test CPU move in the app
# Then check admin portal: Admin Portal → Worker Calls tab
# Should show logs with totalCalls > 0
```

---

## Step 3: Verify Worker Route Configuration (IMPORTANT)

**Purpose:** Ensure Worker is NOT intercepting public `/api/*` routes

1. [ ] In Cloudflare Dashboard, navigate to: **Workers & Pages**
2. [ ] Find and click: **walle-assistant-production** (your Worker)
3. [ ] Click: **Settings** tab
4. [ ] Scroll to: **Triggers** section
5. [ ] Check **Routes** list
6. [ ] **VERIFY:** There should be **NO route** for:
   - `chesschat.uk/api/chess-move*`
   - `chesschat.uk/api/*`
   - Any public route pattern
7. [ ] If such a route exists: Click the **X** to delete it
8. [ ] Click: **Save** if you made changes

**Why this matters:**
- Worker should ONLY be called via service binding (internal)
- Public routes bypass Pages Functions and break the architecture
- Removing public routes forces proper service binding usage

---

## Step 4: Environment Variables (OPTIONAL)

**Purpose:** Configure optional authentication and admin access

### 4a. Internal Auth Token (Optional)
If you want Pages-to-Worker authentication:

1. [ ] In Cloudflare Dashboard: **Workers & Pages** → **chesschat-web** → **Settings**
2. [ ] Scroll to: **Environment variables** (for Production)
3. [ ] Click: **Add variable**
4. [ ] Variable name: `INTERNAL_AUTH_TOKEN`
5. [ ] Value: Generate a secure random string (e.g., `openssl rand -hex 32`)
6. [ ] Click: **Save**
7. [ ] Go to: **Workers & Pages** → **walle-assistant-production** → **Settings**
8. [ ] Add same variable: `INTERNAL_AUTH_TOKEN` with same value
9. [ ] Click: **Save**
10. [ ] Redeploy both Pages and Worker

### 4b. Admin Password (Optional)
If you want to protect admin endpoints:

1. [ ] In Cloudflare Dashboard: **Workers & Pages** → **chesschat-web** → **Settings**
2. [ ] Scroll to: **Environment variables** (for Production)
3. [ ] Click: **Add variable**
4. [ ] Variable name: `ADMIN_PASSWORD`
5. [ ] Value: Choose a secure password
6. [ ] Click: **Save**
7. [ ] Redeploy Pages

**Note:** Admin password is used for:
- `/api/admin/worker-health`
- `/api/admin/worker-calls`
- Admin portal authentication

### 4c. DO NOT SET (IMPORTANT)
- [ ] **Verify:** `ALLOW_FALLBACK_MAIN_THREAD` is **NOT set**
- [ ] This variable should remain unset to keep fallback disabled
- [ ] Only set this in emergencies (see [WORKER_REQUIRED_MODE.md](WORKER_REQUIRED_MODE.md))

---

## Step 5: Deployment

**Deploy the new code to production:**

### 5a. Deploy Worker First
```bash
cd worker-assistant
npm run deploy
```

Wait for deployment to complete. Note the new version number.

### 5b. Deploy Pages
```bash
cd ..  # Return to ChessChatWeb root
npm run build
npm run deploy
```

Or commit and push to trigger CI deployment:
```bash
git add .
git commit -m "feat: implement Worker Required Mode"
git push origin feat/no-fallback-worker-verification
```

---

## Step 6: Verification & Testing

### 6a. Run Automated Verification
```bash
npm run verify:worker-required
npm run verify:all
```

Should show all checks passing.

### 6b. Test Worker Health Endpoint
```bash
curl "https://chesschat.uk/api/admin/worker-health?password=YOUR_ADMIN_PASSWORD"
```

Expected response:
```json
{
  "success": true,
  "bindingPresent": true,
  "workerHttpStatus": 200,
  "parsedJsonOk": true,
  "latencyMs": 234,
  "workerMode": "service-binding",
  "workerEngine": "worker"
}
```

### 6c. Test Chess Move
1. [ ] Open: `https://chesschat.uk`
2. [ ] Start a new game (vs-cpu mode)
3. [ ] Make a move (e.g., e2-e4)
4. [ ] Wait for CPU response
5. [ ] **Verify:** Move completes successfully
6. [ ] Open browser DevTools → Console
7. [ ] Check for errors
8. [ ] Verify no 502/503 errors

### 6d. Check Admin Portal Logs
1. [ ] Open: `https://chesschat.uk`
2. [ ] Click: Admin Portal
3. [ ] Enter admin password (if configured)
4. [ ] Click: **Worker Calls** tab
5. [ ] **Verify:**
   - Total calls > 0
   - Success rate shows percentage
   - Individual logs appear
   - Logs show `mode: "service-binding"`
   - **NOT** `mode: "worker-required"` (that indicates failure)

### 6e. Test Error Handling
1. [ ] Temporarily disable service binding in Dashboard (for testing)
2. [ ] Make a CPU move
3. [ ] **Expected:** Request fails with 503 error
4. [ ] Check response body includes:
   - `success: false`
   - `mode: "worker-required"`
   - `errorCode: "NO_WORKER_BINDING"`
   - `workerCallLog` object
5. [ ] Re-enable service binding
6. [ ] Redeploy Pages
7. [ ] Verify moves work again

---

## Step 7: Monitoring Setup

### 7a. Set Up Alerts (Optional)
Configure Cloudflare alerts for:
- [ ] Worker error rate > 5%
- [ ] Worker CPU time > 10 seconds (99th percentile)
- [ ] Pages error rate > 5%

### 7b. Bookmark Dashboard URLs
- [ ] Worker metrics: `https://dash.cloudflare.com/.../workers/walle-assistant-production`
- [ ] Pages deployments: `https://dash.cloudflare.com/.../pages/chesschat-web`
- [ ] KV logs: `https://dash.cloudflare.com/.../kv/chesschat-worker-logs`

---

## Troubleshooting

### If Step 1 fails (Service Binding)
- Ensure Worker is deployed before configuring binding
- Check Worker name matches exactly
- Try logging out and back into Dashboard
- Redeploy Pages after saving binding

### If Step 2 fails (KV Namespace)
- KV namespace must exist before binding
- Variable name must be exactly `WORKER_CALL_LOGS`
- Check KV is in same account as Pages project

### If Step 3 shows public routes
- Delete routes immediately
- This breaks the architecture if left enabled
- Worker should only be service binding

### If Step 6c fails (Chess move fails)
1. Check Worker health endpoint first
2. Review Worker logs in Dashboard
3. Check browser console for error details
4. See [WORKER_REQUIRED_MODE.md](WORKER_REQUIRED_MODE.md) troubleshooting section

---

## Emergency Rollback

If production breaks after deployment:

### Option 1: Re-enable Fallback (Quick Fix)
1. [ ] Dashboard → Pages → Settings → Environment Variables
2. [ ] Add: `ALLOW_FALLBACK_MAIN_THREAD` = `true`
3. [ ] Redeploy Pages
4. [ ] This restores local fallback while investigating
5. [ ] **Important:** Remove this flag once Worker is fixed

### Option 2: Rollback Deployment
1. [ ] Dashboard → Pages → Deployments
2. [ ] Find previous working deployment
3. [ ] Click: **...** → **Rollback to this deployment**
4. [ ] Confirm rollback

---

## Checklist Summary

- [ ] Step 1: Service binding configured (CRITICAL)
- [ ] Step 2: KV namespace configured (recommended)
- [ ] Step 3: Worker routes verified (no public routes)
- [ ] Step 4: Environment variables set (optional)
- [ ] Step 5: Code deployed (Worker first, then Pages)
- [ ] Step 6: Verification tests pass
- [ ] Step 7: Monitoring configured

**Completion Time:** ~15-20 minutes

**Documentation:**
- Full guide: [WORKER_REQUIRED_MODE.md](WORKER_REQUIRED_MODE.md)
- Architecture: [HYBRID_DEPLOYMENT_GUIDE.md](HYBRID_DEPLOYMENT_GUIDE.md)
- Original issue: [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md)
