# Browser Cache Clear Instructions

## Issue
After deploying Worker API updates, the browser may serve cached responses showing old behavior (e.g., depth 5 instead of new depth 2 limits).

## Solution: Clear Browser Cache

### Method 1: Hard Refresh (Quick)
1. Open the application in browser: `https://chesschat.uk`
2. Press **Ctrl + Shift + R** (Windows) or **Cmd + Shift + R** (Mac)
3. This forces browser to fetch fresh resources

### Method 2: Clear Site Data (Thorough)
1. Open **Developer Tools** (F12)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. In left sidebar, find **Storage** section
4. Click **Clear site data** button
5. Reload page (F5)

### Method 3: Clear All Browser Cache
1. Open browser settings
2. Go to **Privacy and Security**
3. Click **Clear browsing data**
4. Select:
   - ✅ Cached images and files
   - ✅ Cookies and site data (optional)
5. Time range: **Last hour**
6. Click **Clear data**

### Method 4: Incognito/Private Mode (Testing)
1. Open **Incognito Window** (Ctrl + Shift + N in Chrome)
2. Navigate to `https://chesschat.uk`
3. This bypasses all cache

## Verification

After clearing cache, check console logs:
- **Before:** `[CPU Move] API result: depth 5, time 128ms, source: worker`
- **After:** `[CPU Move] API result: depth 2, time <50ms, source: worker`

## Why This Happens

The Worker API endpoint (`/api/chess-move`) responses may be cached by:
1. **Browser HTTP cache** - GET/POST responses
2. **Service Workers** - If PWA features enabled
3. **CDN cache** - Cloudflare edge caching
4. **Fetch API cache** - Application-level caching

## Cloudflare Cache Headers

The Worker API should include cache control headers to prevent this:
```typescript
headers: {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
}
```

**Status:** ⚠️ Need to add these headers to Worker API responses
