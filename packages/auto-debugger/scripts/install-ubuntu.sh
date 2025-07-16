#!/bin/bash
# Installation script for Playwright MCP on Ubuntu 24.04
# Also compatible with Ubuntu 22.04 LTS

set -e

echo "🚀 AutoWeave Auto-Debugger Installation - Ubuntu"
echo "=============================================="

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo "Please do not run this script as root. It will use sudo when needed."
   exit 1
fi

# Detect Ubuntu version
UBUNTU_VERSION=$(lsb_release -rs)
echo "Detected Ubuntu version: $UBUNTU_VERSION"

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js
echo "📦 Installing Node.js..."
if ! command -v node &> /dev/null; then
    # Check if snap is available (preferred for Ubuntu)
    if command -v snap &> /dev/null; then
        echo "Installing Node.js via snap..."
        sudo snap install node --classic
    else
        echo "Installing Node.js via NodeSource repository..."
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
else
    echo "✅ Node.js already installed: $(node --version)"
fi

# Install system dependencies for Playwright
echo "📦 Installing Playwright system dependencies..."

# Base dependencies for all Ubuntu versions
DEPS="libnss3 libatk-bridge2.0-0 libxss1 libgbm1 libgtk-3-0 \
      libxrandr2 libxcomposite1 libxcursor1 libxdamage1 libxi6 \
      fonts-noto-color-emoji fonts-unifont fonts-liberation xvfb \
      ca-certificates fonts-liberation libappindicator3-1 libnss3 \
      lsb-release xdg-utils libxtst6 libxcb-dri3-0 libdrm2 \
      libxkbcommon0 libxfixes3"

# Version-specific dependencies
if [[ "$UBUNTU_VERSION" == "24.04" ]]; then
    # Ubuntu 24.04 specific packages
    DEPS="$DEPS libasound2t64 libgtk-3-0t64 libxshmfence-dev"
elif [[ "$UBUNTU_VERSION" == "22.04" ]]; then
    # Ubuntu 22.04 specific packages
    DEPS="$DEPS libasound2 libgtk-3-0 libxshmfence1"
else
    # Default to older package names
    DEPS="$DEPS libasound2 libgtk-3-0 libxshmfence1"
fi

# Install dependencies
sudo apt install -y $DEPS

# Install additional multimedia codecs
echo "📦 Installing multimedia codecs..."
sudo apt install -y \
    gstreamer1.0-plugins-base \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-plugins-ugly \
    gstreamer1.0-libav

# Install Docker if not present
echo "📦 Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    # Remove old versions
    sudo apt-get remove -y docker docker-engine docker.io containerd runc || true
    
    # Install prerequisites
    sudo apt-get install -y \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Add Docker's official GPG key
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    
    # Add Docker repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Add user to docker group
    sudo usermod -aG docker $USER
    echo "⚠️  Please log out and back in for Docker group changes to take effect"
else
    echo "✅ Docker already installed: $(docker --version)"
fi

# Install Docker Compose standalone if not present
echo "📦 Checking Docker Compose installation..."
if ! command -v docker-compose &> /dev/null; then
    if command -v docker &> /dev/null && docker compose version &> /dev/null; then
        echo "✅ Docker Compose plugin already installed"
    else
        echo "Installing Docker Compose standalone..."
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
    fi
else
    echo "✅ Docker Compose already installed: $(docker-compose --version)"
fi

# Install global npm packages
echo "📦 Installing global npm packages..."
sudo npm install -g \
    typescript \
    ts-node \
    pnpm \
    @playwright/test

# Navigate to package directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR/.."

# Install package dependencies
echo "📦 Installing package dependencies..."
npm install

# Install Playwright browsers
echo "🎭 Installing Playwright browsers..."
npx playwright install chromium firefox webkit
npx playwright install-deps

# Build the package
echo "🔨 Building the package..."
npm run build

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p data logs config prompts/templates

# Create default configuration
echo "⚙️ Creating default configuration..."
cat > config/default.json << EOF
{
  "mcp": {
    "port": 8931,
    "host": "0.0.0.0"
  },
  "browser": {
    "headless": true,
    "devtools": false,
    "timeout": 30000
  },
  "debugger": {
    "captureConsole": true,
    "captureErrors": true,
    "captureNetwork": true,
    "autoAnalyze": true,
    "maxLogSize": 1000
  },
  "autoweave": {
    "apiUrl": "http://localhost:3000",
    "memoryUrl": "http://localhost:8000"
  }
}
EOF

# Create systemd service
echo "⚙️ Creating systemd service file..."
sudo tee /etc/systemd/system/autoweave-debugger.service > /dev/null << EOF
[Unit]
Description=AutoWeave Auto-Debugger Service
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$PWD
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=append:$PWD/logs/debugger.log
StandardError=append:$PWD/logs/debugger-error.log
Environment="NODE_ENV=production"
Environment="PATH=/usr/local/bin:/usr/bin:/bin:$HOME/.npm/bin"

[Install]
WantedBy=multi-user.target
EOF

# Set up log rotation
echo "⚙️ Setting up log rotation..."
sudo tee /etc/logrotate.d/autoweave-debugger > /dev/null << EOF
$PWD/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 $USER $USER
    sharedscripts
    postrotate
        systemctl reload autoweave-debugger >/dev/null 2>&1 || true
    endscript
}
EOF

echo ""
echo "✅ Installation complete!"
echo ""
echo "🚀 Quick Start:"
echo "  1. Start with Docker:     docker compose up -d"
echo "  2. Start with Node:       npm start"
echo "  3. Start as service:      sudo systemctl start autoweave-debugger"
echo "  4. Enable on boot:        sudo systemctl enable autoweave-debugger"
echo ""
echo "📚 Documentation:"
echo "  - README:                 ./README.md"
echo "  - API Docs:              http://localhost:8931/docs"
echo "  - Logs:                  ./logs/"
echo ""
echo "🔧 Configuration:"
echo "  - Config file:           ./config/default.json"
echo "  - Environment vars:      .env"
echo ""
echo "🧪 Testing:"
echo "  - Run example:           node examples/basic-usage.js"
echo "  - Run tests:             npm test"
echo ""
if ! groups | grep -q docker; then
    echo "⚠️  Note: You need to log out and back in to use Docker without sudo."
fi