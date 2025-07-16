module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  collectCoverageFrom: [
    'packages/*/src/**/*.{ts,tsx}',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/types/**/*',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@autoweave/(.*)$': '<rootDir>/packages/$1/src',
  },
  testTimeout: 30000,
  verbose: true
};