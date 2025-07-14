#!/usr/bin/env node

/**
 * Sprint 0 Validation Script
 * Validates all Sprint 0 requirements and deliverables
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 AutoWeave Sprint 0 Validation\n');

const validationResults = {
  rfc001: false,
  usbDaemon: false,
  pluginLoader: false,
  observability: false,
  queue: false,
  examplePlugin: false,
  ossLicenses: false,
  architecture: false,
  documentation: false,
  buildSystem: false,
  tests: false
};

const errors = [];
const warnings = [];

/**
 * Check if RFC-001 is complete and implemented
 */
function validateRFC001() {
  console.log('📋 Validating RFC-001 Plugin Manifest...');
  
  try {
    // Check RFC document exists
    const rfcPath = path.join(__dirname, '../RFC-001-PLUGIN-MANIFEST.md');
    if (!fs.existsSync(rfcPath)) {
      errors.push('RFC-001-PLUGIN-MANIFEST.md not found');
      return false;
    }
    
    // Check implementation exists
    const pluginLoaderPath = path.join(__dirname, '../packages/plugin-loader');
    if (!fs.existsSync(pluginLoaderPath)) {
      errors.push('Plugin loader package not found');
      return false;
    }
    
    // Check key files exist
    const requiredFiles = [
      'src/plugin-manager.ts',
      'src/validators/manifest-validator.ts',
      'src/schemas/manifest-schema.json',
      'src/workers/plugin-worker-runner.ts'
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(pluginLoaderPath, file);
      if (!fs.existsSync(filePath)) {
        errors.push(`Plugin loader missing: ${file}`);
        return false;
      }
    }
    
    // Check manifest schema is RFC-001 compliant
    const schemaPath = path.join(pluginLoaderPath, 'src/schemas/manifest-schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    
    const requiredProperties = ['name', 'version', 'entry', 'permissions', 'hooks'];
    for (const prop of requiredProperties) {
      if (!schema.required?.includes(prop)) {
        errors.push(`Manifest schema missing required property: ${prop}`);
        return false;
      }
    }
    
    console.log('✅ RFC-001 implementation complete');
    return true;
  } catch (error) {
    errors.push(`RFC-001 validation failed: ${error.message}`);
    return false;
  }
}

/**
 * Check USB daemon implementation
 */
function validateUSBDaemon() {
  console.log('🔌 Validating USB Daemon...');
  
  try {
    const usbDaemonPath = path.join(__dirname, '../packages/usb-daemon');
    if (!fs.existsSync(usbDaemonPath)) {
      errors.push('USB daemon package not found');
      return false;
    }
    
    const requiredFiles = [
      'src/usb-daemon.ts',
      'src/events/event-publisher.ts',
      'src/platform/platform-detection.ts',
      'src/types/usb-device.ts'
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(usbDaemonPath, file);
      if (!fs.existsSync(filePath)) {
        errors.push(`USB daemon missing: ${file}`);
        return false;
      }
    }
    
    // Check Redis Streams integration
    const eventPublisherPath = path.join(usbDaemonPath, 'src/events/event-publisher.ts');
    const eventPublisher = fs.readFileSync(eventPublisherPath, 'utf8');
    
    if (!eventPublisher.includes('aw:hotplug')) {
      errors.push('USB daemon missing Redis Streams integration');
      return false;
    }
    
    if (!eventPublisher.includes('USBEventConsumer')) {
      errors.push('USB daemon missing event consumer');
      return false;
    }
    
    console.log('✅ USB daemon implementation complete');
    return true;
  } catch (error) {
    errors.push(`USB daemon validation failed: ${error.message}`);
    return false;
  }
}

/**
 * Validate plugin loader implementation
 */
function validatePluginLoader() {
  console.log('🔧 Validating Plugin Loader...');
  
  try {
    const pluginLoaderPath = path.join(__dirname, '../packages/plugin-loader');
    
    // Check if built successfully
    const distPath = path.join(pluginLoaderPath, 'dist');
    if (!fs.existsSync(distPath)) {
      errors.push('Plugin loader not built - run npm run build');
      return false;
    }
    
    // Check exports
    const indexPath = path.join(distPath, 'index.d.ts');
    if (!fs.existsSync(indexPath)) {
      errors.push('Plugin loader type definitions missing');
      return false;
    }
    
    const typeDefs = fs.readFileSync(indexPath, 'utf8');
    const requiredExports = ['PluginManager', 'PluginWorker', 'PluginManifestValidator'];
    
    for (const exportName of requiredExports) {
      if (!typeDefs.includes(exportName)) {
        errors.push(`Plugin loader missing export: ${exportName}`);
        return false;
      }
    }
    
    console.log('✅ Plugin loader implementation complete');
    return true;
  } catch (error) {
    errors.push(`Plugin loader validation failed: ${error.message}`);
    return false;
  }
}

/**
 * Validate observability package
 */
function validateObservability() {
  console.log('📊 Validating Observability...');
  
  try {
    const obsPath = path.join(__dirname, '../packages/observability');
    
    const requiredFiles = [
      'src/tracing/tracer.ts',
      'src/metrics/metrics.ts',
      'src/logging/logger.ts'
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(obsPath, file);
      if (!fs.existsSync(filePath)) {
        errors.push(`Observability missing: ${file}`);
        return false;
      }
    }
    
    // Check if built
    const distPath = path.join(obsPath, 'dist');
    if (!fs.existsSync(distPath)) {
      errors.push('Observability package not built');
      return false;
    }
    
    console.log('✅ Observability implementation complete');
    return true;
  } catch (error) {
    errors.push(`Observability validation failed: ${error.message}`);
    return false;
  }
}

/**
 * Validate queue system
 */
function validateQueue() {
  console.log('⚡ Validating Queue System...');
  
  try {
    const queuePath = path.join(__dirname, '../packages/queue');
    
    const requiredFiles = [
      'src/queue-manager.ts',
      'src/types/job-queue.ts'
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(queuePath, file);
      if (!fs.existsSync(filePath)) {
        errors.push(`Queue system missing: ${file}`);
        return false;
      }
    }
    
    // Check if built
    const distPath = path.join(queuePath, 'dist');
    if (!fs.existsSync(distPath)) {
      errors.push('Queue package not built');
      return false;
    }
    
    console.log('✅ Queue system implementation complete');
    return true;
  } catch (error) {
    errors.push(`Queue validation failed: ${error.message}`);
    return false;
  }
}

/**
 * Validate example plugin
 */
function validateExamplePlugin() {
  console.log('📦 Validating Example Plugin...');
  
  try {
    const examplePath = path.join(__dirname, '../examples/plugins/usb-scanner-plugin');
    
    if (!fs.existsSync(examplePath)) {
      errors.push('Example plugin not found');
      return false;
    }
    
    // Check manifest
    const manifestPath = path.join(examplePath, 'autoweave.plugin.json');
    if (!fs.existsSync(manifestPath)) {
      errors.push('Example plugin manifest missing');
      return false;
    }
    
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    // Validate against schema
    const schemaPath = path.join(__dirname, '../packages/plugin-loader/src/schemas/manifest-schema.json');
    if (fs.existsSync(schemaPath)) {
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
      
      // Basic validation
      const requiredFields = schema.required || [];
      for (const field of requiredFields) {
        if (!(field in manifest)) {
          errors.push(`Example plugin manifest missing: ${field}`);
          return false;
        }
      }
    }
    
    // Check implementation
    const implPath = path.join(examplePath, 'src/index.js');
    if (!fs.existsSync(implPath)) {
      errors.push('Example plugin implementation missing');
      return false;
    }
    
    const impl = fs.readFileSync(implPath, 'utf8');
    const requiredFunctions = ['initialize', 'cleanup', 'handleScannerAttach', 'handleScannerDetach'];
    
    for (const func of requiredFunctions) {
      if (!impl.includes(`function ${func}`)) {
        warnings.push(`Example plugin missing function: ${func}`);
      }
    }
    
    console.log('✅ Example plugin complete');
    return true;
  } catch (error) {
    errors.push(`Example plugin validation failed: ${error.message}`);
    return false;
  }
}

/**
 * Validate OSS license compatibility
 */
function validateOSSLicenses() {
  console.log('📜 Validating OSS License Compatibility...');
  
  try {
    const packageJsonPath = path.join(__dirname, '../package.json');
    if (!fs.existsSync(packageJsonPath)) {
      errors.push('Root package.json not found');
      return false;
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Check main dependencies for compatibility
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    // List of dependencies with potential license issues
    const problematicPackages = [
      '@apollo/gateway', // Elastic License 2.0
      '@apollo/subgraph'  // Elastic License 2.0
    ];
    
    for (const pkg of problematicPackages) {
      if (dependencies[pkg]) {
        warnings.push(`Potentially problematic license: ${pkg}`);
      }
    }
    
    // Check if license file exists
    const licensePath = path.join(__dirname, '../LICENSE');
    if (!fs.existsSync(licensePath)) {
      errors.push('LICENSE file missing');
      return false;
    }
    
    console.log('✅ OSS license validation complete');
    return true;
  } catch (error) {
    errors.push(`OSS license validation failed: ${error.message}`);
    return false;
  }
}

/**
 * Validate architecture documentation
 */
function validateArchitecture() {
  console.log('🏗️ Validating Architecture Documentation...');
  
  try {
    const requiredDocs = [
      'RFC-001-PLUGIN-MANIFEST.md',
      'USB_DAEMON_SPEC.md',
      'SPRINT_0_REQUIREMENTS.md',
      'SPRINT_0_INFRASTRUCTURE_REPORT.md'
    ];
    
    for (const doc of requiredDocs) {
      const docPath = path.join(__dirname, `../${doc}`);
      if (!fs.existsSync(docPath)) {
        errors.push(`Architecture document missing: ${doc}`);
        return false;
      }
    }
    
    console.log('✅ Architecture documentation complete');
    return true;
  } catch (error) {
    errors.push(`Architecture validation failed: ${error.message}`);
    return false;
  }
}

/**
 * Validate build system
 */
function validateBuildSystem() {
  console.log('🔨 Validating Build System...');
  
  try {
    // Check turbo.json exists
    const turboPath = path.join(__dirname, '../turbo.json');
    if (!fs.existsSync(turboPath)) {
      errors.push('turbo.json not found');
      return false;
    }
    
    // Check workspace configuration
    const packageJsonPath = path.join(__dirname, '../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    if (!packageJson.workspaces) {
      errors.push('Workspace configuration missing');
      return false;
    }
    
    // Try to build core packages
    try {
      console.log('  Testing plugin-loader build...');
      execSync('cd packages/plugin-loader && npm run build', { stdio: 'pipe' });
      
      console.log('  Testing usb-daemon build...');
      execSync('cd packages/usb-daemon && npm run build', { stdio: 'pipe' });
      
      console.log('  Testing queue build...');
      execSync('cd packages/queue && npm run build', { stdio: 'pipe' });
      
      console.log('  Testing observability build...');
      execSync('cd packages/observability && npm run build', { stdio: 'pipe' });
      
    } catch (buildError) {
      errors.push(`Build system failure: ${buildError.message}`);
      return false;
    }
    
    console.log('✅ Build system working');
    return true;
  } catch (error) {
    errors.push(`Build system validation failed: ${error.message}`);
    return false;
  }
}

/**
 * Validate test infrastructure
 */
function validateTests() {
  console.log('🧪 Validating Test Infrastructure...');
  
  try {
    // Check Jest configuration
    const jestConfigPath = path.join(__dirname, '../jest.config.js');
    if (!fs.existsSync(jestConfigPath)) {
      warnings.push('Jest configuration not found');
    }
    
    // Check integration test exists
    const integrationTestPath = path.join(__dirname, '../tests/integration/core/plugin-usb-integration.test.ts');
    if (!fs.existsSync(integrationTestPath)) {
      errors.push('Integration test missing');
      return false;
    }
    
    // Check test directory structure
    const testDirs = [
      '../tests/integration',
      '../tests/unit'
    ];
    
    for (const dir of testDirs) {
      const dirPath = path.join(__dirname, dir);
      if (!fs.existsSync(dirPath)) {
        warnings.push(`Test directory missing: ${dir}`);
      }
    }
    
    console.log('✅ Test infrastructure complete');
    return true;
  } catch (error) {
    errors.push(`Test validation failed: ${error.message}`);
    return false;
  }
}

/**
 * Main validation function
 */
async function main() {
  try {
    // Run all validations
    validationResults.rfc001 = validateRFC001();
    validationResults.usbDaemon = validateUSBDaemon();
    validationResults.pluginLoader = validatePluginLoader();
    validationResults.observability = validateObservability();
    validationResults.queue = validateQueue();
    validationResults.examplePlugin = validateExamplePlugin();
    validationResults.ossLicenses = validateOSSLicenses();
    validationResults.architecture = validateArchitecture();
    validationResults.buildSystem = validateBuildSystem();
    validationResults.tests = validateTests();
    
    // Print results
    console.log('\n📊 Sprint 0 Validation Results:');
    console.log('═══════════════════════════════════');
    
    const results = Object.entries(validationResults);
    const passed = results.filter(([, result]) => result).length;
    const total = results.length;
    
    for (const [category, passed] of results) {
      const status = passed ? '✅' : '❌';
      const name = category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      console.log(`${status} ${name}`);
    }
    
    console.log('\n📈 Summary:');
    console.log(`✅ Passed: ${passed}/${total} (${Math.round(passed/total*100)}%)`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.forEach(error => console.log(`  • ${error}`));
    }
    
    if (warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      warnings.forEach(warning => console.log(`  • ${warning}`));
    }
    
    // Sprint 0 Go/No-Go Decision
    console.log('\n🚦 Sprint 0 Go/No-Go Decision:');
    const criticalComponents = ['rfc001', 'usbDaemon', 'pluginLoader', 'architecture'];
    const criticalPassed = criticalComponents.every(comp => validationResults[comp]);
    const overallScore = passed / total;
    
    if (criticalPassed && overallScore >= 0.8) {
      console.log('🟢 GO for Sprint 1 - All critical components validated');
      console.log('✅ Ready to begin Sprint 1 implementation');
      process.exit(0);
    } else {
      console.log('🔴 NO-GO for Sprint 1 - Critical issues detected');
      console.log('❌ Address critical issues before proceeding');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 Validation script failed:', error.message);
    process.exit(1);
  }
}

// Run validation
main().catch(console.error);