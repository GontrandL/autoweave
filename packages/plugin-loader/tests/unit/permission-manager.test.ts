/**
 * Permission Manager Unit Tests
 * Tests security permission validation and enforcement
 */

import { PermissionManager } from '../../src/security/permission-manager';
import { PluginContext } from '../../src/types';

describe('PermissionManager', () => {
  let permissionManager: PermissionManager;
  let mockContext: PluginContext;

  beforeEach(() => {
    permissionManager = new PermissionManager();
    mockContext = {
      pluginId: 'test-plugin',
      pluginName: 'Test Plugin',
      permissions: [
        'memory:read',
        'memory:write',
        'fs:read:/plugins',
        'llm:access',
      ],
      workerId: 'worker-123',
    };
  });

  describe('checkPermission', () => {
    it('should allow permitted actions', () => {
      expect(permissionManager.checkPermission(mockContext, 'memory:read')).toBe(true);
      expect(permissionManager.checkPermission(mockContext, 'memory:write')).toBe(true);
      expect(permissionManager.checkPermission(mockContext, 'llm:access')).toBe(true);
    });

    it('should deny unpermitted actions', () => {
      expect(permissionManager.checkPermission(mockContext, 'system:exec')).toBe(false);
      expect(permissionManager.checkPermission(mockContext, 'network:raw')).toBe(false);
      expect(permissionManager.checkPermission(mockContext, 'fs:write:/system')).toBe(false);
    });

    it('should validate filesystem paths correctly', () => {
      // Allowed path
      expect(permissionManager.checkPermission(mockContext, 'fs:read:/plugins/data.json')).toBe(true);
      expect(permissionManager.checkPermission(mockContext, 'fs:read:/plugins/subdir/file.txt')).toBe(true);
      
      // Denied paths
      expect(permissionManager.checkPermission(mockContext, 'fs:read:/etc/passwd')).toBe(false);
      expect(permissionManager.checkPermission(mockContext, 'fs:write:/plugins/data.json')).toBe(false); // No write permission
    });

    it('should handle wildcard permissions', () => {
      const wildcardContext: PluginContext = {
        ...mockContext,
        permissions: ['memory:*', 'fs:read:*'],
      };

      expect(permissionManager.checkPermission(wildcardContext, 'memory:read')).toBe(true);
      expect(permissionManager.checkPermission(wildcardContext, 'memory:write')).toBe(true);
      expect(permissionManager.checkPermission(wildcardContext, 'memory:delete')).toBe(true);
      expect(permissionManager.checkPermission(wildcardContext, 'fs:read:/any/path')).toBe(true);
      expect(permissionManager.checkPermission(wildcardContext, 'fs:write:/any/path')).toBe(false);
    });

    it('should prevent path traversal attacks', () => {
      const context: PluginContext = {
        ...mockContext,
        permissions: ['fs:read:/plugins'],
      };

      const maliciousPaths = [
        'fs:read:/plugins/../../../etc/passwd',
        'fs:read:/plugins/./../../sensitive',
        'fs:read:/plugins/%2e%2e%2f%2e%2e%2f',
        'fs:read:/plugins/..\\..\\windows\\system32',
      ];

      maliciousPaths.forEach(path => {
        expect(permissionManager.checkPermission(context, path)).toBe(false);
      });
    });

    it('should handle permission inheritance', () => {
      const context: PluginContext = {
        ...mockContext,
        permissions: ['admin:*'],
      };

      // Admin should have elevated permissions
      expect(permissionManager.checkPermission(context, 'memory:read')).toBe(true);
      expect(permissionManager.checkPermission(context, 'system:info')).toBe(true);
      
      // But not dangerous permissions
      expect(permissionManager.checkPermission(context, 'system:exec')).toBe(false);
    });
  });

  describe('enforcePermission', () => {
    it('should throw error for denied permissions', () => {
      expect(() => {
        permissionManager.enforcePermission(mockContext, 'system:exec');
      }).toThrow('Permission denied: system:exec');

      expect(() => {
        permissionManager.enforcePermission(mockContext, 'fs:write:/etc/passwd');
      }).toThrow('Permission denied: fs:write:/etc/passwd');
    });

    it('should not throw for allowed permissions', () => {
      expect(() => {
        permissionManager.enforcePermission(mockContext, 'memory:read');
      }).not.toThrow();
    });

    it('should include context in error messages', () => {
      try {
        permissionManager.enforcePermission(mockContext, 'network:raw');
      } catch (error: any) {
        expect(error.message).toContain('test-plugin');
        expect(error.message).toContain('network:raw');
      }
    });
  });

  describe('validatePermissions', () => {
    it('should validate permission format', () => {
      const validPermissions = [
        'memory:read',
        'memory:write',
        'llm:access',
        'fs:read:/path',
        'queue:publish',
      ];

      const result = permissionManager.validatePermissions(validPermissions);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid permission formats', () => {
      const invalidPermissions = [
        'invalid',
        'memory:read:extra',
        'unknown:action',
        'fs:read', // Missing path
        '',
      ];

      const result = permissionManager.validatePermissions(invalidPermissions);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(invalidPermissions.length);
    });

    it('should detect dangerous permissions', () => {
      const dangerousPermissions = [
        'system:exec',
        'fs:write:/',
        'fs:write:/etc',
        'network:raw',
        'process:spawn',
      ];

      const result = permissionManager.validatePermissions(dangerousPermissions);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          permission: 'system:exec',
          reason: expect.stringContaining('dangerous'),
        })
      );
    });

    it('should warn about overly broad permissions', () => {
      const broadPermissions = [
        'fs:read:*',
        'memory:*',
        'network:*',
      ];

      const result = permissionManager.validatePermissions(broadPermissions);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].reason).toContain('broad');
    });
  });

  describe('createSandboxedContext', () => {
    it('should create restricted API context', () => {
      const sandbox = permissionManager.createSandboxedContext(mockContext);

      // Should have allowed APIs
      expect(sandbox.memory).toBeDefined();
      expect(sandbox.memory.read).toBeDefined();
      expect(sandbox.memory.write).toBeDefined();
      expect(sandbox.llm).toBeDefined();

      // Should not have denied APIs
      expect(sandbox.system).toBeUndefined();
      expect(sandbox.process).toBeUndefined();
      expect(sandbox.network?.raw).toBeUndefined();
    });

    it('should wrap APIs with permission checks', async () => {
      const sandbox = permissionManager.createSandboxedContext(mockContext);
      
      // Mock implementation
      sandbox.memory.read = jest.fn().mockResolvedValue('data');

      // Should work with permission
      await expect(sandbox.memory.read('key')).resolves.toBe('data');

      // Remove permission and try again
      mockContext.permissions = [];
      const restrictedSandbox = permissionManager.createSandboxedContext(mockContext);
      
      expect(restrictedSandbox.memory?.read).toBeUndefined();
    });

    it('should handle filesystem path restrictions', () => {
      const sandbox = permissionManager.createSandboxedContext(mockContext);

      if (sandbox.fs?.read) {
        // Should work for allowed paths
        expect(() => sandbox.fs.read('/plugins/config.json')).not.toThrow();

        // Should fail for restricted paths
        expect(() => sandbox.fs.read('/etc/passwd')).toThrow();
      }
    });
  });

  describe('permission auditing', () => {
    it('should log permission checks', () => {
      const auditLog: any[] = [];
      permissionManager.on('permission-check', (event) => {
        auditLog.push(event);
      });

      permissionManager.checkPermission(mockContext, 'memory:read');
      permissionManager.checkPermission(mockContext, 'system:exec');

      expect(auditLog).toHaveLength(2);
      expect(auditLog[0]).toMatchObject({
        pluginId: 'test-plugin',
        permission: 'memory:read',
        granted: true,
      });
      expect(auditLog[1]).toMatchObject({
        pluginId: 'test-plugin',
        permission: 'system:exec',
        granted: false,
      });
    });

    it('should track permission usage patterns', () => {
      // Check various permissions multiple times
      for (let i = 0; i < 10; i++) {
        permissionManager.checkPermission(mockContext, 'memory:read');
      }
      for (let i = 0; i < 5; i++) {
        permissionManager.checkPermission(mockContext, 'memory:write');
      }
      permissionManager.checkPermission(mockContext, 'system:exec');

      const stats = permissionManager.getPermissionStats('test-plugin');
      
      expect(stats['memory:read']).toBe(10);
      expect(stats['memory:write']).toBe(5);
      expect(stats['system:exec']).toBe(1);
    });
  });

  describe('rate limiting', () => {
    it('should enforce rate limits on sensitive operations', async () => {
      const context: PluginContext = {
        ...mockContext,
        permissions: ['llm:access'],
      };

      // Configure rate limit
      permissionManager.setRateLimit('llm:access', {
        requests: 5,
        windowMs: 1000,
      });

      // Should allow first 5 requests
      for (let i = 0; i < 5; i++) {
        expect(permissionManager.checkPermission(context, 'llm:access')).toBe(true);
      }

      // 6th request should be rate limited
      expect(permissionManager.checkPermission(context, 'llm:access')).toBe(false);

      // Wait for window to reset
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should allow again
      expect(permissionManager.checkPermission(context, 'llm:access')).toBe(true);
    });

    it('should track rate limits per plugin', () => {
      const context1 = { ...mockContext, pluginId: 'plugin-1' };
      const context2 = { ...mockContext, pluginId: 'plugin-2' };

      permissionManager.setRateLimit('llm:access', {
        requests: 2,
        windowMs: 1000,
      });

      // Each plugin has its own limit
      expect(permissionManager.checkPermission(context1, 'llm:access')).toBe(true);
      expect(permissionManager.checkPermission(context1, 'llm:access')).toBe(true);
      expect(permissionManager.checkPermission(context1, 'llm:access')).toBe(false);

      // Plugin 2 still has quota
      expect(permissionManager.checkPermission(context2, 'llm:access')).toBe(true);
      expect(permissionManager.checkPermission(context2, 'llm:access')).toBe(true);
    });
  });
});