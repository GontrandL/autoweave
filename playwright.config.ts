import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results.json' }],
    ['junit', { outputFile: 'test-results.xml' }],
    ['github']
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
  },

  timeout: 30000,
  expect: {
    timeout: 10000,
  },

  projects: [
    {
      name: 'working-tests',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/working-tests.spec.ts',
    },
    {
      name: 'basic-health',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/basic-health.spec.ts',
    },
    {
      name: 'simple-api',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/simple-api.spec.ts',
    },
    {
      name: 'api-tests',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/api/*.spec.ts',
    },
    {
      name: 'workflow-tests',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/workflows/*.spec.ts',
    },
    {
      name: 'admin-ui',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3000' },
      testMatch: '**/frontend/admin-ui.spec.ts',
    },
    {
      name: 'dev-studio',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3001' },
      testMatch: '**/frontend/dev-studio.spec.ts',
    },
    {
      name: 'user-ui',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3002' },
      testMatch: '**/frontend/user-ui.spec.ts',
    },
    {
      name: 'admin-ui-mobile',
      use: { ...devices['iPhone 12'], baseURL: 'http://localhost:3000' },
      testMatch: '**/frontend/admin-ui.spec.ts',
    },
    {
      name: 'dev-studio-mobile',
      use: { ...devices['iPhone 12'], baseURL: 'http://localhost:3001' },
      testMatch: '**/frontend/dev-studio.spec.ts',
    },
    {
      name: 'user-ui-mobile',
      use: { ...devices['iPhone 12'], baseURL: 'http://localhost:3002' },
      testMatch: '**/frontend/user-ui.spec.ts',
    },
  ],

  // webServer: {
  //   command: 'pnpm run build && pnpm start',
  //   port: 3000,
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120000,
  // },
});