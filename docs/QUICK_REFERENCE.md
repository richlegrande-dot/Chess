# Quick Reference Guide

This guide provides quick commands for common deployment tasks.

## Initial Setup

```bash
# Install dependencies
npm install

# Create .env file from example
cp .env.example .env
# Edit .env with your credentials

# Setup KV namespaces
npm run setup:kv

# Configure secrets
npm run setup:secrets setup production
npm run setup:secrets setup preview
```

## Development

```bash
# Start local dev server
npm run dev

# Access application
open http://localhost:8788

# Test health check
curl http://localhost:8788/api/health
```

## Deployment

```bash
# Validate before deploying
npm run validate:pre-deploy

# Deploy to preview
npm run deploy:preview

# Deploy to production
npm run deploy:production

# Validate after deploying
npm run validate:post-deploy https://chess.pages.dev
```

## Secret Management

```bash
# Setup secrets
npm run setup:secrets setup production
npm run setup:secrets setup preview

# List secrets
npm run setup:secrets list production

# Verify secrets
npm run setup:secrets verify production
```

## Rollback

```bash
# List recent deployments
npm run rollback list

# Rollback to previous
npm run rollback latest

# Rollback to specific deployment
npm run rollback <deployment-id>
```

## Troubleshooting

```bash
# Validate configuration
npm run validate:pre-deploy

# Check health endpoint
curl https://chess.pages.dev/api/health | jq

# Recreate KV namespaces
npm run setup:kv

# Verify secrets
npm run setup:secrets verify production
```

## GitHub Actions

### Required Secrets

Add these to your GitHub repository:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PROJECT_NAME`

### Trigger Deployments

- **Preview**: Push to any branch or create PR
- **Production**: Push to `main` branch
- **Manual**: Go to Actions → Deploy Production → Run workflow

## Wrangler Commands

```bash
# Login to Cloudflare
wrangler login

# List KV namespaces
wrangler kv:namespace list

# List secrets
wrangler pages secret list --project-name=chess

# Set secret
echo "value" | wrangler pages secret put SECRET_NAME --project-name=chess

# Tail logs
wrangler pages deployment tail --project-name=chess

# Deploy manually
wrangler pages deploy public --project-name=chess
```

## API Endpoints

### Health Check
```bash
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "production",
  "checks": {
    "analytics_kv": { "status": "healthy" },
    "rate_limit_kv": { "status": "healthy" },
    "secrets": { "status": "healthy" }
  }
}
```

## Environment Variables

### Local Development (.env)
```bash
CLOUDFLARE_API_TOKEN=your_token
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_PROJECT_NAME=chess
OPENAI_API_KEY=your_key
DATABASE_URL=postgresql://localhost/chess
ADMIN_PASSWORD=your_password
```

### Production (Cloudflare Secrets)
- `OPENAI_API_KEY`
- `DATABASE_URL`
- `ADMIN_PASSWORD`
- `ENVIRONMENT` (auto-set: production/preview)

## Common Issues

### KV Namespace IDs Not Set
```bash
npm run setup:kv
```

### Missing Secrets
```bash
npm run setup:secrets setup production
```

### Pre-Deploy Validation Fails
```bash
npm run validate:pre-deploy
# Fix issues shown in output
```

### Health Check Fails
```bash
# Check KV bindings
# Verify secrets
# Check deployment logs in dashboard
curl https://chess.pages.dev/api/health
```

### Deployment Failed
```bash
# Check GitHub Actions logs
# Check Cloudflare Dashboard logs
# Run pre-deploy validation
npm run validate:pre-deploy
```

## File Structure

```
Chess/
├── functions/          # Cloudflare Pages Functions
│   └── api/
│       └── health.js  # GET /api/health
├── scripts/           # Management scripts
│   ├── setup-kv-namespaces.js
│   ├── setup-secrets.js
│   ├── validate-pre-deploy.js
│   ├── validate-post-deploy.js
│   └── rollback.js
├── docs/              # Documentation
├── .github/workflows/ # CI/CD pipelines
├── public/            # Static files
├── prisma/            # Database schema
└── wrangler.toml      # Cloudflare config
```

## URL Patterns

- **Production**: `https://chess.pages.dev`
- **Preview (branch)**: `https://<branch>.chess.pages.dev`
- **Preview (PR)**: `https://<pr-number>.chess.pages.dev`
- **Health Check**: `https://chess.pages.dev/api/health`

## Resources

- [Complete Setup Guide](docs/SETUP.md)
- [Pages Functions Routing](docs/PAGES_FUNCTIONS_ROUTING.md)
- [Dashboard Configuration](docs/DASHBOARD_CONFIGURATION.md)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)

## Support

- Check documentation in `docs/`
- Review GitHub Actions logs
- Check Cloudflare Dashboard logs
- Run validation scripts
- Open issue on GitHub
