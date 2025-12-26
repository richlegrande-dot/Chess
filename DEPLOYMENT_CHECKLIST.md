# Deployment Checklist

Use this checklist to ensure successful deployment to Cloudflare Pages.

## Pre-deployment Setup

### One-time Setup (First Deployment)

- [ ] **Cloudflare Account**
  - [ ] Create Cloudflare account
  - [ ] Get Account ID from dashboard
  - [ ] Create API token with Pages permissions

- [ ] **Wrangler CLI**
  - [ ] Install: `npm install -g wrangler`
  - [ ] Authenticate: `wrangler login`
  - [ ] Verify: `wrangler whoami`

- [ ] **GitHub Secrets** (for CI/CD)
  - [ ] Add `CLOUDFLARE_API_TOKEN` secret
  - [ ] Add `CLOUDFLARE_ACCOUNT_ID` secret

- [ ] **Environment Configuration**
  - [ ] Run: `./scripts/env/manage-env.sh template`
  - [ ] Edit `.env.production` with your values
  - [ ] Set DATABASE_URL
  - [ ] Set API_SECRET_KEY
  - [ ] Set JWT_SECRET

- [ ] **KV Namespaces**
  - [ ] Run: `./scripts/kv/setup-kv.sh`
  - [ ] Note namespace IDs
  - [ ] Configure bindings in dashboard

## Before Each Deployment

### Local Validation

- [ ] **Code Quality**
  - [ ] Run linter: `npm run lint`
  - [ ] Fix any linting errors
  - [ ] Run type check: `npm run type-check` (if available)

- [ ] **Build Test**
  - [ ] Install dependencies: `npm ci`
  - [ ] Run build: `npm run build`
  - [ ] Verify dist/ directory created
  - [ ] Check build output for errors

- [ ] **Pre-deploy Validation**
  - [ ] Run: `./scripts/validate/pre-deploy.sh`
  - [ ] Fix any validation errors

### Git Preparation

- [ ] **Version Control**
  - [ ] Commit all changes
  - [ ] Write descriptive commit message
  - [ ] Push to remote repository

## Deployment

### Manual Deployment

- [ ] **Run Deployment Script**
  - [ ] Execute: `./scripts/deploy/deploy.sh`
  - [ ] Monitor console output
  - [ ] Note any warnings or errors

- [ ] **Verify Deployment**
  - [ ] Wait for deployment to complete
  - [ ] Check deployment URL is accessible
  - [ ] Verify frontend loads correctly

### CI/CD Deployment

- [ ] **Trigger Deployment**
  - [ ] Push to main branch (production)
  - [ ] OR push to develop branch (development)
  - [ ] OR create pull request (preview)

- [ ] **Monitor GitHub Actions**
  - [ ] Go to Actions tab in GitHub
  - [ ] Watch workflow progress
  - [ ] Check for any failures

## Post-deployment Verification

### Automated Checks

- [ ] **Post-deploy Script**
  - [ ] Run: `DEPLOYMENT_URL="https://your-app.pages.dev" ./scripts/verify/post-deploy.sh`
  - [ ] Review verification results
  - [ ] Investigate any failures

### Manual Verification

- [ ] **Frontend Testing**
  - [ ] Open deployment URL in browser
  - [ ] Test main user flows
  - [ ] Check responsive design
  - [ ] Verify assets load correctly

- [ ] **API Testing**
  - [ ] Test /api/health endpoint
  - [ ] Verify API responses
  - [ ] Check authentication works
  - [ ] Test database connections

- [ ] **Performance**
  - [ ] Check page load times
  - [ ] Verify assets are cached
  - [ ] Test from different locations (if possible)

- [ ] **Security**
  - [ ] Verify HTTPS is enabled
  - [ ] Check security headers
  - [ ] Ensure secrets are not exposed

### Dashboard Verification

- [ ] **Cloudflare Dashboard**
  - [ ] Check deployment status is "Active"
  - [ ] Review deployment logs
  - [ ] Verify environment variables are set
  - [ ] Confirm KV bindings are configured

- [ ] **Analytics**
  - [ ] Enable Web Analytics (if not already)
  - [ ] Monitor initial traffic
  - [ ] Check for errors in analytics

## Post-deployment Tasks

### Documentation

- [ ] **Update Documentation**
  - [ ] Update deployment history
  - [ ] Document any issues encountered
  - [ ] Update runbook if needed

- [ ] **Notify Team**
  - [ ] Announce successful deployment
  - [ ] Share deployment URL
  - [ ] Note any breaking changes

### Monitoring

- [ ] **Set Up Monitoring**
  - [ ] Configure uptime monitoring
  - [ ] Set up error alerts
  - [ ] Enable performance monitoring

- [ ] **First 24 Hours**
  - [ ] Monitor error rates
  - [ ] Watch for performance issues
  - [ ] Be ready to rollback if needed

## Rollback Plan (if needed)

- [ ] **Identify Issue**
  - [ ] Confirm issue is deployment-related
  - [ ] Check error logs
  - [ ] Document the problem

- [ ] **Execute Rollback**
  - [ ] Via Dashboard: Find previous deployment → Click "Rollback"
  - [ ] OR via script: `./scripts/rollback/rollback.sh list` then rollback
  - [ ] Verify rollback completed

- [ ] **Post-rollback**
  - [ ] Verify site is working
  - [ ] Notify team of rollback
  - [ ] Investigate and fix issue

## Troubleshooting

If issues occur, use the troubleshooting utility:

```bash
# Interactive mode
./scripts/troubleshoot/troubleshoot.sh

# Or specific checks
./scripts/troubleshoot/troubleshoot.sh status
./scripts/troubleshoot/troubleshoot.sh kv
./scripts/troubleshoot/troubleshoot.sh database
./scripts/troubleshoot/troubleshoot.sh functions
```

## Notes

- **Preview Deployments**: For pull requests, preview URL will be commented on PR
- **Environment Variables**: Production and preview share the same secrets
- **KV Namespaces**: Preview and production have separate namespaces
- **Rollback**: Always possible via dashboard or Git

## Success Criteria

Deployment is successful when:
- ✅ Build completes without errors
- ✅ Deployment shows as "Active" in dashboard
- ✅ Frontend loads and functions correctly
- ✅ API endpoints respond as expected
- ✅ Database connections work
- ✅ No errors in console or logs
- ✅ Performance is acceptable

## Resources

- [Deployment Documentation](docs/DEPLOYMENT.md)
- [Troubleshooting Guide](scripts/troubleshoot/troubleshoot.sh)
- [Quick Reference](QUICK_REFERENCE.md)
- [Cloudflare Dashboard](https://dash.cloudflare.com/)
