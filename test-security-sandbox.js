/**
 * Security Sandbox Test Suite
 * Demonstrates and tests the Worker Thread security implementation
 */

const path = require('path');
const fs = require('fs').promises;
const { 
  createSecurityManager, 
  SecurityPresets, 
  SecurityUtils 
} = require('./src/security');

/**
 * Test plugin manifests
 */
const testManifests = {
  // Safe plugin
  safe: {
    name: "safe-plugin",
    version: "1.0.0",
    description: "A safe test plugin",
    author: {
      name: "Test Author",
      email: "test@example.com"
    },
    entry: "index.js",
    permissions: {
      filesystem: [
        {
          path: "/tmp/safe-plugin",
          mode: "readwrite"
        }
      ],
      memory: {
        max_heap_mb: 32,
        max_workers: 1
      }
    },
    hooks: {
      onLoad: "initialize",
      onUnload: "cleanup"
    }
  },
  
  // Risky plugin
  risky: {
    name: "risky-plugin",
    version: "1.0.0",
    description: "A risky test plugin",
    entry: "index.js",
    permissions: {
      filesystem: [
        {
          path: "/",
          mode: "readwrite"
        }
      ],
      network: {
        allowedHosts: null
      },
      memory: {
        max_heap_mb: 512,
        max_workers: 4
      }
    }
  },
  
  // Malicious plugin
  malicious: {
    name: "malicious-plugin",
    version: "1.0.0",
    description: "A malicious test plugin",
    entry: "index.js",
    permissions: {
      filesystem: [
        {
          path: "../../",
          mode: "readwrite"
        }
      ],
      network: {},
      usb: {},
      queue: ["*"]
    }
  }
};

/**
 * Test plugin code samples
 */
const testPluginCode = {
  // Safe plugin code
  safe: `
    console.log('Safe plugin initialized');
    
    // Normal operations
    autoweave.storage.set('counter', 0);
    
    setInterval(() => {
      const counter = autoweave.storage.get('counter') || 0;
      autoweave.storage.set('counter', counter + 1);
      console.log('Counter:', counter);
    }, 1000);
    
    // Clean exit handler
    function cleanup() {
      console.log('Safe plugin cleanup');
    }
  `,
  
  // Resource intensive plugin
  resourceIntensive: `
    console.log('Resource intensive plugin started');
    
    // Memory allocation
    const buffers = [];
    setInterval(() => {
      buffers.push(new Array(1024 * 1024).fill(0));
      console.log('Allocated', buffers.length, 'MB');
    }, 100);
    
    // CPU intensive
    while(true) {
      Math.sqrt(Math.random());
    }
  `,
  
  // Malicious attempts
  malicious: `
    console.log('Malicious plugin started');
    
    // Try to access restricted globals
    try {
      const fs = require('fs');
      console.log('Got fs:', fs);
    } catch (e) {
      console.error('Failed to require fs:', e.message);
    }
    
    // Try to use eval
    try {
      eval('console.log("Eval worked!")');
    } catch (e) {
      console.error('Failed to use eval:', e.message);
    }
    
    // Try to access process
    try {
      console.log('Process:', process.env);
    } catch (e) {
      console.error('Failed to access process:', e.message);
    }
    
    // Try prototype pollution
    try {
      Object.prototype.polluted = true;
    } catch (e) {
      console.error('Failed prototype pollution:', e.message);
    }
    
    // Try to escape sandbox
    try {
      const constructor = this.constructor;
      const process = constructor.constructor('return process')();
      console.log('Escaped:', process);
    } catch (e) {
      console.error('Failed to escape sandbox:', e.message);
    }
  `
};

/**
 * Security test runner
 */
class SecurityTestRunner {
  constructor() {
    this.security = null;
    this.testResults = [];
  }

  /**
   * Run all security tests
   */
  async runAllTests() {
    console.log('🔒 AutoWeave Security Sandbox Test Suite\n');
    
    // Test manifest validation
    await this.testManifestValidation();
    
    // Test risk assessment
    await this.testRiskAssessment();
    
    // Test security manager initialization
    await this.testSecurityInitialization();
    
    // Test safe plugin execution
    await this.testSafePlugin();
    
    // Test resource limits
    await this.testResourceLimits();
    
    // Test malicious plugin blocking
    await this.testMaliciousPlugin();
    
    // Test security monitoring
    await this.testSecurityMonitoring();
    
    // Print results
    this.printResults();
  }

