# Learning Layer V3 - NPM Scripts Quick Reference

All verification and deployment commands are available via npm scripts for convenience.

## Deployment

### Deploy to Staging
```bash
npm run deploy:staging
```

### Deploy to Production
```bash
npm run deploy
```

## Database

### Generate Prisma Client
```bash
npm run prisma:generate
```

### Run Migrations (Production)
```bash
npm run prisma:migrate:deploy
```

### Open Database Console
```bash
npm run prisma:studio
```

## Verification

### Health Check
```bash
npm run verify:health
# Requires: ADMIN_PASSWORD environment variable
```

### Sample Ingestion
```bash
npm run verify:ingest
```

### Concept States
```bash
npm run verify:concepts
```

### Practice Plan
```bash
npm run verify:plan
```

### Intervention Loop
```bash
npm run verify:intervention
```

### Run All Verifications
```bash
npm run verify:all
# Requires: ADMIN_PASSWORD environment variable
```

### Verify Staging Environment
```bash
npm run verify:all:staging
# Requires: ADMIN_PASSWORD environment variable
```

## Testing

### E2E Test Suite (Local)
```bash
npm run test:e2e
```

### E2E Test Suite (Production)
```bash
npm run test:learning
# Requires: ADMIN_PASSWORD environment variable
```

## Custom URLs

For custom URLs (non-production), use the scripts directly:

```bash
# Health check
node scripts/verify-learning-health.mjs --url https://custom.url --password $ADMIN_PASSWORD

# Full verification
bash verify-all.sh https://custom.url $ADMIN_PASSWORD
# Or on Windows:
.\verify-all.ps1 -BaseUrl "https://custom.url" -AdminPassword $env:ADMIN_PASSWORD
```

## Environment Setup

Set `ADMIN_PASSWORD` for verification commands:

### Linux/Mac
```bash
export ADMIN_PASSWORD="your-password-here"
npm run verify:all
```

### Windows (PowerShell)
```powershell
$env:ADMIN_PASSWORD = "your-password-here"
npm run verify:all
```

### Windows (CMD)
```cmd
set ADMIN_PASSWORD=your-password-here
npm run verify:all
```

## Common Workflows

### After Deploying to Staging
```bash
npm run deploy:staging
npm run verify:all:staging
```

### After Deploying to Production
```bash
npm run deploy
npm run verify:all
```

### Quick Health Check
```bash
npm run verify:health
```

### Full Verification Suite
```bash
export ADMIN_PASSWORD="your-password"
npm run verify:all
```

## Script Reference

| Script | Description | Requires Auth |
|--------|-------------|---------------|
| `deploy:staging` | Deploy to staging environment | No |
| `deploy` | Deploy to production | No |
| `verify:health` | Check Learning V3 health | Yes |
| `verify:ingest` | Test game ingestion | No |
| `verify:concepts` | Check concept states | No |
| `verify:plan` | Validate practice plan | No |
| `verify:intervention` | Test closed-loop learning | No |
| `verify:all` | Run complete suite | Yes |
| `verify:all:staging` | Verify staging environment | Yes |
| `test:e2e` | E2E tests (local) | Yes |
| `test:learning` | E2E tests (production) | Yes |

## Troubleshooting

### "ADMIN_PASSWORD required"
Set the environment variable:
```bash
export ADMIN_PASSWORD="your-password"
```

### "bash: command not found" (Windows)
Use PowerShell script instead:
```powershell
.\verify-all.ps1 -BaseUrl "https://chesschat.uk" -AdminPassword $env:ADMIN_PASSWORD
```

### "node: command not found"
Install Node.js from nodejs.org

### Verification script fails
Check:
1. Is Learning V3 enabled? (`LEARNING_V3_ENABLED=true`)
2. Is the URL correct?
3. Is the admin password correct?
4. See `LEARNING_LAYER_V3_DEPLOYMENT_CHECKLIST.md` for troubleshooting

## Additional Resources

- **Deployment Guide:** `LEARNING_LAYER_V3_DEPLOYMENT_CHECKLIST.md`
- **Quick Commands:** `LEARNING_V3_QUICK_COMMANDS.md`
- **Release Summary:** `LEARNING_V3_RELEASE_CANDIDATE.md`
- **PR Description:** `PR_DESCRIPTION.md`
