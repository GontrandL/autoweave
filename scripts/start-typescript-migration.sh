#!/bin/bash

# Script to start the TypeScript migration for AutoWeave packages

set -e

echo "🚀 AutoWeave TypeScript Migration Script"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if we're in the root directory
if [ ! -f "pnpm-workspace.yaml" ]; then
    echo "❌ Error: Must be run from AutoWeave root directory"
    exit 1
fi

# Install necessary dependencies
echo -e "${YELLOW}📦 Installing TypeScript build tools...${NC}"
pnpm add -D -w tsup @types/node typescript

# Function to migrate a package
migrate_package() {
    local package_name=$1
    local package_dir="packages/$package_name"
    
    echo -e "\n${BLUE}🔄 Migrating @autoweave/$package_name...${NC}"
    
    # Create TypeScript config
    cat > "$package_dir/tsconfig.json" << EOF
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts", "**/*.test.ts"]
}
EOF
    
    # Create tsup config
    cat > "$package_dir/tsup.config.ts" << EOF
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  external: [/^@autoweave\//],
});
EOF
    
    # Update package.json scripts and exports
    node -e "
    const fs = require('fs');
    const path = require('path');
    const pkgPath = path.join('$package_dir', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    
    // Update scripts
    pkg.scripts = pkg.scripts || {};
    pkg.scripts.build = 'tsup';
    pkg.scripts.dev = 'tsup --watch';
    pkg.scripts['type-check'] = 'tsc --noEmit';
    
    // Update exports
    pkg.exports = {
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.mjs',
        require: './dist/index.js'
      }
    };
    
    // Update main and types
    pkg.main = './dist/index.js';
    pkg.module = './dist/index.mjs';
    pkg.types = './dist/index.d.ts';
    
    // Add files
    pkg.files = ['dist', 'src'];
    
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\\n');
    console.log('✅ Updated package.json for $package_name');
    "
    
    # Create a basic index.ts if index.js exists
    if [ -f "$package_dir/src/index.js" ]; then
        echo -e "${YELLOW}  Converting index.js to index.ts...${NC}"
        mv "$package_dir/src/index.js" "$package_dir/src/index.ts" 2>/dev/null || true
    fi
    
    echo -e "${GREEN}✅ Migration setup complete for $package_name${NC}"
}

# Function to create migration checklist
create_migration_checklist() {
    cat > "TYPESCRIPT_MIGRATION_CHECKLIST.md" << EOF
# TypeScript Migration Checklist

## 🎯 Migration Status

### Core Packages
- [ ] @autoweave/core
  - [ ] Convert all .js files to .ts
  - [ ] Add proper type definitions
  - [ ] Fix type errors
  - [ ] Update imports/exports
  - [ ] Write type tests

- [ ] @autoweave/memory
  - [ ] Type memory interfaces
  - [ ] Add generics for storage
  - [ ] Type Redis/Memgraph clients
  - [ ] Document type usage

- [ ] @autoweave/agents
  - [ ] Define agent base types
  - [ ] Type configuration objects
  - [ ] Add lifecycle types
  - [ ] Type event emitters

### Supporting Packages
- [ ] @autoweave/shared
- [ ] @autoweave/cli
- [ ] @autoweave/integrations
- [ ] @autoweave/backend
- [ ] @autoweave/deployment

## 📝 Migration Steps per Package

1. **Run migration script**
   \`\`\`bash
   ./scripts/start-typescript-migration.sh
   \`\`\`

2. **Convert files incrementally**
   \`\`\`bash
   # For each .js file
   mv src/file.js src/file.ts
   # Fix type errors
   # Add explicit types
   \`\`\`

3. **Add type definitions**
   \`\`\`typescript
   // types/index.d.ts
   export interface AgentConfig {
     name: string;
     description: string;
     capabilities: string[];
   }
   \`\`\`

4. **Test the build**
   \`\`\`bash
   pnpm build
   pnpm type-check
   \`\`\`

5. **Update tests**
   \`\`\`bash
   # Rename test files
   mv file.test.js file.test.ts
   # Add type assertions
   \`\`\`

## 🔍 Common Issues & Solutions

### Issue: Cannot find module '@autoweave/core'
**Solution**: Add to tsconfig paths or use workspace protocol

### Issue: Type 'any' is not assignable
**Solution**: Define proper interfaces instead of using any

### Issue: Build fails with ESM/CJS conflicts
**Solution**: Use tsup dual format output

## ✅ Definition of Done

- [ ] All .js files converted to .ts
- [ ] No TypeScript errors (strict mode)
- [ ] Build produces both ESM and CJS
- [ ] Type definitions exported
- [ ] Tests passing with types
- [ ] Documentation updated
EOF

    echo -e "${GREEN}✅ Created TYPESCRIPT_MIGRATION_CHECKLIST.md${NC}"
}

# Main execution
echo -e "${BLUE}Starting TypeScript migration setup...${NC}"

# Create migration branch
echo -e "\n${YELLOW}Creating migration branch...${NC}"
git checkout -b feat/typescript-migration 2>/dev/null || git checkout feat/typescript-migration

# Migrate core packages first
for package in core memory agents; do
    migrate_package "$package"
done

# Create the checklist
create_migration_checklist

# Update root tsconfig if needed
echo -e "\n${YELLOW}📝 Updating root TypeScript config...${NC}"
cat > "tsconfig.json" << EOF
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "allowJs": true,
    "checkJs": false,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@autoweave/*": ["packages/*/src"]
    }
  },
  "exclude": [
    "node_modules",
    "dist",
    "build",
    "coverage",
    "**/*.spec.ts",
    "**/*.test.ts"
  ]
}
EOF

# Summary
echo -e "\n${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ TypeScript Migration Setup Complete!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo ""
echo "📋 Next steps:"
echo "1. Review TYPESCRIPT_MIGRATION_CHECKLIST.md"
echo "2. Start converting .js files to .ts in each package"
echo "3. Run 'pnpm build' to test the build process"
echo "4. Fix type errors incrementally"
echo "5. Update tests to TypeScript"
echo ""
echo "💡 Tip: Start with @autoweave/shared for type definitions"
echo "        that other packages can import."