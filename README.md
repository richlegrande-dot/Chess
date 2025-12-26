# Chess

A repository for ChessChat Web application deployment automation.

## 🚀 Cloudflare Pages Deployment

This repository includes a complete automation system for deploying to Cloudflare Pages.

**Quick Start:** See [QUICK_REFERENCE.md](QUICK_REFERENCE.md)

**Full Documentation:** See [CLOUDFLARE_DEPLOYMENT_README.md](CLOUDFLARE_DEPLOYMENT_README.md)

### Features

- ✅ Automated deployment scripts
- ✅ KV namespace management
- ✅ Environment variable handling
- ✅ GitHub Actions CI/CD
- ✅ Pre/post-deploy validation
- ✅ Troubleshooting utilities
- ✅ Rollback procedures
- ✅ Comprehensive documentation

### Quick Deploy

```bash
# 1. Authenticate with Cloudflare
wrangler login

# 2. Set up environment
./scripts/env/manage-env.sh template
./scripts/kv/setup-kv.sh

# 3. Deploy
./scripts/deploy/deploy.sh
```

### Documentation

- [Quick Reference](QUICK_REFERENCE.md) - Common commands and tips
- [Deployment Guide](CLOUDFLARE_DEPLOYMENT_README.md) - Complete setup guide
- [Pages Functions](docs/PAGES_FUNCTIONS.md) - Backend API development
- [File Routing](docs/FILE_ROUTING.md) - Routing system guide
- [Dashboard Setup](docs/DASHBOARD_SETUP.md) - Dashboard configuration

### Resources

- [Cloudflare Pages](https://developers.cloudflare.com/pages/)
- [GitHub Actions Workflow](.github/workflows/deploy-cloudflare-pages.yml)
- [Troubleshooting](scripts/troubleshoot/troubleshoot.sh)