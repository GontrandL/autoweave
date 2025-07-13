#!/usr/bin/env node

const { exec } = require('child_process');
const path = require('path');

const packages = ['core', 'memory', 'agents', 'backend', 'integrations', 'cli', 'shared'];

async function runTests() {
    console.log('🧪 Running tests for all packages...\n');
    
    const results = [];
    
    for (const pkg of packages) {
        console.log(`\n📦 Testing @autoweave/${pkg}...`);
        
        await new Promise((resolve) => {
            exec(`cd packages/${pkg} && npm test -- --passWithNoTests`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`❌ ${pkg}: Failed`);
                    console.error(stderr);
                    results.push({ package: pkg, status: 'failed', error: error.message });
                } else {
                    console.log(`✅ ${pkg}: Passed`);
                    results.push({ package: pkg, status: 'passed' });
                }
                resolve();
            });
        });
    }
    
    console.log('\n\n📊 Test Summary:');
    console.log('================');
    
    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    
    if (failed > 0) {
        console.log('\nFailed packages:');
        results.filter(r => r.status === 'failed').forEach(r => {
            console.log(`  - ${r.package}: ${r.error}`);
        });
    }
    
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);