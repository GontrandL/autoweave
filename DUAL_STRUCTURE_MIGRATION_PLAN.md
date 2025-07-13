# AutoWeave Dual Structure Migration Plan

## Executive Summary

Based on the comprehensive code audit, AutoWeave has a **critical dual structure problem** with code existing in both `/src` (monolithic) and `/autoweave-repos` (modular). This plan recommends **Option B: Create a new unified structure** that takes the best from both implementations.

## Current State Analysis

### Audit Findings
- **33 duplicate file groups** - Exact copies in both locations
- **13 diverged files** - Same files with different implementations
- **178 files** in `/autoweave-repos` (modular structure)
- **44 files** in `/src` (monolithic structure)
- **11 modules** already defined in the modular structure

### Diverged Files Analysis
Based on the comparison script results, the `/autoweave-repos` versions generally have:
- Better modular organization
- More consistent error handling
- Clearer separation of concerns
- More recent architectural decisions

## Recommended Strategy: Option B - Unified Structure

### Why Option B?
1. **Clean slate approach** - Avoids carrying forward technical debt
2. **Best of both worlds** - Can cherry-pick improvements from both versions
3. **Future-proof** - Aligns with modern monorepo practices
4. **Clear migration path** - Easier to track progress

### Target Structure
```
/packages/
├── core/                    # Core orchestration engine
├── memory/                  # Hybrid memory system
├── agents/                  # Agent implementations
├── backend/                 # API and services
├── ui/                      # User interfaces
├── cli/                     # Command-line tools
├── integrations/           # External integrations
├── deployment/             # K8s and infrastructure
├── shared/                 # Shared utilities
└── config/                 # Shared configurations
```

## Migration Plan

### Phase 1: Preparation (Week 1)

#### 1.1 Setup New Structure
```bash
# Create packages directory
mkdir -p packages/{core,memory,agents,backend,ui,cli,integrations,deployment,shared,config}

# Initialize workspaces
cp turbo.json packages/
cp package.json packages/ # Update for workspaces
```

#### 1.2 Create Migration Scripts
Create automated scripts to:
- Compare file versions
- Merge diverged files
- Update import paths
- Validate migrations

#### 1.3 Setup Quality Gates
- ESLint/Prettier configurations
- TypeScript configurations
- Test frameworks
- CI/CD pipelines

### Phase 2: Core Module Migration (Week 2)

#### 2.1 Core Package
**Files to migrate:**
- `autoweave.js` - Use `/autoweave-repos` version (better structure)
- `agent-weaver.js` - Merge features from both versions
- `config-intelligence.js` - Use `/src` version (more recent)

**Actions:**
1. Copy base files from chosen source
2. Merge unique features from other version
3. Update imports to use workspace references
4. Add TypeScript definitions
5. Write comprehensive tests

#### 2.2 Memory Package
**Files to migrate:**
- `hybrid-memory.js` - Merge both versions (repo structure, src features)
- `mem0-client.js` - Use `/autoweave-repos` version
- `memgraph-client.js` - Use identical version
- `redis-ml-cache.js` - Use identical version

### Phase 3: Service Migration (Week 3)

#### 3.1 Backend Package
Consolidate all routes and services:
- Use `/autoweave-repos` modular structure
- Port any unique endpoints from `/src`
- Implement proper middleware architecture
- Add OpenAPI documentation

#### 3.2 Agents Package
- Migrate all agent implementations
- Standardize agent interfaces
- Create agent registry system
- Implement agent lifecycle management

### Phase 4: Integration & Deployment (Week 4)

#### 4.1 Integrations Package
- MCP server implementations
- ANP protocol handlers
- Third-party integrations
- Webhook handlers

#### 4.2 Deployment Package
- Kubernetes manifests
- Helm charts
- Docker configurations
- CI/CD pipelines

## File-by-File Migration Guide

### Critical Diverged Files

