import { AutoWeaveJobManager } from '../src/managers/autoweave-job-manager';
import { createTestJobQueueService } from '../src/utils/factory';

// Global test setup
beforeAll(async () => {
  // Setup test environment
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
});

afterAll(async () => {
  // Cleanup test environment
});

// Helper to create test job manager
export async function createTestJobManager(): Promise<AutoWeaveJobManager> {
  const service = await createTestJobQueueService();
  return service.jobManager;
}

// Helper to cleanup test job manager
export async function cleanupTestJobManager(jobManager: AutoWeaveJobManager): Promise<void> {
  await jobManager.gracefulShutdown();
}

// Mock Redis for testing
export class MockRedis {
  private data = new Map<string, any>();
  
  async set(key: string, value: any): Promise<void> {
    this.data.set(key, value);
  }
  
  async get(key: string): Promise<any> {
    return this.data.get(key);
  }
  
  async del(key: string): Promise<void> {
    this.data.delete(key);
  }
  
  async flushall(): Promise<void> {
    this.data.clear();
  }
  
  async ping(): Promise<string> {
    return 'PONG';
  }
  
  async quit(): Promise<void> {
    // Mock quit
  }
  
  async connect(): Promise<void> {
    // Mock connect
  }
  
  get status(): string {
    return 'ready';
  }
}