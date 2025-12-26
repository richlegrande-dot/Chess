# Cloudflare Dashboard Configuration Guide

This guide walks through configuring your Chess application in the Cloudflare Dashboard.

## Table of Contents

1. [Creating a Pages Project](#creating-a-pages-project)
2. [Configuring Build Settings](#configuring-build-settings)
3. [Setting Up KV Namespaces](#setting-up-kv-namespaces)
4. [Configuring Environment Variables](#configuring-environment-variables)
5. [Managing Secrets](#managing-secrets)
6. [Custom Domains](#custom-domains)
7. [Access Policies](#access-policies)
8. [Monitoring and Logs](#monitoring-and-logs)

## Creating a Pages Project

### Step 1: Access Cloudflare Dashboard

1. Navigate to [https://dash.cloudflare.com](https://dash.cloudflare.com)
2. Log in with your Cloudflare account
3. Select your account from the account dropdown

### Step 2: Create New Pages Project

1. Click on "Workers & Pages" in the left sidebar
2. Click "Create application"
3. Select the "Pages" tab
4. Click "Connect to Git"

### Step 3: Connect GitHub Repository

1. Click "Connect GitHub"
2. Authorize Cloudflare to access your GitHub account
3. Select your organization (if applicable)
4. Choose the "Chess" repository
5. Click "Begin setup"

### Step 4: Configure Build Settings

**Project name:** `chess` (or your preferred name)

**Production branch:** `main`

**Build settings:**
- Framework preset: `None`
- Build command: `npm run build`
- Build output directory: `public`
- Root directory: `/` (leave blank)

**Environment variables (build-time):**
- Leave empty for now (we'll add runtime variables later)

Click "Save and Deploy"

## Configuring Build Settings

After initial setup, you can modify build settings:

1. Go to your Pages project
2. Click "Settings"
3. Scroll to "Build & deployments"

### Build Configuration

**Build command:**
```bash
npm run build
```

This command should:
- Install dependencies
- Build your application
- Generate static files in the `public` directory

**Build output directory:**
```
public
```

**Root directory:** (leave blank for repository root)

**Node.js version:**
Select `18` or higher

### Build Watch Paths

Configure which file changes trigger new builds:

```
src/**/*
functions/**/*
package.json
wrangler.toml
```

### Build Caching

Enable build caching to speed up deployments:
- ✓ Cache node_modules
- ✓ Cache build artifacts

## Setting Up KV Namespaces

### Creating KV Namespaces

1. Go to "Workers & Pages" in the sidebar
2. Click on "KV" tab
3. Click "Create a namespace"

Create the following namespaces:

**For Production:**
- Name: `chess-analytics`
- Click "Add"
- Name: `chess-rate-limit`
- Click "Add"

**For Preview:**
- Name: `chess-analytics-preview`
- Click "Add"
- Name: `chess-rate-limit-preview`
- Click "Add"

### Binding KV Namespaces to Your Project

1. Go to your Pages project
2. Click "Settings"
3. Scroll to "Functions"
4. Under "KV namespace bindings", click "Add binding"

**Add these bindings:**

| Variable name | KV namespace | Environment |
|---------------|--------------|-------------|
| ANALYTICS_KV | chess-analytics | Production |
| ANALYTICS_KV | chess-analytics-preview | Preview |
| RATE_LIMIT_KV | chess-rate-limit | Production |
| RATE_LIMIT_KV | chess-rate-limit-preview | Preview |

**Important:** The "Variable name" must match the binding names in your `wrangler.toml` file.

### Verifying KV Setup

1. Go to the KV namespace in the dashboard
2. Click "View" next to a namespace
3. You can manually add/view/delete keys for testing

## Configuring Environment Variables

Environment variables are available to your Functions at runtime.

### Production Environment Variables

1. Go to your Pages project
2. Click "Settings" → "Environment variables"
3. Select "Production" tab
4. Click "Add variable"

**Add these variables:**

| Variable name | Value | Type |
|---------------|-------|------|
| ENVIRONMENT | production | Plain text |

### Preview Environment Variables

1. Select "Preview" tab
2. Click "Add variable"

**Add these variables:**

| Variable name | Value | Type |
|---------------|-------|------|
| ENVIRONMENT | preview | Plain text |

### Variable Types

- **Plain text:** Visible in the dashboard, suitable for non-sensitive values
- **Encrypted:** Hidden in the dashboard, for sensitive values (use Secrets instead)

## Managing Secrets

Secrets are encrypted environment variables for sensitive data.

### Adding Secrets via Dashboard

1. Go to your Pages project
2. Click "Settings" → "Environment variables"
3. Select environment (Production or Preview)
4. Click "Add variable"
5. Check "Encrypt" option
6. Enter variable name and value

**Required secrets:**

| Secret name | Description | Example |
|-------------|-------------|---------|
| OPENAI_API_KEY | OpenAI API key | sk-proj-... |
| DATABASE_URL | Database connection string | postgresql://... |
| ADMIN_PASSWORD | Admin dashboard password | strong_password_here |

### Adding Secrets via Wrangler CLI

Using the CLI is often easier for secrets:

```bash
# Set a secret for production
echo "your_secret_value" | wrangler pages secret put SECRET_NAME --project-name=chess

# Set a secret for preview
echo "your_secret_value" | wrangler pages secret put SECRET_NAME --project-name=chess --env preview
```

### Listing Secrets

```bash
wrangler pages secret list --project-name=chess
```

### Deleting Secrets

```bash
wrangler pages secret delete SECRET_NAME --project-name=chess
```

### Best Practices for Secrets

1. **Never commit secrets to Git**
2. **Use different secrets for production and preview**
3. **Rotate secrets regularly**
4. **Use strong, unique passwords**
5. **Limit access to secret values**

## Custom Domains

Add a custom domain to your Pages project:

### Adding a Domain

1. Go to your Pages project
2. Click "Custom domains"
3. Click "Set up a custom domain"
4. Enter your domain name (e.g., `chess.example.com`)
5. Click "Continue"

### DNS Configuration

Cloudflare will provide DNS records to add:

**For subdomain (chess.example.com):**
- Type: `CNAME`
- Name: `chess`
- Target: `chess.pages.dev`

**For apex domain (example.com):**
- Type: `CNAME`
- Name: `@`
- Target: `chess.pages.dev`

### SSL/TLS Configuration

1. Go to "SSL/TLS" in the main dashboard
2. Select "Full (strict)" mode
3. Cloudflare automatically provisions SSL certificates

### Preview Domains

Preview deployments get automatic URLs:
- Pull requests: `<pr-number>.<project>.pages.dev`
- Branches: `<branch>.<project>.pages.dev`

## Access Policies

Restrict access to your preview deployments:

### Setting Up Access

1. Go to your Pages project
2. Click "Settings"
3. Scroll to "Access policy"
4. Click "Manage"

### Creating an Access Policy

1. Click "Add a policy"
2. Choose policy type:
   - **Public:** Anyone can access
   - **Private (Cloudflare Access):** Requires authentication
   - **Preview only:** Protect only preview deployments

**Example: Protect Preview Deployments**

1. Select "Preview deployments"
2. Choose authentication method:
   - GitHub OAuth
   - Email OTP
   - Other identity providers
3. Add allowed emails or GitHub usernames
4. Click "Save"

### Testing Access Policy

1. Open a preview deployment URL
2. You should see the Cloudflare Access login page
3. Authenticate using the configured method
4. Access is granted after successful authentication

## Monitoring and Logs

### Viewing Deployment History

1. Go to your Pages project
2. Click "Deployments"
3. View list of all deployments with:
   - Deployment ID
   - Environment (Production/Preview)
   - Status (Success/Failed)
   - Branch and commit
   - Timestamp
   - Deployment URL

### Viewing Build Logs

1. Click on a deployment
2. View build logs showing:
   - npm install output
   - Build command output
   - Deployment process
   - Any errors or warnings

### Real-Time Function Logs

1. Go to your Pages project
2. Click "Functions"
3. Click "Logs" or "Real-time Logs"
4. View console.log output from your Functions

**Using Wrangler CLI:**

```bash
# Tail production logs
wrangler pages deployment tail --project-name=chess

# Tail preview logs
wrangler pages deployment tail --project-name=chess --env preview
```

### Analytics

1. Go to your Pages project
2. Click "Analytics"
3. View metrics:
   - Requests per second
   - Data transfer
   - Error rate
   - Response time
   - Status codes

### Setting Up Alerts

1. Go to "Notifications" in the main dashboard
2. Click "Add"
3. Select notification type:
   - **Pages deployment:** Notifies on deployment success/failure
   - **Health check:** Notifies if health check fails
4. Configure notification destination:
   - Email
   - PagerDuty
   - Webhook

**Example: Deployment Failure Alert**

1. Select "Pages deployment"
2. Choose "Deployment failed"
3. Enter email address
4. Click "Save"

## Advanced Configuration

### Preview Aliases

Create named aliases for specific branches:

1. Go to your Pages project
2. Click "Settings"
3. Scroll to "Preview aliases"
4. Add alias: `staging` → `develop` branch

Access: `https://staging.<project>.pages.dev`

### Compatibility Dates

Set the Workers runtime compatibility date:

1. Go to "Settings" → "Functions"
2. Set "Compatibility date": `2024-01-01`

This should match the `compatibility_date` in `wrangler.toml`.

### Build Concurrency

Control how many builds can run simultaneously:

1. Go to "Settings" → "Build & deployments"
2. Configure "Build concurrency"
3. Set to `1` to build one deployment at a time
4. Higher values allow parallel builds

## Troubleshooting

### Deployment Failed

1. Click on the failed deployment
2. Review build logs for errors
3. Common issues:
   - Missing dependencies: Run `npm install` locally
   - Build command failed: Test `npm run build` locally
   - Incorrect build output directory

### Functions Not Working

1. Check "Functions" tab for errors
2. Verify KV namespace bindings
3. Check secrets are configured
4. Review function logs for errors

### KV Namespace Not Bound

1. Go to "Settings" → "Functions"
2. Verify KV namespace bindings
3. Ensure binding names match `wrangler.toml`
4. Re-deploy after updating bindings

### Secrets Not Available

1. Check secrets are configured for the correct environment
2. Verify secret names match your code
3. Re-deploy after adding secrets

## API Access

Manage your Pages project programmatically:

### Get API Token

1. Go to "My Profile" → "API Tokens"
2. Click "Create Token"
3. Use "Edit Cloudflare Workers" template
4. Set permissions:
   - Account Settings: Read
   - Workers KV Storage: Edit
   - Cloudflare Pages: Edit
5. Copy and save token securely

### API Examples

**List deployments:**
```bash
curl -X GET "https://api.cloudflare.com/client/v4/accounts/{account_id}/pages/projects/{project_name}/deployments" \
  -H "Authorization: Bearer {api_token}"
```

**Create deployment:**
```bash
wrangler pages deploy public --project-name=chess
```

## Resources

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Cloudflare Dashboard](https://dash.cloudflare.com)
- [Cloudflare API Documentation](https://developers.cloudflare.com/api/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

## Support

For Cloudflare-specific issues:
- [Cloudflare Community](https://community.cloudflare.com/)
- [Cloudflare Support](https://support.cloudflare.com/)
- [Cloudflare Discord](https://discord.gg/cloudflaredev)