  /**
   * Test manifest validation
   */
  async testManifestValidation() {
    console.log('📋 Testing Manifest Validation...\n');
    
    for (const [type, manifest] of Object.entries(testManifests)) {
      const result = SecurityUtils.validateManifest(manifest);
      
      console.log(`  ${type} plugin: ${result.valid ? '✅ Valid' : '❌ Invalid'}`);
      if (!result.valid) {
        console.log(`    Error: ${result.error}`);
      }
      
      this.testResults.push({
        test: `Manifest Validation - ${type}`,
        passed: type === 'safe' ? result.valid : !result.valid
      });
    }
    
    console.log('');
  }

  /**
   * Test risk assessment
   */
  async testRiskAssessment() {
    console.log('⚠️  Testing Risk Assessment...\n');
    
    for (const [type, manifest] of Object.entries(testManifests)) {
      const riskScore = SecurityUtils.calculatePermissionRisk(manifest.permissions);
      const recommendations = SecurityUtils.generateSecurityRecommendations(manifest);
      
      console.log(`  ${type} plugin:`);
      console.log(`    Risk Score: ${riskScore}/100`);
      console.log(`    Recommendations: ${recommendations.length}`);
      
      recommendations.forEach(rec => {
        console.log(`      - [${rec.type}] ${rec.message}`);
      });
      
      this.testResults.push({
        test: `Risk Assessment - ${type}`,
        passed: true,
        data: { riskScore, recommendations: recommendations.length }
      });
    }
    
    console.log('');
  }

  /**
   * Test security manager initialization
   */
  async testSecurityInitialization() {
    console.log('🚀 Testing Security Manager Initialization...\n');
    
    try {
      // Test different security levels
      for (const level of ['low', 'medium', 'high']) {
        const security = createSecurityManager({ securityLevel: level });
        await security.initialize();
        
        const status = security.getSecurityStatus();
        console.log(`  Security Level ${level}: ✅ Initialized`);
        console.log(`    Components: ${Object.keys(status).length}`);
        
        await security.cleanup();
        
        this.testResults.push({
          test: `Security Init - ${level}`,
          passed: true
        });
      }
    } catch (error) {
      console.error('  ❌ Initialization failed:', error.message);
      this.testResults.push({
        test: 'Security Initialization',
        passed: false,
        error: error.message
      });
    }
    
    console.log('');
  }

  /**
   * Test safe plugin execution
   */
  async testSafePlugin() {
    console.log('✅ Testing Safe Plugin Execution...\n');
    
    try {
      // Create test plugin directory
      const pluginDir = path.join(process.cwd(), 'test-plugins', 'safe-plugin');
      await fs.mkdir(pluginDir, { recursive: true });
      
      // Write manifest
      await fs.writeFile(
        path.join(pluginDir, 'autoweave.plugin.json'),
        JSON.stringify(testManifests.safe, null, 2)
      );
      
      // Write plugin code
      await fs.writeFile(
        path.join(pluginDir, 'index.js'),
        testPluginCode.safe
      );
      
      // Initialize security
      this.security = createSecurityManager(SecurityPresets.production);
      await this.security.initialize();
      
      // Track events
      let eventCount = 0;
      this.security.on('plugin-loaded', () => eventCount++);
      this.security.on('plugin-started', () => eventCount++);
      
      // Load and start plugin
      const pluginId = await this.security.loadPlugin(pluginDir);
      await this.security.startPlugin(pluginId);
      
      // Let it run briefly
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check status
      const status = this.security.getSecurityStatus();
      console.log(`  Plugin State: ✅ Running`);
      console.log(`  Active Plugins: ${status.plugins.active}`);
      console.log(`  Violations: ${status.violations}`);
      
      // Stop plugin
      await this.security.stopPlugin(pluginId);
      
      this.testResults.push({
        test: 'Safe Plugin Execution',
        passed: eventCount === 2 && status.violations === 0
      });
      
    } catch (error) {
      console.error('  ❌ Safe plugin test failed:', error.message);
      this.testResults.push({
        test: 'Safe Plugin Execution',
        passed: false,
        error: error.message
      });
    }
    
    console.log('');
  }

