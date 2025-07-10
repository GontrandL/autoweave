#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if kagent cluster is running
check_kagent_cluster() {
    if ! kubectl cluster-info --context kind-autoweave >/dev/null 2>&1; then
        log_error "kagent cluster not running. Run 'npm run setup' first"
        return 1
    fi

    if ! kubectl get namespace kagent-system >/dev/null 2>&1; then
        log_error "kagent not installed. Run 'kagent install' first"
        return 1
    fi

    log_success "kagent cluster is running"
    return 0
}

# Get kagent UI URL
get_kagent_ui_url() {
    local port_forward_pid=$(pgrep -f "kubectl port-forward.*kagent-ui")
    if [ -n "$port_forward_pid" ]; then
        echo "http://localhost:8080"
    else
        log_warn "kagent UI port-forward not running. Run: kubectl port-forward -n kagent-system svc/kagent-ui 8080:80"
        echo ""
    fi
}

# Clean up test resources
cleanup_test_resources() {
    log_info "Cleaning up test resources..."

    # Delete test agents
    kubectl delete agents -l autoweave.dev/test=true --ignore-not-found=true

    # Delete test tools
    kubectl delete tools -l autoweave.dev/test=true --ignore-not-found=true

    log_success "Test resources cleaned"
}

# Export functions for use in other scripts
export -f log_info log_success log_warn log_error
export -f check_kagent_cluster get_kagent_ui_url cleanup_test_resources