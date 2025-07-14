#!/bin/bash

# AutoWeave Appsmith Integration Setup Script
# This script deploys Appsmith on the Kind cluster and configures it for AutoWeave integration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# DevLogger integration
log_milestone() {
    local phase="$1"
    local task="$2"
    local status="$3"
    local metadata="$4"
    
    node -e "
        const { getDevLogger } = require('./src/utils/dev-logger');
        const logger = getDevLogger();
        logger.milestone('$phase', '$task', '$status', $metadata || {});
    "
}

# Configuration
CLUSTER_NAME="autoweave"
APPSMITH_NAMESPACE="appsmith-system"
APPSMITH_VALUES_FILE="config/k8s/appsmith-values.yaml"
TIMEOUT=300

log_info "🚀 Starting Appsmith integration setup for AutoWeave"

# Check if running from correct directory
if [ ! -f "package.json" ] || [ ! -f "src/index.js" ]; then
    log_error "Please run this script from the AutoWeave project root directory"
    exit 1
fi

log_milestone "Phase1" "Setup script initialization" "started" "{\"clusterName\": \"$CLUSTER_NAME\", \"namespace\": \"$APPSMITH_NAMESPACE\"}"

# Phase 1: Prerequisites Check
log_info "Phase 1: Checking prerequisites..."

# Check kubectl
if ! command -v kubectl &> /dev/null; then
    log_error "kubectl is not installed. Please install kubectl first."
    log_milestone "Phase1" "kubectl check" "failed" "{\"error\": \"kubectl not found\"}"
    exit 1
fi

KUBECTL_VERSION=$(kubectl version --client --short | cut -d' ' -f3)
log_success "kubectl $KUBECTL_VERSION"
log_milestone "Phase1" "kubectl check" "completed" "{\"version\": \"$KUBECTL_VERSION\"}"

# Check helm
if ! command -v helm &> /dev/null; then
    log_warn "Helm not found. Installing Helm..."
    curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
    chmod 700 get_helm.sh
    ./get_helm.sh
    rm get_helm.sh
    log_milestone "Phase1" "Helm installation" "completed" "{\"method\": \"automatic\"}"
else
    HELM_VERSION=$(helm version --short | cut -d' ' -f1)
    log_success "Helm $HELM_VERSION"
    log_milestone "Phase1" "Helm check" "completed" "{\"version\": \"$HELM_VERSION\"}"
fi

# Check Kind cluster
if ! kubectl cluster-info --context "kind-$CLUSTER_NAME" >/dev/null 2>&1; then
    log_error "Kind cluster '$CLUSTER_NAME' not accessible. Please run 'npm run setup' first."
    log_milestone "Phase1" "Kind cluster check" "failed" "{\"cluster\": \"$CLUSTER_NAME\", \"hint\": \"Run npm run setup\"}"
    exit 1
fi

log_success "Kind cluster '$CLUSTER_NAME' is accessible"
log_milestone "Phase1" "Kind cluster check" "completed" "{\"cluster\": \"$CLUSTER_NAME\", \"status\": \"accessible\"}"

# Check if AutoWeave configuration exists
if [ ! -f "$APPSMITH_VALUES_FILE" ]; then
    log_error "Appsmith values file not found at $APPSMITH_VALUES_FILE"
    log_milestone "Phase1" "Configuration file check" "failed" "{\"file\": \"$APPSMITH_VALUES_FILE\"}"
    exit 1
fi

log_success "Appsmith configuration file found"
log_milestone "Phase1" "Configuration file check" "completed" "{\"file\": \"$APPSMITH_VALUES_FILE\"}"

# Phase 2: Helm Repository Setup
log_info "Phase 2: Setting up Helm repository..."

START_TIME=$(date +%s)
helm repo add appsmith https://helm.appsmith.com
helm repo update
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

log_success "Appsmith Helm repository added and updated"
log_milestone "Phase1" "Helm repository setup" "completed" "{\"repo\": \"appsmith\", \"url\": \"https://helm.appsmith.com\", \"durationSeconds\": $DURATION}"

# Phase 3: Namespace Creation
log_info "Phase 3: Creating namespace..."

if kubectl get namespace "$APPSMITH_NAMESPACE" >/dev/null 2>&1; then
    log_info "Namespace '$APPSMITH_NAMESPACE' already exists"
    log_milestone "Phase1" "Namespace check" "completed" "{\"namespace\": \"$APPSMITH_NAMESPACE\", \"status\": \"exists\"}"
else
    kubectl create namespace "$APPSMITH_NAMESPACE"
    log_success "Namespace '$APPSMITH_NAMESPACE' created"
    log_milestone "Phase1" "Namespace creation" "completed" "{\"namespace\": \"$APPSMITH_NAMESPACE\"}"
fi

# Phase 4: Appsmith Deployment
log_info "Phase 4: Deploying Appsmith..."

START_TIME=$(date +%s)

# Check if Appsmith is already installed
if helm list -n "$APPSMITH_NAMESPACE" | grep -q "appsmith"; then
    log_warn "Appsmith is already installed. Upgrading..."
    helm upgrade appsmith appsmith/appsmith -n "$APPSMITH_NAMESPACE" -f "$APPSMITH_VALUES_FILE"
    OPERATION="upgrade"
else
    log_info "Installing Appsmith..."
    helm install appsmith appsmith/appsmith -n "$APPSMITH_NAMESPACE" -f "$APPSMITH_VALUES_FILE"
    OPERATION="install"
fi

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

