#!/bin/bash

# SillyTavern AutoWeave Extension Installation Script
# This script installs the AutoWeave extension into SillyTavern

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
EXTENSION_NAME="autoweave"
EXTENSION_FILE="autoweave-extension.js"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
EXTENSION_SOURCE="$PROJECT_ROOT/config/sillytavern/$EXTENSION_FILE"
SILLYTAVERN_NAMESPACE="autoweave-system"

echo -e "${BLUE}🚀 Installing AutoWeave Extension for SillyTavern${NC}"
echo "============================================="

# Function to log messages
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if extension source exists
if [ ! -f "$EXTENSION_SOURCE" ]; then
    log_error "Extension source file not found: $EXTENSION_SOURCE"
    exit 1
fi

log_info "Found extension source: $EXTENSION_SOURCE"

# Check if SillyTavern is running in Kubernetes
log_info "Checking SillyTavern deployment..."
if kubectl get pods -n $SILLYTAVERN_NAMESPACE -l app=sillytavern >/dev/null 2>&1; then
    SILLYTAVERN_POD=$(kubectl get pods -n $SILLYTAVERN_NAMESPACE -l app=sillytavern -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    
    if [ -z "$SILLYTAVERN_POD" ]; then
        log_error "No SillyTavern pod found in namespace $SILLYTAVERN_NAMESPACE"
        exit 1
    fi
    
    log_info "Found SillyTavern pod: $SILLYTAVERN_POD"
    
    # Check if pod is running
    POD_STATUS=$(kubectl get pod $SILLYTAVERN_POD -n $SILLYTAVERN_NAMESPACE -o jsonpath='{.status.phase}' 2>/dev/null)
    if [ "$POD_STATUS" != "Running" ]; then
        log_warning "SillyTavern pod is not running (status: $POD_STATUS)"
        log_info "Attempting to restart SillyTavern deployment..."
        
        # Restart the deployment
        kubectl rollout restart deployment/sillytavern -n $SILLYTAVERN_NAMESPACE
        
        # Wait for pod to be ready
        log_info "Waiting for SillyTavern to be ready..."
        kubectl wait --for=condition=ready pod -l app=sillytavern -n $SILLYTAVERN_NAMESPACE --timeout=300s
        
        # Get the new pod name
        SILLYTAVERN_POD=$(kubectl get pods -n $SILLYTAVERN_NAMESPACE -l app=sillytavern -o jsonpath='{.items[0].metadata.name}')
        log_success "SillyTavern pod restarted: $SILLYTAVERN_POD"
    fi
    
    # Copy extension to SillyTavern pod
    log_info "Installing extension to SillyTavern pod..."
    
    # Create extensions directory if it doesn't exist
    kubectl exec -n $SILLYTAVERN_NAMESPACE $SILLYTAVERN_POD -- mkdir -p /app/public/scripts/extensions
    
    # Copy the extension file
    kubectl cp "$EXTENSION_SOURCE" "$SILLYTAVERN_NAMESPACE/$SILLYTAVERN_POD:/app/public/scripts/extensions/$EXTENSION_FILE"
    
    # Verify installation
    if kubectl exec -n $SILLYTAVERN_NAMESPACE $SILLYTAVERN_POD -- ls /app/public/scripts/extensions/$EXTENSION_FILE >/dev/null 2>&1; then
        log_success "Extension installed successfully in SillyTavern pod"
    else
        log_error "Failed to install extension in SillyTavern pod"
        exit 1
    fi
    
else
    log_warning "SillyTavern not found in Kubernetes. Checking for local installation..."
    
    # Check common local SillyTavern installation paths
    POSSIBLE_PATHS=(
        "$HOME/SillyTavern"
        "$HOME/sillytavern"
        "/opt/SillyTavern"
        "/usr/local/SillyTavern"
        "./SillyTavern"
    )
    
    SILLYTAVERN_PATH=""
    for path in "${POSSIBLE_PATHS[@]}"; do
        if [ -d "$path" ] && [ -f "$path/server.js" ]; then
            SILLYTAVERN_PATH="$path"
            break
        fi
    done
    
    if [ -z "$SILLYTAVERN_PATH" ]; then
        log_error "SillyTavern installation not found"
        log_info "Please ensure SillyTavern is installed or deployed in Kubernetes"
        exit 1
    fi
    
    log_info "Found local SillyTavern installation: $SILLYTAVERN_PATH"
    
    # Create extensions directory if it doesn't exist
    EXTENSIONS_DIR="$SILLYTAVERN_PATH/public/scripts/extensions"
    mkdir -p "$EXTENSIONS_DIR"
    
    # Copy extension file
    cp "$EXTENSION_SOURCE" "$EXTENSIONS_DIR/$EXTENSION_FILE"
    
    # Set proper permissions
    chmod 644 "$EXTENSIONS_DIR/$EXTENSION_FILE"
    
    log_success "Extension installed successfully in local SillyTavern"
fi

# Create extension manifest
log_info "Creating extension manifest..."
MANIFEST_CONTENT='{
  "name": "AutoWeave",
  "version": "1.0.0",
  "description": "AutoWeave agent orchestration integration for SillyTavern",
  "author": "AutoWeave Team",
  "main": "autoweave-extension.js",
  "permissions": ["api"],
  "dependencies": [],
  "settings": {
    "autoweave_api_url": "http://localhost:3000",
    "auto_refresh_interval": 30000
  }
}'

# Install manifest in pod if using Kubernetes
if [ ! -z "$SILLYTAVERN_POD" ]; then
    echo "$MANIFEST_CONTENT" | kubectl exec -n $SILLYTAVERN_NAMESPACE $SILLYTAVERN_POD -i -- tee /app/public/scripts/extensions/autoweave-manifest.json >/dev/null
    log_success "Extension manifest installed in pod"
else
    echo "$MANIFEST_CONTENT" > "$EXTENSIONS_DIR/autoweave-manifest.json"
    log_success "Extension manifest installed locally"
fi

# Display installation summary
echo ""
echo -e "${GREEN}✅ AutoWeave Extension Installation Complete!${NC}"
echo "============================================="
echo ""
echo "Extension Details:"
echo "  • Name: AutoWeave"
echo "  • Version: 1.0.0"
echo "  • File: $EXTENSION_FILE"
echo ""
echo "Features Available:"
echo "  • Agent creation from SillyTavern chat"
echo "  • Agent management panel"
echo "  • Slash commands: /autoweave, /createagent, /listagents"
echo "  • Real-time agent status monitoring"
echo ""
echo "Next Steps:"
echo "  1. Start or restart SillyTavern"
echo "  2. Look for the robot icon (🤖) in the toolbar"
echo "  3. Use /autoweave show to open the agent panel"
echo "  4. Create your first agent with /createagent <description>"
echo ""
echo "API Connection:"
echo "  • AutoWeave API: http://localhost:3000"
echo "  • Health Check: http://localhost:3000/health"
echo ""
log_info "Installation script completed successfully"