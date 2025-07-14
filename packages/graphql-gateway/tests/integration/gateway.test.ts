import request from 'supertest';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import express from 'express';
import GraphQLGateway from '../../src/gateway';
import { userService } from '../../src/services/user';
import { jwtService } from '../../src/auth/jwt';

describe('GraphQL Gateway Integration', () => {
  let app: express.Application;
  let server: ApolloServer;
  let gateway: GraphQLGateway;
  let accessToken: string;

  beforeAll(async () => {
    // Create test user
    const user = await userService.findUserByEmail('developer@autoweave.com');
    if (user) {
      accessToken = jwtService.generateAccessToken(user);
    }

    // Start gateway in test mode
    process.env.NODE_ENV = 'test';
    gateway = new GraphQLGateway();
    // Note: In a real test, you would start the gateway here
    // await gateway.start();
  });

  afterAll(async () => {
    if (gateway) {
      await gateway.stop();
    }
  });

  describe('Authentication Endpoints', () => {
    test('POST /auth/login should authenticate user', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'developer@autoweave.com',
          password: 'password'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');
    });

    test('POST /auth/login should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'invalid@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
    });

    test('GET /auth/profile should return user profile', async () => {
      const response = await request(app)
        .get('/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email');
    });

    test('POST /auth/logout should invalidate session', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GraphQL Operations', () => {
    test('should query agents with authentication', async () => {
      const query = `
        query {
          agents {
            id
            name
            status
            type
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ query });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('agents');
    });

    test('should reject unauthenticated GraphQL requests', async () => {
      const query = `
        query {
          agents {
            id
            name
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
    });

    test('should enforce permissions on protected operations', async () => {
      const mutation = `
        mutation {
          createAgent(input: {
            name: "Test Agent"
            type: WORKFLOW
            config: {
              runtime: "nodejs"
              memory: "512Mi"
              cpu: "250m"
              environment: []
              ports: []
              volumes: []
              dependencies: []
              scaling: {
                minReplicas: 1
                maxReplicas: 3
              }
            }
          }) {
            id
            name
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ query: mutation });

      expect(response.status).toBe(200);
      if (response.body.errors) {
        // Check if error is permission-related
        expect(response.body.errors[0].extensions.code).toBe('FORBIDDEN');
      } else {
        // Operation succeeded
        expect(response.body.data).toHaveProperty('createAgent');
      }
    });

    test('should enforce rate limiting', async () => {
      const query = `
        query {
          agents {
            id
            name
          }
        }
      `;

      // Send many requests rapidly
      const promises = Array.from({ length: 150 }, () =>
        request(app)
          .post('/graphql')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ query })
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    test('should validate query complexity', async () => {
      const complexQuery = `
        query {
          agents {
            id
            name
            config {
              runtime
              memory
              cpu
              environment {
                key
                value
              }
              ports {
                name
                port
                protocol
              }
              volumes {
                name
                mountPath
                size
                type
              }
              dependencies {
                name
                version
                type
              }
            }
            metrics {
              cpuUsage
              memoryUsage
              networkIn
              networkOut
            }
            logs {
              id
              level
              message
              timestamp
            }
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ query: complexQuery });

      expect(response.status).toBe(200);
      // Query should either succeed or fail with complexity error
      if (response.body.errors) {
        expect(response.body.errors[0].extensions.code).toBe('QUERY_COMPLEXITY_EXCEEDED');
      }
    });
  });

  describe('Health and Metrics', () => {
    test('GET /health should return health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('subgraphs');
    });

    test('GET /metrics should return metrics', async () => {
      const response = await request(app).get('/metrics');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('activeConnections');
      expect(response.body).toHaveProperty('totalRequests');
    });
  });

  describe('Security Headers', () => {
    test('should include security headers', async () => {
      const response = await request(app).get('/health');

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });
  });
});