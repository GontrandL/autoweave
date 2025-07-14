#!/bin/bash

# AutoWeave Rasa Integration Startup Script
# This script starts the Rasa server and action server for AutoWeave integration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RASA_PORT=5005
ACTION_PORT=5055
AUTOWEAVE_PORT=3002

echo -e "${BLUE}🧠 Starting AutoWeave Rasa Integration${NC}"
echo -e "${BLUE}=====================================${NC}"

# Navigate to the correct directory
cd "$(dirname "$0")"

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
check_port $RASA_PORT || { echo -e "${RED}❌ Rasa port $RASA_PORT is not available${NC}"; exit 1; }
check_port $ACTION_PORT || { echo -e "${RED}❌ Action server port $ACTION_PORT is not available${NC}"; exit 1; }

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}📦 Creating Python virtual environment...${NC}"
    python3 -m venv venv
fi

# Activate virtual environment
echo -e "${BLUE}🐍 Activating virtual environment...${NC}"
source venv/bin/activate

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
pip install -r requirements.txt

# Create necessary directories
mkdir -p logs models

# Train the model if it doesn't exist
if [ ! -f "models/autoweave-model.tar.gz" ]; then
    echo -e "${YELLOW}🎓 Training Rasa model...${NC}"
    rasa train --config config.yml --domain domain.yml --data data/ --out models/
    
    # Find the latest model
    LATEST_MODEL=$(ls -t models/*.tar.gz | head -n1)
    if [ -f "$LATEST_MODEL" ]; then
        cp "$LATEST_MODEL" models/autoweave-model.tar.gz
        echo -e "${GREEN}✅ Model trained successfully${NC}"
    else
        echo -e "${RED}❌ Model training failed${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Using existing model${NC}"
fi

# Start the action server in background
echo -e "${BLUE}🚀 Starting Rasa Action Server on port $ACTION_PORT...${NC}"
rasa run actions --port $ACTION_PORT --actions actions.actions --debug > logs/actions.log 2>&1 &
ACTION_PID=$!

# Wait for action server to be ready
wait_for_service "http://localhost:$ACTION_PORT/webhook" "Action Server"

# Start the Rasa server in background
echo -e "${BLUE}🚀 Starting Rasa Server on port $RASA_PORT...${NC}"
rasa run --model models/autoweave-model.tar.gz --port $RASA_PORT --endpoints endpoints.yml --credentials credentials.yml --debug > logs/rasa.log 2>&1 &
RASA_PID=$!

# Wait for Rasa server to be ready
wait_for_service "http://localhost:$RASA_PORT/webhooks/rest/webhook" "Rasa Server"

# Function to cleanup on exit
cleanup() {
    echo -e "${YELLOW}🧹 Cleaning up...${NC}"
    if [ ! -z "$RASA_PID" ]; then
        kill $RASA_PID 2>/dev/null || true
    fi
    if [ ! -z "$ACTION_PID" ]; then
        kill $ACTION_PID 2>/dev/null || true
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Show access information
echo -e "${GREEN}🎉 AutoWeave Rasa Integration is ready!${NC}"
echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}🧠 Rasa Server: http://localhost:$RASA_PORT${NC}"
echo -e "${GREEN}⚡ Action Server: http://localhost:$ACTION_PORT${NC}"
echo -e "${GREEN}🌐 AutoWeave API: http://localhost:$AUTOWEAVE_PORT${NC}"
echo -e "${GREEN}=======================================${NC}"

# Test the integration
echo -e "${BLUE}🧪 Testing integration...${NC}"
TEST_RESPONSE=$(curl -s -X POST "http://localhost:$RASA_PORT/webhooks/rest/webhook" \
    -H "Content-Type: application/json" \
    -d '{"sender": "test", "message": "hello"}')

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Integration test successful${NC}"
    echo -e "${BLUE}Response: $TEST_RESPONSE${NC}"
else
    echo -e "${RED}❌ Integration test failed${NC}"
fi

# Show usage examples
echo -e "${BLUE}📖 Usage Examples:${NC}"
echo -e "${BLUE}==================${NC}"
echo -e "${YELLOW}Test with curl:${NC}"
echo -e "curl -X POST http://localhost:$RASA_PORT/webhooks/rest/webhook \\\\"
echo -e "  -H 'Content-Type: application/json' \\\\"
echo -e "  -d '{\"sender\": \"user\", \"message\": \"create an agent that processes files\"}'"
echo -e ""
echo -e "${YELLOW}Example queries:${NC}"
echo -e "• 'Create an agent that processes PDF files'"
echo -e "• 'List my agents'"
echo -e "• 'What is the system status?'"
echo -e "• 'Search my memory for project data'"
echo -e "• 'Create a workflow for data processing'"

# Monitor the services
echo -e "${BLUE}📊 Monitoring services...${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo -e "${YELLOW}Logs are available in:${NC}"
echo -e "• Rasa Server: logs/rasa.log"
echo -e "• Action Server: logs/actions.log"
echo -e ""

# Keep the script running and monitor services
while true; do
    sleep 10
    
    # Check if Rasa server is still running
    if ! kill -0 $RASA_PID 2>/dev/null; then
        echo -e "${RED}❌ Rasa server has stopped${NC}"
        break
    fi
    
    # Check if Action server is still running
    if ! kill -0 $ACTION_PID 2>/dev/null; then
        echo -e "${RED}❌ Action server has stopped${NC}"
        break
    fi
    
    # Check if AutoWeave is still running
    if ! curl -s "http://localhost:$AUTOWEAVE_PORT/api/health" >/dev/null 2>&1; then
        echo -e "${RED}❌ AutoWeave API is no longer available${NC}"
        break
    fi
done

cleanup