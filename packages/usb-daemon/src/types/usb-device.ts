// Generic USB device descriptor type to avoid direct USB dependency
export interface USBDeviceDescriptor {
  idVendor: number;
  idProduct: number;
  bcdDevice: number;
  iManufacturer: number;
  iProduct: number;
  iSerialNumber: number;
  bDescriptorType: number;
  bLength: number;
  bcdUSB: number;
  bDeviceClass: number;
  bDeviceSubClass: number;
  bDeviceProtocol: number;
  bMaxPacketSize0: number;
  bNumConfigurations: number;
}

export interface USBDeviceInfo {
  vendorId: number;
  productId: number;
  deviceDescriptor: USBDeviceDescriptor;
  serialNumber?: string;
  manufacturer?: string;
  product?: string;
  location: {
    busNumber: number;
    deviceAddress: number;
    portPath: string;
  };
  timestamp: number;
  signature: string;
}

export interface USBEvent {
  messageId: string;
  source: 'node-usb' | 'udev';
  action: 'attach' | 'detach';
  vendorId: number;
  productId: number;
  deviceSignature: string;
  manufacturer?: string;
  product?: string;
  serialNumber?: string;
  timestamp: number;
  deviceDescriptor?: USBDeviceDescriptor;
}

export interface USBDaemonConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  monitoring: {
    enabled: boolean;
    interval: number;
    healthcheck_port: number;
  };
  filters: {
    vendor_whitelist?: number[];
    vendor_blacklist?: number[];
    device_class_filter?: number[];
  };
  performance: {
    max_events_per_second: number;
    debounce_ms: number;
    batch_size: number;
  };
  fallback: {
    enable_udev: boolean;
    udev_script_path: string;
  };
}

export interface USBMonitoringConfig {
  enabled: boolean;
  healthcheckPort: number;
  metricsInterval: number;
}

export interface USBDeviceFilter {
  vendorIds?: number[];
  productIds?: number[];
  deviceClass?: number[];
}