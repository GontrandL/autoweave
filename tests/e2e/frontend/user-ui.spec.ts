import { test, expect } from '@playwright/test';

test.describe('User UI', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses for agents
    await page.route('**/api/agents', async (route) => {
      await route.fulfill({
        json: {
          agents: [
            {
              id: '1',
              name: 'Document Scanner',
              status: 'online',
              description: 'Scans and processes documents via USB scanner',
              capabilities: ['USB', 'OCR', 'PDF'],
            },
            {
              id: '2',
              name: 'Code Assistant',
              status: 'online',
              description: 'Helps with programming tasks and code review',
              capabilities: ['Coding', 'Debug', 'Review'],
            },
          ],
        },
      });
    });
  });

  test('Chat Interface loads and displays correctly', async ({ page }) => {
    await page.goto('/');

    // Check page title
    await expect(page).toHaveTitle(/AutoWeave Chat/);

    // Check agent sidebar
    await expect(page.locator('[data-testid="agent-sidebar"]')).toBeVisible();

    // Check chat interface
    await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible();

    // Check chat header
    await expect(page.locator('h1')).toContainText('Chat with Agents');
  });

  test('Agent sidebar displays agents correctly', async ({ page }) => {
    await page.goto('/');

    // Check agents are displayed
    await expect(page.locator('h2')).toContainText('Available Agents');
    
    // Check agent cards
    const agentCards = page.locator('[data-testid="agent-card"]');
    await expect(agentCards).toHaveCount(3);

    // Check first agent details
    const firstAgent = agentCards.first();
    await expect(firstAgent).toContainText('Document Scanner');
    await expect(firstAgent).toContainText('Online');
    await expect(firstAgent).toContainText('USB');
  });

  test('Chat functionality works', async ({ page }) => {
    await page.goto('/');

    // Type a message
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill('Hello, can you help me?');

    // Send message
    await page.click('[data-testid="send-button"]');

    // Check message appears
    await expect(page.locator('[data-testid="message"]')).toContainText(
      'Hello, can you help me?'
    );

    // Wait for agent response
    await expect(page.locator('[data-testid="agent-message"]')).toBeVisible({
      timeout: 5000,
    });
  });

  test('Voice controls are present', async ({ page }) => {
    await page.goto('/');

    // Check voice button exists
    const voiceButton = page.locator('button:has(.lucide-mic)');
    await expect(voiceButton).toBeVisible();

    // Test voice button click
    await voiceButton.click();
    
    // Should toggle to stop recording (destructive variant)
    await expect(voiceButton).toHaveClass(/destructive/);
  });

  test('Keyboard shortcuts work', async ({ page }) => {
    await page.goto('/');

    // Type a message
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill('Test message');

    // Press Enter to send
    await input.press('Enter');

    // Check message was sent
    await expect(page.locator('[data-testid="message"]')).toContainText(
      'Test message'
    );
  });

  test('Message history displays correctly', async ({ page }) => {
    await page.goto('/');

    // Send multiple messages
    const messages = ['First message', 'Second message', 'Third message'];
    
    for (const message of messages) {
      await page.locator('[data-testid="chat-input"]').fill(message);
      await page.click('[data-testid="send-button"]');
      await page.waitForTimeout(100); // Small delay between messages
    }

    // Check all messages are displayed
    for (const message of messages) {
      await expect(page.locator('[data-testid="message"]')).toContainText(message);
    }
  });

  test('Responsive design works on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check that sidebar is still visible on mobile
    await expect(page.locator('[data-testid="agent-sidebar"]')).toBeVisible();

    // Check that chat interface adapts to mobile
    await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible();
    
    // Chat input should be full width on mobile
    const input = page.locator('[data-testid="chat-input"]');
    await expect(input).toBeVisible();
  });

  test('Agent selection works', async ({ page }) => {
    await page.goto('/');

    // Click on an agent
    const firstAgent = page.locator('[data-testid="agent-card"]').first();
    await firstAgent.click();

    // Should highlight the selected agent
    await expect(firstAgent).toHaveClass(/accent/);
  });

  test('Auto-scroll functionality', async ({ page }) => {
    await page.goto('/');

    // Send enough messages to trigger scroll
    for (let i = 0; i < 10; i++) {
      await page.locator('[data-testid="chat-input"]').fill(`Message ${i + 1}`);
      await page.click('[data-testid="send-button"]');
      await page.waitForTimeout(50);
    }

    // Check that the latest message is visible (auto-scrolled)
    await expect(page.locator('[data-testid="message"]').last()).toBeVisible();
  });

  test('Performance metrics meet targets', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    // Should meet performance targets
    expect(loadTime).toBeLessThan(2000);
    
    // Check that initial render is fast
    await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible();
    await expect(page.locator('[data-testid="agent-sidebar"]')).toBeVisible();
  });
});