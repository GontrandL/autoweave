import { test, expect } from '@playwright/test';

test.describe('Agent Creation Workflow E2E', () => {
  const baseURL = process.env.API_BASE_URL || 'http://localhost:3000';
  
  test.beforeEach(async ({ page }) => {
    // Navigate to agent creation page
    await page.goto(`${baseURL}/create-agent`);
  });

  test('Complete agent creation workflow - Natural language to deployment', async ({ page }) => {
    // Step 1: Natural language description
    await page.fill('[data-testid="agent-description"]', 
      'Create an agent that monitors system logs and alerts when errors occur. It should scan log files every 5 minutes and send notifications via email when critical errors are found.'
    );

    // Step 2: Click generate workflow
    await page.click('[data-testid="generate-workflow"]');

    // Wait for workflow generation
    await page.waitForSelector('[data-testid="workflow-preview"]', { state: 'visible' });

    // Step 3: Verify workflow was generated
    const workflowSteps = page.locator('[data-testid="workflow-step"]');
    await expect(workflowSteps).toHaveCount(4); // Expected steps: input, monitor, analyze, alert

    // Check step types
    await expect(workflowSteps.nth(0)).toContainText('Input');
    await expect(workflowSteps.nth(1)).toContainText('Monitor');
    await expect(workflowSteps.nth(2)).toContainText('Analyze');
    await expect(workflowSteps.nth(3)).toContainText('Alert');

    // Step 4: Customize workflow (optional)
    await page.click('[data-testid="edit-step-2"]');
    await page.fill('[data-testid="step-config-interval"]', '300000'); // 5 minutes
    await page.click('[data-testid="save-step"]');

    // Step 5: Configure agent metadata
    await page.fill('[data-testid="agent-name"]', 'Log Monitor Agent');
    await page.selectOption('[data-testid="agent-priority"]', 'high');
    await page.check('[data-testid="agent-persistent"]');

    // Step 6: Resource configuration
    await page.fill('[data-testid="resource-memory"]', '512Mi');
    await page.fill('[data-testid="resource-cpu"]', '200m');

    // Step 7: Environment variables
    await page.click('[data-testid="add-env-var"]');
    await page.fill('[data-testid="env-key-0"]', 'LOG_LEVEL');
    await page.fill('[data-testid="env-value-0"]', 'info');

    // Step 8: Capabilities selection
    await page.check('[data-testid="capability-file-system"]');
    await page.check('[data-testid="capability-email"]');
    await page.check('[data-testid="capability-scheduling"]');

    // Step 9: Review and validate
    await page.click('[data-testid="review-agent"]');
    
    // Wait for validation
    await page.waitForSelector('[data-testid="validation-results"]', { state: 'visible' });
    
    // Check validation passed
    await expect(page.locator('[data-testid="validation-status"]')).toContainText('Valid');

    // Step 10: Deploy agent
    await page.click('[data-testid="deploy-agent"]');

    // Wait for deployment
    await page.waitForSelector('[data-testid="deployment-status"]', { state: 'visible' });

    // Step 11: Verify deployment success
    await expect(page.locator('[data-testid="deployment-status"]')).toContainText('Deployed');
    
    // Check for deployment ID
    await expect(page.locator('[data-testid="deployment-id"]')).toBeVisible();

    // Step 12: Navigate to agent dashboard
    await page.click('[data-testid="view-agent"]');
    
    // Verify we're on the agent detail page
    await expect(page).toHaveURL(/\/agents\/[a-zA-Z0-9-]+$/);
    await expect(page.locator('h1')).toContainText('Log Monitor Agent');
  });

  test('Agent creation with custom workflow', async ({ page }) => {
    // Navigate to custom workflow builder
    await page.click('[data-testid="custom-workflow"]');

    // Add workflow steps manually
    await page.click('[data-testid="add-step"]');
    await page.selectOption('[data-testid="step-type"]', 'input');
    await page.fill('[data-testid="step-name"]', 'user_request');
    await page.click('[data-testid="save-step"]');

    await page.click('[data-testid="add-step"]');
    await page.selectOption('[data-testid="step-type"]', 'llm');
    await page.fill('[data-testid="step-name"]', 'process_request');
    await page.selectOption('[data-testid="llm-model"]', 'gpt-4');
    await page.click('[data-testid="save-step"]');

    await page.click('[data-testid="add-step"]');
    await page.selectOption('[data-testid="step-type"]', 'api');
    await page.fill('[data-testid="step-name"]', 'external_call');
    await page.fill('[data-testid="api-endpoint"]', 'https://api.example.com/process');
    await page.click('[data-testid="save-step"]');

    await page.click('[data-testid="add-step"]');
    await page.selectOption('[data-testid="step-type"]', 'output');
    await page.fill('[data-testid="step-name"]', 'return_result');
    await page.click('[data-testid="save-step"]');

    // Connect workflow steps
    await page.dragAndDrop('[data-testid="step-user_request-output"]', '[data-testid="step-process_request-input"]');
    await page.dragAndDrop('[data-testid="step-process_request-output"]', '[data-testid="step-external_call-input"]');
    await page.dragAndDrop('[data-testid="step-external_call-output"]', '[data-testid="step-return_result-input"]');

    // Test workflow
    await page.click('[data-testid="test-workflow"]');
    
    // Provide test input
    await page.fill('[data-testid="test-input"]', 'Test input for custom workflow');
    await page.click('[data-testid="run-test"]');

    // Wait for test results
    await page.waitForSelector('[data-testid="test-results"]', { state: 'visible' });
    
    // Verify test passed
    await expect(page.locator('[data-testid="test-status"]')).toContainText('Passed');

    // Save and deploy
    await page.fill('[data-testid="agent-name"]', 'Custom Workflow Agent');
    await page.click('[data-testid="deploy-agent"]');

    // Verify deployment
    await page.waitForSelector('[data-testid="deployment-status"]', { state: 'visible' });
    await expect(page.locator('[data-testid="deployment-status"]')).toContainText('Deployed');
  });

  test('Agent creation with integrations', async ({ page }) => {
    // Start with integration template
    await page.click('[data-testid="integration-template"]');
    
    // Select integration type
    await page.selectOption('[data-testid="integration-type"]', 'openapi');
    
    // Upload OpenAPI spec
    await page.setInputFiles('[data-testid="openapi-file"]', 'tests/fixtures/sample-openapi.yaml');
    
    // Wait for spec analysis
    await page.waitForSelector('[data-testid="spec-analysis"]', { state: 'visible' });
    
    // Select operations to include
    await page.check('[data-testid="operation-get-users"]');
    await page.check('[data-testid="operation-create-user"]');
    await page.check('[data-testid="operation-update-user"]');
    
    // Configure authentication
    await page.selectOption('[data-testid="auth-type"]', 'bearer');
    await page.fill('[data-testid="auth-token"]', 'test-token-placeholder');
    
    // Generate integration agent
    await page.click('[data-testid="generate-integration"]');
    
    // Wait for generation
    await page.waitForSelector('[data-testid="integration-workflow"]', { state: 'visible' });
    
    // Verify workflow includes operations
    const operations = page.locator('[data-testid="workflow-operation"]');
    await expect(operations).toHaveCount(3);
    
    // Test integration
    await page.click('[data-testid="test-integration"]');
    
    // Select test operation
    await page.selectOption('[data-testid="test-operation"]', 'get-users');
    await page.click('[data-testid="run-integration-test"]');
    
    // Wait for test results
    await page.waitForSelector('[data-testid="integration-test-results"]', { state: 'visible' });
    
    // Deploy integration agent
    await page.fill('[data-testid="agent-name"]', 'API Integration Agent');
    await page.click('[data-testid="deploy-agent"]');
    
    // Verify deployment
    await page.waitForSelector('[data-testid="deployment-status"]', { state: 'visible' });
    await expect(page.locator('[data-testid="deployment-status"]')).toContainText('Deployed');
  });

  test('Agent creation error handling', async ({ page }) => {
    // Test empty description
    await page.click('[data-testid="generate-workflow"]');
    
    // Should show error
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Description is required');
    
    // Test invalid configuration
    await page.fill('[data-testid="agent-description"]', 'Test agent');
    await page.click('[data-testid="generate-workflow"]');
    
    // Wait for workflow generation
    await page.waitForSelector('[data-testid="workflow-preview"]', { state: 'visible' });
    
    // Enter invalid resource limits
    await page.fill('[data-testid="resource-memory"]', 'invalid');
    await page.fill('[data-testid="resource-cpu"]', 'invalid');
    
    // Try to deploy
    await page.click('[data-testid="deploy-agent"]');
    
    // Should show validation errors
    await expect(page.locator('[data-testid="validation-errors"]')).toBeVisible();
    await expect(page.locator('[data-testid="validation-errors"]')).toContainText('Invalid memory format');
    await expect(page.locator('[data-testid="validation-errors"]')).toContainText('Invalid CPU format');
  });

  test('Agent creation with monitoring and observability', async ({ page }) => {
    // Create agent with monitoring enabled
    await page.fill('[data-testid="agent-description"]', 
      'Create a data processing agent that transforms CSV files to JSON format'
    );
    
    await page.click('[data-testid="generate-workflow"]');
    await page.waitForSelector('[data-testid="workflow-preview"]', { state: 'visible' });
    
    // Enable monitoring
    await page.check('[data-testid="enable-monitoring"]');
    await page.check('[data-testid="enable-logging"]');
    await page.check('[data-testid="enable-tracing"]');
    
    // Configure monitoring
    await page.selectOption('[data-testid="log-level"]', 'debug');
    await page.fill('[data-testid="metrics-interval"]', '30');
    
    // Enable health checks
    await page.check('[data-testid="enable-health-checks"]');
    await page.fill('[data-testid="health-check-path"]', '/health');
    await page.fill('[data-testid="health-check-interval"]', '10');
    
    // Configure alerts
    await page.click('[data-testid="add-alert"]');
    await page.selectOption('[data-testid="alert-type"]', 'error-rate');
    await page.fill('[data-testid="alert-threshold"]', '5');
    await page.fill('[data-testid="alert-email"]', 'admin@example.com');
    
    // Deploy with monitoring
    await page.fill('[data-testid="agent-name"]', 'Monitored Processing Agent');
    await page.click('[data-testid="deploy-agent"]');
    
    // Wait for deployment
    await page.waitForSelector('[data-testid="deployment-status"]', { state: 'visible' });
    await expect(page.locator('[data-testid="deployment-status"]')).toContainText('Deployed');
    
    // Verify monitoring endpoints
    await page.click('[data-testid="view-monitoring"]');
    
    // Check monitoring dashboard
    await expect(page.locator('[data-testid="metrics-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="log-stream"]')).toBeVisible();
    await expect(page.locator('[data-testid="health-status"]')).toBeVisible();
  });

  test('Agent creation with scaling configuration', async ({ page }) => {
    // Create scalable agent
    await page.fill('[data-testid="agent-description"]', 
      'Create a web scraping agent that processes multiple URLs concurrently'
    );
    
    await page.click('[data-testid="generate-workflow"]');
    await page.waitForSelector('[data-testid="workflow-preview"]', { state: 'visible' });
    
    // Configure scaling
    await page.check('[data-testid="enable-scaling"]');
    await page.fill('[data-testid="min-replicas"]', '2');
    await page.fill('[data-testid="max-replicas"]', '10');
    
    // Configure scaling metrics
    await page.selectOption('[data-testid="scaling-metric"]', 'cpu');
    await page.fill('[data-testid="scaling-threshold"]', '70');
    
    // Configure resource requests and limits
    await page.fill('[data-testid="resource-memory-request"]', '256Mi');
    await page.fill('[data-testid="resource-memory-limit"]', '512Mi');
    await page.fill('[data-testid="resource-cpu-request"]', '100m');
    await page.fill('[data-testid="resource-cpu-limit"]', '500m');
    
    // Deploy scalable agent
    await page.fill('[data-testid="agent-name"]', 'Scalable Scraping Agent');
    await page.click('[data-testid="deploy-agent"]');
    
    // Wait for deployment
    await page.waitForSelector('[data-testid="deployment-status"]', { state: 'visible' });
    await expect(page.locator('[data-testid="deployment-status"]')).toContainText('Deployed');
    
    // Verify scaling configuration
    await page.click('[data-testid="view-scaling"]');
    
    // Check scaling dashboard
    await expect(page.locator('[data-testid="scaling-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="replica-count"]')).toContainText('2'); // Min replicas
  });

  test('Agent creation with security configuration', async ({ page }) => {
    // Create agent with security settings
    await page.fill('[data-testid="agent-description"]', 
      'Create a secure file processing agent that handles sensitive documents'
    );
    
    await page.click('[data-testid="generate-workflow"]');
    await page.waitForSelector('[data-testid="workflow-preview"]', { state: 'visible' });
    
    // Configure security
    await page.check('[data-testid="enable-security"]');
    await page.selectOption('[data-testid="security-context"]', 'restricted');
    await page.check('[data-testid="read-only-filesystem"]');
    await page.check('[data-testid="non-root-user"]');
    
    // Configure network policies
    await page.check('[data-testid="network-isolation"]');
    await page.click('[data-testid="add-allowed-endpoint"]');
    await page.fill('[data-testid="endpoint-url"]', 'https://api.secure-service.com');
    
    // Configure secrets
    await page.click('[data-testid="add-secret"]');
    await page.fill('[data-testid="secret-name"]', 'processing-key');
    await page.fill('[data-testid="secret-key"]', 'API_KEY');
    
    // Configure RBAC
    await page.check('[data-testid="custom-rbac"]');
    await page.check('[data-testid="rbac-read-secrets"]');
    await page.check('[data-testid="rbac-write-configmaps"]');
    
    // Deploy secure agent
    await page.fill('[data-testid="agent-name"]', 'Secure Processing Agent');
    await page.click('[data-testid="deploy-agent"]');
    
    // Wait for deployment
    await page.waitForSelector('[data-testid="deployment-status"]', { state: 'visible' });
    await expect(page.locator('[data-testid="deployment-status"]')).toContainText('Deployed');
    
    // Verify security configuration
    await page.click('[data-testid="view-security"]');
    
    // Check security dashboard
    await expect(page.locator('[data-testid="security-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="rbac-status"]')).toContainText('Active');
  });

  test('Agent creation performance and optimization', async ({ page }) => {
    // Test page load performance
    const startTime = Date.now();
    await page.goto(`${baseURL}/create-agent`);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    // Should load within performance targets
    expect(loadTime).toBeLessThan(3000);
    
    // Test workflow generation performance
    await page.fill('[data-testid="agent-description"]', 
      'Create a high-performance data analytics agent'
    );
    
    const generateStart = Date.now();
    await page.click('[data-testid="generate-workflow"]');
    await page.waitForSelector('[data-testid="workflow-preview"]', { state: 'visible' });
    const generateTime = Date.now() - generateStart;
    
    // Workflow generation should be fast
    expect(generateTime).toBeLessThan(5000);
    
    // Test deployment performance
    await page.fill('[data-testid="agent-name"]', 'Performance Test Agent');
    
    const deployStart = Date.now();
    await page.click('[data-testid="deploy-agent"]');
    await page.waitForSelector('[data-testid="deployment-status"]', { state: 'visible' });
    const deployTime = Date.now() - deployStart;
    
    // Deployment should complete within reasonable time
    expect(deployTime).toBeLessThan(30000);
  });

  test('Agent creation with backup and recovery', async ({ page }) => {
    // Create agent with backup configuration
    await page.fill('[data-testid="agent-description"]', 
      'Create a database backup agent that runs scheduled backups'
    );
    
    await page.click('[data-testid="generate-workflow"]');
    await page.waitForSelector('[data-testid="workflow-preview"]', { state: 'visible' });
    
    // Configure backup
    await page.check('[data-testid="enable-backup"]');
    await page.selectOption('[data-testid="backup-schedule"]', 'daily');
    await page.fill('[data-testid="backup-retention"]', '7');
    
    // Configure storage
    await page.selectOption('[data-testid="backup-storage"]', 's3');
    await page.fill('[data-testid="backup-bucket"]', 'agent-backups');
    
    // Deploy with backup
    await page.fill('[data-testid="agent-name"]', 'Backup Agent');
    await page.click('[data-testid="deploy-agent"]');
    
    // Wait for deployment
    await page.waitForSelector('[data-testid="deployment-status"]', { state: 'visible' });
    await expect(page.locator('[data-testid="deployment-status"]')).toContainText('Deployed');
    
    // Test backup functionality
    await page.click('[data-testid="test-backup"]');
    await page.waitForSelector('[data-testid="backup-test-results"]', { state: 'visible' });
    
    // Verify backup test passed
    await expect(page.locator('[data-testid="backup-status"]')).toContainText('Success');
  });
});