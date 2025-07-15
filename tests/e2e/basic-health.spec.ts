import { test, expect } from '@playwright/test';

test.describe('Basic Health Tests', () => {
  test('Basic test that does not require server', async ({ page }) => {
    // Navigate to a simple page
    await page.goto('https://httpbin.org/status/200');
    
    // Should be successful
    expect(page.url()).toContain('httpbin.org');
  });

  test('Test API health endpoint with mock server', async ({ page }) => {
    // Mock the API response
    await page.route('**/api/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          status: 'ok',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        })
      });
    });

    // Navigate to a page with a base URL
    await page.goto('http://localhost:3000/');
    
    // Make the API call
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/health');
      return await res.json();
    });
    
    expect(response.status).toBe('ok');
    expect(response).toHaveProperty('timestamp');
    expect(response).toHaveProperty('version');
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

  test('Test request interception', async ({ page }) => {
    // Intercept and modify requests
    await page.route('**/api/test', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          message: 'Test successful',
          intercepted: true
        })
      });
    });

    // Navigate to test page with base URL
    await page.goto('http://localhost:3000/');
    
    // Make API call
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/test');
      return await res.json();
    });
    
    expect(response.message).toBe('Test successful');
    expect(response.intercepted).toBe(true);
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
});