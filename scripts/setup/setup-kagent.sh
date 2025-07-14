#!/bin/bash

set -e  # Exit on any error

echo "🚀 AutoWeave + kagent Setup Script"

# Colors
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

# Cleanup function
cleanup() {
    if [ ! -z "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
}
trap cleanup EXIT

# Create temp directory
TEMP_DIR=$(mktemp -d)

# Check if running as root (not recommended)
if [ "$EUID" -eq 0 ]; then
    log_warn "Running as root is not recommended"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Version requirements
REQUIRED_NODE_VERSION="18.0.0"
REQUIRED_DOCKER_VERSION="20.0.0"

# Function to compare versions
version_ge() {
    printf '%s\n' "$2" "$1" | sort -V -C
}

log_info "Checking prerequisites..."

# Check Docker
if ! command -v docker &> /dev/null; then
    log_error "Docker not found. Please install Docker first."
    log_info "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

DOCKER_VERSION=$(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
if ! version_ge "$DOCKER_VERSION" "$REQUIRED_DOCKER_VERSION"; then
    log_error "Docker version $REQUIRED_DOCKER_VERSION+ required, found $DOCKER_VERSION"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info >/dev/null 2>&1; then
    log_error "Docker daemon is not running. Please start Docker first."
    exit 1
fi

log_success "Docker $DOCKER_VERSION"

# Check Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js not found. Please install Node.js $REQUIRED_NODE_VERSION+ first."
    log_info "Visit: https://nodejs.org/en/download/"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2)
if ! version_ge "$NODE_VERSION" "$REQUIRED_NODE_VERSION"; then
    log_error "Node.js $REQUIRED_NODE_VERSION+ required, found $NODE_VERSION"
    exit 1
fi

log_success "Node.js $NODE_VERSION"

# Check kubectl
if ! command -v kubectl &> /dev/null; then
    log_warn "kubectl not found. Installing..."
    cd "$TEMP_DIR"
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
    chmod +x kubectl
    sudo mv kubectl /usr/local/bin/
    log_success "kubectl installed"
else
    log_success "kubectl $(kubectl version --client --short | cut -d' ' -f3)"
fi

# Check kind
if ! command -v kind &> /dev/null; then
    log_warn "kind not found. Installing..."
    cd "$TEMP_DIR"
    curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
    chmod +x ./kind
    sudo mv ./kind /usr/local/bin/kind
    log_success "kind installed"
else
    log_success "kind $(kind version | cut -d' ' -f2)"
fi

# Check/create kind cluster
CLUSTER_NAME="autoweave"
log_info "Setting up Kubernetes cluster..."

if kind get clusters 2>/dev/null | grep -q "^$CLUSTER_NAME$"; then
    log_info "Cluster '$CLUSTER_NAME' already exists"

    # Verify cluster is accessible
    if ! kubectl cluster-info --context "kind-$CLUSTER_NAME" >/dev/null 2>&1; then
        log_warn "Cluster exists but not accessible. Recreating..."
        kind delete cluster --name "$CLUSTER_NAME"
    else
        log_success "Cluster '$CLUSTER_NAME' is running"
    fi
fi

if ! kind get clusters 2>/dev/null | grep -q "^$CLUSTER_NAME$"; then
    log_info "Creating cluster '$CLUSTER_NAME'..."

    # Create kind config
    cat > "$TEMP_DIR/kind-config.yaml" <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: $CLUSTER_NAME
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 8080
    protocol: TCP
  - containerPort: 443
    hostPort: 8443
    protocol: TCP
EOF

    if ! kind create cluster --config "$TEMP_DIR/kind-config.yaml"; then
        log_error "Failed to create kind cluster"
        exit 1
    fi

    log_success "Cluster '$CLUSTER_NAME' created"
fi

# Wait for cluster to be ready
log_info "Waiting for cluster to be ready..."
timeout 120 bash -c 'until kubectl get nodes | grep -q "Ready"; do sleep 2; done' || {
    log_error "Cluster not ready after 2 minutes"
    exit 1
}

log_success "Cluster is ready"

# Install kagent CLI
log_info "Installing kagent CLI..."
if ! command -v kagent &> /dev/null; then
    if ! curl -fsSL https://raw.githubusercontent.com/kagent-dev/kagent/refs/heads/main/scripts/get-kagent | bash; then
        log_error "Failed to install kagent CLI"
        exit 1
    fi

    # Add to PATH for current session
    export PATH=$PATH:$HOME/.local/bin

    # Add to shell profile
    if [ -f "$HOME/.bashrc" ]; then
        echo 'export PATH=$PATH:$HOME/.local/bin' >> "$HOME/.bashrc"
    fi

    log_success "kagent CLI installed"
else
    log_success "kagent CLI already installed"
fi

# Check OPENAI_API_KEY
log_info "Checking OpenAI API key..."
if [ -z "$OPENAI_API_KEY" ]; then
    log_warn "OPENAI_API_KEY not set"

    while true; do
        read -p "Enter your OpenAI API key (or press Enter to skip): " -s API_KEY
        echo

        if [ -z "$API_KEY" ]; then
            log_warn "Skipping API key setup. You'll need to set OPENAI_API_KEY before using AutoWeave."
            break
        fi

        # Basic validation
        if [[ $API_KEY =~ ^sk-[a-zA-Z0-9]{48}$ ]]; then
            export OPENAI_API_KEY="$API_KEY"

            # Add to .env file
            if [ -f ".env" ]; then
                sed -i "s/OPENAI_API_KEY=.*/OPENAI_API_KEY=$API_KEY/" .env
            else
                echo "OPENAI_API_KEY=$API_KEY" >> .env
            fi

            log_success "OpenAI API key configured"
            break
        else
            log_error "Invalid API key format. Expected: sk-[48 characters]"
        fi
    done
else
    log_success "OpenAI API key is set"
fi

# Install kagent to cluster
log_info "Installing kagent to cluster..."

# Check if already installed
if kubectl get namespace kagent-system >/dev/null 2>&1; then
    log_info "kagent already installed"
else
    if ! kagent install; then
        log_error "Failed to install kagent"
        exit 1
    fi

    log_success "kagent installed to cluster"
fi

# Wait for kagent to be ready
log_info "Waiting for kagent to be ready..."
timeout 120 bash -c 'until kubectl get pods -n kagent-system | grep -q "Running"; do sleep 2; done' || {
    log_error "kagent not ready after 2 minutes"
    exit 1
}

log_success "kagent is ready"

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    log_info "Creating .env file from template..."
    cp .env.example .env
    log_success ".env file created"
fi

# Final setup
log_info "Final setup steps..."

# Install Node.js dependencies if not already installed
if [ ! -d "node_modules" ]; then
    log_info "Installing Node.js dependencies..."
    npm install
    log_success "Dependencies installed"
fi

# Set executable permissions on scripts
chmod +x scripts/dev/*.sh
chmod +x scripts/setup/*.sh
chmod +x scripts/cleanup/*.sh

log_success "🎉 AutoWeave + kagent setup complete!"
echo
log_info "Next steps:"
echo "1. Edit .env file with your OpenAI API key"
echo "2. Run 'npm run health' to verify the setup"
echo "3. Run 'npm run dev' to start AutoWeave"
echo "4. Run 'npm run dev:ui' to access kagent UI"
echo
log_info "For more information, see README.md"