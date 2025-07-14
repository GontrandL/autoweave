import { PermissionManager } from '../src/security/permission-manager';
import { PluginPermissions } from '../src/types/plugin';

describe('PermissionManager', () => {
  describe('checkFilesystemAccess', () => {
    const permissions: PluginPermissions = {
      filesystem: [
        { path: '/tmp/plugin-data', mode: 'readwrite' },
        { path: '/var/log/plugin', mode: 'read' }
      ]
    };

    it('should allow access to permitted paths', () => {
      const result = PermissionManager.checkFilesystemAccess(
        '/tmp/plugin-data/file.txt',
        'read',
        permissions
      );
      expect(result.allowed).toBe(true);
    });

    it('should deny access to non-permitted paths', () => {
      const result = PermissionManager.checkFilesystemAccess(
        '/etc/passwd',
        'read',
        permissions
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not in allowed filesystem permissions');
    });

    it('should prevent directory traversal', () => {
      const result = PermissionManager.checkFilesystemAccess(
        '/tmp/plugin-data/../../../etc/passwd',
        'read',
        permissions
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Directory traversal detected');
    });

    it('should respect mode restrictions', () => {
      const result = PermissionManager.checkFilesystemAccess(
        '/var/log/plugin/app.log',
        'write',
        permissions
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Write access not permitted');
    });
  });

  describe('checkNetworkAccess', () => {
    const permissions: PluginPermissions = {
      network: {
        outbound: [
          'https://api.example.com/*',
          'https://*.mydomain.com/*'
        ]
      }
    };

    it('should allow access to permitted URLs', () => {
      const result = PermissionManager.checkNetworkAccess(
        'https://api.example.com/users',
        permissions
      );
      expect(result.allowed).toBe(true);
    });

    it('should support wildcard subdomains', () => {
      const result = PermissionManager.checkNetworkAccess(
        'https://api.mydomain.com/data',
        permissions
      );
      expect(result.allowed).toBe(true);
    });

    it('should deny access to non-permitted URLs', () => {
      const result = PermissionManager.checkNetworkAccess(
        'https://evil.com/steal-data',
        permissions
      );
      expect(result.allowed).toBe(false);
    });

    it('should validate URL format', () => {
      const result = PermissionManager.checkNetworkAccess(
        'not-a-url',
        permissions
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Invalid URL format');
    });
  });

  describe('checkUSBAccess', () => {
    const permissions: PluginPermissions = {
      usb: {
        vendor_ids: ['0x1234', '0x5678'],
        product_ids: ['0xABCD']
      }
    };

    it('should allow access to permitted devices', () => {
      const result = PermissionManager.checkUSBAccess(
        '0x1234',
        '0xABCD',
        permissions
      );
      expect(result.allowed).toBe(true);
    });

    it('should deny access to non-permitted vendor IDs', () => {
      const result = PermissionManager.checkUSBAccess(
        '0x9999',
        '0xABCD',
        permissions
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Vendor ID not allowed');
    });

    it('should deny access to non-permitted product IDs', () => {
      const result = PermissionManager.checkUSBAccess(
        '0x1234',
        '0x9999',
        permissions
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Product ID not allowed');
    });
  });

  describe('checkModuleAccess', () => {
    const permissions: PluginPermissions = {
      network: {
        outbound: ['https://example.com']
      }
    };

    it('should allow safe built-in modules', () => {
      const result = PermissionManager.checkModuleAccess('crypto', permissions);
      expect(result.allowed).toBe(true);
    });

    it('should block dangerous modules', () => {
      const result = PermissionManager.checkModuleAccess('fs', permissions);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('blocked for security reasons');
    });

    it('should allow relative imports', () => {
      const result = PermissionManager.checkModuleAccess('./utils', permissions);
      expect(result.allowed).toBe(true);
    });

    it('should allow npm modules when network access is granted', () => {
      const result = PermissionManager.checkModuleAccess('axios', permissions);
      expect(result.allowed).toBe(true);
    });
  });

  describe('validatePermissions', () => {
    it('should validate filesystem paths', () => {
      const permissions: PluginPermissions = {
        filesystem: [
          { path: 'relative/path', mode: 'read' }
        ]
      };
      
      const errors = PermissionManager.validatePermissions(permissions);
      expect(errors).toContain('Filesystem path must be absolute: relative/path');
    });

    it('should detect dangerous paths', () => {
      const permissions: PluginPermissions = {
        filesystem: [
          { path: '/etc', mode: 'read' }
        ]
      };
      
      const errors = PermissionManager.validatePermissions(permissions);
      expect(errors).toContain('Dangerous filesystem path: /etc');
    });

    it('should validate memory limits', () => {
      const permissions: PluginPermissions = {
        memory: {
          max_heap_mb: 2048,
          max_workers: 20
        }
      };
      
      const errors = PermissionManager.validatePermissions(permissions);
      expect(errors).toContain('Memory limit too high (max 1024MB)');
      expect(errors).toContain('Too many workers requested (max 8)');
    });

    it('should validate network URLs', () => {
      const permissions: PluginPermissions = {
        network: {
          outbound: ['not-a-url']
        }
      };
      
      const errors = PermissionManager.validatePermissions(permissions);
      expect(errors).toContain('Invalid network URL: not-a-url');
    });
  });
});