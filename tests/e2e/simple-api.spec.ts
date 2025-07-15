import { test, expect } from '@playwright/test';

test.describe('Simple API Health Check', () => {
  const baseURL = 'http://localhost:3000';

  test('API health endpoint is accessible', async ({ page }) => {
    // Navigate to health endpoint
    const response = await page.goto(`${baseURL}/api/health`);
    
    // Should return 200
    expect(response?.status()).toBe(200);
    
    // Should return JSON
    const contentType = response?.headers()['content-type'];
    expect(contentType).toContain('application/json');
  });

  test('API health endpoint returns expected structure', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/health`);
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(data.status).toBe('ok');
  });

  test('API responds within acceptable time', async ({ request }) => {
    const startTime = Date.now();
    const response = await request.get(`${baseURL}/api/health`);
    const endTime = Date.now();
    
    expect(response.status()).toBe(200);
    
    const responseTime = endTime - startTime;
    expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
  });
});