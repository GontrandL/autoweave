// @ts-ignore
import * as usb from 'usb';
import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import { USBDeviceInfo, USBDaemonConfig, USBMonitoringConfig } from './types';
import { USBEventPublisher } from './events/event-publisher';

export class USBDaemon extends EventEmitter {
  private isRunning = false;
  private connectedDevices = new Map<string, USBDeviceInfo>();
  private _monitoringConfig: USBMonitoringConfig;
  private eventPublisher: USBEventPublisher;

  constructor(config: USBDaemonConfig) {
    super();
    this._monitoringConfig = {
      enabled: config.monitoring.enabled,
      healthcheckPort: config.monitoring.healthcheck_port,
      metricsInterval: config.monitoring.interval
    };
    
    this.eventPublisher = new USBEventPublisher(config.redis);
    this.setupUSBEventHandlers();
  }

  private setupUSBEventHandlers(): void {
    // Primary: node-usb events
    usb.on('attach', this.handleDeviceAttach.bind(this));
    usb.on('detach', this.handleDeviceDetach.bind(this));
    
    // Error handling
    usb.on('error', this.handleUSBError.bind(this));
  }

  private async handleDeviceAttach(device: usb.Device): Promise<void> {
    try {
      const deviceInfo = await this.extractDeviceInfo(device);
      const signature = this.generateDeviceSignature(deviceInfo);
      
      // Prevent duplicate events
      if (this.connectedDevices.has(signature)) {
        return;
      }

      deviceInfo.signature = signature;
      this.connectedDevices.set(signature, deviceInfo);

      // Emit to Redis + internal handlers
      await this.eventPublisher.publishUSBEvent('attach', deviceInfo);
      this.emit('device:attach', deviceInfo);

      console.log(`USB Device attached: ${deviceInfo.manufacturer} ${deviceInfo.product} (${deviceInfo.vendorId.toString(16)}:${deviceInfo.productId.toString(16)})`);
    } catch (error) {
      this.handleUSBError(error as Error, 'attach');
    }
  }

  private async handleDeviceDetach(device: usb.Device): Promise<void> {
    try {
      const tempInfo = await this.extractDeviceInfo(device);
      const signature = this.generateDeviceSignature(tempInfo);
      
      const deviceInfo = this.connectedDevices.get(signature);
      if (!deviceInfo) {
        return; // Device was not tracked
      }

      this.connectedDevices.delete(signature);

      // Emit to Redis + internal handlers  
      await this.eventPublisher.publishUSBEvent('detach', deviceInfo);
      this.emit('device:detach', deviceInfo);

      console.log(`USB Device detached: ${deviceInfo.manufacturer} ${deviceInfo.product}`);
    } catch (error) {
      this.handleUSBError(error as Error, 'detach');
    }
  }

  private async extractDeviceInfo(device: usb.Device): Promise<USBDeviceInfo> {
    return new Promise((resolve, reject) => {
      try {
        device.open();
        
        const deviceInfo: USBDeviceInfo = {
          vendorId: device.deviceDescriptor.idVendor,
          productId: device.deviceDescriptor.idProduct,
          deviceDescriptor: device.deviceDescriptor,
          location: {
            busNumber: device.busNumber,
            deviceAddress: device.deviceAddress,
            portPath: device.portNumbers ? device.portNumbers.join('.') : '0'
          },
          timestamp: Date.now(),
          signature: ''
        };

        // Async string descriptors
        let pending = 0;
        
        if (device.deviceDescriptor.iManufacturer) {
          pending++;
          device.getStringDescriptor(device.deviceDescriptor.iManufacturer, (error: any, data: any) => {
            if (!error && data) deviceInfo.manufacturer = data.toString();
            if (--pending === 0) finalize();
          });
        }

        if (device.deviceDescriptor.iProduct) {
          pending++;
          device.getStringDescriptor(device.deviceDescriptor.iProduct, (error: any, data: any) => {
            if (!error && data) deviceInfo.product = data.toString();
            if (--pending === 0) finalize();
          });
        }

        if (device.deviceDescriptor.iSerialNumber) {
          pending++;
          device.getStringDescriptor(device.deviceDescriptor.iSerialNumber, (error: any, data: any) => {
            if (!error && data) deviceInfo.serialNumber = data.toString();
            if (--pending === 0) finalize();
          });
        }

        if (pending === 0) {
          finalize();
        }

        function finalize() {
          try {
            device.close();
            resolve(deviceInfo);
          } catch (closeError) {
            // Device might be detached already
            resolve(deviceInfo);
          }
        }

      } catch (error) {
        reject(error);
      }
    });
  }

  private generateDeviceSignature(deviceInfo: USBDeviceInfo): string {
    const data = `${deviceInfo.vendorId}:${deviceInfo.productId}:${deviceInfo.location.busNumber}:${deviceInfo.location.deviceAddress}`;
    return createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  private handleUSBError(error: Error, context?: string): void {
    console.error(`USB Daemon error${context ? ` (${context})` : ''}:`, error);
    this.emit('error', error, context);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    try {
      // Initialize libusb
      if (process.platform === 'win32') {
        usb.useUsbDkBackend(); // Windows compatibility
      }
      
      // Scan existing devices
      await this.scanExistingDevices();
      
      this.isRunning = true;
      console.log('USB Daemon started successfully');
      this.emit('started');
    } catch (error) {
      console.error('Failed to start USB daemon:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    this.connectedDevices.clear();
    
    // Cleanup node-usb
    usb.removeAllListeners();
    
    // Close Redis connection
    await this.eventPublisher.close();
    
    console.log('USB Daemon stopped');
    this.emit('stopped');
  }

  private async scanExistingDevices(): Promise<void> {
    const devices = usb.getDeviceList();
    
    for (const device of devices) {
      try {
        await this.handleDeviceAttach(device);
      } catch (error) {
        console.warn('Failed to process existing device:', error);
      }
    }
  }

  getConnectedDevices(): USBDeviceInfo[] {
    return Array.from(this.connectedDevices.values());
  }

  getDeviceBySignature(signature: string): USBDeviceInfo | undefined {
    return this.connectedDevices.get(signature);
  }

  isDeviceConnected(signature: string): boolean {
    return this.connectedDevices.has(signature);
  }

  getStats() {
    return {
      isRunning: this.isRunning,
      connectedDevicesCount: this.connectedDevices.size,
      connectedDevices: this.getConnectedDevices(),
      monitoring: this._monitoringConfig
    };
  }
}