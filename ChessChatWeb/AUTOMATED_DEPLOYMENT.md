# 🚀 Automated Deployment - Quick Start Guide

## Complete One-Command Deployment

Run this single command to deploy everything:

```powershell
.\deploy-complete.ps1 -VpsIP "YOUR_VPS_IP" -Domain "your-domain.com"
```

That's it! The script will:
1. ✅ Upload files to VPS
2. ✅ Install all dependencies
3. ✅ Configure and start server
4. ✅ Set up SSL (if domain provided)
5. ✅ Configure Cloudflare Worker
6. ✅ Deploy Worker
7. ✅ Test everything

---

## Step-by-Step Automated Deployment

### Prerequisites

1. **VPS Ready**
   - Ubuntu 20.04+ or Debian 11+
   - SSH access enabled
   - IP address or domain name

2. **Local Machine**
   - PowerShell (Windows 10+)
   - SSH client (built-in)

### Option 1: Complete Automation (Recommended)

```powershell
# Single command - does everything!
.\deploy-complete.ps1 -VpsIP "123.456.789.0" -Domain "chess.yourdomain.com"

# Or without domain (uses IP)
.\deploy-complete.ps1 -VpsIP "123.456.789.0"

# With SSH key
.\deploy-complete.ps1 -VpsIP "123.456.789.0" -Domain "chess.yourdomain.com" -SshKeyPath "~/.ssh/id_rsa"
```

### Option 2: Step-by-Step Automation

#### Step 1: Deploy to VPS

```powershell
cd stockfish-server

# With domain (recommended for SSL)
.\deploy-to-vps.ps1 -VpsIP "123.456.789.0" -Domain "chess.yourdomain.com"

# Without domain (HTTP only)
.\deploy-to-vps.ps1 -VpsIP "123.456.789.0"

# With SSH key
.\deploy-to-vps.ps1 -VpsIP "123.456.789.0" -SshKeyPath "~/.ssh/id_rsa"
```

**What it does:**
- ✅ Tests SSH connection
- ✅ Uploads all files
- ✅ Installs Node.js, Nginx, Stockfish, PM2
- ✅ Generates API key
- ✅ Configures and starts server
- ✅ Sets up SSL (if domain)
- ✅ Runs tests
- ✅ Saves deployment info

#### Step 2: Configure Cloudflare Worker

```powershell
cd ../worker-api

# Automatic (reads from deployment info)
.\configure-worker.ps1 -Deploy

# Or manual
.\configure-worker.ps1 -ServerUrl "https://chess.yourdomain.com" -ApiKey "your-api-key" -Deploy
```

**What it does:**
- ✅ Sets Worker secrets (STOCKFISH_SERVER_URL, STOCKFISH_API_KEY)
- ✅ Tests server connection
- ✅ Deploys Worker
- ✅ Saves configuration

---

## Script Parameters

### deploy-complete.ps1

| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| `-VpsIP` | Yes | VPS IP address | `"123.456.789.0"` |
| `-Domain` | No | Your domain name | `"chess.yourdomain.com"` |
| `-SshUser` | No | SSH username (default: root) | `"ubuntu"` |
| `-SshKeyPath` | No | Path to SSH private key | `"~/.ssh/id_rsa"` |

### deploy-to-vps.ps1

Same parameters as `deploy-complete.ps1`

### configure-worker.ps1

| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| `-ServerUrl` | No* | Stockfish server URL | `"https://chess.yourdomain.com"` |
| `-ApiKey` | No* | API key from server | `"a1b2c3d4..."` |
| `-Deploy` | No | Deploy Worker immediately | (switch flag) |

*Auto-loaded from `deployment-info.json` if available

---

## What Gets Installed

### On VPS

- **Node.js 18** - Runtime for server
- **PM2** - Process manager (auto-restart, logs)
- **Nginx** - Reverse proxy
- **Stockfish** - Chess engine binary
- **Certbot** - SSL certificates (if domain)
- **UFW** - Firewall

### Files Created

**On VPS:**
- `/opt/stockfish-server/` - Application directory
- `/var/log/stockfish-server/` - Log files
- `/etc/nginx/sites-available/stockfish-server` - Nginx config

**Locally:**
- `stockfish-server/deployment-info.json` - Deployment details
- `stockfish-server/vps-commands.ps1` - Quick management commands
- `worker-api/worker-config.json` - Worker configuration

---

## After Deployment

### Load Management Commands

```powershell
# Load quick commands
. .\stockfish-server\vps-commands.ps1

# Now you can use:
Show-Logs        # View server logs
Restart-Server   # Restart the server
Get-Status       # Check PM2 status
Connect-VPS      # SSH to VPS
Test-Health      # Test health endpoint
```

### Verify Deployment

```powershell
# Test server health
curl https://chess.yourdomain.com/health

# Expected: {"status":"healthy","service":"stockfish-server",...}

# Test chess move
curl https://your-pages-domain.com/api/chess-move `
  -X POST `
  -H "Content-Type: application/json" `
  -d '{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","cpuLevel":5,"mode":"vs-cpu"}'

