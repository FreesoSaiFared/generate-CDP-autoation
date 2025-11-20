#!/bin/bash

# Deployment script for MCP Server
# Deploys the built MCP server to production

set -e

echo "🚀 Deploying CDP Integuru MCP Server..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DEPLOY_DIR=${DEPLOY_DIR:-"/opt/cdp-integuru-mcp"}
SERVICE_NAME=${SERVICE_NAME:-"cdp-integuru-mcp"}
SERVICE_USER=${SERVICE_USER:-"cdp-automation"}

# Check if build exists
if [ ! -d "dist" ]; then
    echo -e "${RED}Error: dist directory not found. Please run build first.${NC}"
    exit 1
fi

# Check if running as root for system deployment
if [ "$DEPLOY_DIR" = "/opt/cdp-integuru-mcp" ] && [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: System deployment requires root privileges.${NC}"
    echo "Please run with: sudo ./scripts/deploy.sh"
    exit 1
fi

# Create deployment directory
echo -e "${YELLOW}📁 Creating deployment directory...${NC}"
sudo mkdir -p "$DEPLOY_DIR"
sudo mkdir -p "$DEPLOY_DIR/logs"
sudo mkdir -p "$DEPLOY_DIR/sessions"
sudo mkdir -p "$DEPLOY_DIR/temp"

# Copy built files
echo -e "${YELLOW}📋 Copying built files...${NC}"
sudo cp -r dist/* "$DEPLOY_DIR/"

# Set permissions
echo -e "${YELLOW}🔐 Setting permissions...${NC}"
sudo chown -R "$SERVICE_USER:$SERVICE_USER" "$DEPLOY_DIR"
sudo chmod -R 755 "$DEPLOY_DIR"
sudo chmod -R 777 "$DEPLOY_DIR/logs"
sudo chmod -R 777 "$DEPLOY_DIR/sessions"
sudo chmod -R 777 "$DEPLOY_DIR/temp"

# Create systemd service file
echo -e "${YELLOW}⚙️ Creating systemd service...${NC}"
sudo tee /etc/systemd/system/"$SERVICE_NAME".service > /dev/null <<EOF
[Unit]
Description=CDP Integuru MCP Server
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$DEPLOY_DIR
ExecStartPre=/bin/bash -c 'cd $DEPLOY_DIR && npm install --production'
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target

EOF

# Reload systemd and enable service
echo -e "${YELLOW}🔄 Reloading systemd daemon...${NC}"
sudo systemctl daemon-reload

echo -e "${YELLOW}🔧 Enabling service...${NC}"
sudo systemctl enable "$SERVICE_NAME"

# Install dependencies for production
echo -e "${YELLOW}📦 Installing production dependencies...${NC}"
cd "$DEPLOY_DIR"
sudo -u "$SERVICE_USER" npm ci --production

# Create configuration
echo -e "${YELLOW}⚙️ Creating production configuration...${NC}"
sudo -u "$SERVICE_USER" tee "$DEPLOY_DIR/mcp-config.json" > /dev/null <<EOF
{
  "logLevel": "warn",
  "integuru": {
    "model": "gpt-4o",
    "timeout": 30000,
    "tempDir": "$DEPLOY_DIR/temp",
    "integuruDir": "$DEPLOY_DIR/Integuru"
  },
  "mitmproxy": {
    "port": 8080,
    "host": "127.0.0.1",
    "harOutput": "$DEPLOY_DIR/network_requests.har"
  },
  "chrome": {
    "headless": true,
    "userDataDir": "$DEPLOY_DIR/chrome-user-data",
    "extensions": ["$DEPLOY_DIR/extensions/cdp-stealth"]
  },
  "sessions": {
    "storageDir": "$DEPLOY_DIR/sessions",
    "maxAge": 86400000
  }
}
EOF

# Start the service
echo -e "${YELLOW}🚀 Starting MCP server service...${NC}"
sudo systemctl start "$SERVICE_NAME"

# Wait a moment for service to start
sleep 3

# Check service status
echo -e "${YELLOW}🔍 Checking service status...${NC}"
if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
    echo -e "${GREEN}✅ Service is running successfully!${NC}"
    echo -e "${GREEN}📊 Service status:$(sudo systemctl status "$SERVICE_NAME" --no-pager -l --value=StatusSubType)${NC}"
else
    echo -e "${RED}❌ Service failed to start!${NC}"
    echo -e "${RED}📋 Service logs:${NC}"
    sudo journalctl -u "$SERVICE_NAME" --no-pager -n 20
    exit 1
fi

# Show deployment summary
echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo -e "${GREEN}📊 Deployment Summary:${NC}"
echo -e "  ${GREEN}✓${NC} Files copied to: $DEPLOY_DIR"
echo -e "  ${GREEN}✓${NC} Permissions set for: $SERVICE_USER"
echo -e "  ${GREEN}✓${NC} Systemd service: $SERVICE_NAME"
echo -e "  ${GREEN}✓${NC} Service status: Active"
echo ""
echo -e "${YELLOW}🔧 Management commands:${NC}"
echo -e "  ${YELLOW}•${NC} Status:     sudo systemctl status $SERVICE_NAME"
echo -e "  ${YELLOW}•${NC} Start:       sudo systemctl start $SERVICE_NAME"
echo -e "  ${YELLOW}•${NC} Stop:        sudo systemctl stop $SERVICE_NAME"
echo -e "  ${YELLOW}•${NC} Restart:     sudo systemctl restart $SERVICE_NAME"
echo -e "  ${YELLOW}•${NC} Logs:        sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo -e "${GREEN}🔗 MCP Server is ready for Claude integration!${NC}"