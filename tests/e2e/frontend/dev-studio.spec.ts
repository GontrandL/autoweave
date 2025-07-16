import { test, expect } from '@playwright/test';

test.describe('Dev Studio', () => {
  test.beforeEach(async ({ page }) => {
    // Mock WebSocket connection
    await page.addInitScript(() => {
      class MockWebSocket {
        constructor(url: string) {
          setTimeout(() => {
            this.onopen?.();
          }, 100);
        }
        onopen: (() => void) | null = null;
        onmessage: ((event: any) => void) | null = null;
        onclose: (() => void) | null = null;
        onerror: ((error: any) => void) | null = null;
        close() {}
      }
      (window as any).WebSocket = MockWebSocket;
    });
  });

  test('Flow Builder loads and displays canvas', async ({ page }) => {
    await page.goto('/builder');

    // Check page title
    await expect(page).toHaveTitle(/AutoWeave Dev Studio/);

    // Check React Flow canvas
    await expect(page.locator('.react-flow')).toBeVisible();

    // Check node toolbox
    await expect(page.locator('[data-testid="node-toolbox"]')).toBeVisible();

    // Check initial nodes are present
    await expect(page.locator('.react-flow__node')).toHaveCount(3);
  });

  test('Node toolbox functionality', async ({ page }) => {
    await page.goto('/builder');

    // Check all node types are available
    await expect(page.locator('[data-testid="llm-node-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="usb-node-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="output-node-button"]')).toBeVisible();

    // Add a new node
    await page.click('[data-testid="llm-node-button"]');
    
    // Verify node was added (should now have 4 nodes)
    await expect(page.locator('.react-flow__node')).toHaveCount(4);
  });

  test('Flow controls are functional', async ({ page }) => {
    await page.goto('/builder');

    // Check flow controls are visible
    await expect(page.locator('button:has-text("Run Flow")')).toBeVisible();
    await expect(page.locator('button:has-text("Save Flow")')).toBeVisible();
    await expect(page.locator('button:has-text("Export")')).toBeVisible();
    await expect(page.locator('button:has-text("Import")')).toBeVisible();

    // Test run flow button
    await page.click('button:has-text("Run Flow")');
    // Should not crash or throw errors
  });

  test('Node selection shows properties', async ({ page }) => {
    await page.goto('/builder');

    // Click on a node
    await page.click('.react-flow__node:first-child');

    // Check if properties panel appears
    await expect(page.locator('text=Node Properties')).toBeVisible();
    await expect(page.locator('text=Node ID')).toBeVisible();
    await expect(page.locator('text=Node Type')).toBeVisible();
  });

  test('Log Stream functionality', async ({ page }) => {
    await page.goto('/logs');

    // Check page title
    await expect(page.locator('h2')).toContainText('System Logs');

    // Check log stream container
    await expect(page.locator('h3')).toContainText('Live Logs');

    // Check connection status indicator
    await expect(page.locator('text=connected')).toBeVisible();
  });

  test('Navigation works correctly', async ({ page }) => {
    await page.goto('/');

    // Should redirect to /builder
    await expect(page).toHaveURL('/builder');

    // Test navigation links
    await page.click('a[href="/flows"]');
    await expect(page).toHaveURL('/flows');

    await page.click('a[href="/logs"]');
    await expect(page).toHaveURL('/logs');

    await page.click('a[href="/builder"]');
    await expect(page).toHaveURL('/builder');
  });

  test('Canvas interactions work properly', async ({ page }) => {
    await page.goto('/builder');

    // Test canvas panning
    const canvas = page.locator('.react-flow__pane');
    await canvas.click({ position: { x: 100, y: 100 } });
    
    // Test minimap interaction
    await expect(page.locator('.react-flow__minimap')).toBeVisible();
    
    // Test controls
    await expect(page.locator('.react-flow__controls')).toBeVisible();
  });

  test('Performance - React Flow renders efficiently', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/builder');
    
    // Wait for React Flow to be fully rendered
    await page.waitForSelector('.react-flow__node', { state: 'visible' });
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Should load within performance targets
    expect(loadTime).toBeLessThan(3000);
  });
});