#### 1. autoweave.js
```javascript
// Recommendation: Start with /autoweave-repos version
// Add these features from /src version:
// - Enhanced error handling patterns
// - Additional lifecycle hooks
// - Performance optimizations
```

#### 2. agent-weaver.js
```javascript
// Recommendation: Merge both versions
// From /autoweave-repos: Better structure and modularity
// From /src: Recent feature additions and bug fixes
```

#### 3. hybrid-memory.js
```javascript
// Recommendation: Use /autoweave-repos as base
// Port these from /src:
// - Advanced caching strategies
// - Performance optimizations
// - Additional memory fusion algorithms
```

### Duplicate Files
For the 33 duplicate file groups, use this priority order:
1. Check last modified date
2. Prefer `/autoweave-repos` for better structure
3. Validate no features are lost

## Migration Scripts

### 1. File Comparison Script
```javascript
// scripts/migration-helper.js
const fs = require('fs').promises;
const path = require('path');
const { diffLines } = require('diff');

async function migrateFile(srcPath, repoPath, targetPath) {
    // Read both versions
    const srcContent = await fs.readFile(srcPath, 'utf8');
    const repoContent = await fs.readFile(repoPath, 'utf8');
    
    // Analyze differences
    const diff = diffLines(srcContent, repoContent);
    
    // Merge logic based on rules
    const merged = mergeFiles(srcContent, repoContent, diff);
    
    // Update imports
    const updated = updateImports(merged, targetPath);
    
    // Write to new location
    await fs.writeFile(targetPath, updated);
}
```

### 2. Import Path Updater
```javascript
// scripts/update-imports.js
function updateImports(content, newPath) {
    // Update relative imports
    content = content.replace(
        /from ['"]\.\.\/\.\.\/([^'"]+)['"]/g,
        (match, importPath) => {
            return `from '@autoweave/${resolvePackage(importPath)}'`;
        }
    );
    
    return content;
}
```

## Validation Checklist

### Pre-Migration
- [ ] All tests passing in current structure
- [ ] Full backup created
- [ ] Team alignment on approach
- [ ] Migration scripts tested

### During Migration
- [ ] Each module builds independently
- [ ] Import paths updated correctly
- [ ] Tests ported and passing
- [ ] No functionality lost

### Post-Migration
- [ ] All modules integrated
- [ ] E2E tests passing
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Old structure archived

## Risk Mitigation

### Risk 1: Feature Loss
**Mitigation**: Comprehensive testing suite, feature parity checklist

### Risk 2: Breaking Changes
**Mitigation**: Gradual migration, maintain compatibility layer

### Risk 3: Performance Regression
**Mitigation**: Benchmark before/after, performance tests

## Success Metrics

1. **Code Quality**
   - 0% duplicate code
   - 100% TypeScript coverage
   - 80%+ test coverage

2. **Performance**
   - Build time < 2 minutes
   - Agent creation < 30s
   - Memory usage < 1GB

3. **Developer Experience**
   - Clear module boundaries
   - Fast hot reload
   - Intuitive structure

## Timeline

### Week 1: Preparation & Setup
- Create migration scripts
- Setup new structure
- Configure tooling

### Week 2: Core Modules
- Migrate core package
- Migrate memory package
- Validate functionality

### Week 3: Services & Agents
- Migrate backend services
- Migrate agent system
- Integration testing

### Week 4: Final Integration
- Complete remaining packages
- Full system testing
- Performance optimization
- Documentation update

## Next Steps

1. **Immediate Action**: Create migration scripts
2. **Team Review**: Align on approach
3. **Start Migration**: Begin with core package
4. **Daily Validation**: Test each migration
5. **Weekly Review**: Assess progress

## Conclusion

The dual structure issue is AutoWeave's most critical technical debt. This migration plan provides a clear path to a unified, maintainable codebase that preserves all functionality while setting up for future growth.

**Recommended Start Date**: Immediately  
**Estimated Completion**: 4 weeks  
**Expected Outcome**: Single source of truth, improved maintainability, ready for production scale