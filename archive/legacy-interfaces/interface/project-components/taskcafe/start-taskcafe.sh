#!/bin/bash

# AutoWeave Taskcafe Startup Script
# This script starts the Taskcafe interface and bridge service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 Starting AutoWeave Taskcafe Integration${NC}"
echo -e "${BLUE}=========================================${NC}"

# Navigate to the correct directory
cd "$(dirname "$0")"

# Configuration
TASKCAFE_PORT=3333
BRIDGE_PORT=3334
AUTOWEAVE_PORT=3002

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
    local timeout=60
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
    echo -e "${YELLOW}💡 Please start AutoWeave first${NC}"
    exit 1
else
    echo -e "${GREEN}✅ AutoWeave API is running${NC}"
fi

# Check port availability
echo -e "${BLUE}🔍 Checking port availability...${NC}"
check_port $TASKCAFE_PORT || { echo -e "${RED}❌ Taskcafe port $TASKCAFE_PORT is not available${NC}"; exit 1; }
check_port $BRIDGE_PORT || { echo -e "${RED}❌ Bridge port $BRIDGE_PORT is not available${NC}"; exit 1; }

# Check if Kubernetes is available
echo -e "${BLUE}🔍 Checking Kubernetes availability...${NC}"
if kubectl cluster-info &> /dev/null; then
    echo -e "${GREEN}✅ Kubernetes cluster is available${NC}"
    KUBERNETES_AVAILABLE=true
    
    # Check if Taskcafe is deployed
    if kubectl get deployment taskcafe -n taskcafe &> /dev/null; then
        echo -e "${GREEN}✅ Taskcafe is deployed on Kubernetes${NC}"
        TASKCAFE_DEPLOYED=true
    else
        echo -e "${YELLOW}⚠️  Taskcafe is not deployed on Kubernetes${NC}"
        TASKCAFE_DEPLOYED=false
    fi
else
    echo -e "${YELLOW}⚠️  Kubernetes cluster is not available${NC}"
    KUBERNETES_AVAILABLE=false
    TASKCAFE_DEPLOYED=false
fi

# Deploy or start Taskcafe
if [ "$KUBERNETES_AVAILABLE" = true ]; then
    if [ "$TASKCAFE_DEPLOYED" = false ]; then
        echo -e "${BLUE}🚀 Deploying Taskcafe on Kubernetes...${NC}"
        ./deploy-taskcafe.sh
    else
        echo -e "${BLUE}🚀 Starting Taskcafe port forwarding...${NC}"
        kubectl port-forward svc/taskcafe-service $TASKCAFE_PORT:$TASKCAFE_PORT -n taskcafe &
        TASKCAFE_PID=$!
        
        # Wait for port forward to be ready
        sleep 3
        
        # Check if Taskcafe is accessible
        if wait_for_service "http://localhost:$TASKCAFE_PORT/healthz" "Taskcafe"; then
            echo -e "${GREEN}✅ Taskcafe is accessible${NC}"
        else
            echo -e "${RED}❌ Taskcafe port forwarding failed${NC}"
            exit 1
        fi
    fi
else
    echo -e "${YELLOW}⚠️  Kubernetes not available, using local Docker deployment${NC}"
    
    # Check if Docker is available
    if command -v docker &> /dev/null; then
        echo -e "${BLUE}🐳 Starting Taskcafe with Docker...${NC}"
        
        # Start PostgreSQL
        docker run -d --name taskcafe-postgres \
            -e POSTGRES_DB=taskcafe \
            -e POSTGRES_USER=taskcafe \
            -e POSTGRES_PASSWORD=taskcafe_password \
            -p 5432:5432 \
            postgres:15 || echo -e "${YELLOW}⚠️  PostgreSQL container may already exist${NC}"
        
        # Wait for PostgreSQL to be ready
        sleep 5
        
        # Start Taskcafe
        docker run -d --name taskcafe-app \
            -e TASKCAFE_DATABASE_HOST=host.docker.internal \
            -e TASKCAFE_DATABASE_NAME=taskcafe \
            -e TASKCAFE_DATABASE_USER=taskcafe \
            -e TASKCAFE_DATABASE_PASSWORD=taskcafe_password \
            -e TASKCAFE_DATABASE_SSLMODE=disable \
            -e TASKCAFE_DATABASE_PORT=5432 \
            -e TASKCAFE_SECRET_KEY=autoweave-taskcafe-secret \
            -e TASKCAFE_MIGRATE=true \
            -p $TASKCAFE_PORT:3333 \
            taskcafe/taskcafe:latest || echo -e "${YELLOW}⚠️  Taskcafe container may already exist${NC}"
        
        # Wait for Taskcafe to be ready
        if wait_for_service "http://localhost:$TASKCAFE_PORT" "Taskcafe"; then
            echo -e "${GREEN}✅ Taskcafe is running with Docker${NC}"
        else
            echo -e "${RED}❌ Taskcafe failed to start with Docker${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ Neither Kubernetes nor Docker is available${NC}"
        echo -e "${YELLOW}💡 Please install either Kubernetes or Docker to run Taskcafe${NC}"
        exit 1
    fi
