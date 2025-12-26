# Quick Reference Guide - Cloudflare Pages Deployment

## 🚀 Quick Start (3 steps)

```bash
# 1. Authenticate
wrangler login

# 2. Set up KV and environment
./scripts/kv/setup-kv.sh
./scripts/env/manage-env.sh template  # Edit .env.production

# 3. Deploy
./scripts/deploy/deploy.sh
```

## 📋 Common Commands

### Deployment
```bash
# Deploy to production
./scripts/deploy/deploy.sh

# Deploy to preview
ENVIRONMENT=preview ./scripts/deploy/deploy.sh
```

### Environment Management
```bash
# Create template
./scripts/env/manage-env.sh template

# Sync secrets
./scripts/env/manage-env.sh sync .env.production

# List secrets
./scripts/env/manage-env.sh list

# Set single secret
./scripts/env/manage-env.sh set DATABASE_URL "postgresql://..."
```

### KV Management
```bash
# Setup all KV namespaces
./scripts/kv/setup-kv.sh
```

### Validation
```bash
# Pre-deploy checks
./scripts/validate/pre-deploy.sh

# Post-deploy verification
DEPLOYMENT_URL="https://your-app.pages.dev" ./scripts/verify/post-deploy.sh
```

### Troubleshooting
```bash
# Interactive menu
./scripts/troubleshoot/troubleshoot.sh

# Specific checks
./scripts/troubleshoot/troubleshoot.sh status
./scripts/troubleshoot/troubleshoot.sh kv
./scripts/troubleshoot/troubleshoot.sh database
```

### Rollback
```bash
# List deployments
./scripts/rollback/rollback.sh list

# View history
./scripts/rollback/rollback.sh history

# Rollback to commit
./scripts/rollback/rollback.sh git-rollback <sha>
```

## 🔑 Required GitHub Secrets

Add in: Repository Settings → Secrets and variables → Actions

- `CLOUDFLARE_API_TOKEN` - API token with Pages edit permissions
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

## 📂 Key Files

| File | Purpose |
|------|---------|
| `scripts/deploy/deploy.sh` | Main deployment script |
| `scripts/env/manage-env.sh` | Environment management |
| `scripts/kv/setup-kv.sh` | KV namespace setup |
| `.github/workflows/deploy-cloudflare-pages.yml` | CI/CD workflow |
| `wrangler.toml.example` | Cloudflare config template |
| `public/_redirects.example` | Routing config template |

## 🎯 Workflow Triggers

| Event | Environment | Branch |
|-------|-------------|--------|
| Push to `main` | Production | main |
| Push to `develop` | Development | develop |
| Pull Request | Preview | feature/* |
| Manual dispatch | Configurable | any |

## 📚 Documentation

- `CLOUDFLARE_DEPLOYMENT_README.md` - Main README
- `docs/DEPLOYMENT.md` - Complete deployment guide
- `docs/PAGES_FUNCTIONS.md` - Functions API reference
- `docs/FILE_ROUTING.md` - Routing guide
- `docs/DASHBOARD_SETUP.md` - Dashboard configuration

## 🐛 Common Issues

### Build fails
```bash
# Check Node version
./scripts/troubleshoot/troubleshoot.sh build-logs
# Set NODE_VERSION in environment variables
```

### Database connection fails
```bash
# Verify DATABASE_URL is set
./scripts/env/manage-env.sh list
# Use connection pooler URL
```

### KV binding not working
```bash
# Check KV configuration
./scripts/troubleshoot/troubleshoot.sh kv
# Verify bindings in dashboard
```

## 💡 Tips

1. **Always validate locally first**: Run `npm run build` before deploying
2. **Use preview deployments**: Test changes in preview before production
3. **Monitor logs**: Check dashboard logs for runtime errors
4. **Keep secrets secure**: Never commit .env files
5. **Use rollback**: Keep previous deployment ready for quick rollback

## 🔗 Quick Links

- [Cloudflare Dashboard](https://dash.cloudflare.com/)
- [Pages Docs](https://developers.cloudflare.com/pages/)
- [Workers Docs](https://developers.cloudflare.com/workers/)
- [KV Docs](https://developers.cloudflare.com/kv/)
- [Community](https://community.cloudflare.com/)

## 📊 Stats

- **7 automation scripts** (deployment, KV, env, validation, verification, troubleshooting, rollback)
- **1 GitHub Actions workflow** (preview, development, production)
- **4 comprehensive docs** (56KB total)
- **4 example Functions** (health, KV, dynamic routes, middleware)
- **~5000 lines** of automation code and documentation