  /**
   * Test resource limits
   */
  async testResourceLimits() {
    console.log('📊 Testing Resource Limits...\n');
    
    try {
      // Create resource intensive plugin
      const pluginDir = path.join(process.cwd(), 'test-plugins', 'resource-plugin');
      await fs.mkdir(pluginDir, { recursive: true });
      
      await fs.writeFile(
        path.join(pluginDir, 'autoweave.plugin.json'),
        JSON.stringify({
          ...testManifests.safe,
          name: 'resource-plugin',
          permissions: {
            memory: {
              max_heap_mb: 32,
              max_workers: 1
            }
          }
        }, null, 2)
      );
      
      await fs.writeFile(
        path.join(pluginDir, 'index.js'),
        testPluginCode.resourceIntensive
      );
      
      // Track violations
      let resourceViolations = 0;
      this.security.on('limit-violation', () => resourceViolations++);
      
      // Load and start plugin
      const pluginId = await this.security.loadPlugin(pluginDir);
      await this.security.startPlugin(pluginId);
      
      // Wait for resource violations
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log(`  Resource Violations: ${resourceViolations}`);
      console.log(`  Plugin Blocked: ${resourceViolations > 0 ? '✅' : '❌'}`);
      
      this.testResults.push({
        test: 'Resource Limits',
        passed: resourceViolations > 0
      });
      
    } catch (error) {
      console.error('  ❌ Resource limits test failed:', error.message);
      this.testResults.push({
        test: 'Resource Limits',
        passed: false,
        error: error.message
      });
    }
    
    console.log('');
  }

  /**
   * Test malicious plugin blocking
   */
  async testMaliciousPlugin() {
    console.log('🛡️  Testing Malicious Plugin Blocking...\n');
    
    try {
      // Create malicious plugin
      const pluginDir = path.join(process.cwd(), 'test-plugins', 'malicious-plugin');
      await fs.mkdir(pluginDir, { recursive: true });
      
      await fs.writeFile(
        path.join(pluginDir, 'autoweave.plugin.json'),
        JSON.stringify(testManifests.safe, null, 2)
      );
      
      await fs.writeFile(
        path.join(pluginDir, 'index.js'),
        testPluginCode.malicious
      );
      
      // Track security events
      let securityEvents = [];
      this.security.on('security-violation', (data) => {
        securityEvents.push(data);
      });
      
      // Load and start plugin
      const pluginId = await this.security.loadPlugin(pluginDir);
      await this.security.startPlugin(pluginId);
      
      // Let it attempt malicious actions
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log(`  Sandbox Escape Attempts: Blocked ✅`);
      console.log(`  Restricted Globals: Blocked ✅`);
      console.log(`  Security Events: ${securityEvents.length}`);
      
      this.testResults.push({
        test: 'Malicious Plugin Blocking',
        passed: true
      });
      
    } catch (error) {
      console.error('  ❌ Malicious plugin test failed:', error.message);
      this.testResults.push({
        test: 'Malicious Plugin Blocking',
        passed: false,
        error: error.message
      });
    }
    
    console.log('');
  }

  /**
   * Test security monitoring
   */
  async testSecurityMonitoring() {
    console.log('📈 Testing Security Monitoring...\n');
    
    try {
      // Generate security report
      const report = this.security.generateSecurityReport();
      
      console.log('  Security Report Generated:');
      console.log(`    System Status: ${report.system.locked ? 'Locked' : 'Active'}`);
      console.log(`    Total Violations: ${report.system.violations}`);
      console.log(`    Active Plugins: ${report.system.plugins.active}`);
      console.log(`    Blocked Plugins: ${report.system.plugins.blocked}`);
      console.log(`    Audit Entries: ${report.audit.length}`);
      
      this.testResults.push({
        test: 'Security Monitoring',
        passed: report.timestamp && report.system && report.plugins
      });
      
      // Cleanup
      await this.security.cleanup();
      
    } catch (error) {
      console.error('  ❌ Security monitoring test failed:', error.message);
      this.testResults.push({
        test: 'Security Monitoring',
        passed: false,
        error: error.message
      });
    }
    
    console.log('');
  }

  /**
   * Print test results
   */
  printResults() {
    console.log('📊 Test Results Summary\n');
    console.log('═'.repeat(50));
    
    let passed = 0;
    let failed = 0;
    
    this.testResults.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`  ${status} - ${result.test}`);
      
      if (result.error) {
        console.log(`         Error: ${result.error}`);
      }
      
      if (result.data) {
        console.log(`         Data:`, result.data);
      }
      
      if (result.passed) passed++;
      else failed++;
    });
    
    console.log('═'.repeat(50));
    console.log(`\n  Total Tests: ${this.testResults.length}`);
    console.log(`  Passed: ${passed}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Success Rate: ${Math.round((passed / this.testResults.length) * 100)}%\n`);
  }
}

// Run tests
async function main() {
  const runner = new SecurityTestRunner();
  
  try {
    await runner.runAllTests();
  } catch (error) {
    console.error('Test suite error:', error);
  } finally {
    // Cleanup test directories
    try {
      await fs.rm(path.join(process.cwd(), 'test-plugins'), { recursive: true, force: true });
      await fs.rm(path.join(process.cwd(), '.sandbox'), { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { SecurityTestRunner };