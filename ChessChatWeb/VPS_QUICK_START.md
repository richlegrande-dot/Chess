# Quick VPS Deployment Instructions

## 🚀 Ultra-Fast Deployment (5 minutes)

### Step 1: Upload Files to VPS

From your local machine (PowerShell):

```powershell
# Navigate to stockfish-server directory
cd "C:\Users\richl\LLM vs Me\ChessChatWeb\stockfish-server"

# Upload to VPS using SCP
# Replace YOUR_VPS_IP with your actual VPS IP address
scp -r * root@YOUR_VPS_IP:/root/stockfish-server/

# SSH into VPS
ssh root@YOUR_VPS_IP
```

### Step 2: Run Deployment Script

On your VPS:

```bash
# Navigate to uploaded directory
cd /root/stockfish-server

# Make script executable
chmod +x deploy-vps.sh

# Run deployment script
./deploy-vps.sh
```

The script will prompt you for:
1. **Domain name** (optional - press Enter to use IP)
2. **Port** (press Enter for default: 3001)
3. **SSL setup** (if using domain, recommend: y)

### Step 3: Save the API Key

The script will display an API key like:
```
Generated API Key: a1b2c3d4e5f6...
```

**⚠️ SAVE THIS KEY!** You need it for Cloudflare Worker configuration.

### Step 4: Configure Cloudflare Worker

From your local machine:

```powershell
# Navigate to worker-api
cd "C:\Users\richl\LLM vs Me\ChessChatWeb\worker-api"

# Set server URL
npx wrangler secret put STOCKFISH_SERVER_URL
# Enter: https://your-domain.com (or http://YOUR_VPS_IP)

# Set API key
npx wrangler secret put STOCKFISH_API_KEY
# Enter: the API key from Step 3

# Deploy Worker
npx wrangler deploy
```

### Step 5: Test

```powershell
# Test server health
curl https://your-domain.com/health

# Test Worker API
curl -X POST https://your-domain.com/api/chess-move `
  -H "Content-Type: application/json" `
  -d '{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","cpuLevel":5,"mode":"vs-cpu"}'
```

**Expected**: `{"success":true,"move":"e2e4",...}`

---

## 📋 VPS Providers Quick Links

### Recommended Providers

1. **DigitalOcean** ($6/month)
   - Create Droplet: https://cloud.digitalocean.com/droplets/new
   - Choose: Ubuntu 22.04 LTS, Basic plan, Regular CPU, $6/month
   - Get $200 credit: https://www.digitalocean.com/

2. **Vultr** ($6/month)
   - Deploy: https://my.vultr.com/deploy/
   - Choose: Cloud Compute, $6/month, Ubuntu 22.04
   - Get $100 credit: https://www.vultr.com/

3. **Linode** ($5/month)
   - Create: https://cloud.linode.com/linodes/create
   - Choose: Shared CPU, Nanode 1GB, Ubuntu 22.04
   - Get $100 credit: https://www.linode.com/

4. **Hetzner** (€4/month - Cheapest!)
   - Create: https://console.hetzner.cloud/projects
   - Choose: CX11, Ubuntu 22.04
   - Very affordable, EU-based

---

## 🔧 Manual Commands (if script fails)

### Install Dependencies

```bash
# Update system
apt-get update && apt-get upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install other tools
apt-get install -y nginx stockfish git ufw

# Install PM2
npm install -g pm2
```

### Set Up Application

```bash
# Create directory
mkdir -p /opt/stockfish-server
cd /opt/stockfish-server

# Copy files (if already uploaded to /root/stockfish-server)
cp -r /root/stockfish-server/* .

# Install dependencies
npm ci --only=production

# Generate API key
API_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "API Key: $API_KEY"

# Create .env
cat > .env << EOF
PORT=3001
STOCKFISH_API_KEY=$API_KEY
NODE_ENV=production
EOF
```

### Start with PM2

