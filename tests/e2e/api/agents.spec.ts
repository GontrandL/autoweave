import { test, expect } from '@playwright/test';

test.describe('Agent API E2E Tests', () => {
  const baseURL = process.env.API_BASE_URL || 'http://localhost:3000';
  
  test.beforeEach(async ({ page }) => {
    // Set up API base URL
    await page.goto(`${baseURL}/api/health`);
  });

  test('GET /api/agents returns agent list', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/agents`);
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('agents');
    expect(Array.isArray(data.agents)).toBe(true);
    
    // Check agent structure
    if (data.agents.length > 0) {
      const agent = data.agents[0];
      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('name');
      expect(agent).toHaveProperty('status');
      expect(agent).toHaveProperty('description');
      expect(agent).toHaveProperty('capabilities');
    }
  });

  test('POST /api/agents creates new agent', async ({ request }) => {
    const newAgent = {
      name: 'Test Agent E2E',
      description: 'A test agent created during E2E testing',
      capabilities: ['testing', 'e2e'],
      workflow: {
        steps: [
          { type: 'input', name: 'user_input' },
          { type: 'process', name: 'analyze_input' },
          { type: 'output', name: 'return_result' }
        ]
      }
    };

    const response = await request.post(`${baseURL}/api/agents`, {
      data: newAgent
    });

    expect(response.status()).toBe(201);
    
    const data = await response.json();
    expect(data).toHaveProperty('id');
    expect(data.name).toBe(newAgent.name);
    expect(data.description).toBe(newAgent.description);
    expect(data.capabilities).toEqual(newAgent.capabilities);
    expect(data.status).toBe('pending');
  });

  test('GET /api/agents/:id returns specific agent', async ({ request }) => {
    // First create an agent
    const createResponse = await request.post(`${baseURL}/api/agents`, {
      data: {
        name: 'Specific Agent Test',
        description: 'Agent for testing specific retrieval',
        capabilities: ['retrieval-test']
      }
    });
    
    expect(createResponse.status()).toBe(201);
    const createdAgent = await createResponse.json();
    
    // Then retrieve it
    const getResponse = await request.get(`${baseURL}/api/agents/${createdAgent.id}`);
    
    expect(getResponse.status()).toBe(200);
    
    const data = await getResponse.json();
    expect(data.id).toBe(createdAgent.id);
    expect(data.name).toBe('Specific Agent Test');
    expect(data.description).toBe('Agent for testing specific retrieval');
  });

  test('PUT /api/agents/:id updates agent', async ({ request }) => {
    // Create agent first
    const createResponse = await request.post(`${baseURL}/api/agents`, {
      data: {
        name: 'Update Test Agent',
        description: 'Agent for testing updates',
        capabilities: ['update-test']
      }
    });
    
    const createdAgent = await createResponse.json();
    
    // Update the agent
    const updateData = {
      name: 'Updated Test Agent',
      description: 'Agent has been updated',
      capabilities: ['update-test', 'updated']
    };
    
    const updateResponse = await request.put(`${baseURL}/api/agents/${createdAgent.id}`, {
      data: updateData
    });
    
    expect(updateResponse.status()).toBe(200);
    
    const updatedAgent = await updateResponse.json();
    expect(updatedAgent.name).toBe('Updated Test Agent');
    expect(updatedAgent.description).toBe('Agent has been updated');
    expect(updatedAgent.capabilities).toEqual(['update-test', 'updated']);
  });

  test('DELETE /api/agents/:id removes agent', async ({ request }) => {
    // Create agent first
    const createResponse = await request.post(`${baseURL}/api/agents`, {
      data: {
        name: 'Delete Test Agent',
        description: 'Agent for testing deletion',
        capabilities: ['delete-test']
      }
    });
    
    const createdAgent = await createResponse.json();
    
    // Delete the agent
    const deleteResponse = await request.delete(`${baseURL}/api/agents/${createdAgent.id}`);
    
    expect(deleteResponse.status()).toBe(200);
    
    // Verify deletion
    const getResponse = await request.get(`${baseURL}/api/agents/${createdAgent.id}`);
    expect(getResponse.status()).toBe(404);
  });

  test('Agent deployment workflow E2E', async ({ request }) => {
    // Create a comprehensive agent
    const agentData = {
      name: 'Deployment Test Agent',
      description: 'Testing complete deployment workflow',
      capabilities: ['workflow', 'deployment', 'kubernetes'],
      workflow: {
        steps: [
          { type: 'input', name: 'receive_request' },
          { type: 'process', name: 'validate_input' },
          { type: 'external', name: 'call_api', config: { url: 'https://api.example.com' } },
          { type: 'output', name: 'format_response' }
        ]
      },
      config: {
        resources: {
          memory: '256Mi',
          cpu: '100m'
        },
        environment: {
          NODE_ENV: 'production'
        }
      }
    };

    // Create agent
    const createResponse = await request.post(`${baseURL}/api/agents`, {
      data: agentData
    });
    
    expect(createResponse.status()).toBe(201);
    const agent = await createResponse.json();

    // Deploy agent
    const deployResponse = await request.post(`${baseURL}/api/agents/${agent.id}/deploy`);
    
    expect(deployResponse.status()).toBe(200);
    
    const deployResult = await deployResponse.json();
    expect(deployResult).toHaveProperty('deploymentId');
    expect(deployResult).toHaveProperty('status');
    expect(deployResult.status).toBe('deploying');

    // Check deployment status
    const statusResponse = await request.get(`${baseURL}/api/agents/${agent.id}/status`);
    
    expect(statusResponse.status()).toBe(200);
    
    const statusData = await statusResponse.json();
    expect(statusData).toHaveProperty('status');
    expect(['deploying', 'running', 'pending']).toContain(statusData.status);
  });

  test('Agent validation and error handling', async ({ request }) => {
    // Test invalid agent creation
    const invalidAgent = {
      name: '', // Empty name should fail
      description: 'Invalid agent',
      capabilities: []
    };

    const response = await request.post(`${baseURL}/api/agents`, {
      data: invalidAgent
    });

    expect(response.status()).toBe(400);
    
    const error = await response.json();
    expect(error).toHaveProperty('error');
    expect(error.error).toContain('name');
  });

  test('Agent metrics and monitoring', async ({ request }) => {
    // Create agent first
    const createResponse = await request.post(`${baseURL}/api/agents`, {
      data: {
        name: 'Metrics Test Agent',
        description: 'Agent for testing metrics',
        capabilities: ['metrics']
      }
    });
    
    const agent = await createResponse.json();
    
    // Get agent metrics
    const metricsResponse = await request.get(`${baseURL}/api/agents/${agent.id}/metrics`);
    
    expect(metricsResponse.status()).toBe(200);
    
    const metrics = await metricsResponse.json();
    expect(metrics).toHaveProperty('cpu');
    expect(metrics).toHaveProperty('memory');
    expect(metrics).toHaveProperty('requests');
    expect(metrics).toHaveProperty('uptime');
  });

  test('Agent logs retrieval', async ({ request }) => {
    // Create agent first
    const createResponse = await request.post(`${baseURL}/api/agents`, {
      data: {
        name: 'Logs Test Agent',
        description: 'Agent for testing logs',
        capabilities: ['logging']
      }
    });
    
    const agent = await createResponse.json();
    
    // Get agent logs
    const logsResponse = await request.get(`${baseURL}/api/agents/${agent.id}/logs`);
    
    expect(logsResponse.status()).toBe(200);
    
    const logs = await logsResponse.json();
    expect(logs).toHaveProperty('logs');
    expect(Array.isArray(logs.logs)).toBe(true);
  });

  test('Agent capabilities discovery', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/agents/capabilities`);
    
    expect(response.status()).toBe(200);
    
    const capabilities = await response.json();
    expect(capabilities).toHaveProperty('available');
    expect(Array.isArray(capabilities.available)).toBe(true);
    
    // Should include common capabilities
    expect(capabilities.available).toContain('llm');
    expect(capabilities.available).toContain('api');
    expect(capabilities.available).toContain('kubernetes');
  });

  test('Concurrent agent operations', async ({ request }) => {
    // Create multiple agents concurrently
    const agents = [];
    const createPromises = [];
    
    for (let i = 0; i < 5; i++) {
      const promise = request.post(`${baseURL}/api/agents`, {
        data: {
          name: `Concurrent Agent ${i}`,
          description: `Agent ${i} for concurrent testing`,
          capabilities: ['concurrency']
        }
      });
      createPromises.push(promise);
    }
    
    const responses = await Promise.all(createPromises);
    
    // All should succeed
    for (const response of responses) {
      expect(response.status()).toBe(201);
      const agent = await response.json();
      agents.push(agent);
    }
    
    // Verify all agents were created
    const listResponse = await request.get(`${baseURL}/api/agents`);
    const { agents: allAgents } = await listResponse.json();
    
    // Should contain all our test agents
    const testAgents = allAgents.filter(a => a.name.startsWith('Concurrent Agent'));
    expect(testAgents.length).toBeGreaterThanOrEqual(5);
  });

  test('Agent workflow execution', async ({ request }) => {
    // Create agent with executable workflow
    const agentData = {
      name: 'Workflow Execution Agent',
      description: 'Agent for testing workflow execution',
      capabilities: ['workflow-execution'],
      workflow: {
        steps: [
          { type: 'input', name: 'user_input' },
          { type: 'llm', name: 'process_with_llm', config: { model: 'gpt-4' } },
          { type: 'output', name: 'return_result' }
        ]
      }
    };

    const createResponse = await request.post(`${baseURL}/api/agents`, {
      data: agentData
    });
    
    const agent = await createResponse.json();
    
    // Execute workflow
    const executeResponse = await request.post(`${baseURL}/api/agents/${agent.id}/execute`, {
      data: {
        input: 'Test input for workflow execution',
        parameters: {}
      }
    });
    
    expect(executeResponse.status()).toBe(200);
    
    const result = await executeResponse.json();
    expect(result).toHaveProperty('output');
    expect(result).toHaveProperty('executionId');
    expect(result).toHaveProperty('status');
  });
});