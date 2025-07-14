import { AutoWeaveJobData, JobType, JobOptions } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateJobData(jobData: AutoWeaveJobData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!jobData.type) {
    errors.push('Job type is required');
  } else if (!isValidJobType(jobData.type)) {
    errors.push(`Invalid job type: ${jobData.type}`);
  }

  if (!jobData.payload) {
    errors.push('Job payload is required');
  }

  if (!jobData.metadata) {
    errors.push('Job metadata is required');
  } else {
    // Validate metadata
    const metadataValidation = validateJobMetadata(jobData.metadata);
    errors.push(...metadataValidation.errors);
    warnings.push(...metadataValidation.warnings);
  }

  // Validate priority
  if (jobData.priority !== undefined) {
    if (typeof jobData.priority !== 'number') {
      errors.push('Priority must be a number');
    } else if (jobData.priority < 0 || jobData.priority > 100) {
      warnings.push('Priority should be between 0 and 100');
    }
  }

  // Validate timeout
  if (jobData.timeout !== undefined) {
    if (typeof jobData.timeout !== 'number') {
      errors.push('Timeout must be a number');
    } else if (jobData.timeout <= 0) {
      errors.push('Timeout must be positive');
    } else if (jobData.timeout > 300000) { // 5 minutes
      warnings.push('Timeout is very long (>5 minutes)');
    }
  }

  // Validate maxRetries
  if (jobData.maxRetries !== undefined) {
    if (typeof jobData.maxRetries !== 'number') {
      errors.push('maxRetries must be a number');
    } else if (jobData.maxRetries < 0) {
      errors.push('maxRetries must be non-negative');
    } else if (jobData.maxRetries > 10) {
      warnings.push('maxRetries is very high (>10)');
    }
  }

  // Validate payload based on job type
  if (jobData.type && jobData.payload) {
    const payloadValidation = validateJobPayload(jobData.type, jobData.payload);
    errors.push(...payloadValidation.errors);
    warnings.push(...payloadValidation.warnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function validateJobMetadata(metadata: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!metadata.source) {
    errors.push('Metadata source is required');
  } else if (!isValidSource(metadata.source)) {
    errors.push(`Invalid metadata source: ${metadata.source}`);
  }

  if (!metadata.timestamp) {
    errors.push('Metadata timestamp is required');
  } else if (typeof metadata.timestamp !== 'number') {
    errors.push('Metadata timestamp must be a number');
  } else if (metadata.timestamp > Date.now() + 300000) { // 5 minutes in the future
    warnings.push('Metadata timestamp is in the future');
  }

  if (!metadata.version) {
    errors.push('Metadata version is required');
  } else if (typeof metadata.version !== 'string') {
    errors.push('Metadata version must be a string');
  }

  // Validate optional fields
  if (metadata.tenantId && typeof metadata.tenantId !== 'string') {
    errors.push('Metadata tenantId must be a string');
  }

  if (metadata.pluginId && typeof metadata.pluginId !== 'string') {
    errors.push('Metadata pluginId must be a string');
  }

  if (metadata.userId && typeof metadata.userId !== 'string') {
    errors.push('Metadata userId must be a string');
  }

  if (metadata.traceId && typeof metadata.traceId !== 'string') {
    errors.push('Metadata traceId must be a string');
  }

  if (metadata.spanId && typeof metadata.spanId !== 'string') {
    errors.push('Metadata spanId must be a string');
  }

  if (metadata.correlationId && typeof metadata.correlationId !== 'string') {
    errors.push('Metadata correlationId must be a string');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function validateJobPayload(jobType: JobType, payload: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  switch (jobType) {
    case 'usb.device.attached':
    case 'usb.device.detached':
      return validateUSBEventPayload(payload);
    
    case 'usb.scan.complete':
      return validateUSBScanPayload(payload);
    
    case 'plugin.load':
    case 'plugin.unload':
    case 'plugin.execute':
    case 'plugin.validate':
    case 'plugin.reload':
      return validatePluginJobPayload(payload);
    
    case 'llm.batch.process':
    case 'llm.embeddings.generate':
    case 'llm.completion.create':
      return validateLLMJobPayload(payload);
    
    case 'system.maintenance':
    case 'system.cleanup':
    case 'system.health.check':
    case 'system.backup':
      return validateSystemJobPayload(payload);
    
    case 'memory.vectorize':
    case 'memory.index':
    case 'memory.search':
    case 'memory.cleanup':
      return validateMemoryJobPayload(payload);
    
    default:
      warnings.push(`Unknown job type: ${jobType}. Payload validation skipped.`);
      return { valid: true, errors, warnings };
  }
}

function validateUSBEventPayload(payload: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!payload.action) {
    errors.push('USB event action is required');
  } else if (!['attach', 'detach'].includes(payload.action)) {
    errors.push(`Invalid USB event action: ${payload.action}`);
  }

  if (!payload.deviceInfo) {
    errors.push('USB event deviceInfo is required');
  } else {
    if (typeof payload.deviceInfo.vendorId !== 'number') {
      errors.push('USB deviceInfo vendorId must be a number');
    }
    if (typeof payload.deviceInfo.productId !== 'number') {
      errors.push('USB deviceInfo productId must be a number');
    }
    if (!payload.deviceInfo.signature) {
      errors.push('USB deviceInfo signature is required');
    }
  }

  if (!payload.timestamp) {
    errors.push('USB event timestamp is required');
  } else if (typeof payload.timestamp !== 'number') {
    errors.push('USB event timestamp must be a number');
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateUSBScanPayload(payload: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // USB scan payload is typically empty or contains minimal data
  if (payload && typeof payload !== 'object') {
    errors.push('USB scan payload must be an object');
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validatePluginJobPayload(payload: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!payload.pluginId) {
    errors.push('Plugin job pluginId is required');
  } else if (typeof payload.pluginId !== 'string') {
    errors.push('Plugin job pluginId must be a string');
  }

  if (!payload.operation) {
    errors.push('Plugin job operation is required');
  } else if (!['load', 'unload', 'execute', 'validate', 'reload'].includes(payload.operation)) {
    errors.push(`Invalid plugin operation: ${payload.operation}`);
  }

  if (payload.operation === 'load' && !payload.pluginPath) {
    errors.push('Plugin load operation requires pluginPath');
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateLLMJobPayload(payload: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic validation for LLM jobs
  if (!payload || typeof payload !== 'object') {
    errors.push('LLM job payload must be an object');
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateSystemJobPayload(payload: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic validation for system jobs
  if (!payload || typeof payload !== 'object') {
    errors.push('System job payload must be an object');
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateMemoryJobPayload(payload: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic validation for memory jobs
  if (!payload || typeof payload !== 'object') {
    errors.push('Memory job payload must be an object');
  }

  return { valid: errors.length === 0, errors, warnings };
}

function isValidJobType(jobType: string): jobType is JobType {
  const validJobTypes: JobType[] = [
    'usb.device.attached',
    'usb.device.detached',
    'usb.scan.complete',
    'plugin.load',
    'plugin.unload',
    'plugin.execute',
    'plugin.validate',
    'plugin.reload',
    'llm.batch.process',
    'llm.embeddings.generate',
    'llm.completion.create',
    'system.maintenance',
    'system.cleanup',
    'system.health.check',
    'system.backup',
    'memory.vectorize',
    'memory.index',
    'memory.search',
    'memory.cleanup'
  ];

  return validJobTypes.includes(jobType as JobType);
}

function isValidSource(source: string): boolean {
  const validSources = ['usb-daemon', 'plugin-loader', 'manual', 'scheduled', 'webhook'];
  return validSources.includes(source);
}

export function validateJobOptions(options: JobOptions): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate delay
  if (options.delay !== undefined) {
    if (typeof options.delay !== 'number') {
      errors.push('Job delay must be a number');
    } else if (options.delay < 0) {
      errors.push('Job delay must be non-negative');
    } else if (options.delay > 86400000) { // 24 hours
      warnings.push('Job delay is very long (>24 hours)');
    }
  }

  // Validate priority
  if (options.priority !== undefined) {
    if (typeof options.priority !== 'number') {
      errors.push('Job priority must be a number');
    } else if (options.priority < -100 || options.priority > 100) {
      warnings.push('Job priority should be between -100 and 100');
    }
  }

  // Validate attempts
  if (options.attempts !== undefined) {
    if (typeof options.attempts !== 'number') {
      errors.push('Job attempts must be a number');
    } else if (options.attempts < 1) {
      errors.push('Job attempts must be at least 1');
    } else if (options.attempts > 20) {
      warnings.push('Job attempts is very high (>20)');
    }
  }

  // Validate backoff
  if (options.backoff) {
    if (!options.backoff.type) {
      errors.push('Backoff type is required');
    } else if (!['fixed', 'exponential'].includes(options.backoff.type)) {
      errors.push(`Invalid backoff type: ${options.backoff.type}`);
    }

    if (typeof options.backoff.delay !== 'number') {
      errors.push('Backoff delay must be a number');
    } else if (options.backoff.delay < 0) {
      errors.push('Backoff delay must be non-negative');
    }
  }

  // Validate removeOnComplete
  if (options.removeOnComplete !== undefined) {
    if (typeof options.removeOnComplete !== 'number' && typeof options.removeOnComplete !== 'boolean') {
      errors.push('removeOnComplete must be a number or boolean');
    } else if (typeof options.removeOnComplete === 'number' && options.removeOnComplete < 0) {
      errors.push('removeOnComplete must be non-negative');
    }
  }

  // Validate removeOnFail
  if (options.removeOnFail !== undefined) {
    if (typeof options.removeOnFail !== 'number' && typeof options.removeOnFail !== 'boolean') {
      errors.push('removeOnFail must be a number or boolean');
    } else if (typeof options.removeOnFail === 'number' && options.removeOnFail < 0) {
      errors.push('removeOnFail must be non-negative');
    }
  }

  // Validate timeout
  if (options.timeout !== undefined) {
    if (typeof options.timeout !== 'number') {
      errors.push('Job timeout must be a number');
    } else if (options.timeout <= 0) {
      errors.push('Job timeout must be positive');
    } else if (options.timeout > 3600000) { // 1 hour
      warnings.push('Job timeout is very long (>1 hour)');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function sanitizeJobData(jobData: AutoWeaveJobData): AutoWeaveJobData {
  const sanitized = { ...jobData };

  // Ensure metadata exists
  if (!sanitized.metadata) {
    sanitized.metadata = {
      source: 'manual',
      timestamp: Date.now(),
      version: '1.0.0'
    };
  }

  // Ensure timestamp is set
  if (!sanitized.metadata.timestamp) {
    sanitized.metadata.timestamp = Date.now();
  }

  // Ensure version is set
  if (!sanitized.metadata.version) {
    sanitized.metadata.version = '1.0.0';
  }

  // Set default priority if not provided
  if (sanitized.priority === undefined) {
    sanitized.priority = 5;
  }

  // Clamp priority to valid range
  if (sanitized.priority < 0) {
    sanitized.priority = 0;
  } else if (sanitized.priority > 100) {
    sanitized.priority = 100;
  }

  // Set reasonable defaults for timeout and maxRetries
  if (sanitized.timeout === undefined) {
    sanitized.timeout = 30000; // 30 seconds
  }

  if (sanitized.maxRetries === undefined) {
    sanitized.maxRetries = 3;
  }

  return sanitized;
}