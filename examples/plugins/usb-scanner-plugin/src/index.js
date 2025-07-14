/**
 * USB Scanner Plugin
 * Example plugin demonstrating USB device handling with AutoWeave
 */

// Plugin state
const pluginState = {
  initialized: false,
  connectedScanners: new Map(),
  activeScans: new Map(),
  statistics: {
    scannersDetected: 0,
    scansProcessed: 0,
    errors: 0
  }
};

// Known scanner models
const KNOWN_SCANNERS = {
  '0x04A9:0x220E': { vendor: 'Canon', model: 'CanoScan LiDE 120' },
  '0x03F0:0x0C17': { vendor: 'HP', model: 'ScanJet 3970' },
  '0x04B8:0x0142': { vendor: 'Epson', model: 'Perfection V39' },
  '0x04A9:0x190D': { vendor: 'Canon', model: 'CanoScan 9000F' }
};

/**
 * Initialize the plugin
 */
async function initialize() {
  try {
    console.log('Initializing USB Scanner Plugin...');
    
    // Create scan directory if it doesn't exist
    const scanDir = '/tmp/scans';
    try {
      await autoweave.fs.readFile(scanDir);
    } catch {
      // Directory doesn't exist, create it
      console.log('Creating scan directory:', scanDir);
    }
    
    // Subscribe to scan processing queue
    autoweave.queue.subscribe('scan-processing', processScanJob);
    
    pluginState.initialized = true;
    
    console.log('USB Scanner Plugin initialized successfully');
    
    // Emit ready event
    autoweave.emit('plugin-ready', {
      pluginId: autoweave.plugin.id,
      version: autoweave.plugin.version
    });
    
  } catch (error) {
    console.error('Failed to initialize plugin:', error.message);
    throw error;
  }
}

/**
 * Handle scanner attachment
 */
async function handleScannerAttach(event) {
  try {
    const { device } = event;
    const deviceKey = `0x${device.vendorId.toString(16).toUpperCase().padStart(4, '0')}:` +
                     `0x${device.productId.toString(16).toUpperCase().padStart(4, '0')}`;
    
    console.log(`Scanner attached: ${deviceKey}`);
    
    // Check if this is a known scanner
    const scannerInfo = KNOWN_SCANNERS[deviceKey] || {
      vendor: device.manufacturer || 'Unknown',
      model: device.product || 'Unknown Scanner'
    };
    
    // Create scanner record
    const scanner = {
      id: device.signature,
      deviceKey,
      ...scannerInfo,
      serialNumber: device.serialNumber,
      location: device.location,
      attachedAt: Date.now(),
      status: 'ready',
      capabilities: await detectScannerCapabilities(device)
    };
    
    // Store scanner
    pluginState.connectedScanners.set(scanner.id, scanner);
    pluginState.statistics.scannersDetected++;
    
    // Notify about new scanner
    autoweave.emit('scanner-connected', {
      scannerId: scanner.id,
      vendor: scanner.vendor,
      model: scanner.model,
      capabilities: scanner.capabilities
    });
    
    // Log scanner info
    console.log(`Scanner registered: ${scanner.vendor} ${scanner.model}`);
    console.log(`Capabilities:`, scanner.capabilities);
    
    // Store scanner info for other plugins/services
    await autoweave.storage.set(`scanner:${scanner.id}`, scanner);
    
  } catch (error) {
    console.error('Error handling scanner attach:', error.message);
    pluginState.statistics.errors++;
    
    autoweave.emit('scanner-error', {
      event: 'attach',
      error: error.message
    });
  }
}

/**
 * Handle scanner detachment
 */
