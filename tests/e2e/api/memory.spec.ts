import { test, expect } from '@playwright/test';

test.describe('Memory API E2E Tests', () => {
  const baseURL = process.env.API_BASE_URL || 'http://localhost:3000';
  
  test.beforeEach(async ({ page }) => {
    // Set up API base URL
    await page.goto(`${baseURL}/api/health`);
  });

  test('GET /api/memory/health returns memory system status', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/memory/health`);
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('components');
    expect(data.components).toHaveProperty('vector');
    expect(data.components).toHaveProperty('graph');
    expect(data.components).toHaveProperty('cache');
  });

  test('POST /api/memory/store stores memory successfully', async ({ request }) => {
    const memoryData = {
      content: 'This is a test memory for E2E testing',
      metadata: {
        type: 'test',
        source: 'e2e-test',
        timestamp: new Date().toISOString()
      },
      tags: ['test', 'e2e', 'memory']
    };

    const response = await request.post(`${baseURL}/api/memory/store`, {
      data: memoryData
    });

    expect(response.status()).toBe(201);
    
    const data = await response.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('content');
    expect(data.content).toBe(memoryData.content);
    expect(data).toHaveProperty('metadata');
    expect(data.metadata.type).toBe('test');
  });

  test('GET /api/memory/search searches memories', async ({ request }) => {
    // First store some test memories
    const testMemories = [
      {
        content: 'JavaScript programming tutorial',
        metadata: { type: 'tutorial', language: 'javascript' },
        tags: ['programming', 'javascript']
      },
      {
        content: 'Python data analysis guide',
        metadata: { type: 'guide', language: 'python' },
        tags: ['programming', 'python', 'data']
      },
      {
        content: 'Machine learning fundamentals',
        metadata: { type: 'educational', topic: 'ml' },
        tags: ['ml', 'education']
      }
    ];

    // Store memories
    for (const memory of testMemories) {
      await request.post(`${baseURL}/api/memory/store`, { data: memory });
    }

    // Search for programming memories
    const searchResponse = await request.get(`${baseURL}/api/memory/search?q=programming&limit=10`);
    
    expect(searchResponse.status()).toBe(200);
    
    const searchData = await searchResponse.json();
    expect(searchData).toHaveProperty('memories');
    expect(Array.isArray(searchData.memories)).toBe(true);
    expect(searchData.memories.length).toBeGreaterThan(0);
    
    // Should contain programming-related memories
    const programmingMemories = searchData.memories.filter(m => 
      m.content.includes('programming') || m.tags.includes('programming')
    );
    expect(programmingMemories.length).toBeGreaterThan(0);
  });

  test('GET /api/memory/search with filters', async ({ request }) => {
    // Search with metadata filter
    const response = await request.get(`${baseURL}/api/memory/search?q=javascript&metadata.type=tutorial`);
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('memories');
    
    // All returned memories should match the filter
    for (const memory of data.memories) {
      if (memory.metadata) {
        expect(memory.metadata.type).toBe('tutorial');
      }
    }
  });

  test('GET /api/memory/similar finds similar memories', async ({ request }) => {
    // Store a reference memory
    const referenceMemory = {
      content: 'React hooks tutorial for beginners',
      metadata: { type: 'tutorial', framework: 'react' },
      tags: ['react', 'hooks', 'frontend']
    };

    const storeResponse = await request.post(`${baseURL}/api/memory/store`, {
      data: referenceMemory
    });
    
    const storedMemory = await storeResponse.json();
    
    // Find similar memories
    const similarResponse = await request.get(`${baseURL}/api/memory/similar/${storedMemory.id}?limit=5`);
    
    expect(similarResponse.status()).toBe(200);
    
    const similarData = await similarResponse.json();
    expect(similarData).toHaveProperty('memories');
    expect(Array.isArray(similarData.memories)).toBe(true);
    
    // Should not include the reference memory itself
    const selfReference = similarData.memories.find(m => m.id === storedMemory.id);
    expect(selfReference).toBeUndefined();
  });

  test('DELETE /api/memory/:id removes memory', async ({ request }) => {
    // Store a memory first
    const memoryData = {
      content: 'Memory to be deleted',
      metadata: { type: 'test', purpose: 'deletion' },
      tags: ['delete-test']
    };

    const storeResponse = await request.post(`${baseURL}/api/memory/store`, {
      data: memoryData
    });
    
    const storedMemory = await storeResponse.json();
    
    // Delete the memory
    const deleteResponse = await request.delete(`${baseURL}/api/memory/${storedMemory.id}`);
    
    expect(deleteResponse.status()).toBe(200);
    
    // Verify deletion by searching
    const searchResponse = await request.get(`${baseURL}/api/memory/search?q=deletion&metadata.purpose=deletion`);
    const searchData = await searchResponse.json();
    
    const deletedMemory = searchData.memories.find(m => m.id === storedMemory.id);
    expect(deletedMemory).toBeUndefined();
  });

  test('GET /api/memory/metrics returns memory metrics', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/memory/metrics`);
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('totalMemories');
    expect(data).toHaveProperty('storageSize');
    expect(data).toHaveProperty('avgRetrievalTime');
    expect(data).toHaveProperty('cacheHitRate');
    expect(data).toHaveProperty('systemLoad');
    
    // Metrics should be numbers
    expect(typeof data.totalMemories).toBe('number');
    expect(typeof data.storageSize).toBe('number');
    expect(typeof data.avgRetrievalTime).toBe('number');
    expect(typeof data.cacheHitRate).toBe('number');
  });

  test('GET /api/memory/topology returns memory topology', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/memory/topology`);
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('nodes');
    expect(data).toHaveProperty('edges');
    expect(data).toHaveProperty('clusters');
    
    expect(Array.isArray(data.nodes)).toBe(true);
    expect(Array.isArray(data.edges)).toBe(true);
    expect(Array.isArray(data.clusters)).toBe(true);
  });

  test('Memory batch operations', async ({ request }) => {
    const batchData = {
      memories: [
        {
          content: 'Batch memory 1',
          metadata: { batch: 'test-batch-1' },
          tags: ['batch', 'test']
        },
        {
          content: 'Batch memory 2',
          metadata: { batch: 'test-batch-1' },
          tags: ['batch', 'test']
        },
        {
          content: 'Batch memory 3',
          metadata: { batch: 'test-batch-1' },
          tags: ['batch', 'test']
        }
      ]
    };

    const response = await request.post(`${baseURL}/api/memory/batch/store`, {
      data: batchData
    });
    
    expect(response.status()).toBe(201);
    
    const data = await response.json();
    expect(data).toHaveProperty('stored');
    expect(data).toHaveProperty('failed');
    expect(data.stored).toBe(3);
    expect(data.failed).toBe(0);
  });

  test('Memory search with pagination', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/memory/search?q=test&page=1&limit=5`);
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('memories');
    expect(data).toHaveProperty('pagination');
    expect(data.pagination).toHaveProperty('page');
    expect(data.pagination).toHaveProperty('limit');
    expect(data.pagination).toHaveProperty('total');
    expect(data.pagination).toHaveProperty('pages');
    
    expect(data.memories.length).toBeLessThanOrEqual(5);
  });

  test('Memory relationships and connections', async ({ request }) => {
    // Store two related memories
    const memory1 = {
      content: 'React components overview',
      metadata: { type: 'tutorial', framework: 'react' },
      tags: ['react', 'components']
    };

    const memory2 = {
      content: 'React hooks in detail',
      metadata: { type: 'tutorial', framework: 'react' },
      tags: ['react', 'hooks']
    };

    const store1Response = await request.post(`${baseURL}/api/memory/store`, { data: memory1 });
    const store2Response = await request.post(`${baseURL}/api/memory/store`, { data: memory2 });
    
    const storedMemory1 = await store1Response.json();
    const storedMemory2 = await store2Response.json();
    
    // Create a relationship
    const relationshipData = {
      fromId: storedMemory1.id,
      toId: storedMemory2.id,
      type: 'related',
      strength: 0.8
    };

    const relationshipResponse = await request.post(`${baseURL}/api/memory/relationships`, {
      data: relationshipData
    });
    
    expect(relationshipResponse.status()).toBe(201);
    
    // Get relationships for memory1
    const getRelationshipsResponse = await request.get(`${baseURL}/api/memory/${storedMemory1.id}/relationships`);
    
    expect(getRelationshipsResponse.status()).toBe(200);
    
    const relationships = await getRelationshipsResponse.json();
    expect(relationships).toHaveProperty('relationships');
    expect(Array.isArray(relationships.relationships)).toBe(true);
    
    const relatedMemory = relationships.relationships.find(r => r.toId === storedMemory2.id);
    expect(relatedMemory).toBeDefined();
    expect(relatedMemory.type).toBe('related');
  });

  test('Memory versioning and history', async ({ request }) => {
    // Store initial memory
    const initialMemory = {
      content: 'Initial version of memory',
      metadata: { version: '1.0', type: 'versioned' },
      tags: ['version', 'test']
    };

    const storeResponse = await request.post(`${baseURL}/api/memory/store`, {
      data: initialMemory
    });
    
    const storedMemory = await storeResponse.json();
    
    // Update memory
    const updatedMemory = {
      content: 'Updated version of memory',
      metadata: { version: '2.0', type: 'versioned' },
      tags: ['version', 'test', 'updated']
    };

    const updateResponse = await request.put(`${baseURL}/api/memory/${storedMemory.id}`, {
      data: updatedMemory
    });
    
    expect(updateResponse.status()).toBe(200);
    
    // Get memory history
    const historyResponse = await request.get(`${baseURL}/api/memory/${storedMemory.id}/history`);
    
    expect(historyResponse.status()).toBe(200);
    
    const history = await historyResponse.json();
    expect(history).toHaveProperty('versions');
    expect(Array.isArray(history.versions)).toBe(true);
    expect(history.versions.length).toBeGreaterThan(0);
  });

  test('Memory export and import', async ({ request }) => {
    // Export memories
    const exportResponse = await request.get(`${baseURL}/api/memory/export?format=json&filter=test`);
    
    expect(exportResponse.status()).toBe(200);
    
    const exportData = await exportResponse.json();
    expect(exportData).toHaveProperty('memories');
    expect(exportData).toHaveProperty('metadata');
    expect(exportData.metadata).toHaveProperty('exportedAt');
    expect(exportData.metadata).toHaveProperty('format');
    expect(exportData.metadata.format).toBe('json');
    
    // Import memories (using same data)
    const importResponse = await request.post(`${baseURL}/api/memory/import`, {
      data: exportData
    });
    
    expect(importResponse.status()).toBe(200);
    
    const importResult = await importResponse.json();
    expect(importResult).toHaveProperty('imported');
    expect(importResult).toHaveProperty('skipped');
    expect(importResult).toHaveProperty('errors');
  });

  test('Memory analytics and insights', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/memory/analytics`);
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('insights');
    expect(data).toHaveProperty('trends');
    expect(data).toHaveProperty('patterns');
    expect(data).toHaveProperty('recommendations');
    
    // Check insights structure
    expect(data.insights).toHaveProperty('totalMemories');
    expect(data.insights).toHaveProperty('avgContentLength');
    expect(data.insights).toHaveProperty('topTags');
    expect(data.insights).toHaveProperty('memoryTypes');
  });

  test('Memory stress test - concurrent operations', async ({ request }) => {
    const operations = [];
    
    // Create multiple concurrent store operations
    for (let i = 0; i < 10; i++) {
      const operation = request.post(`${baseURL}/api/memory/store`, {
        data: {
          content: `Concurrent memory ${i}`,
          metadata: { batch: 'concurrent-test', index: i },
          tags: ['concurrent', 'stress-test']
        }
      });
      operations.push(operation);
    }
    
    // Wait for all operations to complete
    const results = await Promise.all(operations);
    
    // All operations should succeed
    for (const result of results) {
      expect(result.status()).toBe(201);
    }
    
    // Verify all memories were stored
    const searchResponse = await request.get(`${baseURL}/api/memory/search?q=concurrent&metadata.batch=concurrent-test`);
    const searchData = await searchResponse.json();
    
    expect(searchData.memories.length).toBeGreaterThanOrEqual(10);
  });

  test('Memory security and validation', async ({ request }) => {
    // Test invalid memory data
    const invalidMemory = {
      content: '', // Empty content should be rejected
      metadata: null,
      tags: 'invalid-tags' // Should be array
    };

    const response = await request.post(`${baseURL}/api/memory/store`, {
      data: invalidMemory
    });

    expect(response.status()).toBe(400);
    
    const error = await response.json();
    expect(error).toHaveProperty('error');
    expect(error.error).toContain('content');
  });

  test('Memory cleanup and maintenance', async ({ request }) => {
    // Test cleanup endpoint
    const cleanupResponse = await request.post(`${baseURL}/api/memory/cleanup`, {
      data: {
        olderThan: '1h',
        tags: ['test', 'cleanup']
      }
    });
    
    expect(cleanupResponse.status()).toBe(200);
    
    const cleanupData = await cleanupResponse.json();
    expect(cleanupData).toHaveProperty('cleaned');
    expect(cleanupData).toHaveProperty('remaining');
    expect(typeof cleanupData.cleaned).toBe('number');
    expect(typeof cleanupData.remaining).toBe('number');
  });
});