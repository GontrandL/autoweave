import { PluginPermissions } from '../types/plugin';
import { normalize, isAbsolute } from 'path';
import { URL } from 'url';

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

export class PermissionManager {
  private static readonly SAFE_MODULES = [
    'util', 'path', 'crypto', 'url', 'querystring', 'events',
    'stream', 'buffer', 'string_decoder', 'punycode'
  ];

  private static readonly BLOCKED_MODULES = [
    'fs', 'fs/promises', 'child_process', 'cluster', 'dgram', 
    'dns', 'net', 'os', 'process', 'v8', 'vm', 'worker_threads'
  ];

  /**
   * Check if a filesystem path access is allowed
   */
  static checkFilesystemAccess(
    path: string, 
    mode: 'read' | 'write' | 'readwrite',
    permissions: PluginPermissions
  ): PermissionCheckResult {
    if (!permissions.filesystem) {
      return { allowed: false, reason: 'No filesystem permissions granted' };
    }

    // Normalize and validate path
    const normalizedPath = normalize(path);
    
    // Prevent directory traversal attacks
    if (normalizedPath.includes('..')) {
      return { allowed: false, reason: 'Directory traversal detected' };
    }

    // Check against allowed paths
    for (const permission of permissions.filesystem) {
      const allowedPath = normalize(permission.path);
      
      // Check if requested path is within allowed path
      if (normalizedPath.startsWith(allowedPath) || normalizedPath === allowedPath) {
        // Check if mode is compatible
        if (permission.mode === 'readwrite' || permission.mode === mode) {
          return { allowed: true };
        }
        
        if (mode === 'write' && permission.mode === 'read') {
          return { allowed: false, reason: 'Write access not permitted for this path' };
        }
      }
    }

    return { allowed: false, reason: 'Path not in allowed filesystem permissions' };
  }

  /**
   * Check if a network request is allowed
   */
  static checkNetworkAccess(
    url: string,
    permissions: PluginPermissions
  ): PermissionCheckResult {
    if (!permissions.network?.outbound) {
      return { allowed: false, reason: 'No network permissions granted' };
    }

    try {
      const requestUrl = new URL(url);
      
      for (const allowedUrl of permissions.network.outbound) {
        const allowed = new URL(allowedUrl);
        
        // Check protocol
        if (allowed.protocol !== requestUrl.protocol) {
          continue;
        }
        
        // Check hostname (with wildcard support)
        if (allowed.hostname === '*' || allowed.hostname === requestUrl.hostname) {
          // Check port if specified
          if (allowed.port && allowed.port !== requestUrl.port) {
            continue;
          }
          
          // Check path prefix
          if (allowed.pathname !== '/' && !requestUrl.pathname.startsWith(allowed.pathname)) {
            continue;
          }
          
          return { allowed: true };
        }
        
        // Support subdomain wildcards (*.example.com)
        if (allowed.hostname.startsWith('*.')) {
          const domain = allowed.hostname.slice(2);
          if (requestUrl.hostname.endsWith(domain)) {
            return { allowed: true };
          }
        }
      }
    } catch (error) {
      return { allowed: false, reason: 'Invalid URL format' };
    }

    return { allowed: false, reason: 'URL not in allowed network permissions' };
  }

  /**
   * Check if a USB device access is allowed
   */
  static checkUSBAccess(
    vendorId: string,
    productId: string,
    permissions: PluginPermissions
  ): PermissionCheckResult {
    if (!permissions.usb) {
      return { allowed: false, reason: 'No USB permissions granted' };
    }

    const { vendor_ids, product_ids } = permissions.usb;

    // Check vendor ID
    if (vendor_ids && vendor_ids.length > 0) {
      if (!vendor_ids.includes(vendorId)) {
        return { allowed: false, reason: 'Vendor ID not allowed' };
      }
    }

    // Check product ID
    if (product_ids && product_ids.length > 0) {
      if (!product_ids.includes(productId)) {
        return { allowed: false, reason: 'Product ID not allowed' };
      }
    }

    return { allowed: true };
  }

  /**
   * Check if a module can be loaded
   */
  static checkModuleAccess(
    moduleName: string,
    permissions: PluginPermissions
  ): PermissionCheckResult {
    // Always block dangerous modules
    if (this.BLOCKED_MODULES.includes(moduleName)) {
      return { allowed: false, reason: 'Module is blocked for security reasons' };
    }

    // Allow safe modules
    if (this.SAFE_MODULES.includes(moduleName)) {
      return { allowed: true };
    }

    // Check if it's a relative module (within plugin)
    if (moduleName.startsWith('./') || moduleName.startsWith('../')) {
      return { allowed: true };
    }

    // For npm modules, check if network access is allowed
    // (as they might make network requests)
    if (permissions.network?.outbound && permissions.network.outbound.length > 0) {
      return { allowed: true };
    }

    return { allowed: false, reason: 'Module not in allowed list' };
  }

  /**
   * Check if queue access is allowed
   */
  static checkQueueAccess(
    queueName: string,
    permissions: PluginPermissions
  ): PermissionCheckResult {
    if (!permissions.queue || permissions.queue.length === 0) {
      return { allowed: false, reason: 'No queue permissions granted' };
    }

    if (permissions.queue.includes(queueName)) {
      return { allowed: true };
    }

    return { allowed: false, reason: 'Queue not in allowed list' };
  }

  /**
   * Validate all permissions in a manifest
   */
  static validatePermissions(permissions: PluginPermissions): string[] {
    const errors: string[] = [];

    // Validate filesystem permissions
    if (permissions.filesystem) {
      for (const fs of permissions.filesystem) {
        if (!isAbsolute(fs.path)) {
          errors.push(`Filesystem path must be absolute: ${fs.path}`);
        }
        
        // Check for dangerous paths
        const dangerousPaths = ['/', '/etc', '/usr', '/bin', '/sbin', '/var', '/tmp'];
        if (dangerousPaths.includes(fs.path)) {
          errors.push(`Dangerous filesystem path: ${fs.path}`);
        }
      }
    }

    // Validate network permissions
    if (permissions.network?.outbound) {
      for (const url of permissions.network.outbound) {
        try {
          new URL(url);
        } catch {
          errors.push(`Invalid network URL: ${url}`);
        }
      }
    }

    // Validate memory limits
    if (permissions.memory) {
      if (permissions.memory.max_heap_mb && permissions.memory.max_heap_mb > 1024) {
        errors.push('Memory limit too high (max 1024MB)');
      }
      if (permissions.memory.max_workers && permissions.memory.max_workers > 8) {
        errors.push('Too many workers requested (max 8)');
      }
    }

    return errors;
  }

  /**
   * Create a sandbox-safe permissions object
   */
  static createSandboxPermissions(permissions: PluginPermissions): any {
    return {
      filesystem: permissions.filesystem?.map(fs => ({
        path: normalize(fs.path),
        mode: fs.mode
      })) || [],
      network: {
        outbound: permissions.network?.outbound || [],
        inbound: permissions.network?.inbound || null
      },
      usb: {
        vendor_ids: permissions.usb?.vendor_ids || [],
        product_ids: permissions.usb?.product_ids || []
      },
      memory: {
        max_heap_mb: permissions.memory?.max_heap_mb || 128,
        max_workers: permissions.memory?.max_workers || 1
      },
      queue: permissions.queue || []
    };
  }
}