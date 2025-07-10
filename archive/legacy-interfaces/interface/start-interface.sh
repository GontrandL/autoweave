#!/bin/bash

# AutoWeave Interface Startup Script
# This script starts the complete AutoWeave interface with all components

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AUTOWEAVE_PORT=3002
CHAT_UI_PORT=3000
RASA_PORT=5005
TASKCAFE_PORT=3333
GITEA_PORT=3001

echo -e "${BLUE}🚀 Starting AutoWeave Complete Interface${NC}"
echo -e "${BLUE}=======================================${NC}"

# Function to check if port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${YELLOW}⚠️  Port $port is already in use${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Port $port is available${NC}"
        return 0
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local name=$2
    local timeout=30
    local count=0
    
    echo -e "${YELLOW}⏳ Waiting for $name to be ready...${NC}"
    
    while [ $count -lt $timeout ]; do
        if curl -s "$url" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ $name is ready${NC}"
            return 0
        fi
        count=$((count + 1))
        sleep 1
    done
    
    echo -e "${RED}❌ $name failed to start within ${timeout}s${NC}"
    return 1
}

# Check if AutoWeave is running
echo -e "${BLUE}📡 Checking AutoWeave API status...${NC}"
if ! curl -s "http://localhost:$AUTOWEAVE_PORT/api/health" >/dev/null 2>&1; then
    echo -e "${RED}❌ AutoWeave API is not running on port $AUTOWEAVE_PORT${NC}"
    echo -e "${YELLOW}💡 Please start AutoWeave first:${NC}"
    echo -e "   cd /home/gontrand/AutoWeave && ./start-autoweave.sh"
    exit 1
else
    echo -e "${GREEN}✅ AutoWeave API is running${NC}"
fi

# Check ports
echo -e "${BLUE}🔍 Checking port availability...${NC}"
check_port $CHAT_UI_PORT || { echo -e "${RED}❌ Chat UI port $CHAT_UI_PORT is not available${NC}"; exit 1; }

# Navigate to interface directory
cd "$(dirname "$0")"

# Copy AutoWeave configuration
echo -e "${BLUE}⚙️  Configuring Chat UI for AutoWeave...${NC}"
cd autoweave-interface
cp .env.autoweave .env

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install --ignore-engines
fi

# Build the application
echo -e "${BLUE}🔨 Building Chat UI...${NC}"
npm run build

# Start the Chat UI in background
echo -e "${BLUE}🚀 Starting Chat UI on port $CHAT_UI_PORT...${NC}"
npm run preview -- --port $CHAT_UI_PORT &
CHAT_UI_PID=$!

# Wait for Chat UI to be ready
wait_for_service "http://localhost:$CHAT_UI_PORT" "Chat UI"

# Function to cleanup on exit
cleanup() {
    echo -e "${YELLOW}🧹 Cleaning up...${NC}"
    if [ ! -z "$CHAT_UI_PID" ]; then
        kill $CHAT_UI_PID 2>/dev/null || true
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Show access information
echo -e "${GREEN}🎉 AutoWeave Interface is ready!${NC}"
echo -e "${GREEN}=================================${NC}"
echo -e "${GREEN}🌐 Chat Interface: http://localhost:$CHAT_UI_PORT${NC}"
echo -e "${GREEN}📊 AutoWeave API: http://localhost:$AUTOWEAVE_PORT${NC}"
echo -e "${GREEN}💬 SillyTavern: http://localhost:8081${NC}"
echo -e "${GREEN}📈 Appsmith: http://localhost:8080${NC}"
echo -e "${GREEN}=================================${NC}"

# Optional: Start additional services
echo -e "${BLUE}🔧 Optional Services:${NC}"

# Check if Rasa should be started
if [ -f "../rasa-integration/actions/actions.py" ]; then
    echo -e "${YELLOW}🧠 Rasa integration available${NC}"
    echo -e "${YELLOW}   To enable: Set RASA_ENABLED=true in .env${NC}"
fi

# Check if Taskcafe should be started
if [ -f "../project-components/taskcafe/docker-compose.yml" ]; then
    echo -e "${YELLOW}📋 Taskcafe integration available${NC}"
    echo -e "${YELLOW}   To enable: Set TASKCAFE_ENABLED=true in .env${NC}"
fi

# Check if Gitea should be started
if [ -f "../project-components/gitea/docker-compose.yml" ]; then
    echo -e "${YELLOW}📂 Gitea integration available${NC}"
    echo -e "${YELLOW}   To enable: Set GITEA_ENABLED=true in .env${NC}"
fi

# Monitor the services
echo -e "${BLUE}📊 Monitoring services...${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Keep the script running
while true; do
    sleep 10
    
    # Check if Chat UI is still running
    if ! kill -0 $CHAT_UI_PID 2>/dev/null; then
        echo -e "${RED}❌ Chat UI has stopped${NC}"
        break
    fi
    
    # Check if AutoWeave is still running
    if ! curl -s "http://localhost:$AUTOWEAVE_PORT/api/health" >/dev/null 2>&1; then
        echo -e "${RED}❌ AutoWeave API is no longer available${NC}"
        break
    fi
done

cleanup