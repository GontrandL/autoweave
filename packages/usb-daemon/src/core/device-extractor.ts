// @ts-ignore
import * as usb from 'usb';
import { USBDeviceInfo } from '../types';
import { createHash } from 'crypto';

interface CachedDeviceInfo {
  info: USBDeviceInfo;
  timestamp: number;
}

export class OptimizedDeviceExtractor {
  private cache = new Map<string, CachedDeviceInfo>();
  private extractionTimeouts = new Map<string, NodeJS.Timeout>();
  private readonly cacheMaxAge = 5 * 60 * 1000; // 5 minutes
  private readonly extractionTimeout = 3000; // 3 seconds

  constructor() {
    // Start periodic cache cleanup
    setInterval(() => this.cleanupCache(), 60000);
  }

  public async extractDeviceInfo(device: usb.Device): Promise<USBDeviceInfo> {
    const cacheKey = this.generateCacheKey(device);
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
      return { ...cached.info };
    }

    // Extract with timeout protection
    return this.extractWithTimeout(device, cacheKey);
  }

  private async extractWithTimeout(device: usb.Device, cacheKey: string): Promise<USBDeviceInfo> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.extractionTimeouts.delete(cacheKey);
        reject(new Error('Device extraction timeout'));
      }, this.extractionTimeout);

      this.extractionTimeouts.set(cacheKey, timeoutId);

      this.performExtraction(device)
        .then(info => {
          clearTimeout(timeoutId);
          this.extractionTimeouts.delete(cacheKey);
          
          // Cache the result
          this.cache.set(cacheKey, {
            info,
            timestamp: Date.now()
          });
          
          resolve(info);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          this.extractionTimeouts.delete(cacheKey);
          reject(error);
        });
    });
  }

  private async performExtraction(device: usb.Device): Promise<USBDeviceInfo> {
    return new Promise((resolve, reject) => {
      try {
        device.open();
        
        const deviceInfo: USBDeviceInfo = {
          vendorId: device.deviceDescriptor.idVendor,
          productId: device.deviceDescriptor.idProduct,
          deviceDescriptor: { ...device.deviceDescriptor },
          location: {
            busNumber: device.busNumber,
            deviceAddress: device.deviceAddress,
            portPath: device.portNumbers ? device.portNumbers.join('.') : '0'
          },
          timestamp: Date.now(),
          signature: ''
        };

        // Parallel string descriptor fetching
        const promises: Promise<void>[] = [];

        if (device.deviceDescriptor.iManufacturer) {
          promises.push(
            this.getStringDescriptorAsync(device, device.deviceDescriptor.iManufacturer)
              .then(data => { deviceInfo.manufacturer = data; })
              .catch(() => { /* Ignore errors */ })
          );
        }

        if (device.deviceDescriptor.iProduct) {
          promises.push(
            this.getStringDescriptorAsync(device, device.deviceDescriptor.iProduct)
              .then(data => { deviceInfo.product = data; })
              .catch(() => { /* Ignore errors */ })
          );
        }

        if (device.deviceDescriptor.iSerialNumber) {
          promises.push(
            this.getStringDescriptorAsync(device, device.deviceDescriptor.iSerialNumber)
              .then(data => { deviceInfo.serialNumber = data; })
              .catch(() => { /* Ignore errors */ })
          );
        }

        Promise.allSettled(promises).then(() => {
          try {
            device.close();
          } catch (closeError) {
            // Device might be detached already
          }
          
          // Generate signature after all info is collected
          deviceInfo.signature = this.generateDeviceSignature(deviceInfo);
          resolve(deviceInfo);
        });

      } catch (error) {
        try {
          device.close();
        } catch (closeError) {
          // Ignore close errors
        }
        reject(error);
      }
    });
  }

  private getStringDescriptorAsync(device: usb.Device, index: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('String descriptor timeout'));
      }, 1000);

      device.getStringDescriptor(index, (error: any, data: any) => {
        clearTimeout(timeout);
        if (error) {
          reject(error);
        } else {
          resolve(data ? data.toString() : '');
        }
      });
    });
  }

  private generateCacheKey(device: usb.Device): string {
    return `${device.deviceDescriptor.idVendor}:${device.deviceDescriptor.idProduct}:${device.busNumber}:${device.deviceAddress}`;
  }

  private generateDeviceSignature(deviceInfo: USBDeviceInfo): string {
    const data = `${deviceInfo.vendorId}:${deviceInfo.productId}:${deviceInfo.location.busNumber}:${deviceInfo.location.deviceAddress}`;
    return createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  private cleanupCache(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    this.cache.forEach((cached, key) => {
      if (now - cached.timestamp > this.cacheMaxAge) {
        toDelete.push(key);
      }
    });

    toDelete.forEach(key => this.cache.delete(key));
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public destroy(): void {
    // Clear all timeouts
    this.extractionTimeouts.forEach(timeout => clearTimeout(timeout));
    this.extractionTimeouts.clear();
    this.cache.clear();
  }

  public getStats() {
    return {
      cacheSize: this.cache.size,
      activeExtractions: this.extractionTimeouts.size
    };
  }
}