# Cloudflare Dashboard Configuration Guide

Complete guide to configuring your Cloudflare Pages project through the dashboard.

## Table of Contents

1. [Creating a Pages Project](#creating-a-pages-project)
2. [Build Configuration](#build-configuration)
3. [Environment Variables](#environment-variables)
4. [KV Namespace Bindings](#kv-namespace-bindings)
5. [Custom Domains](#custom-domains)
6. [Access Control](#access-control)
7. [Functions Settings](#functions-settings)
8. [Analytics](#analytics)
9. [Deployment Settings](#deployment-settings)

## Creating a Pages Project

### Via Git Integration

1. **Navigate to Pages:**
   - Go to https://dash.cloudflare.com/
   - Click on **Workers & Pages** in the sidebar
   - Click **Create application** → **Pages** → **Connect to Git**

2. **Connect Repository:**
   - Authorize Cloudflare to access your GitHub/GitLab account
   - Select your repository
   - Click **Begin setup**

3. **Configure Build:**
   - **Production branch**: `main`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - Click **Save and Deploy**

### Via Direct Upload

1. **Navigate to Pages:**
   - Go to https://dash.cloudflare.com/
   - Click **Workers & Pages** → **Create application** → **Pages** → **Upload assets**

2. **Upload Build:**
   - Provide a project name
   - Drag and drop your `dist/` folder or select it
   - Click **Deploy site**

## Build Configuration

### Build Settings

Navigate to: **Workers & Pages** → Your Project → **Settings** → **Build & deployments**

#### Framework Preset

Select a framework preset for automatic configuration:

- **React** (Create React App)
- **Vite**
- **Next.js**
- **Vue**
- **Angular**
- **None** (custom configuration)

#### Build Configuration

```
Build command: npm run build
Build output directory: dist
Root directory: (leave blank)
```

#### Environment Variables for Build

Click **Add variable** to set build-time environment variables:

| Variable | Value | Example |
|----------|-------|---------|
| `NODE_VERSION` | `18` | Node.js version |
| `NPM_VERSION` | `9` | npm version |
| `VITE_API_URL` | `https://api.example.com` | API URL for Vite |

#### Build Commands by Framework

| Framework | Build Command | Output Directory |
|-----------|---------------|------------------|
| Vite + React | `npm run build` | `dist` |
| Create React App | `npm run build` | `build` |
| Next.js | `npm run build` | `out` |
| Vue CLI | `npm run build` | `dist` |
| Angular | `npm run build` | `dist/project-name` |

### Build Caching

Enable build caching for faster deployments:

1. Go to **Settings** → **Build & deployments**
2. Enable **Build caching**
3. Configure cache paths (default: `node_modules/`)

### Build Watch Paths

Configure which paths trigger new builds:

```
Include: src/**, public/**
Exclude: *.md, docs/**
```

## Environment Variables

### Types of Variables

1. **Environment Variables**: Available at build time
2. **Secrets**: Available at runtime (encrypted)

### Setting Environment Variables

Navigate to: **Workers & Pages** → Your Project → **Settings** → **Environment variables**

#### Production Environment

Click **Add variable** under **Production**:

| Variable Name | Value | Type |
|---------------|-------|------|
| `NODE_ENV` | `production` | Plain text |
| `VITE_API_URL` | `https://api.example.com` | Plain text |

#### Preview Environment

Set preview-specific variables:

| Variable Name | Value |
|---------------|-------|
| `NODE_ENV` | `preview` |
| `VITE_API_URL` | `https://preview-api.example.com` |

### Setting Secrets

For sensitive data (passwords, API keys, database URLs):

1. Click **Encrypt** when adding variable
2. Or use Wrangler CLI:

```bash
wrangler pages secret put DATABASE_URL --project-name=chesschat-web
```

### Accessing Variables

#### Build Time (Vite)

Variables prefixed with `VITE_` are available in your app:

```typescript
// src/config.ts
const apiUrl = import.meta.env.VITE_API_URL;
```

#### Runtime (Functions)

All variables available in `context.env`:

```typescript
// functions/api/example.ts
export async function onRequest(context) {
  const dbUrl = context.env.DATABASE_URL;
  const apiKey = context.env.API_SECRET_KEY;
  
  return Response.json({ configured: true });
}
```

## KV Namespace Bindings

### Creating KV Namespaces

1. **Navigate to KV:**
   - Sidebar → **Workers & Pages** → **KV**
   - Click **Create namespace**

2. **Create Namespaces:**
   ```
   Name: chesschat-cache
   Name: chesschat-sessions
   Name: chesschat-game-state
   ```

3. **Create Preview Namespaces:**
   ```
   Name: chesschat-cache-preview
   Name: chesschat-sessions-preview
   Name: chesschat-game-state-preview
   ```

### Binding KV to Pages

1. **Navigate to Bindings:**
   - **Workers & Pages** → Your Project → **Settings** → **Functions**
   - Scroll to **KV namespace bindings**

2. **Add Binding:**
   - Click **Add binding**
   - **Variable name**: `CACHE` (used in code)
   - **KV namespace**: Select `chesschat-cache`
   - **Preview namespace**: Select `chesschat-cache-preview`
   - Click **Save**

3. **Repeat for Other Namespaces:**
   ```
   SESSIONS → chesschat-sessions
   GAME_STATE → chesschat-game-state
   ANALYTICS → chesschat-analytics
   ```

### Using KV in Functions

```typescript
export async function onRequest(context) {
  const { CACHE, SESSIONS, GAME_STATE } = context.env;
  
  // Use KV namespaces
  await CACHE.put("key", "value");
  const value = await SESSIONS.get("session-id");
  
  return Response.json({ success: true });
}
```

## Custom Domains

### Adding a Custom Domain

1. **Navigate to Custom Domains:**
   - **Workers & Pages** → Your Project → **Custom domains**
   - Click **Set up a custom domain**

2. **Enter Domain:**
   - Enter your domain: `chesschat.example.com`
   - Click **Continue**

3. **DNS Configuration:**
   - Cloudflare will automatically add DNS records if your domain is on Cloudflare
   - Otherwise, add a CNAME record:
     ```
     CNAME chesschat your-project.pages.dev
     ```

4. **SSL/TLS:**
   - SSL certificates are automatically provisioned
   - Wait 1-5 minutes for activation

### Setting Primary Domain

1. Click the **•••** menu next to a domain
2. Click **Set as primary domain**
3. All other domains redirect to primary

## Access Control

### Password Protection

Protect preview deployments or entire site:

1. **Navigate to Access:**
   - **Workers & Pages** → Your Project → **Settings** → **Access**

2. **Enable Access:**
   - Click **Enable Access**
   - Choose protection level:
     - **All deployments**: Protect entire site
     - **Preview deployments**: Protect only previews

3. **Configure Policy:**
   - **Policy name**: "Team Access"
   - **Action**: Allow
   - **Configure rules**:
     - Email domain: `@yourcompany.com`
     - Or specific emails
   - Click **Save**

### Authentication Options

- **Email OTP**: Send code to email
- **OAuth**: GitHub, Google, etc.
- **Service Auth**: For automated access

## Functions Settings

### Compatibility Date

Navigate to: **Settings** → **Functions** → **Compatibility date**

Set compatibility date for runtime features:

```
2024-01-01
```

### Usage Model

Choose between:
- **Bundled**: 100,000 requests/day included
- **Unbound**: Pay per request (for high-traffic sites)

### Bindings

Configure additional bindings:

#### R2 Bucket Binding

```
Variable name: MY_BUCKET
R2 bucket: your-bucket-name
```

#### D1 Database Binding

```
Variable name: DB
D1 database: your-database
```

#### Durable Objects Binding

```
Variable name: MY_DURABLE_OBJECT
Durable Object: your-durable-object
```

## Analytics

### Web Analytics

1. **Enable Analytics:**
   - **Workers & Pages** → Your Project → **Analytics**
   - Click **Enable Web Analytics**

2. **Add Beacon:**
   - Copy the analytics script
   - Add to your HTML `<head>`:

```html
<script defer src='https://static.cloudflareinsights.com/beacon.min.js' 
        data-cf-beacon='{"token": "your-token"}'></script>
```

### Workers Analytics

View analytics for Pages Functions:

1. Go to **Analytics** tab
2. View metrics:
   - **Requests**: Total requests
   - **Errors**: Error rate
   - **Duration**: Response times
   - **CPU Time**: Compute usage

### Real User Monitoring (RUM)

Enable RUM for detailed performance metrics:

1. **Settings** → **Analytics** → **RUM**
2. Enable **Real User Monitoring**
3. Configure sampling rate (1-100%)

## Deployment Settings

### Branch Deployments

Configure which branches trigger deployments:

1. **Settings** → **Builds & deployments**
2. **Production branch**: `main`
3. **Preview branches**:
   - All branches (except production)
   - Custom: `develop, staging`

### Build Settings

#### Skip Builds

Skip builds for specific commits:

```bash
git commit -m "docs: update README [skip ci]"
```

#### Build Hooks

Create webhooks to trigger builds:

1. **Settings** → **Builds & deployments** → **Build hooks**
2. Click **Add build hook**
3. **Name**: "Manual Deploy"
4. **Branch**: `main`
5. Copy webhook URL

Trigger build:
```bash
curl -X POST https://api.cloudflare.com/client/v4/pages/webhooks/deploy/YOUR_HOOK_ID
```

### Deployment Protection

Protect specific branches:

1. **Settings** → **Builds & deployments**
2. Enable **Branch Protection**
3. Select protected branches
4. Require manual approval for deployments

### Deployment Notifications

Configure notifications:

1. **Settings** → **Notifications**
2. **Add notification**
3. Choose trigger:
   - Deployment started
   - Deployment succeeded
   - Deployment failed
4. Select destination:
   - Email
   - Webhook
   - PagerDuty

## Rollback

### Via Dashboard

1. **Navigate to Deployments:**
   - **Workers & Pages** → Your Project → **Deployments**

2. **Find Deployment:**
   - Browse deployment history
   - Click **View build** on desired deployment

3. **Rollback:**
   - Click **Rollback to this deployment**
   - Confirm rollback

### Deployment Aliases

Create aliases for specific deployments:

1. Find deployment in history
2. Click **Manage deployment** → **Add alias**
3. Enter alias name: `stable`, `release-1.0`, etc.
4. Access via: `https://stable.your-project.pages.dev`

## Advanced Settings

### Redirects & Headers

Create `public/_redirects` file:

```
# Redirects
/old-page /new-page 301
/blog/* https://blog.example.com/:splat 302

# SPA routing
/api/* 200
/* /index.html 200
```

Create `public/_headers` file:

```
# Security headers
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()

# Cache static assets
/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

### Edge Caching

Configure caching behavior:

```
# public/_headers
/api/data/*
  Cache-Control: public, max-age=300
  
/static/*
  Cache-Control: public, max-age=86400
```

### Custom Error Pages

Create custom error pages:

```
public/
├── 404.html
└── 500.html
```

## Best Practices

### 1. Use Environment-specific Variables

```
Production: VITE_API_URL=https://api.example.com
Preview: VITE_API_URL=https://preview-api.example.com
```

### 2. Protect Sensitive Data

- Use encrypted secrets for passwords
- Never expose secrets in client code
- Rotate secrets regularly

### 3. Monitor Deployments

- Enable deployment notifications
- Review build logs regularly
- Set up error alerts

### 4. Use Preview Deployments

- Test changes in preview before production
- Share preview links with team
- Use preview for QA testing

### 5. Configure Proper Caching

- Cache static assets aggressively
- Use short cache for dynamic content
- Invalidate cache when needed

## Troubleshooting

### Build Failures

1. Check build logs in deployment details
2. Verify build command and output directory
3. Check Node version requirements
4. Review environment variables

### Runtime Errors

1. Check Functions logs in dashboard
2. Verify environment variables are set
3. Check KV bindings are configured
4. Review browser console for client errors

### DNS Issues

1. Verify CNAME record is correct
2. Check Cloudflare proxy status (orange cloud)
3. Wait for DNS propagation (up to 24 hours)
4. Test with `dig` or `nslookup`

## Resources

- [Cloudflare Dashboard](https://dash.cloudflare.com/)
- [Pages Documentation](https://developers.cloudflare.com/pages/)
- [Functions Settings](https://developers.cloudflare.com/pages/functions/)
- [Custom Domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Environment Variables](https://developers.cloudflare.com/pages/configuration/build-configuration/)
