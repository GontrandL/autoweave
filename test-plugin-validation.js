const { PluginManifestValidator } = require('./packages/plugin-loader/dist/index.js');
const fs = require('fs');

async function testPluginValidation() {
  try {
    console.log('Testing RFC-001 Plugin Manifest Validation...');
    
    const manifest = JSON.parse(fs.readFileSync('./examples/plugins/usb-scanner-plugin/autoweave.plugin.json', 'utf8'));
    console.log('Loaded manifest:', manifest.name, 'v' + manifest.version);
    
    const validator = new PluginManifestValidator();
    const result = validator.validateManifest(manifest);
    
    console.log('\n=== RFC-001 Compliance Test ===');
    console.log('Valid:', result.valid);
    
    if (!result.valid) {
      console.log('Validation errors:', result.errors);
    } else {
      console.log('✅ All RFC-001 requirements met!');
      console.log('✅ Schema validation passed');
      console.log('✅ Required fields present:', manifest.name, manifest.version, manifest.entry);
      console.log('✅ Permissions defined:', Object.keys(manifest.permissions || {}));
      console.log('✅ Hooks defined:', Object.keys(manifest.hooks || {}));
    }
    
    return result.valid;
  } catch(error) {
    console.error('❌ Error during validation:', error.message);
    return false;
  }
}

testPluginValidation().then(valid => {
  console.log('\n=== Test Result ===');
  console.log(valid ? '🟢 PASS: RFC-001 compliance verified' : '🔴 FAIL: RFC-001 compliance issues');
  process.exit(valid ? 0 : 1);
});