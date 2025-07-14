/**
 * Plugin USB Capability Extension
 * Extends plugin manifest validation and permission system for USB events
 */

const Ajv = require('ajv');

/**
 * USB permission schema for plugin manifests
 */
const usbPermissionSchema = {
  type: 'object',
  properties: {
    vendor_ids: {
      type: 'array',
      items: {
        type: 'string',
        pattern: '^0x[0-9A-Fa-f]{4}$'
      },
      description: 'List of allowed USB vendor IDs in hex format (e.g., "0x04A9")'
    },
    product_ids: {
      type: 'array',
      items: {
        type: 'string',
        pattern: '^0x[0-9A-Fa-f]{4}$'
      },
      description: 'List of allowed USB product IDs in hex format'
    },
    device_classes: {
      type: 'array',
      items: {
        type: 'integer',
        minimum: 0,
        maximum: 255
      },
      description: 'List of allowed USB device classes'
    },
    interfaces: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          class: { type: 'integer', minimum: 0, maximum: 255 },
          subclass: { type: 'integer', minimum: 0, maximum: 255 },
          protocol: { type: 'integer', minimum: 0, maximum: 255 }
        }
      },
      description: 'List of allowed USB interfaces'
    },
    filter: {
      type: 'object',
      additionalProperties: true,
      description: 'Additional custom filters'
    },
    exclusive: {
      type: 'boolean',
      default: false,
      description: 'Request exclusive access to matching devices'
    },
    detach_kernel_driver: {
      type: 'boolean',
      default: false,
      description: 'Detach kernel driver if needed (requires elevated permissions)'
    }
  },
  additionalProperties: false
};

/**
 * USB hooks schema for plugin manifests
 */
const usbHooksSchema = {
  type: 'object',
  properties: {
    onUSBAttach: {
      type: 'string',
      description: 'Function to call when USB device is attached'
    },
    onUSBDetach: {
      type: 'string',
      description: 'Function to call when USB device is detached'
    },
    onUSBError: {
      type: 'string',
      description: 'Function to call on USB errors'
    }
  }
};

/**
 * Extended plugin manifest schema with USB support
 */
const extendedManifestSchema = {
  type: 'object',
  required: ['name', 'version', 'entry', 'permissions'],
  properties: {
    name: {
      type: 'string',
      pattern: '^[a-z0-9-]+$'
    },
    version: {
      type: 'string',
      pattern: '^\\d+\\.\\d+\\.\\d+$'
    },
    description: {
      type: 'string'
    },
    author: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string', format: 'email' }
      }
    },
    entry: {
      type: 'string'
    },
    permissions: {
      type: 'object',
      properties: {
        filesystem: {
          type: 'array',
          items: {
            type: 'object',
            required: ['path', 'mode'],
            properties: {
              path: { type: 'string' },
              mode: { type: 'string', enum: ['read', 'readwrite'] }
            }
          }
        },
        network: {
          type: 'object',
          properties: {
            allowedHosts: {
              type: 'array',
              items: { type: 'string' }
            },
            rateLimit: { type: 'integer', minimum: 1 }
          }
        },
        usb: usbPermissionSchema,
        queue: {
          type: 'array',
          items: { type: 'string' }
        },
        memory: {
          type: 'object',
          properties: {
            max_heap_mb: { type: 'integer', minimum: 1 },
            max_workers: { type: 'integer', minimum: 1, maximum: 10 },
            max_storage_mb: { type: 'integer', minimum: 1 }
          }
        }
      }
    },
    hooks: {
      type: 'object',
      properties: {
        onLoad: { type: 'string' },
        onUnload: { type: 'string' },
        onJobReceived: { type: 'string' },
        ...usbHooksSchema.properties
      }
    },
    dependencies: {
      type: 'object'
    }
  }
};

/**
 * Plugin USB Capability validator and enhancer
 */
class PluginUSBCapability {
  constructor() {
    this.ajv = new Ajv({ allErrors: true, verbose: true });
    this.manifestValidator = this.ajv.compile(extendedManifestSchema);
    this.usbPermissionValidator = this.ajv.compile(usbPermissionSchema);
  }

  /**
   * Validate plugin manifest with USB extensions
   */
  validateManifest(manifest) {
    const valid = this.manifestValidator(manifest);
    
    if (!valid) {
      const errors = this.manifestValidator.errors.map(err => ({
        path: err.instancePath,
        message: err.message,
        params: err.params
      }));
      
      throw new Error(`Invalid manifest: ${JSON.stringify(errors, null, 2)}`);
    }
    
    // Additional USB-specific validation
    if (manifest.permissions?.usb) {
      this.validateUSBPermissions(manifest.permissions.usb);
    }
    
    // Validate USB hooks if USB permissions are requested
    if (manifest.permissions?.usb && manifest.hooks) {
      this.validateUSBHooks(manifest);
    }
    
    return true;
  }

  /**
   * Validate USB permissions
   */
  validateUSBPermissions(usbPermissions) {
    const valid = this.usbPermissionValidator(usbPermissions);
    
    if (!valid) {
      const errors = this.usbPermissionValidator.errors.map(err => ({
        path: err.instancePath,
        message: err.message
      }));
      
      throw new Error(`Invalid USB permissions: ${JSON.stringify(errors, null, 2)}`);
    }
    
    // Additional business logic validation
    if (usbPermissions.vendor_ids && usbPermissions.vendor_ids.length > 100) {
      throw new Error('Too many vendor IDs specified (max 100)');
    }
    
    if (usbPermissions.product_ids && usbPermissions.product_ids.length > 100) {
      throw new Error('Too many product IDs specified (max 100)');
    }
    
    // Warn about elevated permissions
    if (usbPermissions.detach_kernel_driver) {
      console.warn('Plugin requests kernel driver detachment - requires elevated permissions');
    }
    
    return true;
  }