```bash
cd /opt/stockfish-server

# Create PM2 config
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'stockfish-server',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    max_memory_restart: '512M',
    env: { NODE_ENV: 'production' }
  }]
};
EOF

# Start
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Check status
pm2 status
```

### Configure Nginx

```bash
# Create config
cat > /etc/nginx/sites-available/stockfish-server << 'EOF'
server {
    listen 80;
    server_name _;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

# Enable
ln -s /etc/nginx/sites-available/stockfish-server /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### Configure Firewall

```bash
ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable
```

---

## 🆘 Troubleshooting

### Can't SSH to VPS

```powershell
# Test connection
ping YOUR_VPS_IP

# Try with verbose
ssh -v root@YOUR_VPS_IP

# Check if using SSH key
ssh -i ~/.ssh/id_rsa root@YOUR_VPS_IP
```

### SCP Upload Fails

```powershell
# Alternative: Use WinSCP
# Download: https://winscp.net/

# Or use Git
# 1. Push to GitHub
# 2. On VPS: git clone YOUR_REPO
```

### Server Not Starting

```bash
# Check PM2 logs
pm2 logs stockfish-server

# Check if port is blocked
netstat -tulpn | grep 3001

# Restart
pm2 restart stockfish-server
```

### Nginx 502 Error

```bash
# Check if Node server is running
pm2 status

# Check Nginx logs
tail /var/log/nginx/error.log

# Restart both
pm2 restart stockfish-server
systemctl restart nginx
```

### Can't Access from Outside

```bash
# Check firewall
ufw status

# Allow HTTP
ufw allow 80

# Check if Nginx is listening
netstat -tulpn | grep :80
```

---

## 📊 After Deployment

### Check Server Status

```bash
# PM2 status
pm2 status

# View logs
pm2 logs stockfish-server --lines 20

# Server resources
pm2 monit
```

### Test Endpoints

```bash
# Get your IP
IP=$(curl -s ifconfig.me)

# Test health
curl http://$IP/health

# Test compute (need API key)
API_KEY=$(grep STOCKFISH_API_KEY /opt/stockfish-server/.env | cut -d'=' -f2)

curl -X POST http://$IP/compute-move \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","cpuLevel":5}'
```

---

## 💡 Pro Tips

### Use tmux for Long-Running Tasks

```bash
# Install tmux
apt-get install -y tmux

# Start session
tmux new -s deploy

# If disconnected, reattach
tmux attach -t deploy
```

### Set Up SSH Key (Recommended)

```powershell
# On local machine, generate key if you don't have one
ssh-keygen -t rsa -b 4096

# Copy to VPS
scp ~/.ssh/id_rsa.pub root@YOUR_VPS_IP:/root/.ssh/authorized_keys
```

### Save VPS Info

Create a file on your local machine:

```powershell
# Create deployment-info.txt
@"
VPS IP: YOUR_VPS_IP
Domain: your-domain.com
API Key: your-api-key-here
Deployed: $(Get-Date)
"@ | Out-File deployment-info.txt
```

---

## ✅ Success Checklist

- [ ] VPS created and accessible via SSH
- [ ] Files uploaded to VPS
- [ ] Deployment script ran successfully
- [ ] API key saved securely
- [ ] Health endpoint responds: `curl http://YOUR_IP/health`
- [ ] Cloudflare Worker secrets configured
- [ ] Worker deployed: `npx wrangler deploy`
- [ ] End-to-end test passes
- [ ] Monitoring set up (UptimeRobot, etc.)

---

**Need Help?**
- Full guide: [VPS_DEPLOYMENT_GUIDE.md](./VPS_DEPLOYMENT_GUIDE.md)
- Deployment options: [DEPLOYMENT_GUIDE_OPTION_B.md](./DEPLOYMENT_GUIDE_OPTION_B.md)

**Deployment Time**: ~15 minutes  
**Status**: Ready to deploy!