log_success "Appsmith $OPERATION completed"
log_milestone "Phase1" "Appsmith deployment" "completed" "{\"operation\": \"$OPERATION\", \"namespace\": \"$APPSMITH_NAMESPACE\", \"durationSeconds\": $DURATION}"

# Phase 5: Deployment Verification
log_info "Phase 5: Verifying deployment..."

log_info "Waiting for Appsmith pods to be ready..."
START_TIME=$(date +%s)

kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=appsmith -n "$APPSMITH_NAMESPACE" --timeout=${TIMEOUT}s

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Check pod status
POD_STATUS=$(kubectl get pods -n "$APPSMITH_NAMESPACE" -l app.kubernetes.io/instance=appsmith -o jsonpath='{.items[0].status.phase}')
POD_NAME=$(kubectl get pods -n "$APPSMITH_NAMESPACE" -l app.kubernetes.io/instance=appsmith -o jsonpath='{.items[0].metadata.name}')

if [ "$POD_STATUS" = "Running" ]; then
    log_success "Appsmith pod is running"
    log_milestone "Phase1" "Pod readiness verification" "completed" "{\"podName\": \"$POD_NAME\", \"status\": \"Running\", \"durationSeconds\": $DURATION}"
else
    log_error "Appsmith pod is not running. Status: $POD_STATUS"
    log_milestone "Phase1" "Pod readiness verification" "failed" "{\"podName\": \"$POD_NAME\", \"status\": \"$POD_STATUS\"}"
    kubectl describe pod "$POD_NAME" -n "$APPSMITH_NAMESPACE"
    exit 1
fi

# Phase 6: Service Discovery
log_info "Phase 6: Discovering services..."

SERVICE_NAME=$(kubectl get svc -n "$APPSMITH_NAMESPACE" -l app.kubernetes.io/instance=appsmith -o jsonpath='{.items[0].metadata.name}')
SERVICE_PORT=$(kubectl get svc -n "$APPSMITH_NAMESPACE" -l app.kubernetes.io/instance=appsmith -o jsonpath='{.items[0].spec.ports[0].port}')

log_success "Appsmith service discovered: $SERVICE_NAME:$SERVICE_PORT"
log_milestone "Phase2" "Service discovery" "completed" "{\"serviceName\": \"$SERVICE_NAME\", \"port\": $SERVICE_PORT, \"namespace\": \"$APPSMITH_NAMESPACE\"}"

# Phase 7: Port Forward Setup
log_info "Phase 7: Setting up port forwarding..."

# Kill existing port-forward if running
pkill -f "kubectl port-forward -n $APPSMITH_NAMESPACE svc/$SERVICE_NAME" || true

# Start port-forward in background
kubectl port-forward -n "$APPSMITH_NAMESPACE" svc/"$SERVICE_NAME" 80:80 > /dev/null 2>&1 &
PORT_FORWARD_PID=$!
echo $PORT_FORWARD_PID > /tmp/appsmith-portforward.pid

sleep 5

# Verify port-forward is working
if ps -p $PORT_FORWARD_PID > /dev/null; then
    log_success "Port-forward established (PID: $PORT_FORWARD_PID)"
    log_milestone "Phase2" "Port-forward setup" "completed" "{\"pid\": $PORT_FORWARD_PID, \"localPort\": 80, \"remotePort\": 80, \"accessURL\": \"http://localhost\"}"
else
    log_error "Failed to establish port-forward"
    log_milestone "Phase2" "Port-forward setup" "failed" "{\"error\": \"Port-forward failed\"}"
    exit 1
fi

# Phase 8: Docker Gateway IP Discovery for AutoWeave API
log_info "Phase 8: Discovering network configuration..."

DOCKER_GATEWAY_IP=$(docker network inspect kind | grep Gateway | head -1 | awk '{print $2}' | sed 's/"//g')
AUTOWEAVE_API_URL="http://${DOCKER_GATEWAY_IP}:3000"

log_success "Docker Gateway IP: $DOCKER_GATEWAY_IP"
log_milestone "Phase3" "Network configuration discovery" "completed" "{\"dockerGatewayIP\": \"$DOCKER_GATEWAY_IP\", \"autoweaveAPIURL\": \"$AUTOWEAVE_API_URL\"}"

# Phase 9: Final Summary
log_info "Phase 9: Setup complete!"

cat << EOF

🎉 Appsmith Integration Setup Complete!

📋 Summary:
   • Namespace: $APPSMITH_NAMESPACE
   • Service: $SERVICE_NAME:$SERVICE_PORT
   • Port-forward PID: $PORT_FORWARD_PID
   • Access URL: http://localhost

🔧 Next Steps:
   1. Open your browser and go to: http://localhost
   2. Create your Appsmith admin account
   3. Configure API datasource with URL: $AUTOWEAVE_API_URL/api
   4. Build your AutoWeave management interface

🛠️  Useful Commands:
   • Stop port-forward: kill $PORT_FORWARD_PID
   • Check pods: kubectl get pods -n $APPSMITH_NAMESPACE
   • Check logs: kubectl logs -f -n $APPSMITH_NAMESPACE -l app.kubernetes.io/instance=appsmith
   • Restart port-forward: kubectl port-forward -n $APPSMITH_NAMESPACE svc/$SERVICE_NAME 80:80

📁 Configuration Files:
   • Helm values: $APPSMITH_VALUES_FILE
   • Progress log: docs/development-progress.md

EOF

log_milestone "Phase3" "Setup completion" "completed" "{\"accessURL\": \"http://localhost\", \"autoweaveAPIURL\": \"$AUTOWEAVE_API_URL/api\", \"portForwardPID\": $PORT_FORWARD_PID}"

log_success "Appsmith integration setup completed successfully!"