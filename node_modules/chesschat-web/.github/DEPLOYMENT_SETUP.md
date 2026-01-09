# Automated Cloudflare Pages Deployment Setup

## Overview
Automatic deployment to Cloudflare Pages (chesschat.uk) on every push to `main` branch.

## GitHub Secrets Required

You need to add these secrets to your GitHub repository:

### 1. CLOUDFLARE_API_TOKEN
**Get it from:**
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use template: "Edit Cloudflare Workers"
4. Or create custom token with permissions:
   - Account > Cloudflare Pages: Edit
   - Zone > DNS: Read
5. Copy the token

**Add to GitHub:**
- Go to your repository: https://github.com/YOUR_USERNAME/Chess
- Settings → Secrets and variables → Actions
- Click "New repository secret"
- Name: `CLOUDFLARE_API_TOKEN`
- Value: (paste your token)

### 2. CLOUDFLARE_ACCOUNT_ID
**Get it from:**
1. Go to https://dash.cloudflare.com
2. Click on "Workers & Pages" in the left sidebar
3. Click on your "chesschat" project
4. Your Account ID is in the URL or in the right sidebar

**Add to GitHub:**
- Same process as above
- Name: `CLOUDFLARE_ACCOUNT_ID`
- Value: (paste your account ID)

## How It Works

### Automatic Deployment
When you push code to the `main` branch:
1. GitHub Actions builds your project
2. Deploys to Cloudflare Pages
3. Updates chesschat.uk automatically
4. No manual promotion needed!

### Triggers
- ✅ Push to `main` branch
- ✅ Changes to src/, public/, or config files
- ✅ Manual trigger via GitHub Actions UI

### Manual Deployment
You can also trigger manually:
1. Go to your repo → Actions tab
2. Click "Deploy to Cloudflare Pages"
3. Click "Run workflow" → "Run workflow"

## First Time Setup

### Step 1: Add Secrets (Above)
Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` to GitHub secrets.

### Step 2: Commit and Push
```bash
cd "c:\Users\richl\LLM vs Me\ChessChatWeb"
git add .github/workflows/deploy.yml
git commit -m "Add automated Cloudflare Pages deployment"
git push origin main
```

### Step 3: Watch It Deploy
- Go to your repo → Actions tab
- Watch the "Deploy to Cloudflare Pages" workflow run
- It will automatically deploy to chesschat.uk

## Testing the Automation

After setup, make a small change to test:
```bash
# Make a small change
echo "// Test deployment" >> src/lib/api.ts

# Commit and push
git add .
git commit -m "Test automated deployment"
git push origin main

# Watch the deployment happen automatically!
```

## Workflow Status Badge

Add this to your README.md to show deployment status:
```markdown
![Deploy Status](https://github.com/YOUR_USERNAME/Chess/actions/workflows/deploy.yml/badge.svg)
```

## Benefits

✅ **No Manual Steps** - Push to main = automatic deployment  
✅ **No Preview URLs** - Goes straight to production domain  
✅ **Consistent Builds** - Same environment every time  
✅ **Fast Deployments** - Typically 2-3 minutes total  
✅ **Rollback Ready** - Previous deployments saved in Cloudflare  

## Troubleshooting

### "Error: Could not find project"
- Check your `CLOUDFLARE_ACCOUNT_ID` is correct
- Verify project name is "chesschat" in Cloudflare dashboard

### "Error: Authentication error"
- Check your `CLOUDFLARE_API_TOKEN` is valid
- Ensure token has "Cloudflare Pages: Edit" permission

### "Build fails"
- Check the Actions log for specific errors
- Test locally with `npm run build` first

### "Deployment succeeds but site not updated"
- Clear browser cache (Ctrl+Shift+F5)
- Wait 1-2 minutes for Cloudflare CDN to update
- Check deployment in Cloudflare dashboard

## Current Status

**Manual Deployment:** Working ✅  
**Automated Deployment:** Needs secrets setup ⚠️  

Once you add the GitHub secrets, every push to `main` will automatically deploy to chesschat.uk!