fi

# Install bridge dependencies
echo -e "${BLUE}📦 Installing bridge dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    npm install
fi

# Start the bridge service
echo -e "${BLUE}🌉 Starting AutoWeave-Taskcafe Bridge...${NC}"
TASKCAFE_API_URL=http://localhost:$TASKCAFE_PORT \
AUTOWEAVE_API_URL=http://localhost:$AUTOWEAVE_PORT \
BRIDGE_PORT=$BRIDGE_PORT \
node autoweave-taskcafe-bridge.js &
BRIDGE_PID=$!

# Wait for bridge to be ready
if wait_for_service "http://localhost:$BRIDGE_PORT/health" "Bridge Service"; then
    echo -e "${GREEN}✅ Bridge service is running${NC}"
else
    echo -e "${RED}❌ Bridge service failed to start${NC}"
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo -e "${YELLOW}🧹 Cleaning up...${NC}"
    
    # Kill bridge process
    if [ ! -z "$BRIDGE_PID" ]; then
        kill $BRIDGE_PID 2>/dev/null || true
    fi
    
    # Kill port forward if running
    if [ ! -z "$TASKCAFE_PID" ]; then
        kill $TASKCAFE_PID 2>/dev/null || true
    fi
    
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Show success message
echo -e "${GREEN}🎉 AutoWeave Taskcafe Integration is ready!${NC}"
echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}📋 Taskcafe UI: http://localhost:$TASKCAFE_PORT${NC}"
echo -e "${GREEN}🌉 Bridge API: http://localhost:$BRIDGE_PORT${NC}"
echo -e "${GREEN}🌐 AutoWeave API: http://localhost:$AUTOWEAVE_PORT${NC}"
echo -e "${GREEN}=============================================${NC}"

# Test the integration
echo -e "${BLUE}🧪 Testing integration...${NC}"

# Test bridge health
BRIDGE_HEALTH=$(curl -s "http://localhost:$BRIDGE_PORT/health")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Bridge health check passed${NC}"
    echo -e "${BLUE}Response: $BRIDGE_HEALTH${NC}"
else
    echo -e "${RED}❌ Bridge health check failed${NC}"
fi

# Test Taskcafe access
if curl -s "http://localhost:$TASKCAFE_PORT" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Taskcafe is accessible${NC}"
else
    echo -e "${RED}❌ Taskcafe is not accessible${NC}"
fi

# Show usage examples
echo -e "${BLUE}📖 Usage Examples:${NC}"
echo -e "${BLUE}==================${NC}"
echo -e "${YELLOW}Sync project to AutoWeave:${NC}"
echo -e "curl -X POST http://localhost:$BRIDGE_PORT/sync/project/1"
echo -e ""
echo -e "${YELLOW}Create task from agent:${NC}"
echo -e "curl -X POST http://localhost:$BRIDGE_PORT/agent/AGENT_ID/task \\\\"
echo -e "  -H 'Content-Type: application/json' \\\\"
echo -e "  -d '{\"description\": \"Process user feedback\"}'"
echo -e ""
echo -e "${YELLOW}Search AutoWeave memory:${NC}"
echo -e "curl -X POST http://localhost:$BRIDGE_PORT/memory/search \\\\"
echo -e "  -H 'Content-Type: application/json' \\\\"
echo -e "  -d '{\"query\": \"project tasks\"}'"

# Show next steps
echo -e "${BLUE}📋 Next Steps:${NC}"
echo -e "${BLUE}===============${NC}"
echo -e "${YELLOW}1. Open Taskcafe UI at http://localhost:$TASKCAFE_PORT${NC}"
echo -e "${YELLOW}2. Create your first project${NC}"
echo -e "${YELLOW}3. Use the bridge API to sync with AutoWeave${NC}"
echo -e "${YELLOW}4. Create agents from your project tasks${NC}"

# Monitor the services
echo -e "${BLUE}📊 Monitoring services...${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo -e ""

# Keep the script running
while true; do
    sleep 10
    
    # Check if bridge is still running
    if ! kill -0 $BRIDGE_PID 2>/dev/null; then
        echo -e "${RED}❌ Bridge service has stopped${NC}"
        break
    fi
    
    # Check if Taskcafe is still accessible
    if ! curl -s "http://localhost:$TASKCAFE_PORT" >/dev/null 2>&1; then
        echo -e "${RED}❌ Taskcafe is no longer accessible${NC}"
        break
    fi
    
    # Check if AutoWeave is still running
    if ! curl -s "http://localhost:$AUTOWEAVE_PORT/api/health" >/dev/null 2>&1; then
        echo -e "${RED}❌ AutoWeave API is no longer available${NC}"
        break
    fi
done

cleanup