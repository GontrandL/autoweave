import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('error_rate');
const responseTime = new Trend('response_time');
const agentCreations = new Counter('agent_creations');
const successfulQueries = new Counter('successful_queries');

export const options = {
  scenarios: {
    // Smoke test - minimal load
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      tags: { scenario: 'smoke' },
    },
    
    // Load test - normal expected load
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },
        { duration: '5m', target: 20 },
        { duration: '2m', target: 40 },
        { duration: '5m', target: 40 },
        { duration: '2m', target: 0 },
      ],
      tags: { scenario: 'load' },
    },
    
    // Stress test - beyond normal capacity
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '5m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '5m', target: 200 },
        { duration: '10m', target: 0 },
      ],
      tags: { scenario: 'stress' },
    },
    
    // Spike test - sudden traffic spikes
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 100 },
        { duration: '1m', target: 100 },
        { duration: '10s', target: 1400 },
        { duration: '3m', target: 1400 },
        { duration: '10s', target: 100 },
        { duration: '3m', target: 100 },
        { duration: '10s', target: 0 },
      ],
      tags: { scenario: 'spike' },
    },
  },
  
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    error_rate: ['rate<0.05'], // Error rate under 5%
    http_req_failed: ['rate<0.02'], // Failed request rate under 2%
    response_time: ['p(99)<1000'], // 99% under 1s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token';

// Test data generators
function generateAgentConfig() {
  return {
    name: `load-test-agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    description: 'Load test agent for performance validation',
    config: {
      type: 'simple',
      capabilities: ['greet', 'respond', 'analyze'],
      plugins: ['@autoweave/llm-plugin', '@autoweave/memory-plugin'],
      resources: {
        memory: '512Mi',
        cpu: '250m'
      }
    }
  };
}

function generateQueryPayload() {
  const queries = [
    'Hello, how are you today?',
    'Can you help me with a task?',
    'What are your capabilities?',
    'Process this data for me',
    'Analyze the current situation',
    'Generate a report summary',
    'What is the weather like?',
    'Help me understand this concept'
  ];
  
  return {
    message: queries[Math.floor(Math.random() * queries.length)],
    context: { 
      userId: `user-${Math.random().toString(36).substr(2, 9)}`,
      sessionId: `session-${Date.now()}`,
      timestamp: new Date().toISOString()
    }
  };
}

export default function() {
  const scenarios = [
    testHealthEndpoints,
    testAgentCreation,
    testAgentQuery,
    testPluginManagement,
    testMemoryOperations,
    testObservabilityEndpoints,
    testConfigurationAPI
  ];
  
  // Randomly select a scenario with weighted distribution
  const weights = [0.2, 0.15, 0.3, 0.1, 0.1, 0.1, 0.05];
  const random = Math.random();
  let cumulative = 0;
  let selectedIndex = 0;
  
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (random <= cumulative) {
      selectedIndex = i;
      break;
    }
  }
  
  scenarios[selectedIndex]();
  sleep(Math.random() * 2 + 1); // Random sleep between 1-3 seconds
}

function testHealthEndpoints() {
  const endpoints = ['/health', '/ready', '/metrics'];
  
  endpoints.forEach(endpoint => {
    const response = http.get(`${BASE_URL}${endpoint}`);
    
    errorRate.add(response.status !== 200);
    responseTime.add(response.timings.duration);
    
    check(response, {
      [`${endpoint} status is 200`]: (r) => r.status === 200,
      [`${endpoint} response time < 500ms`]: (r) => r.timings.duration < 500,
      [`${endpoint} has valid content`]: (r) => r.body.length > 0,
    });
  });
}

function testAgentCreation() {
  const payload = JSON.stringify(generateAgentConfig());
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
  };

  const response = http.post(`${BASE_URL}/api/agents`, payload, params);
  
  errorRate.add(response.status !== 201);
  responseTime.add(response.timings.duration);
  
  if (response.status === 201) {
    agentCreations.add(1);
  }
  
  const success = check(response, {
    'agent creation status is 201': (r) => r.status === 201,
    'agent creation response time < 2s': (r) => r.timings.duration < 2000,
    'response has agent ID': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.id !== undefined;
      } catch {
        return false;
      }
    },
    'response has valid structure': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.name && body.config;
      } catch {
        return false;
      }
    }
  });
  
  if (success && response.status === 201) {
    // Clean up created agent
    try {
      const agentData = JSON.parse(response.body);
      http.del(`${BASE_URL}/api/agents/${agentData.id}`, params);
    } catch (e) {
      console.warn('Failed to cleanup agent:', e);
    }
  }
}

function testAgentQuery() {
  const agentId = 'test-agent-1'; // Pre-created agent for testing
  const query = generateQueryPayload();

  const response = http.post(
    `${BASE_URL}/api/agents/${agentId}/query`,
    JSON.stringify(query),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
    }
  );

  errorRate.add(response.status !== 200);
  responseTime.add(response.timings.duration);

  if (response.status === 200) {
    successfulQueries.add(1);
  }

  check(response, {
    'query status is 200': (r) => r.status === 200,
    'query response time < 3s': (r) => r.timings.duration < 3000,
    'response has message': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.response !== undefined;
      } catch {
        return false;
      }
    },
    'response has metadata': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.metadata !== undefined;
      } catch {
        return false;
      }
    }
  });
}

function testPluginManagement() {
  const response = http.get(`${BASE_URL}/api/plugins`, {
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
  });

  errorRate.add(response.status !== 200);
  responseTime.add(response.timings.duration);

  check(response, {
    'plugins list status is 200': (r) => r.status === 200,
    'plugins response time < 1s': (r) => r.timings.duration < 1000,
    'response has plugins array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.plugins);
      } catch {
        return false;
      }
    },
  });
}

function testMemoryOperations() {
  const query = {
    text: 'Find information about user preferences and system configuration',
    limit: 10,
    filters: {
      type: 'user_data',
      recent: true
    }
  };

  const response = http.post(
    `${BASE_URL}/api/memory/search`,
    JSON.stringify(query),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
    }
  );

  errorRate.add(response.status !== 200);
  responseTime.add(response.timings.duration);

  check(response, {
    'memory search status is 200': (r) => r.status === 200,
    'memory search response time < 1.5s': (r) => r.timings.duration < 1500,
    'response has results': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.results !== undefined;
      } catch {
        return false;
      }
    },
    'results structure is valid': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.results) && body.total !== undefined;
      } catch {
        return false;
      }
    }
  });
}

function testObservabilityEndpoints() {
  const endpoints = [
    { path: '/metrics', expectedStatus: 200 },
    { path: '/api/traces', expectedStatus: 200 },
    { path: '/api/logs', expectedStatus: 200 }
  ];
  
  endpoints.forEach(({ path, expectedStatus }) => {
    const response = http.get(`${BASE_URL}${path}`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
    });
    
    errorRate.add(response.status !== expectedStatus);
    responseTime.add(response.timings.duration);
    
    check(response, {
      [`${path} status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
      [`${path} response time < 1s`]: (r) => r.timings.duration < 1000,
    });
  });
}

