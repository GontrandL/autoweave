/**
 * USB Scanner Plugin Example
 * Demonstrates AutoWeave plugin capabilities with USB device handling
 */

// Plugin state
let isInitialized = false;
let scannerDevices = new Map();

/**
 * Plugin initialization hook
 */
async function initialize() {
  console.log('USB Scanner Plugin: Initializing...');
  
  // Ensure scan directory exists
  const fs = require('fs');
  const scanDir = '/tmp/scans';
  
  if (!fs.existsSync(scanDir)) {
    fs.mkdirSync(scanDir, { recursive: true });
    console.log(`Created scan directory: ${scanDir}`);
  }
  
  isInitialized = true;
  console.log('USB Scanner Plugin: Initialized successfully');
}

/**
 * Plugin cleanup hook
 */
async function cleanup() {
  console.log('USB Scanner Plugin: Cleaning up...');
  
  // Close any open scanner connections
  for (const [deviceId, device] of scannerDevices) {
    console.log(`Disconnecting scanner device: ${deviceId}`);
    // In a real plugin, this would close device connections
  }
  
  scannerDevices.clear();
  isInitialized = false;
  console.log('USB Scanner Plugin: Cleanup completed');
}

/**
 * USB device attach handler
 */
async function handleScannerAttach(deviceInfo) {
  if (!isInitialized) {
    console.warn('Plugin not initialized, ignoring USB attach event');
    return;
  }
  
  console.log('USB Scanner Plugin: Device attached', {
    vendor: deviceInfo.vendorId?.toString(16),
    product: deviceInfo.productId?.toString(16),
    manufacturer: deviceInfo.manufacturer,
    product_name: deviceInfo.product
  });
  
  // Check if this is a supported scanner
  const supportedVendors = [0x04A9, 0x03F0]; // Canon, HP
  const supportedProducts = [0x220E, 0x0C17];
  
  if (supportedVendors.includes(deviceInfo.vendorId) || 
      supportedProducts.includes(deviceInfo.productId)) {
    
    // Register the scanner device
    const deviceId = `${deviceInfo.vendorId}:${deviceInfo.productId}:${deviceInfo.signature}`;
    scannerDevices.set(deviceId, {
      ...deviceInfo,
      connectedAt: new Date(),
      status: 'ready'
    });
    
    console.log(`Registered scanner device: ${deviceId}`);
    
    // In a real plugin, this would:
    // - Initialize scanner drivers
    // - Configure scan settings
    // - Register scanner capabilities
  } else {
    console.log('Device not a supported scanner, ignoring');
  }
}

/**
 * USB device detach handler
 */
async function handleScannerDetach(deviceInfo) {
  if (!isInitialized) {
    console.warn('Plugin not initialized, ignoring USB detach event');
    return;
  }
  
  console.log('USB Scanner Plugin: Device detached', {
    vendor: deviceInfo.vendorId?.toString(16),
    product: deviceInfo.productId?.toString(16),
    signature: deviceInfo.signature
  });
  
  // Find and remove the scanner device
  const deviceId = `${deviceInfo.vendorId}:${deviceInfo.productId}:${deviceInfo.signature}`;
  
  if (scannerDevices.has(deviceId)) {
    scannerDevices.delete(deviceId);
    console.log(`Unregistered scanner device: ${deviceId}`);
    
    // In a real plugin, this would:
    // - Cancel any active scans
    // - Close device connections
    // - Clean up temporary files
  }
}

/**
 * Job processing handler
 */
async function processScanJob(jobData) {
  if (!isInitialized) {
    throw new Error('Plugin not initialized');
  }
  
  console.log('USB Scanner Plugin: Processing scan job', jobData);
  
  const { type, payload } = jobData;
  
  switch (type) {
    case 'scan.document':
      return await processScanDocument(payload);
    
    case 'scan.list_devices':
      return await listScannerDevices();
    
    case 'scan.get_status':
      return await getScannerStatus(payload.deviceId);
    
    default:
      throw new Error(`Unknown job type: ${type}`);
  }
}

/**
 * Process document scan request
 */
async function processScanDocument(payload) {
  const { deviceId, settings = {} } = payload;
  
  if (!scannerDevices.has(deviceId)) {
    throw new Error(`Scanner device not found: ${deviceId}`);
  }
  
  const device = scannerDevices.get(deviceId);
  console.log(`Starting scan on device: ${deviceId}`, settings);
  
  // Simulate scan process
  const scanId = `scan_${Date.now()}`;
  const filename = `${scanId}.pdf`;
  const filepath = `/tmp/scans/${filename}`;
  
  // In a real plugin, this would:
  // - Configure scanner settings (resolution, format, etc.)
  // - Initiate scan operation
  // - Monitor scan progress
  // - Save scanned document
  
  // Simulate scan completion
  const fs = require('fs');
  fs.writeFileSync(filepath, `Simulated scan data for ${deviceId} at ${new Date().toISOString()}`);
  
  return {
    success: true,
    scanId,
    filename,
    filepath,
    device: device.manufacturer + ' ' + device.product,
    settings,
    completedAt: new Date().toISOString()
  };
}

/**
 * List available scanner devices
 */
async function listScannerDevices() {
  const devices = Array.from(scannerDevices.entries()).map(([id, device]) => ({
    id,
    manufacturer: device.manufacturer,
    product: device.product,
    vendorId: device.vendorId,
    productId: device.productId,
    status: device.status,
    connectedAt: device.connectedAt
  }));
  
  return {
    success: true,
    devices,
    count: devices.length
  };
}

/**
 * Get scanner device status
 */
async function getScannerStatus(deviceId) {
  if (!scannerDevices.has(deviceId)) {
    throw new Error(`Scanner device not found: ${deviceId}`);
  }
  
  const device = scannerDevices.get(deviceId);
  
  return {
    success: true,
    device: {
      id: deviceId,
      manufacturer: device.manufacturer,
      product: device.product,
      status: device.status,
      connectedAt: device.connectedAt,
      capabilities: {
        maxResolution: '600x600',
        formats: ['PDF', 'JPEG', 'PNG'],
        duplex: true,
        adf: true
      }
    }
  };
}

// Export plugin functions
module.exports = {
  initialize,
  cleanup,
  handleScannerAttach,
  handleScannerDetach,
  processScanJob
};