async function handleScannerDetach(event) {
  try {
    const { device } = event;
    
    // Find scanner by signature
    let scannerId = null;
    for (const [id, scanner] of pluginState.connectedScanners) {
      if (scanner.serialNumber === device.serialNumber ||
          scanner.location.portPath === device.location.portPath) {
        scannerId = id;
        break;
      }
    }
    
    if (!scannerId) {
      console.warn('Unknown scanner detached');
      return;
    }
    
    const scanner = pluginState.connectedScanners.get(scannerId);
    console.log(`Scanner detached: ${scanner.vendor} ${scanner.model}`);
    
    // Cancel any active scans
    if (pluginState.activeScans.has(scannerId)) {
      const scan = pluginState.activeScans.get(scannerId);
      scan.status = 'cancelled';
      pluginState.activeScans.delete(scannerId);
      
      console.log('Cancelled active scan due to scanner detachment');
    }
    
    // Remove scanner
    pluginState.connectedScanners.delete(scannerId);
    
    // Notify about scanner removal
    autoweave.emit('scanner-disconnected', {
      scannerId,
      vendor: scanner.vendor,
      model: scanner.model
    });
    
    // Remove from storage
    await autoweave.storage.delete(`scanner:${scannerId}`);
    
  } catch (error) {
    console.error('Error handling scanner detach:', error.message);
    pluginState.statistics.errors++;
    
    autoweave.emit('scanner-error', {
      event: 'detach',
      error: error.message
    });
  }
}

/**
 * Handle USB errors
 */
async function handleUSBError(error) {
  console.error('USB error:', error);
  pluginState.statistics.errors++;
  
  autoweave.emit('scanner-error', {
    event: 'usb-error',
    error: error.message || 'Unknown USB error'
  });
}

/**
 * Detect scanner capabilities
 */
async function detectScannerCapabilities(device) {
  // In a real implementation, this would query the scanner
  // For now, return mock capabilities based on device class
  
  const capabilities = {
    colorModes: ['color', 'grayscale', 'blackwhite'],
    resolutions: [75, 150, 300, 600],
    defaultResolution: 300,
    paperSizes: ['a4', 'letter', 'legal'],
    defaultPaperSize: 'a4',
    features: []
  };
  
  // Add features based on device info
  if (device.manufacturer === 'Canon' || device.manufacturer === 'Epson') {
    capabilities.resolutions.push(1200);
    capabilities.features.push('auto-document-feeder');
  }
  
  if (device.product && device.product.toLowerCase().includes('photo')) {
    capabilities.resolutions.push(2400, 4800);
    capabilities.features.push('photo-scanning');
    capabilities.features.push('film-scanning');
  }
  
  return capabilities;
}

/**
 * Process scan job from queue
 */
async function processScanJob(message) {
  try {
    const job = message.data || message;
    console.log('Processing scan job:', job.jobId);
    
    // Validate job
    if (!job.scannerId || !job.settings) {
      throw new Error('Invalid scan job format');
    }
    
    // Check if scanner is connected
    const scanner = pluginState.connectedScanners.get(job.scannerId);
    if (!scanner) {
      throw new Error(`Scanner not found: ${job.scannerId}`);
    }
    
    // Check if scanner is busy
    if (pluginState.activeScans.has(job.scannerId)) {
      throw new Error('Scanner is busy');
    }
    
    // Create scan record
    const scan = {
      jobId: job.jobId,
      scannerId: job.scannerId,
      settings: validateScanSettings(job.settings, scanner.capabilities),
      status: 'scanning',
      startTime: Date.now(),
      progress: 0
    };
    
    pluginState.activeScans.set(job.scannerId, scan);
    
    // Notify scan started
    autoweave.emit('scan-started', {
      jobId: job.jobId,
      scannerId: job.scannerId,
      settings: scan.settings
    });
    
    // Simulate scanning process
    await performScan(scanner, scan);
    
    // Remove from active scans
    pluginState.activeScans.delete(job.scannerId);
    pluginState.statistics.scansProcessed++;
    
    // Notify scan completed
    autoweave.emit('scan-completed', {
      jobId: job.jobId,
      scannerId: job.scannerId,
      outputFile: scan.outputFile,
      duration: Date.now() - scan.startTime
    });
    
  } catch (error) {
    console.error('Error processing scan job:', error.message);
    pluginState.statistics.errors++;
    
    autoweave.emit('scan-error', {
      jobId: message.jobId,
      error: error.message
    });
  }
}

