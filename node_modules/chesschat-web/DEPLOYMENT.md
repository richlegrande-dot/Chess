# ChessChat Web - Deployment Guide

## Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
2. **Node.js**: Version 18 or higher
3. **OpenAI API Key**: Get from [platform.openai.com](https://platform.openai.com/api-keys)

## Initial Setup

### 1. Install Dependencies

```powershell
cd "c:\Users\richl\LLM vs Me\ChessChatWeb"
npm install
```

### 2. Configure Local Environment

Create `.dev.vars` file for local development:

```powershell
# Copy example file
Copy-Item .dev.vars.example .dev.vars

# Edit .dev.vars and add your OpenAI API key
notepad .dev.vars
```

`.dev.vars` should contain:
```
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 3. Run Locally

```powershell
# Start development server
npm run dev
```

Visit `http://localhost:3000` to see the app.

## Cloudflare Deployment

### Option 1: Deploy via Wrangler CLI (Recommended)

#### Step 1: Login to Cloudflare

```powershell
npx wrangler login
```

This opens a browser to authenticate with Cloudflare.

#### Step 2: Set Environment Variables

```powershell
# Set OpenAI API key in Cloudflare
npx wrangler pages secret put OPENAI_API_KEY
# When prompted, paste your OpenAI API key
```

#### Step 3: Build and Deploy

```powershell
# Build the project
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name=chesschat-web
```

Your app will be live at: `https://chesschat-web.pages.dev`

### Option 2: Deploy via Cloudflare Dashboard

#### Step 1: Push to Git

```powershell
# Initialize git repository
git init
git add .
git commit -m "Initial ChessChat Web"

# Push to GitHub (create repo first at github.com)
git remote add origin https://github.com/YOUR_USERNAME/chesschat-web.git
git branch -M main
git push -u origin main
```

#### Step 2: Connect to Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Pages** → **Create a project**
3. Connect your GitHub repository
4. Configure build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/`

#### Step 3: Set Environment Variables

1. In Cloudflare Pages project settings
2. Go to **Settings** → **Environment variables**
3. Add variable:
   - **Variable name**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key
   - **Environment**: Production & Preview

#### Step 4: Deploy

Click **Save and Deploy**. Your app will be live at:
- Production: `https://chesschat-web.pages.dev`
- Custom domain: Configure in **Custom domains** settings

## Testing the Deployment

### 1. Test Chess Gameplay

1. Visit your deployed URL
2. Make a move on the board (you play White)
3. AI should respond with a Black move
4. Verify error handling by playing invalid moves

### 2. Test Post-Game Chat

1. Complete a game (resign or reach checkmate)
2. Click "Analyze Game with AI"
3. Ask questions like "Where did I go wrong?"
4. Verify AI provides relevant analysis

### 3. Test Settings

1. Click "Settings" in header
2. Change AI model
3. Save and start new game
4. Verify the new model is used

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for AI opponent and chat |

## Custom Domain Setup

### 1. Add Domain in Cloudflare Pages

1. Go to your project in Cloudflare Pages
2. Navigate to **Custom domains**
3. Click **Set up a custom domain**
4. Enter your domain (e.g., `chesschat.example.com`)
5. Follow DNS configuration instructions

### 2. Update DNS

Add the following DNS records in your domain registrar:

```
Type: CNAME
Name: chesschat (or @)
Content: chesschat-web.pages.dev
Proxy: Enabled
```

### 3. Wait for SSL

Cloudflare automatically provisions an SSL certificate. This typically takes 1-5 minutes.

## Monitoring & Debugging

### View Logs

```powershell
# Tail Cloudflare Pages logs
npx wrangler pages deployment tail
```

### View Function Logs

Cloudflare Function logs appear in:
- Cloudflare Dashboard → Pages → Your Project → Functions

### Common Issues

#### Issue: "API key not configured"

**Solution**: Ensure `OPENAI_API_KEY` is set in Cloudflare Pages environment variables.

```powershell
# Re-set the API key
npx wrangler pages secret put OPENAI_API_KEY
```

#### Issue: "Failed to get AI move"

**Possible causes**:
1. Invalid OpenAI API key
2. OpenAI API rate limit exceeded
3. Network timeout

**Solution**: Check Cloudflare Function logs for specific error messages.

#### Issue: Build fails on Cloudflare

**Solution**: Ensure `package.json` scripts are correct:

```json
{
  "scripts": {
    "build": "tsc && vite build"
  }
}
```

#### Issue: Functions not working

**Solution**: Verify function files are in `functions/api/` directory:
- `functions/api/chess-move.ts`
- `functions/api/chat.ts`

## Local Development with Functions

To test Cloudflare Functions locally:

```powershell
# Install Wrangler
npm install -g wrangler

# Run local dev server with Functions
wrangler pages dev dist --local
```

## Performance Optimization

### 1. Enable Caching

Add `_headers` file in `public/`:

```
/*
  Cache-Control: public, max-age=3600
/assets/*
  Cache-Control: public, max-age=31536000
```

### 2. Compress Assets

Vite automatically compresses assets during build. Ensure gzip compression is enabled in Cloudflare.

### 3. Minimize API Calls

The app already implements retry logic with exponential backoff to minimize unnecessary API calls.

## Updating the App

### Update Code

```powershell
# Pull latest changes
git pull

# Install dependencies
npm install

# Test locally
npm run dev
```

### Deploy Updates

```powershell
# Build
npm run build

# Deploy
npm run deploy
```

Or push to GitHub if using automatic deployments.

## Rollback

To rollback to a previous deployment:

1. Go to Cloudflare Dashboard → Pages → Your Project
2. Navigate to **Deployments**
3. Find the previous successful deployment
4. Click **⋮** → **Rollback to this deployment**

## Cost Estimation

### Cloudflare Pages

- **Free tier**: 500 builds/month, unlimited requests
- **Paid tier**: $20/month (20,000 builds/month)

### OpenAI API Costs

- **GPT-4o Mini**: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- **GPT-4o**: ~$2.50 per 1M input tokens, ~$10 per 1M output tokens

**Estimated monthly cost** (1000 games):
- ~1000 moves × 10 tokens input = 10K tokens = $0.001
- ~1000 moves × 5 tokens output = 5K tokens = $0.003
- **Total**: ~$0.01/month for games + chat costs

## Security Best Practices

1. **Never commit `.dev.vars`** to git (already in `.gitignore`)
2. **Rotate API keys** regularly in Cloudflare settings
3. **Monitor usage** in OpenAI dashboard
4. **Set rate limits** in Cloudflare if needed
5. **Enable HTTPS only** (automatic with Cloudflare)

## Support

For issues or questions:
- **Cloudflare Docs**: [developers.cloudflare.com/pages](https://developers.cloudflare.com/pages/)
- **OpenAI Docs**: [platform.openai.com/docs](https://platform.openai.com/docs)
- **Vite Docs**: [vitejs.dev](https://vitejs.dev)

---

**Last Updated**: December 10, 2025  
**Version**: 1.0.0  
**Status**: Production Ready ✅
