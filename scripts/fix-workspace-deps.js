#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

async function fixWorkspaceDeps() {
    const packages = ['core', 'memory', 'agents', 'backend', 'integrations', 'cli', 'deployment', 'shared'];
    
    for (const pkg of packages) {
        const packageJsonPath = path.join('packages', pkg, 'package.json');
        
        try {
            const content = await fs.readFile(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(content);
            
            // Replace workspace:* with file: references
            if (packageJson.dependencies) {
                for (const [dep, version] of Object.entries(packageJson.dependencies)) {
                    if (version === 'workspace:*' && dep.startsWith('@autoweave/')) {
                        const depName = dep.replace('@autoweave/', '');
                        packageJson.dependencies[dep] = `file:../${depName}`;
                    }
                }
            }
            
            await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
            console.log(`✅ Fixed ${pkg}/package.json`);
            
        } catch (error) {
            console.error(`❌ Error fixing ${pkg}:`, error.message);
        }
    }
}

fixWorkspaceDeps().catch(console.error);