# Expected: {"success":true,"move":"e2e4",...}
```

### View Deployment Info

```powershell
# View saved deployment details
Get-Content .\stockfish-server\deployment-info.json | ConvertFrom-Json | Format-List
```

---

## Troubleshooting

### SSH Connection Failed

```powershell
# Test SSH manually
ssh root@YOUR_VPS_IP

# If using key authentication
ssh -i ~/.ssh/id_rsa root@YOUR_VPS_IP

# Add -SshKeyPath parameter to script
.\deploy-to-vps.ps1 -VpsIP "YOUR_IP" -SshKeyPath "~/.ssh/id_rsa"
```

### Files Upload Failed

```powershell
# Check you're in the right directory
Get-Location  # Should be in ChessChatWeb

# Verify files exist
Get-ChildItem .\stockfish-server\

# Try manual upload
scp -r .\stockfish-server\* root@YOUR_VPS_IP:/root/stockfish-server/
```

### Worker Configuration Failed

```powershell
# Manual configuration
cd worker-api

# Set secrets manually
npx wrangler secret put STOCKFISH_SERVER_URL
# Enter: https://your-server-url

npx wrangler secret put STOCKFISH_API_KEY
# Enter: your-api-key

# Deploy
npx wrangler deploy
```

### Server Not Responding

```bash
# SSH to VPS
ssh root@YOUR_VPS_IP

# Check PM2 status
pm2 status

# View logs
pm2 logs stockfish-server --lines 50

# Restart server
pm2 restart stockfish-server

# Check if port is listening
netstat -tulpn | grep 3001
```

---

## Manual Intervention Points

The scripts are designed to be fully automated, but you may need manual intervention for:

### 1. SSH Authentication

If using password authentication, you'll be prompted for password at these steps:
- Initial connection test
- File upload (SCP)
- Deployment script execution
- Each command execution

**Solution**: Set up SSH key authentication:
```powershell
# Generate key (if you don't have one)
ssh-keygen -t rsa -b 4096

# Copy to VPS
ssh-copy-id root@YOUR_VPS_IP
```

### 2. SSL Certificate Setup

If using a domain, Certbot may prompt for:
- Email address for notifications
- Agreement to terms of service

The script handles this automatically with `--non-interactive`, but you can set up SSL manually:
```bash
# On VPS
certbot --nginx -d your-domain.com
```

### 3. Cloudflare Worker Deployment

First-time Wrangler usage may require:
- Login to Cloudflare account
- Select Worker project

```powershell
# Login to Wrangler
npx wrangler login

# Follow browser prompts
```

---

## Security Notes

### API Key

The scripts automatically generate a secure API key. **Save it securely!**

```powershell
# View API key
Get-Content .\stockfish-server\deployment-info.json | ConvertFrom-Json | Select-Object -ExpandProperty apiKey

# Or on VPS
ssh root@YOUR_VPS_IP 'grep STOCKFISH_API_KEY /opt/stockfish-server/.env'
```

### Firewall

The script automatically configures UFW firewall:
- Port 22 (SSH)
- Port 80 (HTTP)
- Port 443 (HTTPS)
- Port 3001 (Stockfish server - optional)

### SSL Certificate

If using a domain, the script automatically sets up Let's Encrypt SSL.

Certificate auto-renewal is configured via Certbot systemd timer.

---

## Cost Estimate

| Item | Cost |
|------|------|
| VPS (DigitalOcean/Vultr/Hetzner) | $5-10/month |
| Domain (optional) | $1-2/month |
| SSL Certificate (Let's Encrypt) | Free |
| Cloudflare Workers | Free tier (100k req/day) |
| **Total** | **$5-12/month** |

---

## Success Checklist

- [ ] VPS created and accessible
- [ ] `deploy-complete.ps1` executed successfully
- [ ] API key saved securely
- [ ] Health endpoint responds: `curl https://your-server/health`
- [ ] Worker deployed successfully
- [ ] End-to-end test passes
- [ ] Management commands loaded
- [ ] Monitoring set up (UptimeRobot, etc.)

---

## Support

**Documentation:**
- Manual deployment: [VPS_DEPLOYMENT_GUIDE.md](./VPS_DEPLOYMENT_GUIDE.md)
- Quick start: [VPS_QUICK_START.md](./VPS_QUICK_START.md)
- Option B guide: [DEPLOYMENT_GUIDE_OPTION_B.md](./DEPLOYMENT_GUIDE_OPTION_B.md)

**Scripts:**
- Complete automation: `deploy-complete.ps1`
- VPS deployment: `stockfish-server/deploy-to-vps.ps1`
- Worker config: `worker-api/configure-worker.ps1`

---

**Ready to deploy? Run:**
```powershell
.\deploy-complete.ps1 -VpsIP "YOUR_VPS_IP" -Domain "your-domain.com"
```

That's it! ✨
