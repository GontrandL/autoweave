/**
 * Plugin Manifest Validator Unit Tests
 * Tests manifest validation with AJV schema
 */

import { ManifestValidator } from '../../src/validators/manifest-validator';
import { PluginManifest } from '../../src/types';
import Ajv from 'ajv';

describe('ManifestValidator', () => {
  let validator: ManifestValidator;

  beforeEach(() => {
    validator = new ManifestValidator();
  });

  describe('validate', () => {
    it('should validate a complete valid manifest', () => {
      const manifest: PluginManifest = {
        $schema: 'https://autoweave.dev/schemas/plugin-v1.json',
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin',
        entry: './dist/index.js',
        autoweave: {
          minVersion: '2.0.0',
          maxVersion: '3.0.0',
        },
        permissions: [
          'memory:read',
          'memory:write',
          'llm:access',
          'queue:publish',
          'fs:read:/plugins',
        ],
        hooks: {
          onLoad: './dist/hooks/onLoad.js',
          onUnload: './dist/hooks/onUnload.js',
          onError: './dist/hooks/onError.js',
        },
        dependencies: {
          external: ['axios@^1.6.0', 'lodash@^4.17.0'],
          autoweave: ['@autoweave/memory@^2.0.0'],
        },
        isolation: {
          workerThread: true,
          memoryLimit: '256MB',
          cpuLimit: '50%',
        },
        signature: {
          algorithm: 'SHA-256',
          hash: 'abc123def456',
          publicKey: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----',
        },
      };

      const result = validator.validate(manifest);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject manifest with missing required fields', () => {
      const manifest: any = {
        name: 'test-plugin',
        // Missing version, entry, etc.
      };

      const result = validator.validate(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: expect.stringContaining('version'),
          message: expect.stringContaining('required'),
        })
      );
    });

    it('should validate version format', () => {
      const invalidVersions = ['1', '1.0', 'v1.0.0', '1.0.0-beta'];
      
      invalidVersions.forEach(version => {
        const manifest: any = {
          name: 'test-plugin',
          version,
          entry: './index.js',
        };

        const result = validator.validate(manifest);
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: expect.stringContaining('version'),
            message: expect.stringContaining('pattern'),
          })
        );
      });

      // Valid versions
      const validVersions = ['1.0.0', '2.1.3', '10.20.30'];
      validVersions.forEach(version => {
        const manifest: any = {
          name: 'test-plugin',
          version,
          entry: './index.js',
        };

        const result = validator.validate(manifest);
        // May still be invalid due to other fields, but not version
        const versionErrors = result.errors.filter(e => e.field.includes('version'));
        expect(versionErrors).toHaveLength(0);
      });
    });

    it('should validate permission format', () => {
      const validPermissions = [
        'memory:read',
        'memory:write',
        'llm:access',
        'queue:publish',
        'fs:read:/specific/path',
        'fs:write:/another/path',
        'network:http',
        'system:info',
      ];

      const manifest: any = {
        name: 'test-plugin',
        version: '1.0.0',
        entry: './index.js',
        permissions: validPermissions,
      };

      const result = validator.validate(manifest);
      const permissionErrors = result.errors.filter(e => e.field.includes('permissions'));
      expect(permissionErrors).toHaveLength(0);
    });

    it('should reject invalid permission formats', () => {
      const invalidPermissions = [
        'invalid',
        'memory:invalid:action',
        'fs:read', // Missing path
        'unknown:action',
        '',
      ];

      invalidPermissions.forEach(permission => {
        const manifest: any = {
          name: 'test-plugin',
          version: '1.0.0',
          entry: './index.js',
          permissions: [permission],
        };

        const result = validator.validate(manifest);
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: expect.stringContaining('permissions'),
          })
        );
      });
    });

    it('should validate isolation limits', () => {
      const validLimits = [
        { memoryLimit: '256MB', cpuLimit: '50%' },
        { memoryLimit: '1GB', cpuLimit: '25%' },
        { memoryLimit: '512MB', cpuLimit: '100%' },
      ];

      validLimits.forEach(limits => {
        const manifest: any = {
          name: 'test-plugin',
          version: '1.0.0',
          entry: './index.js',
          isolation: {
            workerThread: true,
            ...limits,
          },
        };

        const result = validator.validate(manifest);
        const isolationErrors = result.errors.filter(e => e.field.includes('isolation'));
        expect(isolationErrors).toHaveLength(0);
      });
    });

    it('should reject invalid isolation limits', () => {
      const invalidLimits = [
        { memoryLimit: '256', cpuLimit: '50%' }, // Missing unit
        { memoryLimit: '256MB', cpuLimit: '50' }, // Missing %
        { memoryLimit: '256TB', cpuLimit: '50%' }, // Invalid unit
        { memoryLimit: '256MB', cpuLimit: '150%' }, // Over 100%
      ];

      invalidLimits.forEach(limits => {
        const manifest: any = {
          name: 'test-plugin',
          version: '1.0.0',
          entry: './index.js',
          isolation: {
            workerThread: true,
            ...limits,
          },
        };

        const result = validator.validate(manifest);
        expect(result.valid).toBe(false);
      });
    });

    it('should validate autoweave version constraints', () => {
      const validConstraints = [
        { minVersion: '2.0.0', maxVersion: '3.0.0' },
        { minVersion: '1.0.0', maxVersion: '2.0.0' },
        { minVersion: '2.5.0' }, // No max version
        { maxVersion: '3.0.0' }, // No min version
      ];

      validConstraints.forEach(constraints => {
        const manifest: any = {
          name: 'test-plugin',
          version: '1.0.0',
          entry: './index.js',
          autoweave: constraints,
        };

        const result = validator.validate(manifest);
        const autoweaveErrors = result.errors.filter(e => e.field.includes('autoweave'));
        expect(autoweaveErrors).toHaveLength(0);
      });
    });

    it('should validate hook paths', () => {
      const manifest: any = {
        name: 'test-plugin',
        version: '1.0.0',
        entry: './index.js',
        hooks: {
          onLoad: './hooks/load.js',
          onUnload: './hooks/unload.js',
          onError: './hooks/error.js',
        },
      };

      const result = validator.validate(manifest);
      const hookErrors = result.errors.filter(e => e.field.includes('hooks'));
      expect(hookErrors).toHaveLength(0);
    });

    it('should validate signature format', () => {
      const validSignature = {
        algorithm: 'SHA-256',
        hash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        publicKey: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----',
      };

      const manifest: any = {
        name: 'test-plugin',
        version: '1.0.0',
        entry: './index.js',
        signature: validSignature,
      };

      const result = validator.validate(manifest);
      const signatureErrors = result.errors.filter(e => e.field.includes('signature'));
      expect(signatureErrors).toHaveLength(0);
    });

    it('should reject invalid signature algorithms', () => {
      const manifest: any = {
        name: 'test-plugin',
        version: '1.0.0',
        entry: './index.js',
        signature: {
          algorithm: 'MD5', // Not allowed
          hash: 'abc123',
          publicKey: '-----BEGIN PUBLIC KEY-----\nkey\n-----END PUBLIC KEY-----',
        },
      };

      const result = validator.validate(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: expect.stringContaining('algorithm'),
        })
      );
    });

    it('should validate dependency formats', () => {
      const manifest: any = {
        name: 'test-plugin',
        version: '1.0.0',
        entry: './index.js',
        dependencies: {
          external: [
            'axios@^1.6.0',
            'lodash@~4.17.0',
            'express@4.18.2',
            '@types/node@*',
          ],
          autoweave: [
            '@autoweave/memory@^2.0.0',
            '@autoweave/llm@~1.5.0',
          ],
        },
      };

      const result = validator.validate(manifest);
      const depErrors = result.errors.filter(e => e.field.includes('dependencies'));
      expect(depErrors).toHaveLength(0);
    });
  });

  describe('error formatting', () => {
    it('should provide clear error messages', () => {
      const manifest: any = {
        name: 'test-plugin',
        version: '1.0',
        entry: 123, // Should be string
        permissions: ['invalid:permission:format'],
      };

      const result = validator.validate(manifest);
      
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: '/version',
          message: expect.stringContaining('pattern'),
        })
      );

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: '/entry',
          message: expect.stringContaining('string'),
        })
      );
    });
  });

  describe('schema caching', () => {
    it('should cache compiled schema for performance', () => {
      const manifest: PluginManifest = {
        name: 'test-plugin',
        version: '1.0.0',
        entry: './index.js',
      } as any;

      // First validation compiles schema
      const start1 = performance.now();
      validator.validate(manifest);
      const time1 = performance.now() - start1;

      // Second validation uses cached schema
      const start2 = performance.now();
      validator.validate(manifest);
      const time2 = performance.now() - start2;

      // Cached validation should be faster
      expect(time2).toBeLessThan(time1);
    });
  });
});