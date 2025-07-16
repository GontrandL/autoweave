/**
 * Jest Configuration for Sprint 1 Tests
 * Optimized for USB daemon and plugin loader testing
 */

module.exports = {
  // Extend base configuration
  ...require('./jest.config.js'),
  
  // Sprint 1 specific settings
  displayName: 'Sprint 1 Tests',
  testTimeout: 30000,
  
  // Test patterns for Sprint 1
  testMatch: [
    '<rootDir>/packages/usb-daemon/tests/**/*.test.ts',
    '<rootDir>/packages/plugin-loader/tests/**/*.test.ts',
    '<rootDir>/tests/integration/sprint1-*.test.ts',
  ],
  
  // Coverage settings for Sprint 1 components
  collectCoverageFrom: [
    'packages/usb-daemon/src/**/*.{ts,js}',
    'packages/plugin-loader/src/**/*.{ts,js}',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/types/**/*',
    '!packages/*/src/**/*.test.ts',
    '!packages/*/dist/**/*',
  ],
  
  // Higher coverage thresholds for Sprint 1
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    'packages/usb-daemon/src/**/*.ts': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    'packages/plugin-loader/src/**/*.ts': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  
  // Custom setup for Sprint 1 tests
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.ts',
    '<rootDir>/tests/setup-sprint1.ts',
  ],
  
  // Test environment variables
  setupFiles: ['<rootDir>/tests/env-setup.js'],
  
  // Module name mapping for Sprint 1 packages
  moduleNameMapper: {
    '^@autoweave/usb-daemon$': '<rootDir>/packages/usb-daemon/src',
    '^@autoweave/plugin-loader$': '<rootDir>/packages/plugin-loader/src',
    '^@autoweave/(.*)$': '<rootDir>/packages/$1/src',
  },
  
  // Transform settings
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        compilerOptions: {
          // Optimize for test performance
          incremental: false,
          declaration: false,
          declarationMap: false,
          sourceMap: false,
        },
      },
    }],
  },
  
  // Test environment
  testEnvironment: 'node',
  
  // Performance optimizations
  maxWorkers: '50%',
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  
  // Reporting
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-reports',
      outputName: 'sprint1-junit.xml',
      suiteName: 'Sprint 1 Tests',
    }],
    ['jest-html-reporters', {
      publicPath: 'test-reports',
      filename: 'sprint1-report.html',
      expand: true,
      hideIcon: false,
    }],
  ],
  
  // Global teardown for integration tests
  globalTeardown: '<rootDir>/tests/global-teardown.js',
  
  // Test sequencing for resource-intensive tests
  testSequencer: '<rootDir>/tests/sprint1-sequencer.js',
  
  // Verbose output for debugging
  verbose: process.env.JEST_VERBOSE === 'true',
  
  // Detect open handles for debugging
  detectOpenHandles: true,
  forceExit: true,
  
  // Memory limits for performance tests
  workerIdleMemoryLimit: '1GB',
  
  // Test categorization with projects
  projects: [
    {
      displayName: 'USB Daemon Unit',
      testMatch: ['<rootDir>/packages/usb-daemon/tests/unit/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup-unit.ts'],
    },
    {
      displayName: 'USB Daemon Integration',
      testMatch: ['<rootDir>/packages/usb-daemon/tests/integration/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup-integration.ts'],
      testTimeout: 60000,
    },
    {
      displayName: 'USB Daemon Performance',
      testMatch: ['<rootDir>/packages/usb-daemon/tests/performance/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup-performance.ts'],
      testTimeout: 300000, // 5 minutes for performance tests
    },
    {
      displayName: 'Plugin Loader Unit',
      testMatch: ['<rootDir>/packages/plugin-loader/tests/unit/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup-unit.ts'],
    },
    {
      displayName: 'Plugin Loader Integration',
      testMatch: ['<rootDir>/packages/plugin-loader/tests/integration/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup-integration.ts'],
      testTimeout: 60000,
    },
    {
      displayName: 'Plugin Loader Security',
      testMatch: ['<rootDir>/packages/plugin-loader/tests/security/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup-security.ts'],
      testTimeout: 120000, // 2 minutes for security tests
    },
    {
      displayName: 'Plugin Loader Performance',
      testMatch: ['<rootDir>/packages/plugin-loader/tests/performance/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup-performance.ts'],
      testTimeout: 300000, // 5 minutes for performance tests
    },
    {
      displayName: 'End-to-End',
      testMatch: ['<rootDir>/tests/integration/sprint1-*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup-e2e.ts'],
      testTimeout: 120000, // 2 minutes for E2E tests
    },
  ],
};