function testConfigurationAPI() {
  const response = http.get(`${BASE_URL}/api/config`, {
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
  });

  errorRate.add(response.status !== 200);
  responseTime.add(response.timings.duration);

  check(response, {
    'config status is 200': (r) => r.status === 200,
    'config response time < 500ms': (r) => r.timings.duration < 500,
    'config has valid structure': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.version && body.environment;
      } catch {
        return false;
      }
    },
  });
}

export function handleSummary(data) {
  const results = {
    'load-test-results.json': JSON.stringify(data, null, 2),
    'load-test-report.html': generateHTMLReport(data),
    'load-test-summary.txt': generateTextSummary(data)
  };
  
  return results;
}

function generateHTMLReport(data) {
  const scenarios = Object.keys(data.metrics.http_reqs?.values || {});
  const metrics = data.metrics;
  
  return `
<!DOCTYPE html>
<html>
<head>
    <title>AutoWeave Load Test Report</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 40px; 
            background-color: #f5f5f5; 
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            background: white; 
            padding: 30px; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        .metric { 
            margin: 20px 0; 
            padding: 15px; 
            border: 1px solid #ddd; 
            border-radius: 5px; 
        }
        .pass { 
            background-color: #d4edda; 
            border-color: #c3e6cb; 
            color: #155724; 
        }
        .fail { 
            background-color: #f8d7da; 
            border-color: #f5c6cb; 
            color: #721c24; 
        }
        .warn { 
            background-color: #fff3cd; 
            border-color: #ffeaa7; 
            color: #856404; 
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 20px 0; 
        }
        th, td { 
            padding: 12px; 
            text-align: left; 
            border-bottom: 1px solid #ddd; 
        }
        th { 
            background-color: #f8f9fa; 
            font-weight: bold; 
        }
        .header { 
            text-align: center; 
            margin-bottom: 30px; 
        }
        .summary-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
            gap: 20px; 
            margin: 30px 0; 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>AutoWeave Load Test Report</h1>
            <p>Generated: ${new Date().toISOString()}</p>
        </div>
        
        <h2>Summary</h2>
        <div class="summary-grid">
            <div class="metric ${getThresholdClass(metrics.http_req_duration?.values?.p95, 500)}">
                <strong>P95 Response Time:</strong> ${(metrics.http_req_duration?.values?.p95 || 0).toFixed(2)}ms 
                <br><small>Threshold: &lt;500ms</small>
            </div>
            
            <div class="metric ${getThresholdClass(metrics.http_req_failed?.rate, 0.02, true)}">
                <strong>Error Rate:</strong> ${((metrics.http_req_failed?.rate || 0) * 100).toFixed(2)}% 
                <br><small>Threshold: &lt;2%</small>
            </div>
            
            <div class="metric ${getThresholdClass(metrics.error_rate?.rate, 0.05, true)}">
                <strong>Custom Error Rate:</strong> ${((metrics.error_rate?.rate || 0) * 100).toFixed(2)}% 
                <br><small>Threshold: &lt;5%</small>
            </div>
            
            <div class="metric pass">
                <strong>Total Requests:</strong> ${metrics.http_reqs?.count || 0}
                <br><small>All scenarios combined</small>
            </div>
        </div>
        
        <h2>Detailed Metrics</h2>
        <table>
            <tr>
                <th>Metric</th>
                <th>Average</th>
                <th>P90</th>
                <th>P95</th>
                <th>P99</th>
                <th>Max</th>
            </tr>
            <tr>
                <td>Response Time</td>
                <td>${(metrics.http_req_duration?.values?.avg || 0).toFixed(2)}ms</td>
                <td>${(metrics.http_req_duration?.values?.p90 || 0).toFixed(2)}ms</td>
                <td>${(metrics.http_req_duration?.values?.p95 || 0).toFixed(2)}ms</td>
                <td>${(metrics.http_req_duration?.values?.p99 || 0).toFixed(2)}ms</td>
                <td>${(metrics.http_req_duration?.values?.max || 0).toFixed(2)}ms</td>
            </tr>
            <tr>
                <td>Request Rate</td>
                <td>${(metrics.http_reqs?.rate || 0).toFixed(2)}/s</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
            </tr>
        </table>
        
        <h2>Custom Metrics</h2>
        <table>
            <tr>
                <th>Metric</th>
                <th>Count/Rate</th>
                <th>Status</th>
            </tr>
            <tr>
                <td>Agent Creations</td>
                <td>${metrics.agent_creations?.count || 0}</td>
                <td class="${metrics.agent_creations?.count > 0 ? 'pass' : 'warn'}">
                    ${metrics.agent_creations?.count > 0 ? 'Active' : 'Low Activity'}
                </td>
            </tr>
            <tr>
                <td>Successful Queries</td>
                <td>${metrics.successful_queries?.count || 0}</td>
                <td class="${metrics.successful_queries?.count > 0 ? 'pass' : 'warn'}">
                    ${metrics.successful_queries?.count > 0 ? 'Active' : 'Low Activity'}
                </td>
            </tr>
        </table>
        
        <h2>Recommendations</h2>
        <div class="metric">
            ${generateRecommendations(metrics)}
        </div>
        
        <footer style="margin-top: 50px; text-align: center; color: #666;">
            <p>AutoWeave Performance Testing Suite | Generated by K6</p>
        </footer>
    </div>
</body>
</html>`;
}

