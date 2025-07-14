import { test, expect } from '@playwright/test';

test.describe('Admin UI', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses
    await page.route('**/api/health', async (route) => {
      await route.fulfill({
        json: {
          systemHealth: {
            cpu: 65,
            memory: 68,
            disk: 45,
            usbDevices: 12,
            activePlugins: 8,
            queueJobs: 45,
            timestamp: new Date().toISOString(),
          },
        },
      });
    });
  });

  test('Health Dashboard loads and displays metrics', async ({ page }) => {
    await page.goto('/health');

    // Check page title
    await expect(page).toHaveTitle(/AutoWeave Admin Dashboard/);

    // Check main heading
    await expect(page.locator('h2')).toContainText('System Health');

    // Check main metrics cards
    await expect(page.locator('[data-testid="usb-devices-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-plugins-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="queue-jobs-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="memory-usage-card"]')).toBeVisible();

    // Check system metrics chart
    await expect(page.locator('[data-testid="system-metrics-chart"]')).toBeVisible();

    // Check service status
    await expect(page.locator('[data-testid="service-status"]')).toBeVisible();
  });

  test('Plugin Management page functionality', async ({ page }) => {
    await page.goto('/plugins');

    // Check page title
    await expect(page.locator('h2')).toContainText('Plugins');

    // Check install button
    await expect(page.locator('button:has-text("Install Plugin")')).toBeVisible();

    // Check plugin cards are displayed
    await expect(page.locator('[data-testid="plugin-card"]')).toHaveCount(4);

    // Test plugin actions
    const firstPlugin = page.locator('[data-testid="plugin-card"]').first();
    await expect(firstPlugin).toBeVisible();
    
    // Check plugin status badge
    await expect(firstPlugin.locator('[data-testid="plugin-status"]')).toBeVisible();
  });

  test('Navigation works correctly', async ({ page }) => {
    await page.goto('/');

    // Should redirect to /health
    await expect(page).toHaveURL('/health');

    // Test navigation links
    await page.click('a[href="/plugins"]');
    await expect(page).toHaveURL('/plugins');

    await page.click('a[href="/logs"]');
    await expect(page).toHaveURL('/logs');

    await page.click('a[href="/costs"]');
    await expect(page).toHaveURL('/costs');
  });

  test('Responsive design works on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/health');

    // Check that content is still visible on mobile
    await expect(page.locator('h2')).toContainText('System Health');
    
    // Cards should stack vertically on mobile
    const cards = page.locator('[data-testid*="card"]');
    await expect(cards).toHaveCount(4);
  });

  test('Performance metrics meet targets', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/health');
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    // First Contentful Paint should be under 2s
    expect(loadTime).toBeLessThan(2000);
    
    // Check for performance markers
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        firstContentfulPaint: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        largestContentfulPaint: navigation.loadEventEnd - navigation.loadEventStart,
      };
    });
    
    expect(performanceMetrics.firstContentfulPaint).toBeLessThan(2000);
  });
});