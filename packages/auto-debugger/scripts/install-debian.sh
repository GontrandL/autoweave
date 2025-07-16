#!/bin/bash
# Installation script for Playwright MCP on Debian Bookworm
# Tested on Debian 12 (Bookworm)

set -e

echo "🚀 AutoWeave Auto-Debugger Installation - Debian Bookworm"
echo "========================================================"

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo "Please do not run this script as root. It will use sudo when needed."
   exit 1
fi

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js LTS
echo "📦 Installing Node.js LTS..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "✅ Node.js already installed: $(node --version)"
fi

# Install system dependencies for Playwright
echo "📦 Installing Playwright system dependencies..."
sudo apt install -y \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libxss1 \
    libasound2 \
    libatspi2.0-0 \
    fonts-unifont \
    fonts-liberation \
    fonts-noto-color-emoji \
    libgtk-3-0 \
    libcups2 \
    libdbus-1-3 \
    libxext6 \
    libxfixes3 \
    libxshmfence1 \
    xvfb \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libnss3 \
    lsb-release \
    xdg-utils

# Install Docker if not present
echo "📦 Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER
    echo "⚠️  Please log out and back in for Docker group changes to take effect"
else
    echo "✅ Docker already installed: $(docker --version)"
fi

# Install Docker Compose if not present
echo "📦 Checking Docker Compose installation..."
if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
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

# Set up systemd service (optional)
echo "⚙️ Creating systemd service file..."
sudo tee /etc/systemd/system/autoweave-debugger.service > /dev/null << EOF
[Unit]
Description=AutoWeave Auto-Debugger Service
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PWD
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=append:$PWD/logs/debugger.log
StandardError=append:$PWD/logs/debugger-error.log

[Install]
WantedBy=multi-user.target
EOF

echo ""
echo "✅ Installation complete!"
echo ""
echo "🚀 Quick Start:"
echo "  1. Start with Docker:     docker-compose up -d"
echo "  2. Start with Node:       npm start"
echo "  3. Start as service:      sudo systemctl start autoweave-debugger"
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
echo "⚠️  Note: If you just installed Docker, please log out and back in for group changes to take effect."