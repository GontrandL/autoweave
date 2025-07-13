#!/bin/bash
set -euo pipefail

echo "🚀 AutoWeave Monorepo Migration Script"
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the AutoWeave root directory"
    exit 1
fi

# Create directory structure
print_status "Creating monorepo directory structure..."
mkdir -p packages/{core,memory,agents,backend,ui,cli,integrations,deployment}
mkdir -p packages/shared/{types,utils,config}
mkdir -p apps/{web,docs}
mkdir -p tools/{scripts,migrations}

# Create package.json for each package
print_status "Creating package.json files for workspaces..."

# Core package
cat > packages/core/package.json << 'EOF'
{
  "name": "@autoweave/core",
  "version": "1.0.0",
  "description": "Core orchestration engine for AutoWeave",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc -w",
    "test": "jest",
    "lint": "eslint src --ext .ts,.js"
  },
  "dependencies": {
    "openai": "^4.20.0",
    "ajv": "^8.12.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.30",
    "typescript": "^5.4.3"
  }
}
EOF

# Memory package
cat > packages/memory/package.json << 'EOF'
{
  "name": "@autoweave/memory",
  "version": "1.0.0",
  "description": "Hybrid memory system for AutoWeave",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc -w",
    "test": "jest",
    "lint": "eslint src --ext .ts,.js",
    "start:mem0": "python scripts/mem0-bridge.py"
  },
  "dependencies": {
    "ioredis": "^5.3.2",
    "@qdrant/js-client-rest": "^1.7.0"
  }
}
EOF

# Create TypeScript configs for packages
print_status "Creating TypeScript configurations..."

for pkg in core memory agents backend ui cli integrations; do
    cat > packages/$pkg/tsconfig.json << EOF
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
EOF
done

# Move existing source files
print_status "Moving existing source files to packages..."

# Move core files
if [ -d "src/core" ]; then
    mv src/core/* packages/core/src/ 2>/dev/null || true
fi

# Move memory files
if [ -d "src/memory" ]; then
    mv src/memory/* packages/memory/src/ 2>/dev/null || true
fi

# Move agent files
if [ -d "src/agents" ]; then
    mv src/agents/* packages/agents/src/ 2>/dev/null || true
fi

# Create .gitignore
print_status "Creating .gitignore..."
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
build/
.next/
out/
coverage/
.turbo/
*.tsbuildinfo

# Environment
.env
.env.*
!.env.example

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Testing
coverage/
.nyc_output/

# Misc
.cache/
.temp/
.tmp/
EOF

# Install dependencies
print_status "Installing dependencies..."
if command -v pnpm &> /dev/null; then
    pnpm install
else
    print_warning "pnpm not found. Installing pnpm..."
    npm install -g pnpm@8.15.5
    pnpm install
fi

# Initialize git hooks
print_status "Setting up git hooks..."
pnpm prepare

# Create initial changeset
print_status "Creating initial changeset..."
mkdir -p .changeset
cat > .changeset/initial-monorepo.md << 'EOF'
---
"@autoweave/core": major
"@autoweave/memory": major
"@autoweave/agents": major
"@autoweave/backend": major
"@autoweave/ui": major
"@autoweave/cli": major
"@autoweave/integrations": major
---

Initial monorepo setup

- Migrated to Turborepo monorepo structure
- Added TypeScript support across all packages
- Implemented unified CI/CD pipeline
- Added security scanning (CodeQL, Dependabot)
- Configured quality tools (ESLint, Prettier, Commitlint)
- Set up automated testing and coverage reporting
- Created Helm chart for unified deployment
EOF

print_status "Migration complete! 🎉"
echo ""
echo "Next steps:"
echo "1. Review the new structure in packages/"
echo "2. Move remaining code from src/ to appropriate packages"
echo "3. Update import paths in your code"
echo "4. Run 'pnpm build' to verify everything builds"
echo "5. Run 'pnpm test' to ensure tests pass"
echo "6. Commit changes with: git add . && git commit -m 'chore: migrate to monorepo structure'"
echo ""
print_warning "Note: You may need to manually move some files and update imports"