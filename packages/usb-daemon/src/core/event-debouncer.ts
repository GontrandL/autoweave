import { EventEmitter } from 'events';
import { USBDeviceInfo } from '../types';

interface DebouncedEvent {
  deviceInfo: USBDeviceInfo;
  action: 'attach' | 'detach';
  timestamp: number;
  count: number;
}

export class USBEventDebouncer extends EventEmitter {
  private eventQueue = new Map<string, DebouncedEvent>();
  private processingTimer: NodeJS.Timeout | null = null;
  private lastEventTime = 0;
  private eventCount = 0;

  constructor(
    private debounceMs: number = 50,
    private maxEventsPerSecond: number = 100,
    private batchSize: number = 10
  ) {
    super();
  }

  public debounceEvent(action: 'attach' | 'detach', deviceInfo: USBDeviceInfo): void {
    const now = Date.now();
    const signature = deviceInfo.signature;

    // Rate limiting check
    if (now - this.lastEventTime < 1000) {
      this.eventCount++;
      if (this.eventCount > this.maxEventsPerSecond) {
        console.warn(`Rate limit exceeded: ${this.eventCount} events/sec`);
        return;
      }
    } else {
      this.eventCount = 1;
      this.lastEventTime = now;
    }

    // Check for existing event
    const existing = this.eventQueue.get(signature);
    if (existing) {
      // Update event if action changed or increment count
      if (existing.action !== action) {
        existing.action = action;
        existing.timestamp = now;
      }
      existing.count++;
    } else {
      this.eventQueue.set(signature, {
        deviceInfo,
        action,
        timestamp: now,
        count: 1
      });
    }

    // Schedule processing
    this.scheduleProcessing();
  }

  private scheduleProcessing(): void {
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
    }

    this.processingTimer = setTimeout(() => {
      this.processEventQueue();
    }, this.debounceMs);
  }

  private processEventQueue(): void {
    if (this.eventQueue.size === 0) return;

    // Process in batches
    const events = Array.from(this.eventQueue.values());
    const batches = [];

    for (let i = 0; i < events.length; i += this.batchSize) {
      batches.push(events.slice(i, i + this.batchSize));
    }

    // Emit batches
    batches.forEach(batch => {
      this.emit('batch', batch);
    });

    // Clear processed events
    this.eventQueue.clear();
    this.processingTimer = null;
  }

  public forceFlush(): void {
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
      this.processingTimer = null;
    }
    this.processEventQueue();
  }

  public destroy(): void {
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
    }
    this.eventQueue.clear();
    this.removeAllListeners();
  }

  public getStats() {
    return {
      queueSize: this.eventQueue.size,
      eventsPerSecond: this.eventCount,
      pendingProcessing: this.processingTimer !== null
    };
  }
}