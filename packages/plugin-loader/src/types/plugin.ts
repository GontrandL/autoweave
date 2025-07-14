export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  author?: {
    name: string;
    email?: string;
    url?: string;
  };
  entry: string;
  permissions: PluginPermissions;
  hooks: PluginHooks;
  dependencies?: {
    autoweave?: string;
    node?: string;
  };
  signature?: {
    algorithm: 'SHA-256';
    value: string;
    signer?: string;
  };
}

export interface PluginPermissions {
  filesystem?: Array<{
    path: string;
    mode: 'read' | 'write' | 'readwrite';
  }>;
  network?: {
    outbound?: string[];
    inbound?: {
      port: number;
      interface: 'localhost' | 'all';
    };
  };
  usb?: {
    vendor_ids?: string[];
    product_ids?: string[];
  };
  memory?: {
    max_heap_mb?: number;
    max_workers?: number;
  };
  queue?: string[];
}

export interface PluginHooks {
  onLoad?: string;
  onUnload?: string;
  onUSBAttach?: string;
  onUSBDetach?: string;
  onJobReceived?: string;
}

export interface PluginInstance {
  manifest: PluginManifest;
  worker?: any; // Worker from worker_threads
  path: string;
  loaded: boolean;
  loadedAt?: Date;
  signature: string;
}

export interface PluginValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface PluginLoadResult {
  success: boolean;
  plugin?: PluginInstance;
  error?: string;
}

export type PluginEvent = 'load' | 'unload' | 'error' | 'usb:attach' | 'usb:detach' | 'job:received';

export interface PluginEventData {
  type: PluginEvent;
  plugin: string;
  data?: any;
  timestamp: number;
}