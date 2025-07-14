import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';

export interface EnhancedPlatformInfo {
  platform: NodeJS.Platform;
  arch: string;
  osRelease: string;
  kernelVersion?: string;
  isLinux: boolean;
  isWindows: boolean;
  isMacOS: boolean;
  hasUdev: boolean;
  hasLibusb: boolean;
  hasSystemd: boolean;
  hasRedis: boolean;
  isWSL: boolean;
  isDocker: boolean;
  supportsHotplug: boolean;
  capabilities: PlatformCapabilities;
}

export interface PlatformCapabilities {
  usbAccess: boolean;
  adminPrivileges: boolean;
  canInstallUdevRules: boolean;
  canAccessRedis: boolean;
  recommendedStrategy: 'libusb' | 'udev' | 'hybrid' | 'none';
}

export class EnhancedPlatformDetector {
  static detect(): EnhancedPlatformInfo {
    const platform = process.platform;
    const arch = process.arch;
    const osRelease = os.release();
    
    const isLinux = platform === 'linux';
    const isWindows = platform === 'win32';
    const isMacOS = platform === 'darwin';
    
    // Enhanced detections
    const hasUdev = isLinux && this.checkUdevAvailable();
    const hasLibusb = this.checkLibusbAvailable();
    const hasSystemd = isLinux && this.checkSystemdAvailable();
    const hasRedis = this.checkRedisAvailable();
    const isWSL = this.checkWSL();
    const isDocker = this.checkDocker();
    const kernelVersion = isLinux ? this.getKernelVersion() : undefined;
    
    // Determine capabilities
    const capabilities = this.determineCapabilities({
      platform,
      isLinux,
      isWindows,
      isMacOS,
      hasUdev,
      hasLibusb,
      hasSystemd,
      hasRedis,
      isWSL,
      isDocker
    });
    
    const supportsHotplug = capabilities.recommendedStrategy !== 'none';
    
    return {
      platform,
      arch,
      osRelease,
      kernelVersion,
      isLinux,
      isWindows,
      isMacOS,
      hasUdev,
      hasLibusb,
      hasSystemd,
      hasRedis,
      isWSL,
      isDocker,
      supportsHotplug,
      capabilities
    };
  }

  private static checkUdevAvailable(): boolean {
    try {
      // Check for udev paths and commands
      const udevPaths = [
        '/lib/udev',
        '/usr/lib/udev',
        '/etc/udev',
        '/run/udev'
      ];
      
      const hasUdevPath = udevPaths.some(path => {
        try {
          return fs.existsSync(path);
        } catch {
          return false;
        }
      });
      
      // Check if udevadm is available
      try {
        execSync('which udevadm', { stdio: 'ignore' });
        return true;
      } catch {
        return hasUdevPath;
      }
    } catch {
      return false;
    }
  }

