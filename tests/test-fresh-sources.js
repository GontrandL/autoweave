const fetch = require('node-fetch');
const assert = require('assert');

const BASE_URL = 'http://localhost:3000';
const MCP_URL = 'http://localhost:3002';

/**
 * Comprehensive test suite for AutoWeave Fresh Sources and Configuration Intelligence
 */

async function runTests() {
    console.log('🧪 Starting AutoWeave Fresh Sources Test Suite...\n');
    
    let passed = 0;
    let failed = 0;

    // Test 1: MCP Tools Discovery
    try {
        console.log('📋 Test 1: MCP Tools Discovery');
        const res = await fetch(`${MCP_URL}/mcp/v1/tools`);
        const data = await res.json();
        assert(data.tools.length === 5, 'Should have 5 MCP tools');
        assert(data.tools.find(t => t.name === 'create-config'), 'Should have create-config tool');
        assert(data.tools.find(t => t.name === 'find-fresh-sources'), 'Should have find-fresh-sources tool');
        console.log('✅ MCP tools discovery passed\n');
        passed++;
    } catch (error) {
        console.log('❌ MCP tools discovery failed:', error.message, '\n');
        failed++;
    }

    // Test 2: Fresh Sources for Docker Images
    try {
        console.log('📋 Test 2: Fresh Sources for Docker Images');
        const res = await fetch(`${BASE_URL}/api/config/sources/latest/docker/postgres`);
        const data = await res.json();
        assert(data.success === true, 'Should return success');
        assert(data.type === 'docker', 'Should be docker type');
        assert(data.latest, 'Should have latest version');
        assert(Array.isArray(data.tags), 'Should have tags array');
        console.log(`✅ Found PostgreSQL Docker latest: ${data.latest}\n`);
        passed++;
    } catch (error) {
        console.log('❌ Docker fresh sources failed:', error.message, '\n');
        failed++;
    }

    // Test 3: Fresh Sources for Helm Charts
    try {
        console.log('📋 Test 3: Fresh Sources for Helm Charts');
        const res = await fetch(`${BASE_URL}/api/config/sources/latest/helm/mongodb`);
        const data = await res.json();
        assert(data.success === true, 'Should return success');
        assert(data.latestVersion, 'Should have latest version');
        assert(data.repository, 'Should have repository info');
        console.log(`✅ Found MongoDB Helm chart: ${data.latestVersion} from ${data.repository}\n`);
        passed++;
    } catch (error) {
        console.log('❌ Helm fresh sources failed:', error.message, '\n');
        failed++;
    }

    // Test 4: Package Search Across Registries
    try {
        console.log('📋 Test 4: Package Search Across Registries');
        const res = await fetch(`${BASE_URL}/api/config/sources/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: 'kafka' })
        });
        const data = await res.json();
        assert(data.success === true, 'Should return success');
        assert(data.results.docker.length > 0, 'Should find Docker images');
        assert(data.results.helm.length > 0, 'Should find Helm charts');
        assert(data.results.suggestions.length > 0, 'Should have suggestions');
        console.log(`✅ Found ${data.results.docker.length} Docker + ${data.results.helm.length} Helm results for "kafka"\n`);
        passed++;
    } catch (error) {
        console.log('❌ Package search failed:', error.message, '\n');
        failed++;
    }

    // Test 5: Configuration Generation with Fresh Sources
    try {
        console.log('📋 Test 5: Configuration Generation with Fresh Sources');
        const res = await fetch(`${BASE_URL}/api/config/generate-with-fresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                intent: 'Deploy Elasticsearch cluster with Kibana',
                options: { useFreshVersions: true }
            })
        });
        const data = await res.json();
        assert(data.success === true, 'Should return success');
        assert(data.configuration.metadata.versions, 'Should have version metadata');
        assert(data.configuration.gitopsLabels, 'Should have GitOps labels');
        assert(data.configuration.observability, 'Should have observability config');
        console.log(`✅ Generated configuration: ${data.configuration.name}\n`);
        passed++;
    } catch (error) {
        console.log('❌ Configuration generation failed:', error.message, '\n');
        failed++;
    }

    // Test 6: Check Outdated Versions
    try {
        console.log('📋 Test 6: Check Outdated Versions');
        const res = await fetch(`${BASE_URL}/api/config/sources/check-outdated`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                packages: [
                    { type: 'docker', name: 'redis', currentVersion: '6.0' },
                    { type: 'helm', name: 'nginx', currentVersion: '1.0.0' }
                ]
            })
        });
        const data = await res.json();
        assert(data.success === true, 'Should return success');
        assert(data.summary.total === 2, 'Should check 2 packages');
        assert(data.results[0].hasOwnProperty('isOutdated'), 'Should have outdated status');
        console.log(`✅ Checked versions: ${data.summary.outdated}/${data.summary.total} outdated\n`);
        passed++;
    } catch (error) {
        console.log('❌ Check outdated failed:', error.message, '\n');
        failed++;
    }

    // Test 7: MCP create-config Tool
    try {
        console.log('📋 Test 7: MCP create-config Tool');
        const res = await fetch(`${MCP_URL}/mcp/v1/tools/create-config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                intent: 'Setup Grafana with Prometheus datasource',
                options: { platform: 'kubernetes', includeObservability: true }
            })
        });
        const data = await res.json();
        assert(data.success === true, 'Should return success');
        assert(data.result.observability.metrics.enabled === true, 'Should have metrics enabled');
        assert(data.result.metadata.versions, 'Should include version info');
        console.log(`✅ MCP generated config: ${data.result.name}\n`);
        passed++;
    } catch (error) {
        console.log('❌ MCP create-config failed:', error.message, '\n');
        failed++;
    }

    // Test 8: GitOps Generation
    try {
        console.log('📋 Test 8: GitOps Generation');
        const res = await fetch(`${MCP_URL}/mcp/v1/tools/generate-gitops`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                application: {
                    name: 'test-app',
                    type: 'api',
                    components: ['api', 'cache', 'db']
                }
            })
        });
        const data = await res.json();
        assert(data.success === true, 'Should return success');
        assert(data.result.gitops, 'Should have GitOps config');
        assert(data.result.manifests['kustomization.yaml'], 'Should have Kustomization');
        assert(Object.keys(data.result.manifests).length >= 4, 'Should have multiple manifests');
        console.log(`✅ Generated GitOps structure with ${Object.keys(data.result.manifests).length} files\n`);
        passed++;
    } catch (error) {
        console.log('❌ GitOps generation failed:', error.message, '\n');
        failed++;
    }

    // Test 9: Configuration Suggestions
    try {
        console.log('📋 Test 9: Configuration Suggestions');
        const res = await fetch(`${BASE_URL}/api/config/suggestions?q=deploy%20mysql`);
        const data = await res.json();
        assert(data.success === true, 'Should return success');
        assert(data.suggestions.length > 0, 'Should have suggestions');
        assert(data.suggestions.find(s => s.type === 'pattern' || s.type === 'package'), 'Should have pattern or package suggestions');
        console.log(`✅ Got ${data.suggestions.length} suggestions for "deploy mysql"\n`);
        passed++;
    } catch (error) {
        console.log('❌ Configuration suggestions failed:', error.message, '\n');
        failed++;
    }

    // Test 10: GitOps Validation
    try {
        console.log('📋 Test 10: GitOps Validation');
        const res = await fetch(`${BASE_URL}/api/config/gitops/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                manifests: {
                    'service.yaml': {
                        apiVersion: 'v1',
                        kind: 'Service',
                        metadata: {
                            name: 'test-service',
                            labels: {}  // Missing required labels
                        }
                    }
                }
            })
        });
        const data = await res.json();
        assert(data.success === true, 'Should return success');
        assert(data.validations[0].valid === false, 'Should detect missing labels');
        assert(data.validations[0].issues.length > 0, 'Should report issues');
        console.log(`✅ GitOps validation detected ${data.validations[0].issues.length} issues\n`);
        passed++;
    } catch (error) {
        console.log('❌ GitOps validation failed:', error.message, '\n');
        failed++;
    }

    // Summary
    console.log('📊 Test Summary:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${Math.round(passed/(passed+failed)*100)}%\n`);

    if (failed === 0) {
        console.log('🎉 All tests passed! AutoWeave Fresh Sources is working perfectly!');
    } else {
        console.log('⚠️  Some tests failed. Please check the implementation.');
    }
}

// Run tests
runTests().catch(console.error);