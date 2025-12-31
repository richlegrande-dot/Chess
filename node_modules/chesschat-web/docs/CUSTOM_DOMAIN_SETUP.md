# Custom Domain Setup Guide - chesschat.uk

This guide explains how to connect your custom domain `chesschat.uk` to your Cloudflare Pages deployment.

## Prerequisites

✅ Domain purchased and managed in Cloudflare Registrar: `chesschat.uk`  
✅ Cloudflare Pages project deployed  
✅ Application code prepared for custom domain (completed)

---

## Part 1: Connect Domain in Cloudflare UI (5 minutes)

### Step 1: Navigate to Custom Domains

1. Log into [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Go to **Pages** in the left sidebar
3. Select your project: **chesschat-web** (or your project name)
4. Click the **Custom domains** tab

### Step 2: Add Primary Domain (Apex)

1. Click **Set up a custom domain**
2. Enter: `chesschat.uk`
3. Click **Continue**
4. Cloudflare will automatically:
   - Add the necessary DNS records (A/AAAA or CNAME)
   - Verify domain ownership
   - Issue SSL/TLS certificate (typically within 1-5 minutes)
5. Wait for status to show **Active**

### Step 3: Add WWW Subdomain

1. Click **Set up a custom domain** again
2. Enter: `www.chesschat.uk`
3. Click **Continue**
4. Cloudflare will automatically configure DNS and SSL
5. Wait for status to show **Active**

### Step 4: Verify Configuration

Both domains should now show as **Active** in the Custom domains list:
- ✅ `chesschat.uk`
- ✅ `www.chesschat.uk`

---

## Part 2: Verify Redirects and Routing

### Test WWW → Apex Redirect

Open browser and visit: `https://www.chesschat.uk`

**Expected behavior:**
- Browser should redirect to `https://chesschat.uk` (no www)
- URL bar shows `chesschat.uk`
- Status code: 301 (Moved Permanently)

### Test SPA Routing (Deep Links)

Visit these URLs directly:
- `https://chesschat.uk/game`
- `https://chesschat.uk/coaching`
- `https://chesschat.uk/admin`

**Expected behavior:**
- No 404 errors
- App loads correctly
- React Router handles navigation

### Test API Endpoints

1. Open browser DevTools (F12)
2. Go to Network tab
3. Navigate to coaching mode
4. Check that API calls are to: `https://chesschat.uk/api/...`

**Expected behavior:**
- All API calls are same-origin (to `chesschat.uk`)
- No CORS errors
- No mixed content warnings

---

## Part 3: Verify Security Headers

### Check Headers with DevTools

1. Open `https://chesschat.uk`
2. Open DevTools (F12) → Network tab
3. Refresh page
4. Click on the document request
5. Go to **Headers** tab

**Expected headers:**
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### Check SSL Certificate

1. Click the padlock icon in browser address bar
2. Select **Certificate (Valid)**

**Expected:**
- Issued to: `chesschat.uk`
- Issued by: Cloudflare
- Valid for at least 90 days

---

## Part 4: DNS Configuration (Auto-managed by Cloudflare)

Cloudflare automatically creates these DNS records when you add custom domains:

```
Type    Name              Content
----    ----              -------
CNAME   chesschat.uk      chesschat-web.pages.dev
CNAME   www               chesschat.uk
```

**Note:** You don't need to manually configure DNS. Cloudflare handles this automatically.

---

## Part 5: localStorage Migration

Your Wall-E training data is automatically preserved across domain changes:

- Training data is stored in browser localStorage
- Data persists per-origin (domain + port)
- When you switch from `*.pages.dev` to `chesschat.uk`, you start fresh
- To migrate existing data:
  1. Export from old domain: **🧠 Wall-E's Memory Bank** → **📥 Export JSONL**
  2. Save file locally
  3. Visit new domain
  4. Import data (feature to be added if needed)

**For development:** Always use `localhost:3001` (fixed port) to maintain data consistency.

---

## Troubleshooting

### Issue: "ERR_TOO_MANY_REDIRECTS"

**Cause:** Redirect loop between www and apex

**Solution:**
1. Check `public/_redirects` contains: `https://www.chesschat.uk/* https://chesschat.uk/:splat 301!`
2. Verify both domains are Active in Cloudflare Pages
3. Clear browser cache and cookies
4. Try incognito mode

### Issue: 404 on Deep Links

**Cause:** SPA fallback not working

**Solution:**
1. Verify `public/_redirects` exists
2. Check build output: `dist/_redirects` should exist
3. Ensure redirect rule is present: `/* /index.html 200`
4. Redeploy: `npm run build && npm run deploy`

### Issue: API Calls Failing

**Cause:** CORS or mixed content errors

**Solution:**
1. Check browser console for specific errors
2. Verify API calls use relative paths: `/api/...`
3. Confirm Pages Functions are deployed: Check **Functions** tab in Cloudflare Pages
4. Test API directly: `https://chesschat.uk/api/health`

### Issue: Mixed Content Warnings

**Cause:** Loading resources over HTTP instead of HTTPS

**Solution:**
1. Check CSP header includes: `upgrade-insecure-requests`
2. Verify all resources use HTTPS or relative URLs
3. Search codebase for `http://` references

### Issue: Slow Initial Load

**Cause:** Assets not cached properly

**Solution:**
1. Check `public/_headers` exists in build output
2. Verify Cache-Control headers in Network tab
3. Assets should have: `Cache-Control: public, max-age=31536000, immutable`

---

## Deployment Commands

### Deploy to Production

```bash
# Build the application
npm run build

# Deploy to Cloudflare Pages
npm run deploy
```

### Preview Deployment

```bash
# Build and preview locally
npm run build
npm run preview
```

This opens a local server at `http://localhost:4173` to test the production build.

---

## Post-Deployment Checklist

- [ ] Both domains (`chesschat.uk` and `www.chesschat.uk`) show **Active** status
- [ ] Visiting `www.chesschat.uk` redirects to `chesschat.uk`
- [ ] Direct navigation to `/game`, `/coaching`, `/admin` works (no 404)
- [ ] All API endpoints respond correctly
- [ ] Security headers are present (check DevTools)
- [ ] SSL certificate is valid and shows padlock
- [ ] localStorage training data is accessible (or export/import if needed)
- [ ] Page load performance is acceptable
- [ ] Mobile responsive layout works
- [ ] No console errors or warnings

---

## Additional Resources

- [Cloudflare Pages Custom Domains](https://developers.cloudflare.com/pages/platform/custom-domains/)
- [Cloudflare Pages Redirects](https://developers.cloudflare.com/pages/platform/redirects/)
- [Cloudflare Pages Headers](https://developers.cloudflare.com/pages/platform/headers/)
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/platform/functions/)

---

## Support

If you encounter issues not covered in this guide:

1. Check browser console for error messages
2. Review Cloudflare Pages deployment logs
3. Verify DNS records in Cloudflare DNS dashboard
4. Test in incognito mode to rule out caching issues
5. Check Cloudflare Status page: https://www.cloudflarestatus.com/

---

**Last Updated:** December 19, 2025  
**Domain:** chesschat.uk  
**Project:** ChessChat with Wall-E