  private static checkLibusbAvailable(): boolean {
    try {
      // Try to require the usb module
      require('usb');
      return true;
    } catch {
      // Check if libusb is installed on system
      if (process.platform === 'linux') {
        try {
          execSync('ldconfig -p | grep libusb', { stdio: 'ignore' });
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  private static checkSystemdAvailable(): boolean {
    try {
      execSync('systemctl --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private static checkRedisAvailable(): boolean {
    try {
      execSync('redis-cli ping', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private static checkWSL(): boolean {
    if (process.platform !== 'linux') return false;
    
    try {
      const procVersion = fs.readFileSync('/proc/version', 'utf8');
      return procVersion.toLowerCase().includes('microsoft');
    } catch {
      return false;
    }
  }

  private static checkDocker(): boolean {
    try {
      return fs.existsSync('/.dockerenv') || 
             fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker');
    } catch {
      return false;
    }
  }

  private static getKernelVersion(): string | undefined {
    try {
      return execSync('uname -r', { encoding: 'utf8' }).trim();
    } catch {
      return undefined;
    }
  }

  private static determineCapabilities(info: any): PlatformCapabilities {
    const capabilities: PlatformCapabilities = {
      usbAccess: false,
      adminPrivileges: false,
      canInstallUdevRules: false,
      canAccessRedis: false,
      recommendedStrategy: 'none'
    };

    // Check USB access
    if (info.hasLibusb) {
      try {
        const usb = require('usb');
        usb.getDeviceList();
        capabilities.usbAccess = true;
      } catch {
        capabilities.usbAccess = false;
      }
    }

    // Check admin privileges
    if (info.isLinux) {
      capabilities.adminPrivileges = process.getuid ? process.getuid() === 0 : false;
    } else if (info.isWindows) {
      try {
        execSync('net session', { stdio: 'ignore' });
        capabilities.adminPrivileges = true;
      } catch {
        capabilities.adminPrivileges = false;
      }
    } else if (info.isMacOS) {
      capabilities.adminPrivileges = process.getuid ? process.getuid() === 0 : false;
    }

    // Check if we can install udev rules
    capabilities.canInstallUdevRules = info.hasUdev && 
                                     capabilities.adminPrivileges && 
                                     !info.isWSL && 
                                     !info.isDocker;

    // Check Redis access
    capabilities.canAccessRedis = info.hasRedis;

    // Determine recommended strategy
    if (info.isLinux) {
      if (info.hasUdev && capabilities.canInstallUdevRules) {
        capabilities.recommendedStrategy = 'hybrid'; // Both udev and libusb
      } else if (capabilities.usbAccess) {
        capabilities.recommendedStrategy = 'libusb';
      } else if (info.hasUdev) {
        capabilities.recommendedStrategy = 'udev';
      }
    } else if (capabilities.usbAccess) {
      capabilities.recommendedStrategy = 'libusb';
    }

    return capabilities;
  }

  static getOptimizedConfig(platformInfo: EnhancedPlatformInfo) {
    const config = {
      fallback: {
        enable_udev: false,
        udev_script_path: '/usr/local/bin/autoweave-udev-notify'
      },
      performance: {
        max_events_per_second: 100,
        debounce_ms: 50,
        batch_size: 10
      },
      memory: {
        max_heap_mb: 128,
        gc_interval_ms: 30000
      },
      monitoring: {
        enabled: true,
        interval: 10000,
        healthcheck_port: 3456
      }
    };

    // Platform-specific optimizations
    if (platformInfo.isLinux) {
      if (platformInfo.capabilities.recommendedStrategy === 'hybrid') {
        config.fallback.enable_udev = true;
        config.performance.max_events_per_second = 200; // Can handle more with dual sources
      }
      
      if (platformInfo.isWSL) {
        config.performance.debounce_ms = 100; // WSL can be slower
        config.memory.max_heap_mb = 64; // Conservative memory in WSL
      }
      
      if (platformInfo.isDocker) {
        config.monitoring.enabled = false; // Disable healthcheck in Docker
        config.memory.max_heap_mb = 64; // Conservative memory in containers
      }
    }

    if (platformInfo.isWindows) {
      config.performance.debounce_ms = 100; // Windows USB events can be noisy
      config.performance.batch_size = 5; // Smaller batches on Windows
    }

    if (platformInfo.isMacOS) {
      config.performance.max_events_per_second = 50; // More conservative on macOS
      config.performance.debounce_ms = 75;
    }

    // Adjust based on kernel version
    if (platformInfo.kernelVersion) {
      const majorVersion = parseInt(platformInfo.kernelVersion.split('.')[0]);
      if (majorVersion >= 5) {
        config.performance.max_events_per_second = 150; // Newer kernels handle USB better
      }
    }

    return config;
  }

  static generateErrorRecoveryStrategy(platformInfo: EnhancedPlatformInfo) {
    const strategies = [];

    if (platformInfo.capabilities.recommendedStrategy === 'libusb') {
      strategies.push({
        name: 'libusb-retry',
        description: 'Retry libusb operations with exponential backoff',
        maxRetries: 3,
        initialDelay: 100,
        maxDelay: 2000
      });
    }

    if (platformInfo.hasUdev) {
      strategies.push({
        name: 'udev-fallback',
        description: 'Fall back to udev monitoring if libusb fails',
        trigger: 'libusb-error-count > 5'
      });
    }

    if (platformInfo.isLinux && !platformInfo.capabilities.adminPrivileges) {
      strategies.push({
        name: 'permission-helper',
        description: 'Guide user to fix USB permissions',
        message: 'Run: sudo usermod -a -G plugdev $USER && sudo udevadm control --reload-rules'
      });
    }

    if (!platformInfo.capabilities.canAccessRedis) {
      strategies.push({
        name: 'redis-reconnect',
        description: 'Attempt to reconnect to Redis with backoff',
        maxRetries: 10,
        retryInterval: 5000
      });
    }

    return strategies;
  }
}