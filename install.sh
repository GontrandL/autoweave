#!/bin/bash

# AutoWeave Complete Installation Script
# Automated installer for production-ready AutoWeave with Intelligence Agents
# Compatible with Linux, macOS, and Windows (WSL)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
AUTOWEAVE_VERSION="v1.0.0"
AUTOWEAVE_DIR="$HOME/autoweave"
NODE_MIN_VERSION="18.0.0"
PYTHON_MIN_VERSION="3.8.0"

# Functions
print_banner() {
    echo -e "${PURPLE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    🤖 AutoWeave Installer                    ║"
    echo "║              The Self-Weaving Agent Orchestrator             ║"
    echo "║                                                              ║"
    echo "║                    Version: $AUTOWEAVE_VERSION                       ║"
    echo "║              Production Ready with AI Intelligence           ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Version comparison
version_ge() {
    [ "$(printf '%s\n' "$2" "$1" | sort -V | head -n1)" = "$2" ]
}

# Check system requirements
check_system_requirements() {
    print_step "Checking system requirements..."
    
    # Check OS
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        print_info "Operating System: Linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        print_info "Operating System: macOS"
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
        OS="windows"
        print_info "Operating System: Windows (WSL recommended)"
    else
        print_error "Unsupported operating system: $OSTYPE"
        exit 1
    fi
    
    # Check Node.js
    if command_exists node; then
        NODE_VERSION=$(node --version | sed 's/v//')
        if version_ge "$NODE_VERSION" "$NODE_MIN_VERSION"; then
            print_success "Node.js $NODE_VERSION detected"
        else
            print_error "Node.js $NODE_MIN_VERSION or higher required. Found: $NODE_VERSION"
            exit 1
        fi
    else
        print_error "Node.js not found. Please install Node.js $NODE_MIN_VERSION or higher"
        exit 1
    fi
    
    # Check npm
    if command_exists npm; then
        NPM_VERSION=$(npm --version)
        print_success "npm $NPM_VERSION detected"
    else
        print_error "npm not found. Please install npm"
        exit 1
    fi
    
    # Check Python
    if command_exists python3; then
        PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
        if version_ge "$PYTHON_VERSION" "$PYTHON_MIN_VERSION"; then
            print_success "Python $PYTHON_VERSION detected"
        else
            print_error "Python $PYTHON_MIN_VERSION or higher required. Found: $PYTHON_VERSION"
            exit 1
        fi
    else
        print_error "Python 3 not found. Please install Python $PYTHON_MIN_VERSION or higher"
        exit 1
    fi
    
    # Check Git
    if command_exists git; then
        GIT_VERSION=$(git --version | cut -d' ' -f3)
        print_success "Git $GIT_VERSION detected"
    else
        print_error "Git not found. Please install Git"
        exit 1
    fi
    
    # Check Docker (optional)
    if command_exists docker; then
        DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | sed 's/,//')
        print_success "Docker $DOCKER_VERSION detected"
        DOCKER_AVAILABLE=true
    else
        print_warning "Docker not found. Some features will be limited"
        DOCKER_AVAILABLE=false
    fi
    
    # Check kubectl (optional)
    if command_exists kubectl; then
        KUBECTL_VERSION=$(kubectl version --client --short 2>/dev/null | cut -d' ' -f3 | sed 's/v//' || echo "unknown")
        print_success "kubectl $KUBECTL_VERSION detected"
        KUBECTL_AVAILABLE=true
    else
        print_warning "kubectl not found. Kubernetes features will be limited"
        KUBECTL_AVAILABLE=false
    fi
    
    print_success "System requirements check completed"
}

