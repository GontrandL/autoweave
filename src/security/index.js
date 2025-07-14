/**
 * Security Module Exports
 * Main entry point for the Worker Thread security sandbox implementation
 */

const PluginSecurityManager = require('./plugin-security-manager');
const SecurityMonitor = require('./security-monitor');
const ResourceEnforcer = require('./resource-enforcer');
const SecurityBoundary = require('./security-boundary');
const SecurePluginRunner = require('./secure-plugin-runner');

/**
 * Create a new security manager with default configuration
 */
function createSecurityManager(options = {}) {
  return new PluginSecurityManager(options);
}

/**
 * Security presets for different use cases
 */
const SecurityPresets = {
  // Development environment - relaxed security
  development: {
    securityLevel: 'low',
    monitor: {
      blockOnViolation: false,
      alertOnAnomaly: false
    },
    enforcer: {
      enforceHardLimits: false
    },
    boundary: {
      encryptMessages: false,
      auditEnabled: false
    }
  },
  
  // Testing environment - balanced security
  testing: {
    securityLevel: 'medium',
    monitor: {
      maxEventsPerMinute: 1000,
      maxErrorsPerMinute: 50
    },
    enforcer: {
      maxHeapUsageMB: 128,
      maxCpuPercent: 50
    },
    boundary: {
      encryptMessages: true,
      validateSchema: true
    }
  },
  
  // Production environment - strict security
  production: {
    securityLevel: 'high',
    requireSignedPlugins: true,
    monitor: {
      maxEventsPerMinute: 500,
      maxErrorsPerMinute: 20,
      blockOnViolation: true,
      alertOnAnomaly: true
    },
    enforcer: {
      maxHeapUsageMB: 64,
      maxCpuPercent: 30,
      enforceHardLimits: true,
      gracePeriodMs: 5000
    },
    boundary: {
      encryptMessages: true,
      validateSchema: true,
      strictMode: true,
      maxMessageSize: 512 * 1024
    }
  }
};

/**
 * Security utilities
 */
const SecurityUtils = {
  /**
   * Validate plugin manifest
   */
  validateManifest(manifest) {
    const manager = new PluginSecurityManager();
    try {
      manager.validateManifest(manifest);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  },
  
  /**
   * Calculate risk score for a plugin based on its permissions
   */
  calculatePermissionRisk(permissions) {
    let score = 0;
    
    // File system access
    if (permissions.filesystem) {
      score += permissions.filesystem.length * 10;
      permissions.filesystem.forEach(fs => {
        if (fs.mode === 'readwrite') score += 5;
        if (fs.path === '/' || fs.path.includes('..')) score += 20;
      });
    }
    
    // Network access
    if (permissions.network) {
      score += 15;
      if (!permissions.network.allowedHosts) score += 10;
    }
    
    // USB access
    if (permissions.usb) {
      score += 20;
    }
    
    // Memory usage
    if (permissions.memory) {
      if (permissions.memory.max_heap_mb > 256) score += 10;
      if (permissions.memory.max_workers > 2) score += 5;
    }
    
    return Math.min(100, score);
  },
  
  /**
   * Generate security recommendations based on manifest
   */
  generateSecurityRecommendations(manifest) {
    const recommendations = [];
    const permissions = manifest.permissions || {};
    
    // File system recommendations
    if (permissions.filesystem) {
      permissions.filesystem.forEach(fs => {
        if (fs.path === '/' || fs.path.includes('..')) {
          recommendations.push({
            type: 'critical',
            message: `Avoid broad filesystem access: ${fs.path}`
          });
        }
        if (fs.mode === 'readwrite' && !fs.path.includes('/tmp')) {
          recommendations.push({
            type: 'warning',
            message: `Consider read-only access for: ${fs.path}`
          });
        }
      });
    }
    
    // Network recommendations
    if (permissions.network && !permissions.network.allowedHosts) {
      recommendations.push({
        type: 'warning',
        message: 'Specify allowed hosts for network access'
      });
    }
    
    // Memory recommendations
    if (permissions.memory) {
      if (permissions.memory.max_heap_mb > 256) {
        recommendations.push({
          type: 'info',
          message: 'Consider reducing memory allocation'
        });
      }
    }
    
    // General recommendations
    if (!manifest.author || !manifest.author.email) {
      recommendations.push({
        type: 'info',
        message: 'Add author contact information'
      });
    }
    
    return recommendations;
  }
};

/**
 * Example usage and integration guide
 */
const SecurityExamples = {
  /**
   * Basic plugin loading example
   */
  async basicExample() {
    // Create security manager
    const security = createSecurityManager(SecurityPresets.production);
    
    // Initialize
    await security.initialize();
    
    // Load plugin
    const pluginId = await security.loadPlugin('/path/to/plugin');
    
    // Start plugin
    await security.startPlugin(pluginId);
    
    // Monitor events
    security.on('security-violation', (data) => {
      console.error('Security violation:', data);
    });
    
    security.on('plugin-blocked', (data) => {
      console.error('Plugin blocked:', data);
    });
    
    // Get status
    const status = security.getSecurityStatus();
    console.log('Security status:', status);
    
    // Generate report
    const report = security.generateSecurityReport();
    console.log('Security report:', report);
    
    // Cleanup
    await security.cleanup();
  },
  
  /**
   * Custom security configuration example
   */
  customExample() {
    const security = createSecurityManager({
      securityLevel: 'high',
      requireSignedPlugins: true,
      maxActivePlugins: 5,
      
      monitor: {
        maxEventsPerMinute: 300,
        maxErrorsPerMinute: 10,
        anomalyDetectionWindow: 120000 // 2 minutes
      },
      
      enforcer: {
        maxHeapUsageMB: 32,
        maxCpuPercent: 25,
        maxFileHandles: 5,
        maxNetworkRequestsPerMinute: 30
      },
      
      boundary: {
        encryptMessages: true,
        algorithm: 'aes-256-gcm',
        maxMessageSize: 256 * 1024, // 256KB
        auditRetentionMs: 7200000 // 2 hours
      }
    });
    
    return security;
  }
};

module.exports = {
  // Main components
  PluginSecurityManager,
  SecurityMonitor,
  ResourceEnforcer,
  SecurityBoundary,
  SecurePluginRunner,
  
  // Factory function
  createSecurityManager,
  
  // Presets and utilities
  SecurityPresets,
  SecurityUtils,
  SecurityExamples
};