/**
 * AutoWeave Integration Module
 * Exports all integration components for USB daemon and plugin loader
 */

module.exports = {
  // Main integration service
  AutoWeaveIntegrationService: require('./autoweave-integration-service'),
  
  // USB event bridge
  USBEventBridge: require('./usb-event-bridge'),
  
  // Plugin USB capability validator
  PluginUSBCapability: require('./plugin-usb-capability'),
  
  // Test utilities
  testIntegration: require('./test-integration').testIntegration
};