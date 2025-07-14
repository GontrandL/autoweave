#!/bin/bash

# AutoWeave Quick Deploy Script for Ubuntu
# This script automates the deployment of AutoWeave on Ubuntu

set -e

echo "🚀 AutoWeave Quick Deploy for Ubuntu"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Function to check command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check version
check_version() {
    local cmd=$1
    local min_version=$2
    local current_version=$($cmd --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
    
    if [ "$(printf '%s\n' "$min_version" "$current_version" | sort -V | head -n1)" = "$min_version" ]; then
        echo -e "${GREEN}✓ $cmd version $current_version (>= $min_version)${NC}"
        return 0
    else
        echo -e "${RED}✗ $cmd version $current_version (need >= $min_version)${NC}"
        return 1
    fi
}

echo -e "${YELLOW}📋 Phase 1: Checking Prerequisites${NC}"
echo ""

# Check Ubuntu version
echo "Ubuntu version:"
lsb_release -d

# Check prerequisites
PREREQS_OK=true

# Node.js
if command_exists node; then
    check_version node 18.0 || PREREQS_OK=false
else
    echo -e "${RED}✗ Node.js not installed${NC}"
    PREREQS_OK=false
fi

# Python
if command_exists python3; then
    check_version python3 3.8 || PREREQS_OK=false
else
    echo -e "${RED}✗ Python3 not installed${NC}"
    PREREQS_OK=false
fi

# Docker
if command_exists docker; then
    echo -e "${GREEN}✓ Docker installed${NC}"
else
    echo -e "${RED}✗ Docker not installed${NC}"
    PREREQS_OK=false
fi

# Git
if command_exists git; then
    echo -e "${GREEN}✓ Git installed${NC}"
else
    echo -e "${RED}✗ Git not installed${NC}"
    PREREQS_OK=false
fi

if [ "$PREREQS_OK" = false ]; then
    echo ""
    echo -e "${YELLOW}📦 Installing missing prerequisites...${NC}"
    
    # Update system
    sudo apt update
    
    # Install basic tools
    sudo apt install -y curl git build-essential
    
    # Install Node.js 18 if missing
    if ! command_exists node || ! check_version node 18.0; then
        echo "Installing Node.js 18..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt install -y nodejs
    fi
    
    # Install Python if missing
    if ! command_exists python3; then
        echo "Installing Python..."
        sudo apt install -y python3 python3-pip python3-venv
    fi
    
    # Install Docker if missing
    if ! command_exists docker; then
        echo "Installing Docker..."
        sudo apt install -y docker.io docker-compose
        sudo usermod -aG docker $USER
        echo -e "${YELLOW}⚠️  You need to logout and login again for docker permissions${NC}"
    fi
fi

echo ""
echo -e "${YELLOW}📋 Phase 2: Cloning AutoWeave Deployment${NC}"

# Create directory
mkdir -p ~/autoweave-deployment
cd ~/autoweave-deployment

# Clone deployment repo
if [ ! -d "deployment" ]; then
    git clone https://github.com/GontrandL/autoweave-deployment.git deployment
else
    echo "Deployment repo already cloned"
fi

cd deployment

echo ""
echo -e "${YELLOW}📋 Phase 3: Running AutoWeave Installer${NC}"

# Make scripts executable
chmod +x install.sh start-autoweave.sh scripts/*.sh

# Check for .env
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${YELLOW}⚠️  Created .env file - Please edit it and add your OPENAI_API_KEY${NC}"
        echo -e "${YELLOW}Run: nano .env${NC}"
    fi
fi

echo ""
echo -e "${GREEN}✅ Quick deploy preparation complete!${NC}"
echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "1. Edit .env file: cd ~/autoweave-deployment/deployment && nano .env"
echo "2. Add your OPENAI_API_KEY"
echo "3. Run: ./install.sh"
echo "4. Deploy infrastructure: ./scripts/setup-memory-system.sh"
echo "5. Start AutoWeave: ./start-autoweave.sh"
echo ""
echo -e "${YELLOW}💡 Pro tip: Use this one-liner after setting your API key:${NC}"
echo "cd ~/autoweave-deployment/deployment && ./install.sh && ./start-autoweave.sh"