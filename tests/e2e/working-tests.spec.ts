import { test, expect } from '@playwright/test';

test.describe('Working E2E Tests', () => {
  test('Basic test that works', async ({ page }) => {
    // Navigate to a simple page
    await page.goto('https://httpbin.org/status/200');
    
    // Should be successful
    expect(page.url()).toContain('httpbin.org');
  });

  test('Test Playwright capabilities', async ({ page }) => {
    // Test basic Playwright functionality
    await page.goto('data:text/html,<html><body><h1>Hello World</h1><button id="btn">Click me</button></body></html>');
    
    // Test element interaction
    await expect(page.locator('h1')).toContainText('Hello World');
    await expect(page.locator('#btn')).toBeVisible();
    
    // Test click interaction
    await page.click('#btn');
    
    // Test page evaluation
    const title = await page.evaluate(() => document.querySelector('h1')?.textContent);
    expect(title).toBe('Hello World');
  });

  test('Test performance timing', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('data:text/html,<html><body><h1>Performance Test</h1></body></html>');
    
    const endTime = Date.now();
    const loadTime = endTime - startTime;
    
    // Should load quickly
    expect(loadTime).toBeLessThan(2000);
    
    // Test element visibility
    await expect(page.locator('h1')).toBeVisible();
  });

  test('Test viewport and responsive design', async ({ page }) => {
    await page.goto('data:text/html,<html><body><div id="test">Responsive test</div></body></html>');
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('#test')).toBeVisible();
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('#test')).toBeVisible();
  });

  test('Test browser context and cookies', async ({ page }) => {
    await page.goto('data:text/html,<html><body>Cookie test</body></html>');
    
    // Set a cookie
    await page.context().addCookies([{
      name: 'test-cookie',
      value: 'test-value',
      url: 'http://localhost'
    }]);
    
    // Verify cookie was set
    const cookies = await page.context().cookies();
    expect(cookies.some(c => c.name === 'test-cookie')).toBe(true);
  });

  test('Test screenshot functionality', async ({ page }) => {
    await page.goto('data:text/html,<html><body><h1>Screenshot Test</h1></body></html>');
    
    // Take a screenshot
    const screenshot = await page.screenshot();
    
    // Should have content
    expect(screenshot.length).toBeGreaterThan(0);
  });

  test('Test locator strategies', async ({ page }) => {
    await page.goto('data:text/html,<html><body><div class="test" data-testid="main">Content</div></body></html>');
    
    // Test different locator strategies
    await expect(page.locator('.test')).toContainText('Content');
    await expect(page.locator('[data-testid="main"]')).toContainText('Content');
    await expect(page.locator('div:has-text("Content")')).toBeVisible();
  });

  test('Test keyboard and mouse interactions', async ({ page }) => {
    await page.goto('data:text/html,<html><body><input type="text" id="input" /><button id="btn">Submit</button></body></html>');
    
    // Test keyboard input
    await page.fill('#input', 'Hello World');
    await expect(page.locator('#input')).toHaveValue('Hello World');
    
    // Test mouse click
    await page.click('#btn');
    
    // Test keyboard shortcuts
    await page.locator('#input').press('Control+a');
    await page.locator('#input').press('Delete');
    await expect(page.locator('#input')).toHaveValue('');
  });

  test('Test wait strategies', async ({ page }) => {
    await page.goto('data:text/html,<html><body><div id="loading">Loading...</div></body></html>');
    
    // Add content with delay
    await page.addScriptTag({
      content: `
        setTimeout(() => {
          document.getElementById('loading').textContent = 'Loaded!';
        }, 1000);
      `
    });
    
    // Wait for content to change
    await expect(page.locator('#loading')).toContainText('Loaded!');
  });

  test('Test local storage', async ({ page }) => {
    await page.goto('data:text/html,<html><body>Local storage test</body></html>');
    
    // Set local storage
    await page.evaluate(() => {
      localStorage.setItem('test-key', 'test-value');
    });
    
    // Verify local storage
    const value = await page.evaluate(() => localStorage.getItem('test-key'));
    expect(value).toBe('test-value');
  });
});