function getThresholdClass(value, threshold, isRate = false) {
  if (value === undefined || value === null) return 'warn';
  
  if (isRate) {
    if (value <= threshold) return 'pass';
    if (value <= threshold * 2) return 'warn';
    return 'fail';
  } else {
    if (value <= threshold) return 'pass';
    if (value <= threshold * 1.5) return 'warn';
    return 'fail';
  }
}

function generateRecommendations(metrics) {
  const recommendations = [];
  
  if ((metrics.http_req_duration?.values?.p95 || 0) > 500) {
    recommendations.push('⚠️ Consider optimizing API response times - P95 latency exceeds 500ms threshold');
  }
  
  if ((metrics.http_req_failed?.rate || 0) > 0.02) {
    recommendations.push('🔴 High error rate detected - investigate failing requests');
  }
  
  if ((metrics.error_rate?.rate || 0) > 0.05) {
    recommendations.push('🔴 Custom error rate threshold exceeded - check application logs');
  }
  
  if ((metrics.http_req_duration?.values?.p99 || 0) > 2000) {
    recommendations.push('⚠️ Some requests are very slow - check for outliers and bottlenecks');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('✅ All performance metrics are within acceptable thresholds');
    recommendations.push('💡 Consider gradually increasing load to find system limits');
  }
  
  return recommendations.map(rec => `<p>${rec}</p>`).join('');
}

function generateTextSummary(data) {
  const metrics = data.metrics;
  return `
AutoWeave Load Test Summary
==========================
Generated: ${new Date().toISOString()}

Key Metrics:
- Total Requests: ${metrics.http_reqs?.count || 0}
- Request Rate: ${(metrics.http_reqs?.rate || 0).toFixed(2)}/s
- P95 Response Time: ${(metrics.http_req_duration?.values?.p95 || 0).toFixed(2)}ms
- Error Rate: ${((metrics.http_req_failed?.rate || 0) * 100).toFixed(2)}%
- Agent Creations: ${metrics.agent_creations?.count || 0}
- Successful Queries: ${metrics.successful_queries?.count || 0}

Thresholds:
- P95 < 500ms: ${(metrics.http_req_duration?.values?.p95 || 0) < 500 ? 'PASS' : 'FAIL'}
- Error Rate < 2%: ${(metrics.http_req_failed?.rate || 0) < 0.02 ? 'PASS' : 'FAIL'}
- Custom Error Rate < 5%: ${(metrics.error_rate?.rate || 0) < 0.05 ? 'PASS' : 'FAIL'}
`;
}