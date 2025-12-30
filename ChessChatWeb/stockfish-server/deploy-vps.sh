#!/bin/bash

################################################################################
# VPS Deployment Script for Stockfish HTTP Server
#
# This script automates the deployment of the Stockfish server on a VPS
# running Ubuntu 20.04+ or Debian 11+
#
# Usage:
#   chmod +x deploy-vps.sh
#   sudo ./deploy-vps.sh
#
# Requirements:
#   - Ubuntu 20.04+ or Debian 11+
#   - Root or sudo access
#   - Domain pointed to server (optional, for SSL)
################################################################################

set -e  # Exit on error

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Stockfish HTTP Server - VPS Deployment                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root or with sudo"
    exit 1
fi

echo "📦 Step 1: Installing system dependencies..."
apt-get update
apt-get install -y curl git nginx stockfish certbot python3-certbot-nginx ufw

echo ""
echo "✓ Verifying Stockfish installation..."
if ! command -v stockfish &> /dev/null; then
    echo "❌ Stockfish not found in PATH!"
    echo "Attempting to install from backports..."
    apt-get install -y stockfish || {
        echo "❌ Failed to install Stockfish. Please install manually."
        exit 1
    }
fi

STOCKFISH_PATH=$(which stockfish)
echo "✓ Stockfish found at: $STOCKFISH_PATH"

# Test Stockfish is working
echo "✓ Testing Stockfish engine..."
echo "uci" | stockfish | head -n 5
if [ $? -eq 0 ]; then
    echo "✓ Stockfish is working correctly"
else
    echo "❌ Stockfish test failed!"
    exit 1
fi

echo ""
echo "📦 Step 2: Installing Node.js 18..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

NODE_VERSION=$(node --version)
echo "✓ Node.js installed: $NODE_VERSION"

echo ""
echo "📦 Step 3: Installing PM2 process manager..."
npm install -g pm2

echo ""
echo "📂 Step 4: Setting up application directory..."
APP_DIR="/opt/stockfish-server"
mkdir -p $APP_DIR

# Prompt for configuration
echo ""
echo "⚙️  Configuration Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
read -p "Enter domain name (or press Enter to use IP address): " DOMAIN_NAME
read -p "Enter server port [3001]: " SERVER_PORT
SERVER_PORT=${SERVER_PORT:-3001}

# Generate API key if not provided
echo ""
echo "🔑 Generating API key..."
API_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "Generated API Key: $API_KEY"
echo ""
echo "⚠️  IMPORTANT: Save this API key! You'll need it for Cloudflare Worker configuration."
echo ""
read -p "Press Enter to continue..."

# Create .env file
cat > $APP_DIR/.env << EOF
PORT=$SERVER_PORT
STOCKFISH_API_KEY=$API_KEY
NODE_ENV=production
EOF

echo "✓ Configuration saved to $APP_DIR/.env"

echo ""
echo "📥 Step 5: Copying application files..."
# Copy files from current directory to app directory
cp package*.json $APP_DIR/
cp server.js $APP_DIR/
cp test-server.js $APP_DIR/

echo ""
echo "📦 Step 6: Installing application dependencies..."
cd $APP_DIR
npm ci --only=production

echo ""
echo "🔧 Step 7: Configuring PM2..."
pm2 delete stockfish-server 2>/dev/null || true

# Create PM2 ecosystem file
cat > $APP_DIR/ecosystem.config.js << 'EOF'
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
chown -R $USER:$USER /var/log/stockfish-server

echo "✓ Starting application with PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u $USER --hp /root

echo ""
echo "🔥 Step 8: Configuring firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow $SERVER_PORT/tcp
    ufw --force enable
    echo "✓ Firewall configured"
else
    echo "⚠️  UFW not found, skipping firewall configuration"
fi

echo ""
echo "🌐 Step 9: Configuring Nginx reverse proxy..."

# Create Nginx configuration
if [ -n "$DOMAIN_NAME" ]; then
    # Using domain name
    cat > /etc/nginx/sites-available/stockfish-server << EOF
