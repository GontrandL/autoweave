/**
 * Test script for USB daemon and plugin loader integration
 * Demonstrates the complete event flow
 */

const path = require('path');
const AutoWeaveIntegrationService = require('./autoweave-integration-service');

async function testIntegration() {
  console.log('=== AutoWeave USB Integration Test ===\n');
  
  // Create integration service
  const service = new AutoWeaveIntegrationService({
    serviceName: 'test-integration',
    redis: {
      host: 'localhost',
      port: 6379
    },
    autoStart: false
  });
  
  // Setup event listeners
  service.on('initialized', (data) => {
    console.log('✓ Service initialized:', data);
  });
  
  service.on('started', (data) => {
    console.log('✓ Service started:', data);
  });
  
  service.on('plugin-loaded', (data) => {
    console.log('✓ Plugin loaded:', data.pluginId);
  });
  
  service.on('plugin-started', (data) => {
    console.log('✓ Plugin started:', data.pluginId);
  });
  
  service.on('health-check', (health) => {
    console.log('📊 Health check:', {
      status: health.status,
      components: health.components,
      metrics: health.metrics
    });
  });
  
  service.on('component-error', (error) => {
    console.error('❌ Component error:', error);
  });
  
  try {
    // Initialize service
    console.log('1. Initializing integration service...');
    await service.initialize();
    
    // Start service
    console.log('\n2. Starting integration service...');
    await service.start();
    
    // Load USB scanner plugin
    console.log('\n3. Loading USB scanner plugin...');
    const pluginPath = path.join(__dirname, '../../examples/plugins/usb-scanner-plugin');
    const pluginId = await service.loadPlugin(pluginPath);
    
    // Start the plugin
    console.log('\n4. Starting USB scanner plugin...');
    await service.startPlugin(pluginId);
    
    // Get service status
    console.log('\n5. Service status:');
    const status = service.getStatus();
    console.log(JSON.stringify(status, null, 2));
    
    // Simulate USB device events
    console.log('\n6. Simulating USB device events...');
    
    // Create mock USB device
    const mockDevice = {
      vendorId: 0x04A9,
      productId: 0x220E,
      manufacturer: 'Canon',
      product: 'CanoScan LiDE 120',
      serialNumber: 'SN123456',
      signature: 'mock-device-001',
      location: {
        busNumber: 1,
        deviceAddress: 4,
        portPath: '1.2'
      }
    };
    
    // Get USB daemon reference (for testing only)
    if (service.usbDaemon) {
      console.log('   - Simulating device attach...');
      await service.usbDaemon.emit('device:attach', mockDevice);
      
      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('   - Simulating device detach...');
      await service.usbDaemon.emit('device:detach', mockDevice);
      
      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Generate report
    console.log('\n7. Generating service report...');
    const report = await service.generateReport();
    console.log('Report summary:', {
      service: report.service.name,
      health: report.health.status,
      components: Object.keys(report.components)
    });
    
    // Run for a few seconds to see events
    console.log('\n8. Running for 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Stop plugin
    console.log('\n9. Stopping plugin...');
    await service.stopPlugin(pluginId);
    
    // Stop service
    console.log('\n10. Stopping integration service...');
    await service.stop();
    
    // Cleanup
    console.log('\n11. Cleaning up...');
    await service.cleanup();
    
    console.log('\n✅ Integration test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Integration test failed:', error);
    
    // Cleanup on error
    try {
      await service.cleanup();
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
    
    process.exit(1);
  }
}

// Run test if executed directly
if (require.main === module) {
  testIntegration()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testIntegration };