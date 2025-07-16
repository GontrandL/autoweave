/**
 * Unit Test Setup
 * Configuration for isolated unit tests
 */

// Mock external dependencies for unit tests
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    xAdd: jest.fn().mockResolvedValue('1234567890-0'),
    xRead: jest.fn().mockResolvedValue([]),
    multi: jest.fn(() => ({
      xAdd: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    })),
    isReady: true,
    on: jest.fn(),
    once: jest.fn(),
    off: jest.fn(),
  })),
}));

jest.mock('usb', () => ({
  on: jest.fn(),
  getDeviceList: jest.fn(() => []),
  findBySerialNumber: jest.fn(),
  findByIds: jest.fn(),
}));

jest.mock('chokidar', () => ({
  watch: jest.fn(() => ({
    on: jest.fn(),
    close: jest.fn(),
    add: jest.fn(),
    unwatch: jest.fn(),
  })),
}));

// Mock worker_threads for unit tests
jest.mock('worker_threads', () => ({
  Worker: jest.fn().mockImplementation(() => ({
    postMessage: jest.fn(),
    terminate: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    once: jest.fn(),
    off: jest.fn(),
    threadId: Math.random(),
  })),
  isMainThread: true,
  parentPort: null,
  workerData: {},
}));

// Mock filesystem operations
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  rm: jest.fn(),
  access: jest.fn(),
  stat: jest.fn(),
  readdir: jest.fn(),
}));

// Set fast timeouts for unit tests
jest.setTimeout(10000); // 10 seconds max for unit tests

// Before each unit test
beforeEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Reset module registry to ensure clean state
  jest.resetModules();
});

export {};