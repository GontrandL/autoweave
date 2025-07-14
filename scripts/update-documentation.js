#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

/**
 * Documentation Update Script
 * Updates all documentation to reflect the new monorepo structure
 */

class DocumentationUpdater {
    constructor() {
        this.updates = 0;
        this.pathMappings = [
            { old: /\/src\/core\//g, new: '/packages/core/src/' },
            { old: /src\/core\//g, new: 'packages/core/src/' },
            { old: /\/src\/memory\//g, new: '/packages/memory/src/' },
            { old: /src\/memory\//g, new: 'packages/memory/src/' },
            { old: /\/src\/agents\//g, new: '/packages/agents/src/' },
            { old: /src\/agents\//g, new: 'packages/agents/src/' },
            { old: /\/src\/routes\//g, new: '/packages/backend/src/routes/' },
            { old: /src\/routes\//g, new: 'packages/backend/src/routes/' },
            { old: /\/src\/mcp\//g, new: '/packages/integrations/src/mcp/' },
            { old: /src\/mcp\//g, new: 'packages/integrations/src/mcp/' },
            { old: /\/src\/anp\//g, new: '/packages/integrations/src/anp/' },
            { old: /src\/anp\//g, new: 'packages/integrations/src/anp/' },
            { old: /\/src\/utils\//g, new: '/packages/shared/src/utils/' },
            { old: /src\/utils\//g, new: 'packages/shared/src/utils/' },
            { old: /\/src\/services\//g, new: '/packages/backend/src/services/' },
            { old: /src\/services\//g, new: 'packages/backend/src/services/' },
            { old: /\/src\/cli\//g, new: '/packages/cli/src/' },
            { old: /src\/cli\//g, new: 'packages/cli/src/' },
            { old: /\/autoweave-repos\//g, new: '/packages/' },
            { old: /autoweave-repos\//g, new: 'packages/' }
        ];
    }

    async update() {
        console.log('📝 Updating AutoWeave Documentation...\n');
        
        // Update main documentation files
        await this.updateMainDocs();
        
        // Create package READMEs
        await this.createPackageReadmes();
        
        // Update CLAUDE.md specifically
        await this.updateClaudeMd();
        
        // Summary
        console.log(`\n✅ Documentation update complete! Updated ${this.updates} files.`);
    }

    async updateMainDocs() {
        const mainDocs = ['README.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'PLANNING.md'];
        
        for (const doc of mainDocs) {
            try {
                await this.updateFile(doc);
            } catch (error) {
                console.log(`⚠️  Could not update ${doc}: ${error.message}`);
            }
        }
    }

    async updateFile(filePath) {
        try {
            let content = await fs.readFile(filePath, 'utf8');
            let updated = false;
            
            // Apply all path mappings
            for (const mapping of this.pathMappings) {
                if (mapping.old.test(content)) {
                    content = content.replace(mapping.old, mapping.new);
                    updated = true;
                }
            }
            
            if (updated) {
                await fs.writeFile(filePath, content);
                console.log(`✅ Updated ${filePath}`);
                this.updates++;
            }
        } catch (error) {
            throw error;
        }
    }

    async updateClaudeMd() {
        try {
            let content = await fs.readFile('CLAUDE.md', 'utf8');
            
            // Update architecture components section
            content = content.replace(
                /### Architecture Components[\s\S]*?(?=\n##|\n### Development Guidelines)/,
                `### Architecture Components

1. **Core Engine** (\`/packages/core/src/\`)
   - \`autoweave.js\`: Main orchestration logic
   - \`agent-weaver.js\`: Agent creation and management
   - \`config-intelligence.js\`: AI-powered configuration generation

2. **Memory System** (\`/packages/memory/src/\`)
   - \`hybrid-memory.js\`: Fusion of contextual and structural memory
   - \`mem0-client.js\`: Vector-based contextual memory
   - \`graph-client.js\`: Graph-based structural memory
   - \`redis-ml-cache.js\`: ML-powered caching layer

3. **Agent System** (\`/packages/agents/src/\`)
   - \`debugging-agent.js\`: Intelligent debugging assistant
   - \`self-awareness-agent.js\`: Self-monitoring and optimization
   - \`integration-agent/\`: External service integrations

4. **Backend Services** (\`/packages/backend/src/\`)
   - \`routes/\`: REST API endpoints
   - \`services/\`: Business logic and service layer
   - \`index.js\`: Express server setup

5. **Integrations** (\`/packages/integrations/src/\`)
   - \`mcp/\`: Model Context Protocol server
   - \`anp/\`: Agent Network Protocol (if implemented)

6. **CLI Tools** (\`/packages/cli/src/\`)
   - \`create-agent.js\`: Agent creation command

7. **Shared Utilities** (\`/packages/shared/src/\`)
   - \`utils/\`: Common utilities and helpers

8. **Deployment** (\`/packages/deployment/src/\`)
   - \`helm/\`: Helm charts for Kubernetes
   - \`k8s/\`: Kubernetes manifests
   - \`Dockerfile\`: Container configuration`
            );
            
            // Update file organization section
            content = content.replace(
                /### File Organization[\s\S]*?(?=\n##|\n### Testing Strategy)/,
                `### File Organization
- Core logic in \`/packages/core/src/\`
- API routes in \`/packages/backend/src/routes/\`
- Utilities in \`/packages/shared/src/utils/\`
- Agent-specific code in \`/packages/agents/src/\`
- Memory components in \`/packages/memory/src/\`
- Protocol implementations in \`/packages/integrations/src/\``
            );
            
            // Update agent modules section
            content = content.replace(
                /### Working with Agent Modules[\s\S]*?(?=\n##|\n### Integration Points)/,
                `### Working with Agent Modules

The project is organized as a monorepo with the following packages:

1. **@autoweave/core**: Main orchestration engine
2. **@autoweave/agents**: Agent implementations (debugging, integration, self-awareness)
3. **@autoweave/backend**: API server and service management
4. **@autoweave/memory**: Hybrid memory system
5. **@autoweave/integrations**: Protocol bridges and external integrations
6. **@autoweave/cli**: Command-line interface
7. **@autoweave/deployment**: Deployment scripts and K8s configs
8. **@autoweave/shared**: Shared utilities and types

Each package has its own \`package.json\` and can be developed independently while sharing common dependencies through the workspace.`
            );
            
            await fs.writeFile('CLAUDE.md', content);
            console.log('✅ Updated CLAUDE.md with new monorepo structure');
            this.updates++;
            
        } catch (error) {
            console.error('❌ Error updating CLAUDE.md:', error.message);
        }
    }

    async createPackageReadmes() {
        const packages = [
            {
                name: 'core',
                title: 'Core Orchestration Engine',
                description: 'The heart of AutoWeave - handles agent creation, orchestration, and configuration intelligence.'
            },
            {
                name: 'memory',
                title: 'Hybrid Memory System',
                description: 'Combines vector-based contextual memory (mem0) with graph-based structural memory (Memgraph) for intelligent agent memory.'
            },
            {
                name: 'agents',
                title: 'Agent Implementations',
                description: 'Specialized agents including debugging, integration, and self-awareness capabilities.'
            },
            {
                name: 'backend',
                title: 'Backend API Services',
                description: 'REST API endpoints and service layer for AutoWeave platform.'
            },
            {
                name: 'integrations',
                title: 'External Integrations',
                description: 'Protocol bridges including MCP (Model Context Protocol) and ANP (Agent Network Protocol).'
            },
            {
                name: 'cli',
                title: 'Command Line Interface',
                description: 'CLI tools for creating and managing AutoWeave agents.'
            },
            {
                name: 'deployment',
                title: 'Deployment Configuration',
                description: 'Kubernetes manifests, Helm charts, and Docker configurations.'
            },
            {
                name: 'shared',
                title: 'Shared Utilities',
                description: 'Common utilities, types, and helpers used across all packages.'
            }
        ];

        for (const pkg of packages) {
            const readmePath = path.join('packages', pkg.name, 'README.md');
            const content = `# @autoweave/${pkg.name}

## ${pkg.title}

${pkg.description}

## Installation

This package is part of the AutoWeave monorepo. Install the entire workspace:

\`\`\`bash
npm install
\`\`\`

## Usage

\`\`\`javascript
const { ${pkg.name === 'core' ? 'AutoWeave' : pkg.name} } = require('@autoweave/${pkg.name}');
\`\`\`

## Development

\`\`\`bash
# Run tests
npm test

# Run in development mode
npm run dev

# Build package
npm run build
\`\`\`

## Structure

\`\`\`
packages/${pkg.name}/
├── src/           # Source code
├── tests/         # Test files
├── package.json   # Package configuration
└── README.md      # This file
\`\`\`

## Dependencies

See \`package.json\` for the full list of dependencies.

## License

Part of the AutoWeave project. See the root LICENSE file for details.
`;

            await fs.writeFile(readmePath, content);
            console.log(`✅ Created ${pkg.name} package README.md`);
            this.updates++;
        }
    }
}

// Run the updater
const updater = new DocumentationUpdater();
updater.update().catch(console.error);