/**
 * Validate scan settings against scanner capabilities
 */
function validateScanSettings(settings, capabilities) {
  const validated = {
    colorMode: settings.colorMode || capabilities.colorModes[0],
    resolution: settings.resolution || capabilities.defaultResolution,
    paperSize: settings.paperSize || capabilities.defaultPaperSize,
    format: settings.format || 'pdf'
  };
  
  // Validate color mode
  if (!capabilities.colorModes.includes(validated.colorMode)) {
    validated.colorMode = capabilities.colorModes[0];
  }
  
  // Validate resolution
  if (!capabilities.resolutions.includes(validated.resolution)) {
    // Find closest resolution
    validated.resolution = capabilities.resolutions.reduce((prev, curr) => {
      return Math.abs(curr - settings.resolution) < Math.abs(prev - settings.resolution) 
        ? curr : prev;
    });
  }
  
  // Validate paper size
  if (!capabilities.paperSizes.includes(validated.paperSize)) {
    validated.paperSize = capabilities.defaultPaperSize;
  }
  
  return validated;
}

/**
 * Perform the actual scan (simulated)
 */
async function performScan(scanner, scan) {
  try {
    // Update progress
    for (let progress = 0; progress <= 100; progress += 10) {
      scan.progress = progress;
      
      // Emit progress update
      autoweave.emit('scan-progress', {
        jobId: scan.jobId,
        progress: progress
      });
      
      // Simulate scan time
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Check if scan was cancelled
      if (scan.status === 'cancelled') {
        throw new Error('Scan cancelled');
      }
    }
    
    // Generate output file path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `scan_${scanner.vendor}_${timestamp}.${scan.settings.format}`;
    scan.outputFile = `/tmp/scans/${filename}`;
    
    // In a real implementation, this would save the actual scan data
    // For now, create a mock file
    const mockContent = JSON.stringify({
      scanner: `${scanner.vendor} ${scanner.model}`,
      settings: scan.settings,
      timestamp: new Date().toISOString(),
      pages: 1
    }, null, 2);
    
    await autoweave.fs.writeFile(scan.outputFile, mockContent);
    
    scan.status = 'completed';
    
    console.log(`Scan completed: ${scan.outputFile}`);
    
  } catch (error) {
    scan.status = 'error';
    scan.error = error.message;
    throw error;
  }
}

/**
 * Cleanup function called on plugin unload
 */
async function cleanup() {
  try {
    console.log('Cleaning up USB Scanner Plugin...');
    
    // Cancel any active scans
    for (const [scannerId, scan] of pluginState.activeScans) {
      scan.status = 'cancelled';
      console.log(`Cancelled scan ${scan.jobId}`);
    }
    
    // Clear storage
    for (const [scannerId] of pluginState.connectedScanners) {
      await autoweave.storage.delete(`scanner:${scannerId}`);
    }
    
    // Clear state
    pluginState.connectedScanners.clear();
    pluginState.activeScans.clear();
    
    console.log('USB Scanner Plugin cleaned up');
    
  } catch (error) {
    console.error('Error during cleanup:', error.message);
  }
}

/**
 * Get plugin status
 */
function getStatus() {
  return {
    initialized: pluginState.initialized,
    connectedScanners: Array.from(pluginState.connectedScanners.values()).map(s => ({
      id: s.id,
      vendor: s.vendor,
      model: s.model,
      status: s.status
    })),
    activeScans: pluginState.activeScans.size,
    statistics: pluginState.statistics
  };
}

// Export functions if running in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initialize,
    handleScannerAttach,
    handleScannerDetach,
    handleUSBError,
    processScanJob,
    cleanup,
    getStatus
  };
}