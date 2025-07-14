/**
 * USB Device Information Extractor Unit Tests
 * Tests device data extraction with timeout handling
 */

import { DeviceExtractor } from '../../src/core/device-extractor';
import { Device } from 'usb';

// Mock the usb module
jest.mock('usb');

describe('DeviceExtractor', () => {
  let extractor: DeviceExtractor;
  let mockDevice: jest.Mocked<Device>;

  beforeEach(() => {
    extractor = new DeviceExtractor({
      extractionTimeout: 1000,
      maxRetries: 3,
      retryDelay: 100,
    });

    // Create mock USB device
    mockDevice = {
      deviceDescriptor: {
        idVendor: 0x1234,
        idProduct: 0x5678,
        iManufacturer: 1,
        iProduct: 2,
        iSerialNumber: 3,
      },
      open: jest.fn(),
      close: jest.fn(),
      getStringDescriptor: jest.fn(),
    } as any;
  });

  describe('extractDeviceInfo', () => {
    it('should extract device info successfully', async () => {
      mockDevice.getStringDescriptor
        .mockImplementationOnce((index, cb) => cb(null, 'Test Manufacturer'))
        .mockImplementationOnce((index, cb) => cb(null, 'Test Product'))
        .mockImplementationOnce((index, cb) => cb(null, 'SN123456'));

      const info = await extractor.extractDeviceInfo(mockDevice);

      expect(info).toEqual({
        vendorId: 0x1234,
        productId: 0x5678,
        manufacturer: 'Test Manufacturer',
        deviceName: 'Test Product',
        serialNumber: 'SN123456',
        devicePath: expect.any(String),
      });

      expect(mockDevice.open).toHaveBeenCalledTimes(1);
      expect(mockDevice.close).toHaveBeenCalledTimes(1);
    });

    it('should handle timeout during extraction', async () => {
      mockDevice.getStringDescriptor.mockImplementation((index, cb) => {
        // Never call callback to simulate timeout
      });

      await expect(extractor.extractDeviceInfo(mockDevice)).rejects.toThrow('extraction timeout');
    });

    it('should retry on transient failures', async () => {
      let attempts = 0;
      mockDevice.getStringDescriptor.mockImplementation((index, cb) => {
        attempts++;
        if (attempts < 3) {
          cb(new Error('Device busy'), null);
        } else {
          cb(null, 'Success');
        }
      });

      const info = await extractor.extractDeviceInfo(mockDevice);

      expect(info.manufacturer).toBe('Success');
      expect(mockDevice.open).toHaveBeenCalledTimes(3);
    });

    it('should handle devices that cannot be opened', async () => {
      mockDevice.open.mockImplementation(() => {
        throw new Error('Access denied');
      });

      const info = await extractor.extractDeviceInfo(mockDevice);

      expect(info.manufacturer).toBe('Unknown');
      expect(info.deviceName).toBe('Unknown Device');
      expect(info.serialNumber).toContain('auto-generated-');
    });

    it('should handle missing string descriptors gracefully', async () => {
      mockDevice.getStringDescriptor.mockImplementation((index, cb) => {
        cb(new Error('No descriptor'), null);
      });

      const info = await extractor.extractDeviceInfo(mockDevice);

      expect(info.manufacturer).toBe('Unknown');
      expect(info.deviceName).toBe('Unknown Device');
      expect(info.serialNumber).toContain('auto-generated-');
    });

    it('should close device even on error', async () => {
      mockDevice.getStringDescriptor.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await expect(extractor.extractDeviceInfo(mockDevice)).rejects.toThrow();
      expect(mockDevice.close).toHaveBeenCalled();
    });
  });

  describe('platform-specific behavior', () => {
    it('should handle Windows-specific device paths', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true,
      });

      mockDevice.getStringDescriptor
        .mockImplementationOnce((index, cb) => cb(null, 'Vendor'))
        .mockImplementationOnce((index, cb) => cb(null, 'Product'))
        .mockImplementationOnce((index, cb) => cb(null, 'Serial'));

      const info = await extractor.extractDeviceInfo(mockDevice);
      expect(info.devicePath).toMatch(/\\\\Device\\\\/);

      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true,
      });
    });

    it('should handle Linux-specific device paths', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true,
      });

      mockDevice.getStringDescriptor
        .mockImplementationOnce((index, cb) => cb(null, 'Vendor'))
        .mockImplementationOnce((index, cb) => cb(null, 'Product'))
        .mockImplementationOnce((index, cb) => cb(null, 'Serial'));

      const info = await extractor.extractDeviceInfo(mockDevice);
      expect(info.devicePath).toMatch(/\/dev\/bus\/usb\//);

      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true,
      });
    });
  });

  describe('performance', () => {
    it('should cache device info for rapid re-queries', async () => {
      mockDevice.getStringDescriptor
        .mockImplementationOnce((index, cb) => cb(null, 'Vendor'))
        .mockImplementationOnce((index, cb) => cb(null, 'Product'))
        .mockImplementationOnce((index, cb) => cb(null, 'Serial'));

      // First extraction
      const info1 = await extractor.extractDeviceInfo(mockDevice);
      
      // Second extraction should use cache
      const info2 = await extractor.extractDeviceInfo(mockDevice);
      
      expect(info1).toEqual(info2);
      expect(mockDevice.open).toHaveBeenCalledTimes(1); // Only opened once
    });

    it('should respect cache TTL', async () => {
      jest.useFakeTimers();
      
      mockDevice.getStringDescriptor
        .mockImplementation((index, cb) => cb(null, `Value-${Date.now()}`));

      const info1 = await extractor.extractDeviceInfo(mockDevice);
      
      // Advance time past cache TTL
      jest.advanceTimersByTime(61000); // 61 seconds
      
      const info2 = await extractor.extractDeviceInfo(mockDevice);
      
      expect(info1.manufacturer).not.toEqual(info2.manufacturer);
      
      jest.useRealTimers();
    });
  });
});