  /**
   * Validate USB hooks
   */
  validateUSBHooks(manifest) {
    const hooks = manifest.hooks;
    const usbHooks = ['onUSBAttach', 'onUSBDetach', 'onUSBError'];
    
    for (const hookName of usbHooks) {
      if (hooks[hookName] && typeof hooks[hookName] !== 'string') {
        throw new Error(`USB hook ${hookName} must be a string (function name)`);
      }
    }
    
    // Warn if USB permissions but no USB hooks
    if (!hooks.onUSBAttach && !hooks.onUSBDetach) {
      console.warn('Plugin has USB permissions but no USB event handlers');
    }
    
    return true;
  }

  /**
   * Enhance plugin manifest with USB defaults
   */
  enhanceManifest(manifest) {
    const enhanced = { ...manifest };
    
    // Add default hooks if missing
    if (enhanced.permissions?.usb && !enhanced.hooks) {
      enhanced.hooks = {};
    }
    
    // Add default USB error handler if missing
    if (enhanced.permissions?.usb && enhanced.hooks && !enhanced.hooks.onUSBError) {
      enhanced.hooks.onUSBError = 'handleUSBError';
    }
    
    // Add default memory limits for USB plugins
    if (enhanced.permissions?.usb) {
      enhanced.permissions.memory = enhanced.permissions.memory || {};
      enhanced.permissions.memory.max_heap_mb = enhanced.permissions.memory.max_heap_mb || 128;
    }
    
    return enhanced;
  }

  /**
   * Create USB device filter from permissions
   */
  createDeviceFilter(usbPermissions) {
    return {
      matchDevice: (device) => {
        // Check vendor ID
        if (usbPermissions.vendor_ids && usbPermissions.vendor_ids.length > 0) {
          const vendorHex = `0x${device.vendorId.toString(16).toUpperCase().padStart(4, '0')}`;
          if (!usbPermissions.vendor_ids.includes(vendorHex)) {
            return false;
          }
        }
        
        // Check product ID
        if (usbPermissions.product_ids && usbPermissions.product_ids.length > 0) {
          const productHex = `0x${device.productId.toString(16).toUpperCase().padStart(4, '0')}`;
          if (!usbPermissions.product_ids.includes(productHex)) {
            return false;
          }
        }
        
        // Check device class
        if (usbPermissions.device_classes && device.deviceClass !== undefined) {
          if (!usbPermissions.device_classes.includes(device.deviceClass)) {
            return false;
          }
        }
        
        // Check custom filter
        if (usbPermissions.filter) {
          for (const [key, value] of Object.entries(usbPermissions.filter)) {
            if (device[key] !== value) {
              return false;
            }
          }
        }
        
        return true;
      }
    };
  }

  /**
   * Generate USB permission summary
   */
  generatePermissionSummary(usbPermissions) {
    const summary = {
      scope: 'limited',
      devices: [],
      capabilities: []
    };
    
    // Determine scope
    if (!usbPermissions.vendor_ids && !usbPermissions.product_ids && !usbPermissions.device_classes) {
      summary.scope = 'all-devices';
    } else if (usbPermissions.vendor_ids && usbPermissions.vendor_ids.length === 1) {
      summary.scope = 'single-vendor';
    } else if (usbPermissions.product_ids && usbPermissions.product_ids.length === 1) {
      summary.scope = 'single-product';
    }
    
    // List specific devices
    if (usbPermissions.vendor_ids) {
      summary.devices.push(`Vendors: ${usbPermissions.vendor_ids.join(', ')}`);
    }
    
    if (usbPermissions.product_ids) {
      summary.devices.push(`Products: ${usbPermissions.product_ids.join(', ')}`);
    }
    
    if (usbPermissions.device_classes) {
      const classNames = usbPermissions.device_classes.map(c => this.getDeviceClassName(c));
      summary.devices.push(`Classes: ${classNames.join(', ')}`);
    }
    
    // List capabilities
    if (usbPermissions.exclusive) {
      summary.capabilities.push('exclusive-access');
    }
    
    if (usbPermissions.detach_kernel_driver) {
      summary.capabilities.push('kernel-driver-detach');
    }
    
    return summary;
  }

  /**
   * Get human-readable device class name
   */
  getDeviceClassName(classCode) {
    const classNames = {
      0x00: 'Device',
      0x01: 'Audio',
      0x02: 'Communications',
      0x03: 'HID',
      0x05: 'Physical',
      0x06: 'Image',
      0x07: 'Printer',
      0x08: 'Mass Storage',
      0x09: 'Hub',
      0x0A: 'CDC-Data',
      0x0B: 'Smart Card',
      0x0D: 'Content Security',
      0x0E: 'Video',
      0x0F: 'Personal Healthcare',
      0x10: 'Audio/Video',
      0xDC: 'Diagnostic',
      0xE0: 'Wireless',
      0xEF: 'Miscellaneous',
      0xFE: 'Application Specific',
      0xFF: 'Vendor Specific'
    };
    
    return classNames[classCode] || `Class 0x${classCode.toString(16).toUpperCase()}`;
  }

  /**
   * Check if plugin can access USB device
   */
  canAccessDevice(manifest, device) {
    if (!manifest.permissions?.usb) {
      return false;
    }
    
    const filter = this.createDeviceFilter(manifest.permissions.usb);
    return filter.matchDevice(device);
  }
}

module.exports = PluginUSBCapability;