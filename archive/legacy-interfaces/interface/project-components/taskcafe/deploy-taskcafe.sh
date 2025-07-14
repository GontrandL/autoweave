#!/bin/bash

# AutoWeave Taskcafe Deployment Script
# This script deploys Taskcafe task management system with AutoWeave integration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 Deploying AutoWeave Taskcafe Integration${NC}"
echo -e "${BLUE}===========================================${NC}"

# Navigate to the correct directory
cd "$(dirname "$0")"

# Configuration
TASKCAFE_PORT=3333
AUTOWEAVE_PORT=3002
NAMESPACE=taskcafe

# Function to check if kubectl is available
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        echo -e "${RED}❌ kubectl is not installed or not in PATH${NC}"
        echo -e "${YELLOW}💡 Please install kubectl first${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ kubectl is available${NC}"
}

# Function to check if Kubernetes cluster is running
check_cluster() {
    if ! kubectl cluster-info &> /dev/null; then
        echo -e "${RED}❌ Kubernetes cluster is not running${NC}"
        echo -e "${YELLOW}💡 Please start your Kubernetes cluster first${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Kubernetes cluster is running${NC}"
}

# Function to check if AutoWeave is running
check_autoweave() {
    echo -e "${BLUE}📡 Checking AutoWeave API status...${NC}"
    if ! curl -s "http://localhost:$AUTOWEAVE_PORT/api/health" >/dev/null 2>&1; then
        echo -e "${RED}❌ AutoWeave API is not running on port $AUTOWEAVE_PORT${NC}"
        echo -e "${YELLOW}💡 Please start AutoWeave first${NC}"
        exit 1
    else
        echo -e "${GREEN}✅ AutoWeave API is running${NC}"
    fi
}

# Function to wait for deployment to be ready
wait_for_deployment() {
    local deployment=$1
    local namespace=$2
    local timeout=300
    
    echo -e "${YELLOW}⏳ Waiting for deployment $deployment to be ready...${NC}"
    
    if kubectl wait --for=condition=Available --timeout=${timeout}s deployment/$deployment -n $namespace; then
        echo -e "${GREEN}✅ Deployment $deployment is ready${NC}"
        return 0
    else
        echo -e "${RED}❌ Deployment $deployment failed to be ready within ${timeout}s${NC}"
        return 1
    fi
}

# Function to check service health
check_service_health() {
    local service_name=$1
    local namespace=$2
    local port=$3
    local path=${4:-/}
    
    echo -e "${BLUE}🔍 Checking $service_name health...${NC}"
    
    # Port forward to check service
    kubectl port-forward svc/$service_name $port:$port -n $namespace &
    PF_PID=$!
    
    # Wait a moment for port forward to establish
    sleep 3
    
    # Check health
    if curl -s "http://localhost:$port$path" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ $service_name is healthy${NC}"
        kill $PF_PID 2>/dev/null || true
        return 0
    else
        echo -e "${RED}❌ $service_name is not responding${NC}"
        kill $PF_PID 2>/dev/null || true
        return 1
    fi
}

# Pre-deployment checks
echo -e "${BLUE}🔍 Running pre-deployment checks...${NC}"
check_kubectl
check_cluster
check_autoweave

# Deploy Taskcafe
echo -e "${BLUE}🚀 Deploying Taskcafe...${NC}"
kubectl apply -f taskcafe-deployment.yaml

# Wait for namespace to be created
echo -e "${BLUE}⏳ Waiting for namespace to be ready...${NC}"
kubectl wait --for=condition=Ready --timeout=30s namespace/$NAMESPACE || true

# Wait for PostgreSQL to be ready
echo -e "${BLUE}⏳ Waiting for PostgreSQL to be ready...${NC}"
wait_for_deployment postgres $NAMESPACE

# Wait for Taskcafe to be ready
echo -e "${BLUE}⏳ Waiting for Taskcafe to be ready...${NC}"
wait_for_deployment taskcafe $NAMESPACE

# Check service health
echo -e "${BLUE}🔍 Checking service health...${NC}"
check_service_health taskcafe-service $NAMESPACE $TASKCAFE_PORT /healthz

# Show deployment status
echo -e "${BLUE}📊 Deployment Status:${NC}"
echo -e "${BLUE}===================${NC}"
kubectl get all -n $NAMESPACE

# Show access information
echo -e "${GREEN}🎉 Taskcafe deployment completed successfully!${NC}"
echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}📋 Taskcafe UI: http://localhost:3333${NC}"
echo -e "${GREEN}🌐 AutoWeave API: http://localhost:$AUTOWEAVE_PORT${NC}"
echo -e "${GREEN}🔑 Namespace: $NAMESPACE${NC}"
echo -e "${GREEN}=============================================${NC}"

# Show port forwarding command
echo -e "${BLUE}📡 To access Taskcafe:${NC}"
echo -e "${BLUE}======================${NC}"
echo -e "${YELLOW}kubectl port-forward svc/taskcafe-service 3333:3333 -n $NAMESPACE${NC}"
echo -e ""
echo -e "${BLUE}🔗 Then open: http://localhost:3333${NC}"

# Show logs command
echo -e "${BLUE}📜 To view logs:${NC}"
echo -e "${BLUE}================${NC}"
echo -e "${YELLOW}kubectl logs -f deployment/taskcafe -n $NAMESPACE${NC}"

# Show next steps
echo -e "${BLUE}📋 Next Steps:${NC}"
echo -e "${BLUE}===============${NC}"
echo -e "${YELLOW}1. Port forward to access Taskcafe UI${NC}"
echo -e "${YELLOW}2. Create your first project${NC}"
echo -e "${YELLOW}3. Configure AutoWeave integration${NC}"
echo -e "${YELLOW}4. Set up project workflows${NC}"

echo -e "${GREEN}✅ Taskcafe is now integrated with AutoWeave!${NC}"