server {
    listen 80;
    server_name $DOMAIN_NAME;

    location / {
        proxy_pass http://localhost:$SERVER_PORT;
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

    ln -sf /etc/nginx/sites-available/stockfish-server /etc/nginx/sites-enabled/
    nginx -t && systemctl reload nginx
    
    echo "✓ Nginx configured for domain: $DOMAIN_NAME"
    
    # Offer SSL setup
    echo ""
    read -p "Do you want to set up SSL with Let's Encrypt? (y/n): " SETUP_SSL
    if [ "$SETUP_SSL" = "y" ] || [ "$SETUP_SSL" = "Y" ]; then
        echo "🔒 Setting up SSL certificate..."
        certbot --nginx -d $DOMAIN_NAME --non-interactive --agree-tos --register-unsafely-without-email || \
        certbot --nginx -d $DOMAIN_NAME
        echo "✓ SSL certificate installed"
    fi
    
    SERVER_URL="https://$DOMAIN_NAME"
else
    # Using IP address
    SERVER_IP=$(curl -s ifconfig.me)
    
    cat > /etc/nginx/sites-available/stockfish-server << EOF
server {
    listen 80;
    server_name $SERVER_IP;

    location / {
        proxy_pass http://localhost:$SERVER_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

    ln -sf /etc/nginx/sites-available/stockfish-server /etc/nginx/sites-enabled/
    nginx -t && systemctl reload nginx
    
    echo "✓ Nginx configured for IP: $SERVER_IP"
    SERVER_URL="http://$SERVER_IP"
fi

echo ""
echo "🧪 Step 10: Testing deployment..."
sleep 3

# Test health endpoint
echo "Testing health endpoint..."
if curl -f -s "$SERVER_URL/health" > /dev/null; then
    echo "✓ Health check passed"
    
    # Test move computation
    echo "Testing move computation..."
    MOVE_RESPONSE=$(curl -s -X POST "$SERVER_URL/compute-move" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $API_KEY" \
        -d '{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","cpuLevel":5}')
    
    if echo "$MOVE_RESPONSE" | grep -q '"success":true'; then
        MOVE=$(echo "$MOVE_RESPONSE" | grep -o '"move":"[^"]*"' | head -n1 | cut -d'"' -f4)
        echo "✓ Move computation test passed: $MOVE"
    else
        echo "⚠️  Move computation test failed"
        echo "Response: $MOVE_RESPONSE"
    fi
else
    echo "⚠️  Health check failed - checking PM2 logs..."
    pm2 logs stockfish-server --lines 50 --nostream
fi

echo ""
echo "📊 Verifying Stockfish is accessible..."
if echo "uci" | stockfish | head -n1 | grep -q "Stockfish"; then
    echo "✓ Stockfish binary is working"
else
    echo "⚠️  Stockfish binary test failed"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              🎉 Deployment Complete!                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 Server Information:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Server URL:        $SERVER_URL"
echo "Health Endpoint:   $SERVER_URL/health"
echo "API Key:           $API_KEY"
echo "App Directory:     $APP_DIR"
echo "PM2 Process:       stockfish-server"
echo ""
echo "📝 Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Test the server manually:"
echo "   curl $SERVER_URL/health"
echo "   curl -X POST $SERVER_URL/compute-move \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -H \"Authorization: Bearer $API_KEY\" \\"
echo "     -d '{\"fen\":\"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1\",\"cpuLevel\":8}'"
echo ""
echo "2. Save deployment info to file:"
cat > $APP_DIR/deployment-info.json << INFOJSON
{
  "serverUrl": "$SERVER_URL",
  "apiKey": "$API_KEY",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "vpsIp": "$(curl -s ifconfig.me)",
  "domain": "$DOMAIN_NAME",
  "port": $SERVER_PORT
}
INFOJSON
echo "   Saved to: $APP_DIR/deployment-info.json"
echo ""
echo "3. Configure Cloudflare Worker secrets (from your local machine):"
echo "   cd worker-api"
echo "   npx wrangler secret put STOCKFISH_SERVER_URL"
echo "   (Enter: $SERVER_URL)"
echo ""
echo "   npx wrangler secret put STOCKFISH_API_KEY"
echo "   (Enter: $API_KEY)"
echo ""
echo "4. Deploy the Worker:"
echo "   npx wrangler deploy"
echo ""
echo "📊 Server Management Commands:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "View logs:         pm2 logs stockfish-server"
echo "Restart server:    pm2 restart stockfish-server"
echo "Stop server:       pm2 stop stockfish-server"
echo "Server status:     pm2 status"
echo "Monitor:           pm2 monit"
echo ""
echo "🔐 Security Reminders:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "- Save the API key in a secure location"
echo "- Keep your server updated: apt-get update && apt-get upgrade"
echo "- Monitor server logs regularly: pm2 logs stockfish-server"
echo "- Set up monitoring alerts (UptimeRobot, etc.)"
echo ""
