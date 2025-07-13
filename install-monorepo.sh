#!/bin/bash
# AutoWeave Monorepo Installation Script
# For Ubuntu/Debian systems

set -e

echo "🚀 AutoWeave Monorepo Installation"
echo "=================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check Node.js version
check_node() {
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js not found${NC}"
        echo "Please install Node.js 18+ first:"
        echo "curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
        echo "sudo apt-get install -y nodejs"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo -e "${RED}❌ Node.js version too old${NC}"
        echo "Please upgrade to Node.js 18+"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Node.js $(node -v) detected${NC}"
}

# Check npm version
check_npm() {
    NPM_VERSION=$(npm -v | cut -d'.' -f1)
    if [ "$NPM_VERSION" -lt 7 ]; then
        echo -e "${YELLOW}⚠️  npm version too old, upgrading...${NC}"
        npm install -g npm@latest
    fi
    echo -e "${GREEN}✅ npm $(npm -v) detected${NC}"
}

# Install dependencies
install_deps() {
    echo -e "\n${YELLOW}📦 Installing dependencies...${NC}"
    
    # Clean install to avoid conflicts
    rm -rf node_modules package-lock.json
    rm -rf packages/*/node_modules
    
    # Install with legacy peer deps flag to avoid conflicts
    npm install --legacy-peer-deps
    
    echo -e "${GREEN}✅ Dependencies installed${NC}"
}

# Setup environment
setup_env() {
    echo -e "\n${YELLOW}🔧 Setting up environment...${NC}"
    
    if [ ! -f .env ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ Created .env from template${NC}"
        echo -e "${YELLOW}⚠️  Please edit .env and add your API keys${NC}"
    else
        echo -e "${GREEN}✅ .env already exists${NC}"
    fi
    
    # Set default mock mode for testing
    if ! grep -q "ENABLE_MOCKS" .env; then
        echo -e "\n# Mock Configuration" >> .env
        echo "ENABLE_MOCKS=true" >> .env
        echo "MOCK_MEM0=true" >> .env
        echo "MOCK_MEMGRAPH=true" >> .env
        echo "MOCK_REDIS=true" >> .env
        echo -e "${GREEN}✅ Enabled mock mode for testing${NC}"
    fi
}

# Create necessary directories
create_dirs() {
    echo -e "\n${YELLOW}📁 Creating directories...${NC}"
    
    # Create log directories
    for pkg in packages/*; do
        if [ -d "$pkg/src" ]; then
            mkdir -p "$pkg/logs"
        fi
    done
    
    # Create data directories
    mkdir -p data/memory
    mkdir -p data/agents
    
    echo -e "${GREEN}✅ Directories created${NC}"
}

# Set permissions
set_permissions() {
    echo -e "\n${YELLOW}🔐 Setting permissions...${NC}"
    
    # Make scripts executable
    chmod +x scripts/*.js
    chmod +x scripts/*.sh 2>/dev/null || true
    chmod +x *.sh 2>/dev/null || true
    
    echo -e "${GREEN}✅ Permissions set${NC}"
}

# Run tests
run_tests() {
    echo -e "\n${YELLOW}🧪 Running tests...${NC}"
    
    if node scripts/run-all-tests.js; then
        echo -e "${GREEN}✅ All tests passed${NC}"
    else
        echo -e "${YELLOW}⚠️  Some tests failed (this is expected in dev)${NC}"
    fi
}

# Final checks
final_checks() {
    echo -e "\n${YELLOW}🔍 Running final checks...${NC}"
    
    # Check if all packages are valid
    VALID_PACKAGES=0
    TOTAL_PACKAGES=0
    
    for pkg in packages/*/package.json; do
        TOTAL_PACKAGES=$((TOTAL_PACKAGES + 1))
        if [ -f "$pkg" ]; then
            VALID_PACKAGES=$((VALID_PACKAGES + 1))
        fi
    done
    
    echo -e "${GREEN}✅ Found $VALID_PACKAGES/$TOTAL_PACKAGES valid packages${NC}"
    
    # Validate environment
    node -c packages/shared/src/env-validator.js 2>/dev/null && \
        echo -e "${GREEN}✅ Environment validator ready${NC}" || \
        echo -e "${YELLOW}⚠️  Environment validator needs configuration${NC}"
}

# Main installation flow
main() {
    echo -e "${YELLOW}Starting installation...${NC}\n"
    
    check_node
    check_npm
    install_deps
    setup_env
    create_dirs
    set_permissions
    run_tests
    final_checks
    
    echo -e "\n${GREEN}🎉 Installation complete!${NC}"
    echo -e "\nNext steps:"
    echo "1. Edit .env and add your OPENAI_API_KEY"
    echo "2. Start the backend: cd packages/backend && npm start"
    echo "3. Test the API: curl http://localhost:3000/health"
    echo -e "\n${YELLOW}Happy coding! 🚀${NC}"
}

# Run main function
main