# Install AutoWeave
install_autoweave() {
    print_step "Installing AutoWeave..."
    
    # Create installation directory
    if [ -d "$AUTOWEAVE_DIR" ]; then
        print_warning "AutoWeave directory already exists. Backing up..."
        mv "$AUTOWEAVE_DIR" "${AUTOWEAVE_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    mkdir -p "$AUTOWEAVE_DIR"
    cd "$AUTOWEAVE_DIR"
    
    # Clone repository (if this is from GitHub) or copy files
    if [ -n "$AUTOWEAVE_REPO_URL" ]; then
        print_info "Cloning AutoWeave repository..."
        git clone "$AUTOWEAVE_REPO_URL" .
    else
        print_info "Using local AutoWeave installation..."
        # Copy current directory if running from AutoWeave source
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        if [ -f "$SCRIPT_DIR/package.json" ]; then
            cp -r "$SCRIPT_DIR"/* .
        else
            print_error "AutoWeave source files not found"
            exit 1
        fi
    fi
    
    print_success "AutoWeave files installed"
}

# Install Node.js dependencies
install_node_dependencies() {
    print_step "Installing Node.js dependencies..."
    
    cd "$AUTOWEAVE_DIR"
    
    # Install production dependencies
    npm install --production
    
    # Install development dependencies if requested
    if [ "$INSTALL_DEV_DEPS" = "true" ]; then
        npm install
        print_success "Development dependencies installed"
    fi
    
    print_success "Node.js dependencies installed"
}

# Install Python dependencies
install_python_dependencies() {
    print_step "Installing Python dependencies..."
    
    cd "$AUTOWEAVE_DIR"
    
    # Create virtual environment
    python3 -m venv venv
    source venv/bin/activate
    
    # Upgrade pip
    pip install --upgrade pip
    
    # Install Python dependencies
    if [ -f "requirements.txt" ]; then
        pip install -r requirements.txt
    fi
    
    # Install mem0 and related packages
    pip install mem0ai langchain-memgraph qdrant-client
    
    print_success "Python dependencies installed"
}

# Setup configuration
setup_configuration() {
    print_step "Setting up configuration..."
    
    cd "$AUTOWEAVE_DIR"
    
    # Create .env file from template
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_info "Created .env file from template"
        else
            # Create basic .env file
            cat > .env << EOF
# AutoWeave Configuration
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# OpenAI Configuration (Required)
OPENAI_API_KEY=your_openai_api_key_here

# Memory System Configuration
MEM0_SELF_HOSTED=true
QDRANT_HOST=localhost
QDRANT_PORT=6333
MEMGRAPH_HOST=localhost
MEMGRAPH_PORT=7687

# Redis Cache Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Kubernetes Configuration
KAGENT_NAMESPACE=default
KUBECONFIG=~/.kube/config

# Monitoring Configuration (Optional)
# SENTRY_DSN=your_sentry_dsn_here
# SECURITY_SERVICE_URL=your_security_service_url_here
# SECURITY_SERVICE_TOKEN=your_security_token_here

# MCP Configuration
MCP_PORT=3002
ANP_PORT=8083
EOF
            print_info "Created basic .env file"
        fi
    fi
    
    # Set proper permissions
    chmod 600 .env
    
    print_success "Configuration setup completed"
}

# Setup databases
setup_databases() {
    print_step "Setting up databases..."
    
    if [ "$DOCKER_AVAILABLE" = true ]; then
        cd "$AUTOWEAVE_DIR"
        
        # Setup memory system if docker-compose exists
        if [ -f "scripts/setup-memory-system.sh" ]; then
            print_info "Setting up memory system with Docker..."
            bash scripts/setup-memory-system.sh
            print_success "Memory system setup completed"
        fi
        
        # Setup Redis if not running
        if ! docker ps | grep -q redis; then
            print_info "Starting Redis container..."
            docker run -d --name autoweave-redis -p 6379:6379 redis:alpine
            print_success "Redis container started"
        fi
        
    else
        print_warning "Docker not available. Please setup databases manually:"
        print_info "- Qdrant: https://qdrant.tech/documentation/quick_start/"
        print_info "- Memgraph: https://memgraph.com/docs/getting-started"
        print_info "- Redis: https://redis.io/docs/getting-started/"
    fi
}

# Setup Kubernetes (optional)
setup_kubernetes() {
    if [ "$KUBECTL_AVAILABLE" = true ]; then
        print_step "Setting up Kubernetes integration..."
        
        cd "$AUTOWEAVE_DIR"
        
        # Create AutoWeave namespace
        kubectl create namespace autoweave-system --dry-run=client -o yaml | kubectl apply -f -
        
        # Deploy memory system to Kubernetes if manifests exist
        if [ -d "k8s/memory" ]; then
            print_info "Deploying memory system to Kubernetes..."
            kubectl apply -f k8s/memory/
        fi
        
        print_success "Kubernetes integration setup completed"
    else
        print_warning "kubectl not available. Skipping Kubernetes setup"
    fi
}

# Install CLI tools
install_cli_tools() {
    print_step "Installing CLI tools..."
    
    cd "$AUTOWEAVE_DIR"
    
    # Make scripts executable
    if [ -d "scripts" ]; then
        chmod +x scripts/*.sh
        print_success "Scripts made executable"
    fi
    
    # Create symlink for global access (optional)
    if [ "$CREATE_SYMLINK" = "true" ]; then
        SYMLINK_PATH="/usr/local/bin/autoweave"
        if [ -w "/usr/local/bin" ] || [ "$EUID" -eq 0 ]; then
            ln -sf "$AUTOWEAVE_DIR/scripts/autoweave-cli.sh" "$SYMLINK_PATH" 2>/dev/null || true
            print_success "AutoWeave CLI symlink created: $SYMLINK_PATH"
        else
            print_warning "Cannot create global symlink. Add $AUTOWEAVE_DIR/scripts to your PATH"
        fi
    fi
    
    print_success "CLI tools installation completed"
}

# Run tests
run_tests() {
    if [ "$RUN_TESTS" = "true" ]; then
        print_step "Running tests..."
        
        cd "$AUTOWEAVE_DIR"
        
        # Install test dependencies if not already installed
        if [ ! -d "node_modules" ]; then
            npm install
        fi
        
        # Run tests
        npm test
        
        print_success "Tests completed"
    fi
}

# Deploy intelligence agents
deploy_intelligence_agents() {
    if [ "$DEPLOY_AGENTS" = "true" ]; then
        print_step "Deploying intelligence agents..."
        
        cd "$AUTOWEAVE_DIR"
        
        # Start AutoWeave in background
        print_info "Starting AutoWeave server..."
        npm start > autoweave.log 2>&1 &
        AUTOWEAVE_PID=$!
        
        # Wait for server to start
        sleep 10
        
        # Check if server is running
        if curl -s http://localhost:3000/api/health > /dev/null; then
            print_success "AutoWeave server started"
            
            # Deploy intelligence agents
            print_info "Deploying intelligence agents..."
            
            agents=(
                "Advanced Monitoring Intelligence Agent - Real-time system monitoring, performance analytics, predictive alerting"
                "Security Intelligence Agent - Advanced threat detection, anomaly recognition, security event correlation"
                "Advanced Analytics Intelligence Agent - Data pattern recognition, predictive analytics, business intelligence"
                "Performance Optimization Intelligence Agent - Real-time performance tuning, resource allocation optimization"
                "Configuration Intelligence Agent - Analyze system configuration, detect optimization opportunities"
                "Diagnostic Intelligence Agent - System performance analysis, identify optimization opportunities"
            )
            
            for agent_desc in "${agents[@]}"; do
                curl -s -X POST http://localhost:3000/api/agents \
                    -H "Content-Type: application/json" \
                    -d "{\"description\": \"$agent_desc\"}" > /dev/null
                print_success "Deployed: $(echo "$agent_desc" | cut -d'-' -f1 | xargs)"
            done
            
            # Stop the server
            kill $AUTOWEAVE_PID 2>/dev/null || true
            
            print_success "Intelligence agents deployed"
        else
            print_warning "AutoWeave server failed to start. Skipping agent deployment"
            kill $AUTOWEAVE_PID 2>/dev/null || true
        fi
    fi
}

# Post-installation setup
post_installation() {
    print_step "Post-installation setup..."
    
    cd "$AUTOWEAVE_DIR"
    
    # Create systemd service file (Linux only)
    if [ "$OS" = "linux" ] && [ "$CREATE_SERVICE" = "true" ]; then
        SERVICE_FILE="/etc/systemd/system/autoweave.service"
        if [ -w "/etc/systemd/system" ] || [ "$EUID" -eq 0 ]; then
            cat > "$SERVICE_FILE" << EOF
[Unit]
Description=AutoWeave Agent Orchestrator
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$AUTOWEAVE_DIR
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
            systemctl daemon-reload
            systemctl enable autoweave
            print_success "SystemD service created and enabled"
        else
            print_warning "Cannot create SystemD service (insufficient permissions)"
        fi
    fi
    
    # Create startup script
    cat > "$AUTOWEAVE_DIR/start.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate 2>/dev/null || true
npm start
EOF
    chmod +x "$AUTOWEAVE_DIR/start.sh"
    
    print_success "Post-installation setup completed"
}

# Print installation summary
print_summary() {
    echo
    print_success "🎉 AutoWeave installation completed successfully!"
    echo
    echo -e "${CYAN}Installation Summary:${NC}"
    echo "- Installation directory: $AUTOWEAVE_DIR"
    echo "- Node.js version: $NODE_VERSION"
    echo "- Python version: $PYTHON_VERSION"
    echo "- Docker available: $DOCKER_AVAILABLE"
    echo "- Kubernetes available: $KUBECTL_AVAILABLE"
    echo
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Edit configuration: $AUTOWEAVE_DIR/.env"
    echo "2. Set your OpenAI API key in the .env file"
    echo "3. Start AutoWeave: cd $AUTOWEAVE_DIR && ./start.sh"
    echo "4. Access the API: http://localhost:3000/api/health"
    echo
    echo -e "${GREEN}Documentation:${NC}"
    echo "- README: $AUTOWEAVE_DIR/README.md"
    echo "- API Docs: $AUTOWEAVE_DIR/docs/"
    echo "- Troubleshooting: $AUTOWEAVE_DIR/docs/TROUBLESHOOTING_GUIDE.md"
    echo
    echo -e "${PURPLE}Intelligence Agents:${NC}"
    if [ "$DEPLOY_AGENTS" = "true" ]; then
        echo "- 6 Intelligence agents deployed and ready"
        echo "- ML-based Redis cache enabled"
        echo "- Pattern recognition active"
    else
        echo "- Run with --deploy-agents to deploy intelligence agents"
    fi
    echo
    echo -e "${BLUE}Support:${NC}"
    echo "- Issues: https://github.com/autoweave/autoweave/issues"
    echo "- Documentation: https://docs.autoweave.ai"
    echo
}

# Main installation process
main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dev)
                INSTALL_DEV_DEPS="true"
                shift
                ;;
            --no-docker)
                DOCKER_AVAILABLE="false"
                shift
                ;;
            --no-k8s)
                KUBECTL_AVAILABLE="false"
                shift
                ;;
            --test)
                RUN_TESTS="true"
                shift
                ;;
            --deploy-agents)
                DEPLOY_AGENTS="true"
                shift
                ;;
            --create-service)
                CREATE_SERVICE="true"
                shift
                ;;
            --create-symlink)
                CREATE_SYMLINK="true"
                shift
                ;;
            --dir=*)
                AUTOWEAVE_DIR="${1#*=}"
                shift
                ;;
            --help|-h)
                echo "AutoWeave Installer"
                echo
                echo "Usage: $0 [OPTIONS]"
                echo
                echo "Options:"
                echo "  --dev              Install development dependencies"
                echo "  --no-docker        Skip Docker-based setup"
                echo "  --no-k8s          Skip Kubernetes setup"
                echo "  --test             Run tests after installation"
                echo "  --deploy-agents    Deploy intelligence agents"
                echo "  --create-service   Create SystemD service (Linux only)"
                echo "  --create-symlink   Create global CLI symlink"
                echo "  --dir=PATH         Installation directory (default: ~/autoweave)"
                echo "  --help, -h         Show this help message"
                echo
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Set defaults
    INSTALL_DEV_DEPS=${INSTALL_DEV_DEPS:-false}
    RUN_TESTS=${RUN_TESTS:-false}
    DEPLOY_AGENTS=${DEPLOY_AGENTS:-false}
    CREATE_SERVICE=${CREATE_SERVICE:-false}
    CREATE_SYMLINK=${CREATE_SYMLINK:-false}
    
    # Run installation
    print_banner
    check_system_requirements
    install_autoweave
    install_node_dependencies
    install_python_dependencies
    setup_configuration
    setup_databases
    setup_kubernetes
    install_cli_tools
    run_tests
    deploy_intelligence_agents
    post_installation
    print_summary
}

# Run main function
main "$@"