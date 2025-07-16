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
   ```bash
   ./scripts/start-typescript-migration.sh
   ```

2. **Convert files incrementally**
   ```bash
   # For each .js file
   mv src/file.js src/file.ts
   # Fix type errors
   # Add explicit types
   ```

3. **Add type definitions**
   ```typescript
   // types/index.d.ts
   export interface AgentConfig {
     name: string;
     description: string;
     capabilities: string[];
   }
   ```

4. **Test the build**
   ```bash
   pnpm build
   pnpm type-check
   ```

5. **Update tests**
   ```bash
   # Rename test files
   mv file.test.js file.test.ts
   # Add type assertions
   ```

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
