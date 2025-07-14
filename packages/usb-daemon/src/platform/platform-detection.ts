export interface PlatformInfo {
  platform: NodeJS.Platform;
  arch: string;
  isLinux: boolean;
  isWindows: boolean;
  isMacOS: boolean;
  hasUdev: boolean;
  hasLibusb: boolean;
  supportsHotplug: boolean;
}

export class PlatformDetector {
  static detect(): PlatformInfo {
    const platform = process.platform;
    const arch = process.arch;
    
    const isLinux = platform === 'linux';
    const isWindows = platform === 'win32';
    const isMacOS = platform === 'darwin';
    
    // Check for udev availability on Linux
    const hasUdev = isLinux && this.checkUdevAvailable();
    
    // Check for libusb availability
    const hasLibusb = this.checkLibusbAvailable();
    
    // Determine hot-plug support
    const supportsHotplug = hasLibusb || hasUdev;
    
    return {
      platform,
      arch,
      isLinux,
      isWindows,
      isMacOS,
      hasUdev,
      hasLibusb,
      supportsHotplug
    };
  }

  private static checkUdevAvailable(): boolean {
    try {
      const fs = require('fs');
      
      // Check for common udev paths
      const udevPaths = [
        '/lib/udev',
        '/usr/lib/udev',
        '/etc/udev',
        '/run/udev'
      ];
      
      return udevPaths.some(udevPath => {
        try {
          return fs.existsSync(udevPath);
        } catch {
          return false;
        }
      });
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
      return false;
    }
  }

  static getRecommendedConfig(platformInfo: PlatformInfo) {
    const config = {
      fallback: {
        enable_udev: false,
        udev_script_path: '/usr/local/bin/autoweave-udev-notify'
      },
      performance: {
        max_events_per_second: 100,
        debounce_ms: 50,
        batch_size: 10
      }
    };

    if (platformInfo.isLinux && platformInfo.hasUdev) {
      config.fallback.enable_udev = true;
    }

    if (platformInfo.isWindows) {
      // Windows-specific optimizations
      config.performance.debounce_ms = 100; // Windows USB events can be noisy
    }

    if (platformInfo.isMacOS) {
      // macOS-specific optimizations
      config.performance.max_events_per_second = 50; // More conservative on macOS
    }

    return config;
  }

  static getUdevRulesPath(): string {
    return '/etc/udev/rules.d/99-autoweave-usb.rules';
  }

  static getUdevScriptPath(): string {
    return '/usr/local/bin/autoweave-udev-notify';
  }

  static generateUdevRules(): string {
    return `# AutoWeave USB Hot-plug Detection
# Generated automatically - do not edit manually

# All USB devices - notify AutoWeave daemon
SUBSYSTEM=="usb", ACTION=="add", RUN+="${this.getUdevScriptPath()} add %k %s{idVendor} %s{idProduct}"
SUBSYSTEM=="usb", ACTION=="remove", RUN+="${this.getUdevScriptPath()} remove %k %s{idVendor} %s{idProduct}"

# Specific device classes of interest
SUBSYSTEM=="usb", ATTR{bDeviceClass}=="09", ACTION=="add", TAG+="autoweave_hub"
SUBSYSTEM=="usb", ATTR{bDeviceClass}=="03", ACTION=="add", TAG+="autoweave_hid"
SUBSYSTEM=="usb", ATTR{bDeviceClass}=="08", ACTION=="add", TAG+="autoweave_storage"
SUBSYSTEM=="usb", ATTR{bDeviceClass}=="0a", ACTION=="add", TAG+="autoweave_cdc"

# Grant permissions for AutoWeave daemon
SUBSYSTEM=="usb", GROUP="autoweave", MODE="0664"
`;
  }

  static generateUdevScript(redisHost: string = 'localhost', redisPort: number = 6379): string {
    return `#!/bin/bash
# AutoWeave udev notification script
# Generated automatically - do not edit manually

ACTION=$1
DEVICE=$2
VENDOR_ID=$3
PRODUCT_ID=$4

REDIS_HOST=\${AUTOWEAVE_REDIS_HOST:-${redisHost}}
REDIS_PORT=\${AUTOWEAVE_REDIS_PORT:-${redisPort}}

# Notify via Redis
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" XADD "aw:hotplug" "*" \\
  "source" "udev" \\
  "action" "$ACTION" \\
  "device" "$DEVICE" \\
  "vendor_id" "$VENDOR_ID" \\
  "product_id" "$PRODUCT_ID" \\
  "timestamp" "$(date +%s%3N)"
`;
  }
}