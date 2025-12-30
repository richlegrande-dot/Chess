# VPS Deployment Guide - Stockfish HTTP Server

**Target**: Ubuntu 20.04+ or Debian 11+ VPS  
**Time**: 15-30 minutes  
**Difficulty**: ⭐⭐⭐ Medium

---

## Prerequisites

### 1. VPS Setup

You need a VPS with:
- **OS**: Ubuntu 20.04+ or Debian 11+
- **RAM**: 512MB minimum (1GB recommended)
- **CPU**: 1 core minimum (2+ recommended)
- **Storage**: 10GB minimum
- **Root access**: Yes (via SSH)

**VPS Provider Recommendations**:
- **DigitalOcean**: $6/month Droplet - [Get $200 credit](https://www.digitalocean.com/)
- **Vultr**: $6/month Cloud Compute - [Get $100 credit](https://www.vultr.com/)
- **Linode**: $5/month Nanode - [Get $100 credit](https://www.linode.com/)
- **Hetzner**: €4/month CX11 - [Very affordable](https://www.hetzner.com/)

### 2. Domain Name (Optional but Recommended)

For SSL/HTTPS support:
- Purchase domain from Namecheap, GoDaddy, Google Domains, etc.
- Point A record to your VPS IP address
- Wait for DNS propagation (5-30 minutes)

### 3. Local Tools

- SSH client (built into Windows 10+, macOS, Linux)
- SCP/SFTP for file transfer (WinSCP, FileZilla, or command line)

---

## Quick Start (Automated)

### Option A: One-Command Deployment

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Download and run deployment script
curl -fsSL https://raw.githubusercontent.com/YOUR_REPO/main/stockfish-server/deploy-vps.sh | sudo bash
```

### Option B: Manual Upload + Deploy

```bash
# 1. From your local machine, upload files to VPS
scp -r stockfish-server/ root@your-vps-ip:/root/

# 2. SSH into VPS
ssh root@your-vps-ip

# 3. Run deployment script
cd /root/stockfish-server
chmod +x deploy-vps.sh
sudo ./deploy-vps.sh
```

The script will:
1. ✅ Install Node.js, Nginx, Stockfish, PM2
2. ✅ Configure the application
3. ✅ Set up systemd service
4. ✅ Configure Nginx reverse proxy
5. ✅ Set up SSL (if domain provided)
6. ✅ Configure firewall
7. ✅ Start the server

---

## Manual Deployment (Step-by-Step)

If you prefer manual control, follow these steps:

### Step 1: Connect to VPS

```bash
# From your local machine
ssh root@your-vps-ip

# Or with key authentication
ssh -i ~/.ssh/id_rsa root@your-vps-ip
```

### Step 2: Update System

```bash
apt-get update
apt-get upgrade -y
apt-get install -y curl git nginx stockfish ufw
```

### Step 3: Install Node.js 18

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version
```

### Step 4: Install PM2 (Process Manager)

```bash
npm install -g pm2

# Verify installation
pm2 --version
```

### Step 5: Set Up Application

```bash
# Create application directory
mkdir -p /opt/stockfish-server
cd /opt/stockfish-server

# Upload your files (from local machine in another terminal)
# scp -r stockfish-server/* root@your-vps-ip:/opt/stockfish-server/

# Or clone from git if you have it in a repo
# git clone YOUR_REPO_URL .

# Install dependencies
npm ci --only=production
```

### Step 6: Configure Environment

```bash
# Generate API key
API_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "Generated API Key: $API_KEY"

# Create .env file
cat > /opt/stockfish-server/.env << EOF
PORT=3001
STOCKFISH_API_KEY=$API_KEY
NODE_ENV=production
EOF

# Save the API key - you'll need it later!
echo "$API_KEY" > ~/stockfish-api-key.txt
```

### Step 7: Create PM2 Configuration

```bash
cat > /opt/stockfish-server/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'stockfish-server',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '/var/log/stockfish-server/error.log',
    out_file: '/var/log/stockfish-server/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
EOF

# Create log directory
mkdir -p /var/log/stockfish-server
```

### Step 8: Start Application with PM2

```bash
cd /opt/stockfish-server

# Start the application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Set PM2 to start on boot
pm2 startup systemd
# Run the command that PM2 outputs

# Check status
pm2 status
pm2 logs stockfish-server --lines 20
```

### Step 9: Configure Firewall

```bash
# Enable firewall
ufw --force enable

# Allow SSH (important!)
ufw allow 22/tcp

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Allow Stockfish server port (if accessing directly)
ufw allow 3001/tcp

# Check status
ufw status
```

### Step 10: Configure Nginx Reverse Proxy

#### With Domain Name (Recommended for SSL)

```bash
# Get your domain name
DOMAIN="your-domain.com"

# Create Nginx configuration
cat > /etc/nginx/sites-available/stockfish-server << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts for chess computation
        proxy_connect_timeout 10s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;
    }
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/stockfish-server /etc/nginx/sites-enabled/

# Test configuration
nginx -t

# Reload Nginx
systemctl reload nginx
```

#### With IP Address Only

```bash
# Get your server IP
SERVER_IP=$(curl -s ifconfig.me)

# Create Nginx configuration
cat > /etc/nginx/sites-available/stockfish-server << EOF
server {
    listen 80;
    server_name $SERVER_IP;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable and reload
ln -s /etc/nginx/sites-available/stockfish-server /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### Step 11: Set Up SSL with Let's Encrypt (Domain Only)

```bash
# Install Certbot
apt-get install -y certbot python3-certbot-nginx

# Get SSL certificate
certbot --nginx -d your-domain.com

# Certbot will automatically:
# - Get certificate from Let's Encrypt
# - Update Nginx configuration
# - Set up auto-renewal

# Test auto-renewal
certbot renew --dry-run
```

---

## Testing Your Deployment

### Test Health Endpoint

```bash
# From VPS
curl http://localhost:3001/health

# From anywhere (with domain)
curl https://your-domain.com/health

# Or with IP
curl http://your-vps-ip/health
```

**Expected Response**:
```json
{
  "status": "healthy",
  "service": "stockfish-server",
  "version": "1.0.0",
  "timestamp": "2025-12-29T..."
}
```

### Test Compute Move Endpoint

```bash
# Get your API key
API_KEY=$(cat /opt/stockfish-server/.env | grep STOCKFISH_API_KEY | cut -d'=' -f2)

# Test compute move
curl -X POST https://your-domain.com/compute-move \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "cpuLevel": 5
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "move": "e2e4",
  "cpuLevel": 5,
  "computeTimeMs": 250,
  "timestamp": "..."
}
```

### Run Full Test Suite

```bash
cd /opt/stockfish-server

# Set environment variables
export STOCKFISH_API_KEY=$(grep STOCKFISH_API_KEY .env | cut -d'=' -f2)
export STOCKFISH_SERVER_URL="https://your-domain.com"

# Run tests
node test-server.js
```

---

## Configure Cloudflare Worker

Now that your VPS server is running, configure the Cloudflare Worker:

```bash
# From your local machine
cd ChessChatWeb/worker-api

# Set Stockfish server URL
npx wrangler secret put STOCKFISH_SERVER_URL
# Enter: https://your-domain.com (or http://your-vps-ip)

# Set API key (from VPS)
npx wrangler secret put STOCKFISH_API_KEY
# Enter: the API key from your VPS (cat /opt/stockfish-server/.env)

# Deploy Worker
npx wrangler deploy
```

---

## Server Management

### PM2 Commands

```bash
# View status
pm2 status

# View logs
pm2 logs stockfish-server
pm2 logs stockfish-server --lines 100

# Restart
pm2 restart stockfish-server

# Stop
pm2 stop stockfish-server

# Start
pm2 start stockfish-server

# Monitor resources
pm2 monit

# Save current state
pm2 save
```

### Nginx Commands

```bash
# Test configuration
nginx -t

# Reload
systemctl reload nginx

# Restart
systemctl restart nginx

# View logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### System Monitoring

```bash
# Check disk space
df -h

# Check memory
free -h

# Check CPU
top

# Check running processes
ps aux | grep node

# Check open ports
netstat -tulpn | grep LISTEN
```

---

## Troubleshooting

### Server Won't Start

```bash
# Check PM2 logs
pm2 logs stockfish-server --lines 50

# Check Node.js is installed
node --version

# Check if port is in use
netstat -tulpn | grep 3001

# Restart PM2
pm2 restart stockfish-server
```

### Nginx Errors

```bash
# Test configuration
nginx -t

# Check Nginx logs
tail -f /var/log/nginx/error.log

# Restart Nginx
systemctl restart nginx
```

### Can't Connect from Outside

```bash
# Check firewall
ufw status

# Allow ports
ufw allow 80/tcp
ufw allow 443/tcp

# Check if Nginx is running
systemctl status nginx

# Check if server is listening
netstat -tulpn | grep nginx
```

### SSL Certificate Issues

```bash
# Renew certificate manually
certbot renew

# Check certificate status
certbot certificates

# Test auto-renewal
certbot renew --dry-run
```

---

## Security Best Practices

### 1. SSH Security

```bash
# Disable root login (after creating sudo user)
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart ssh

# Use SSH keys instead of passwords
# On local machine:
ssh-copy-id user@your-vps-ip
```

### 2. Automatic Updates

```bash
# Install unattended upgrades
apt-get install -y unattended-upgrades

# Enable automatic security updates
dpkg-reconfigure -plow unattended-upgrades
```

### 3. Fail2Ban (Brute Force Protection)

```bash
# Install Fail2Ban
apt-get install -y fail2ban

# Enable and start
systemctl enable fail2ban
systemctl start fail2ban
```

### 4. Regular Backups

```bash
# Backup application and database
tar -czf /root/backup-$(date +%Y%m%d).tar.gz /opt/stockfish-server

# Automated backup script (cron)
echo "0 2 * * * tar -czf /root/backup-\$(date +\%Y\%m\%d).tar.gz /opt/stockfish-server" | crontab -
```

---

## Monitoring and Alerts

### Set Up Uptime Monitoring

Use external monitoring service:
- **UptimeRobot** (free): https://uptimerobot.com/
- **Pingdom** (free tier): https://www.pingdom.com/
- **StatusCake** (free): https://www.statuscake.com/

Monitor: `https://your-domain.com/health`

### Server Logs

```bash
# Application logs
pm2 logs stockfish-server

# System logs
journalctl -u nginx -f
tail -f /var/log/syslog
```

---

## Scaling and Performance

### Vertical Scaling (Upgrade VPS)

When you need more power:
1. Upgrade to larger VPS (more CPU/RAM)
2. No code changes needed
3. Just restart the service

### Horizontal Scaling (Multiple Servers)

For very high traffic:
1. Deploy to multiple VPS instances
2. Use load balancer (Nginx, HAProxy, Cloudflare)
3. Point Cloudflare Worker to load balancer

---

## Cost Estimate

| Component | Monthly Cost |
|-----------|--------------|
| VPS (DigitalOcean/Vultr) | $6 |
| Domain Name | $1-2 |
| SSL Certificate | $0 (Let's Encrypt) |
| **Total** | **$7-8** |

Cheaper than managed platforms for long-term use!

---

## Maintenance Checklist

### Weekly
- [ ] Check PM2 logs for errors
- [ ] Review Nginx access logs
- [ ] Check disk space: `df -h`

### Monthly
- [ ] Update system packages: `apt-get update && apt-get upgrade`
- [ ] Review security logs
- [ ] Test SSL certificate renewal
- [ ] Review server resource usage

### Quarterly
- [ ] Rotate API keys
- [ ] Review and clean old logs
- [ ] Backup configuration files
- [ ] Performance audit

---

## Getting Help

**Documentation**:
- Main deployment: [DEPLOYMENT_GUIDE_OPTION_B.md](./DEPLOYMENT_GUIDE_OPTION_B.md)
- Architecture: [ARCHITECTURE_STOCKFISH_AI_LEARNING.md](./ARCHITECTURE_STOCKFISH_AI_LEARNING.md)

**Common Issues**:
- Port already in use: `lsof -i :3001` then kill process
- Nginx won't start: Check config with `nginx -t`
- PM2 not starting on boot: Run `pm2 startup` again

---

**Deployment Date**: December 29, 2025  
**Guide Version**: 1.0  
**Tested On**: Ubuntu 22.04 LTS, Debian 11
