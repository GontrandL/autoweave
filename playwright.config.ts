import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e/frontend',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results.json' }],
    ['junit', { outputFile: 'test-results.xml' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'admin-ui',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3000' },
      testMatch: '**/admin-ui.spec.ts',
    },
    {
      name: 'dev-studio',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3001' },
      testMatch: '**/dev-studio.spec.ts',
    },
    {
      name: 'user-ui',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3002' },
      testMatch: '**/user-ui.spec.ts',
    },
    {
      name: 'admin-ui-mobile',
      use: { ...devices['iPhone 12'], baseURL: 'http://localhost:3000' },
      testMatch: '**/admin-ui.spec.ts',
    },
    {
      name: 'dev-studio-mobile',
      use: { ...devices['iPhone 12'], baseURL: 'http://localhost:3001' },
      testMatch: '**/dev-studio.spec.ts',
    },
    {
      name: 'user-ui-mobile',
      use: { ...devices['iPhone 12'], baseURL: 'http://localhost:3002' },
      testMatch: '**/user-ui.spec.ts',
    },
  ],

  webServer: [
    {
      command: 'pnpm start:admin',
      port: 3000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm start:studio',
      port: 3001,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm start:user',
      port: 3002,
      reuseExistingServer: !process.env.CI,
    },
  ],
});