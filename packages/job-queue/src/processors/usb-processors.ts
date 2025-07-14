import { JobContext, JobResult, USBEventData, ProcessFunction } from '../types';

export const usbDeviceAttachedProcessor: ProcessFunction = async (context: JobContext): Promise<JobResult> => {
  const { data, log } = context;
  const eventData = data.payload as USBEventData;

  try {
    log(`Processing USB device attached: ${eventData.deviceInfo.product || 'Unknown Device'}`);

    // Update progress
    context.progress(10);

    // Extract device information
    const deviceInfo = eventData.deviceInfo;
    const deviceId = `${deviceInfo.vendorId.toString(16).padStart(4, '0')}:${deviceInfo.productId.toString(16).padStart(4, '0')}`;

    log(`Device ID: ${deviceId}`);
    log(`Manufacturer: ${deviceInfo.manufacturer || 'Unknown'}`);
    log(`Product: ${deviceInfo.product || 'Unknown'}`);
    log(`Serial: ${deviceInfo.serialNumber || 'N/A'}`);

    context.progress(30);

    // Check if device is known/supported
    const knownDevices = await checkKnownDevices(deviceInfo);
    
    context.progress(50);

    // Notify plugin system about new device
    const pluginNotifications = await notifyPluginSystem(deviceInfo);
    
    context.progress(70);

    // Update device registry
    await updateDeviceRegistry(deviceInfo, 'attached');
    
    context.progress(90);

    // Prepare result
    const result = {
      deviceId,
      deviceInfo,
      isKnown: knownDevices.length > 0,
      knownDevices,
      pluginNotifications,
      timestamp: eventData.timestamp
    };

    context.progress(100);
    log(`USB device attached processing completed for ${deviceId}`);

    return {
      success: true,
      data: result
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error processing USB device attached: ${errorMessage}`, 'error');
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

export const usbDeviceDetachedProcessor: ProcessFunction = async (context: JobContext): Promise<JobResult> => {
  const { data, log } = context;
  const eventData = data.payload as USBEventData;

  try {
    log(`Processing USB device detached: ${eventData.deviceInfo.product || 'Unknown Device'}`);

    context.progress(10);

    const deviceInfo = eventData.deviceInfo;
    const deviceId = `${deviceInfo.vendorId.toString(16).padStart(4, '0')}:${deviceInfo.productId.toString(16).padStart(4, '0')}`;

    log(`Device ID: ${deviceId}`);

    context.progress(30);

    // Notify plugin system about device removal
    const pluginNotifications = await notifyPluginSystemDetached(deviceInfo);
    
    context.progress(50);

    // Update device registry
    await updateDeviceRegistry(deviceInfo, 'detached');
    
    context.progress(70);

    // Cleanup any device-specific resources
    await cleanupDeviceResources(deviceInfo);
    
    context.progress(90);

    const result = {
      deviceId,
      deviceInfo,
      pluginNotifications,
      timestamp: eventData.timestamp
    };

    context.progress(100);
    log(`USB device detached processing completed for ${deviceId}`);

    return {
      success: true,
      data: result
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error processing USB device detached: ${errorMessage}`, 'error');
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

export const usbScanCompleteProcessor: ProcessFunction = async (context: JobContext): Promise<JobResult> => {
  const { data, log } = context;

  try {
    log('Processing USB scan complete');

    context.progress(10);

    // Get current device list
    const currentDevices = await getCurrentDeviceList();
    
    context.progress(30);

    // Compare with previous scan
    const previousDevices = await getPreviousDeviceList();
    
    context.progress(50);

    // Identify changes
    const deviceChanges = identifyDeviceChanges(previousDevices, currentDevices);
    
    context.progress(70);

    // Update device registry with full scan results
    await updateDeviceRegistryFull(currentDevices);
    
    context.progress(90);

    const result = {
      totalDevices: currentDevices.length,
      newDevices: deviceChanges.added,
      removedDevices: deviceChanges.removed,
      timestamp: Date.now()
    };

    context.progress(100);
    log(`USB scan complete processing finished. Found ${currentDevices.length} devices`);

    return {
      success: true,
      data: result
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error processing USB scan complete: ${errorMessage}`, 'error');
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

// Helper functions
async function checkKnownDevices(deviceInfo: USBEventData['deviceInfo']): Promise<any[]> {
  // In a real implementation, this would check against a database of known devices
  // For now, return empty array
  return [];
}

async function notifyPluginSystem(deviceInfo: USBEventData['deviceInfo']): Promise<string[]> {
  // In a real implementation, this would notify the plugin system
  // about the new device so plugins can react appropriately
  return [`plugin-notification-${deviceInfo.vendorId}-${deviceInfo.productId}`];
}

async function notifyPluginSystemDetached(deviceInfo: USBEventData['deviceInfo']): Promise<string[]> {
  // Notify plugins about device removal
  return [`plugin-detach-notification-${deviceInfo.vendorId}-${deviceInfo.productId}`];
}

async function updateDeviceRegistry(deviceInfo: USBEventData['deviceInfo'], action: 'attached' | 'detached'): Promise<void> {
  // Update device registry - in real implementation, this would interact with a database
  console.log(`Device registry updated: ${action} device ${deviceInfo.vendorId}:${deviceInfo.productId}`);
}

async function cleanupDeviceResources(deviceInfo: USBEventData['deviceInfo']): Promise<void> {
  // Cleanup any resources associated with the device
  console.log(`Cleaning up resources for device ${deviceInfo.vendorId}:${deviceInfo.productId}`);
}

async function getCurrentDeviceList(): Promise<any[]> {
  // Get current USB device list - in real implementation, this would query the USB system
  return [];
}

async function getPreviousDeviceList(): Promise<any[]> {
  // Get previous device list from registry
  return [];
}

function identifyDeviceChanges(previous: any[], current: any[]): { added: any[], removed: any[] } {
  // Compare device lists to identify changes
  return {
    added: [],
    removed: []
  };
}

async function updateDeviceRegistryFull(devices: any[]): Promise<void> {
  // Update device registry with full scan results
  console.log(`Device registry updated with ${devices.length} devices`);
}