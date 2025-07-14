/**
 * USB Daemon Event Debouncer Unit Tests
 * Tests event debouncing logic to prevent duplicate events
 */

import { EventDebouncer } from '../../src/core/event-debouncer';
import { USBDevice } from '../../src/types';

describe('EventDebouncer', () => {
  let debouncer: EventDebouncer;
  const mockDevice: USBDevice = {
    vendorId: 0x1234,
    productId: 0x5678,
    deviceName: 'Test Device',
    manufacturer: 'Test Corp',
    serialNumber: 'SN123456',
    devicePath: '/dev/usb/001',
  };

  beforeEach(() => {
    debouncer = new EventDebouncer({
      windowMs: 100,
      maxEventsPerDevice: 5,
    });
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('shouldProcess', () => {
    it('should allow first event for a device', () => {
      const result = debouncer.shouldProcess('attach', mockDevice);
      expect(result).toBe(true);
    });

    it('should debounce rapid duplicate events', () => {
      // First event should pass
      expect(debouncer.shouldProcess('attach', mockDevice)).toBe(true);
      
      // Immediate duplicate should be debounced
      expect(debouncer.shouldProcess('attach', mockDevice)).toBe(false);
      
      // After debounce window, should allow again
      jest.advanceTimersByTime(101);
      expect(debouncer.shouldProcess('attach', mockDevice)).toBe(true);
    });

    it('should track events per device independently', () => {
      const device2: USBDevice = { ...mockDevice, serialNumber: 'SN789' };
      
      expect(debouncer.shouldProcess('attach', mockDevice)).toBe(true);
      expect(debouncer.shouldProcess('attach', device2)).toBe(true);
      
      // Each device has its own debounce window
      expect(debouncer.shouldProcess('attach', mockDevice)).toBe(false);
      expect(debouncer.shouldProcess('attach', device2)).toBe(false);
    });

    it('should handle different event types separately', () => {
      expect(debouncer.shouldProcess('attach', mockDevice)).toBe(true);
      expect(debouncer.shouldProcess('detach', mockDevice)).toBe(true);
      
      // Same event type should be debounced
      expect(debouncer.shouldProcess('attach', mockDevice)).toBe(false);
      expect(debouncer.shouldProcess('detach', mockDevice)).toBe(false);
    });

    it('should enforce max events per device within window', () => {
      // Allow up to maxEventsPerDevice
      for (let i = 0; i < 5; i++) {
        jest.advanceTimersByTime(10);
        expect(debouncer.shouldProcess('attach', mockDevice)).toBe(true);
      }
      
      // Exceed limit within window
      jest.advanceTimersByTime(10);
      expect(debouncer.shouldProcess('attach', mockDevice)).toBe(false);
      
      // After window expires, allow again
      jest.advanceTimersByTime(100);
      expect(debouncer.shouldProcess('attach', mockDevice)).toBe(true);
    });
  });

  describe('memory management', () => {
    it('should clean up old entries to prevent memory leaks', () => {
      // Add events for multiple devices
      for (let i = 0; i < 100; i++) {
        const device: USBDevice = { ...mockDevice, serialNumber: `SN${i}` };
        debouncer.shouldProcess('attach', device);
      }
      
      // Advance time to trigger cleanup
      jest.advanceTimersByTime(60000); // 1 minute
      
      // Trigger cleanup by processing new event
      debouncer.shouldProcess('attach', mockDevice);
      
      // Internal map should be cleaned
      const stats = debouncer.getStats();
      expect(stats.deviceCount).toBeLessThan(100);
    });

    it('should provide accurate statistics', () => {
      debouncer.shouldProcess('attach', mockDevice);
      debouncer.shouldProcess('attach', mockDevice); // Debounced
      debouncer.shouldProcess('detach', mockDevice);
      
      const stats = debouncer.getStats();
      expect(stats.totalEvents).toBe(3);
      expect(stats.debouncedEvents).toBe(1);
      expect(stats.deviceCount).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle devices without serial numbers', () => {
      const deviceNoSerial = { ...mockDevice, serialNumber: undefined };
      
      expect(debouncer.shouldProcess('attach', deviceNoSerial)).toBe(true);
      expect(debouncer.shouldProcess('attach', deviceNoSerial)).toBe(false);
    });

    it('should handle rapid connect/disconnect cycles', () => {
      // Simulate rapid plug/unplug
      const events = ['attach', 'detach', 'attach', 'detach', 'attach'];
      const results: boolean[] = [];
      
      events.forEach((event, i) => {
        jest.advanceTimersByTime(5);
        results.push(debouncer.shouldProcess(event as any, mockDevice));
      });
      
      // First of each type should pass, rest debounced
      expect(results).toEqual([true, true, false, false, false]);
    });
  });
});