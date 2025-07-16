#!/bin/bash
# Start script for AutoWeave Auto-Debugger MCP Server

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

echo "🚀 Starting AutoWeave Auto-Debugger MCP Server"
echo "============================================"

# Check if the package is built
if [ ! -d "dist" ]; then
    echo "📦 Building package..."
    npm run build
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Install Playwright browsers if needed
if [ ! -d "$HOME/.cache/ms-playwright" ]; then
    echo "🎭 Installing Playwright browsers..."
    npx playwright install chromium
fi

# Create required directories
mkdir -p logs data config

# Check if config exists, if not create default
if [ ! -f "config/default.json" ]; then
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
fi

# Export environment variables
export NODE_ENV=${NODE_ENV:-production}
export MCP_PORT=${MCP_PORT:-8931}
export LOG_LEVEL=${LOG_LEVEL:-info}
export HEADLESS=${HEADLESS:-true}

echo ""
echo "📋 Configuration:"
echo "  - MCP Port: $MCP_PORT"
echo "  - Log Level: $LOG_LEVEL"
echo "  - Headless: $HEADLESS"
echo "  - Environment: $NODE_ENV"
echo ""

# Start the server
echo "🎭 Starting MCP server on port $MCP_PORT..."
exec node dist/playwright/mcp-server.js