#!/bin/bash

source "$(dirname "$0")/dev-helpers.sh"

log_info "Running AutoWeave + kagent health check..."

# 1. Check Node.js and npm
if ! command -v node &> /dev/null; then
    log_error "Node.js not found"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2)
if [ "$(printf '%s\n' "18.0.0" "$NODE_VERSION" | sort -V | head -n1)" != "18.0.0" ]; then
    log_error "Node.js 18+ required, found $NODE_VERSION"
    exit 1
fi

log_success "Node.js $NODE_VERSION"

# 2. Check dependencies
if [ ! -d "node_modules" ]; then
    log_warn "Node modules not installed. Running npm install..."
    npm install
fi

# 3. Check environment
if [ ! -f ".env" ]; then
    log_warn ".env file not found. Copying from .env.example"
    cp .env.example .env
    log_warn "Please edit .env file with your API keys"
fi

# 4. Check OPENAI_API_KEY
source .env
if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "your_openai_api_key_here" ]; then
    log_error "OPENAI_API_KEY not set in .env file"
    exit 1
fi

log_success "Environment configuration"

# 5. Check kagent cluster
if ! check_kagent_cluster; then
    exit 1
fi

# 6. Check kagent pods
log_info "Checking kagent pods..."
if ! kubectl get pods -n kagent-system | grep -q "Running"; then
    log_error "kagent pods not running"
    kubectl get pods -n kagent-system
    exit 1
fi

log_success "kagent pods running"

# 7. Test AutoWeave API
log_info "Testing AutoWeave components..."

# Check if AutoWeave can be started
if [ -f "src/index.js" ]; then
    log_success "AutoWeave main file exists"
else
    log_warn "AutoWeave main file not found (this is expected during development)"
fi

log_success "Health check complete!"
log_info "kagent UI: $(get_kagent_ui_url)"
log_info "Ready to develop!"