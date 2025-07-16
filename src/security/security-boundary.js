/**
 * Security Boundary
 * Implements secure IPC communication and context isolation
 */

const EventEmitter = require('events');
const crypto = require('crypto');
const { Worker } = require('worker_threads');
const path = require('path');

/**
 * Security Boundary - Manages secure communication between main thread and plugin workers
 */
class SecurityBoundary extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      // Message limits
      maxMessageSize: options.maxMessageSize || 1024 * 1024, // 1MB
      maxMessagesPerSecond: options.maxMessagesPerSecond || 100,
      messageQueueSize: options.messageQueueSize || 1000,
      
      // Encryption
      encryptMessages: options.encryptMessages !== false,
      algorithm: options.algorithm || 'aes-256-gcm',
      
      // Validation
      validateSchema: options.validateSchema !== false,
      strictMode: options.strictMode !== false,
      
      // Audit
      auditEnabled: options.auditEnabled !== false,
      auditRetentionMs: options.auditRetentionMs || 3600000, // 1 hour
      
      ...options
    };
    
    // Worker management
    this.workers = new Map();
    this.channels = new Map();
    
    // Message tracking
    this.messageQueues = new Map();
    this.messageRates = new Map();
    
    // Encryption keys
    this.encryptionKeys = new Map();
    
    // Audit log
    this.auditLog = [];
    this.auditCleanupInterval = null;
    
    // Initialize
    this.initialize();
  }

  /**
   * Initialize security boundary
   */
  initialize() {
    // Start audit cleanup
    if (this.options.auditEnabled) {
      this.auditCleanupInterval = setInterval(() => {
        this.cleanupAuditLog();
      }, 60000); // Every minute
    }
    
    // Rate limit reset
    setInterval(() => {
      this.messageRates.clear();
    }, 1000); // Every second
  }

  /**
   * Create secure channel for plugin
   */
  async createChannel(pluginId, workerPath, manifest) {
    // Generate encryption key if enabled
    let encryptionKey = null;
    if (this.options.encryptMessages) {
      encryptionKey = crypto.randomBytes(32);
      this.encryptionKeys.set(pluginId, encryptionKey);
    }
    
    // Create worker with security context
    const worker = new Worker(workerPath, {
      workerData: {
        pluginId,
        manifest,
        securityContext: {
          encryptionEnabled: this.options.encryptMessages,
          algorithm: this.options.algorithm,
          strictMode: this.options.strictMode
        }
      },
      // Resource limits
      resourceLimits: {
        maxOldGenerationSizeMb: manifest.permissions?.memory?.max_heap_mb || 128,
        maxYoungGenerationSizeMb: 32,
        codeRangeSizeMb: 16
      }
    });
    
    // Initialize channel
    const channel = {
      id: crypto.randomUUID(),
      pluginId,
      worker,
      manifest,
      created: Date.now(),
      messageCount: 0,
      active: true,
      encryptionKey
    };
    
    this.workers.set(pluginId, worker);
    this.channels.set(pluginId, channel);
    
    // Setup secure message handlers
    this.setupMessageHandlers(pluginId, worker);
    
    // Initialize message queue
    this.messageQueues.set(pluginId, []);
    
    this.emit('channel-created', {
      pluginId,
      channelId: channel.id
    });
    
    return channel.id;
  }

  /**
   * Setup secure message handlers
   */
  setupMessageHandlers(pluginId, worker) {
    worker.on('message', async (message) => {
      try {
        // Decrypt if needed
        const decrypted = await this.decryptMessage(pluginId, message);
        
        // Validate message
        this.validateMessage(pluginId, decrypted);
        
        // Check rate limits
        this.checkRateLimit(pluginId);
        
        // Audit log
        this.auditMessage(pluginId, 'receive', decrypted);
        
        // Process message
        this.processMessage(pluginId, decrypted);
        
      } catch (error) {
        this.handleMessageError(pluginId, error, message);
      }
    });
    
    worker.on('error', (error) => {
      this.emit('worker-error', {
        pluginId,
        error: error.message
      });
    });
    
    worker.on('exit', (code) => {
      this.emit('worker-exit', {
        pluginId,
        code
      });
      
      // Cleanup
      this.closeChannel(pluginId);
    });
  }

  /**
   * Send message to plugin
   */
  async sendMessage(pluginId, type, data) {
    const channel = this.channels.get(pluginId);
    if (!channel || !channel.active) {
      throw new Error(`No active channel for plugin: ${pluginId}`);
    }
    
    // Create message
    const message = {
      id: crypto.randomUUID(),
      type,
      data,
      timestamp: Date.now(),
      sender: 'main'
    };
    
    // Validate size
    const messageSize = Buffer.byteLength(JSON.stringify(message));
    if (messageSize > this.options.maxMessageSize) {
      throw new Error(`Message too large: ${messageSize} bytes`);
    }
    
    // Check rate limit
    this.checkRateLimit('main');
    
    // Check queue size
    const queue = this.messageQueues.get(pluginId) || [];
    if (queue.length >= this.options.messageQueueSize) {
      throw new Error('Message queue full');
    }
    
    // Encrypt if needed
    const encrypted = await this.encryptMessage(pluginId, message);
    
    // Audit log
    this.auditMessage(pluginId, 'send', message);
    
    // Send to worker
    channel.worker.postMessage(encrypted);
    channel.messageCount++;
    
    return message.id;
  }

  /**
   * Process received message
   */
  processMessage(pluginId, message) {
    // Add to queue
    const queue = this.messageQueues.get(pluginId) || [];
    queue.push(message);
    
    // Limit queue size
    if (queue.length > this.options.messageQueueSize) {
      queue.shift(); // Remove oldest
    }
    
    this.messageQueues.set(pluginId, queue);
    
    // Emit for processing
    this.emit('message', {
      pluginId,
      message
    });
    
    // Handle specific message types
    switch (message.type) {
      case 'console':
      case 'error':
      case 'resource-usage':
      case 'plugin-event':
        this.emit(message.type, {
          pluginId,
          data: message.data
        });
        break;
    }
  }

  /**
   * Validate message structure and content
   */
  validateMessage(pluginId, message) {
    // Basic structure validation
    if (!message || typeof message !== 'object') {
      throw new Error('Invalid message format');
    }
    
    if (!message.type || typeof message.type !== 'string') {
      throw new Error('Missing or invalid message type');
    }
    
    if (!message.timestamp || typeof message.timestamp !== 'number') {
      throw new Error('Missing or invalid timestamp');
    }
    
    // Strict mode validation
    if (this.options.strictMode) {
      // Check for dangerous properties
      const dangerous = ['__proto__', 'constructor', 'prototype'];
      const checkObject = (obj, path = '') => {
        for (const key in obj) {
          if (dangerous.includes(key)) {
            throw new Error(`Dangerous property detected: ${path}.${key}`);
          }
          if (obj[key] && typeof obj[key] === 'object') {
            checkObject(obj[key], `${path}.${key}`);
          }
        }
      };
      
      checkObject(message);
    }
    
    // Schema validation based on message type
    if (this.options.validateSchema) {
      this.validateMessageSchema(message);
    }
  }

  /**
   * Validate message against schema
   */
  validateMessageSchema(message) {
    const schemas = {
      'console': {
        required: ['level', 'message'],
        properties: {
          level: { type: 'string', enum: ['log', 'info', 'warn', 'error', 'debug'] },
          message: { type: 'array' }
        }
      },
      'error': {
        required: ['message', 'type'],
        properties: {
          message: { type: 'string' },
          type: { type: 'string' }
        }
      },
      'resource-usage': {
        required: ['memory', 'cpu'],
        properties: {
          memory: { type: 'object' },
          cpu: { type: 'object' }
        }
      }
    };
    
    const schema = schemas[message.type];
    if (!schema) return; // Unknown type, skip validation
    
    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in message.data)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
    }
    
    // Check property types
    if (schema.properties) {
      for (const [field, spec] of Object.entries(schema.properties)) {
        if (field in message.data) {
          const value = message.data[field];
          const valueType = Array.isArray(value) ? 'array' : typeof value;
          
          if (spec.type && valueType !== spec.type) {
            throw new Error(`Invalid type for ${field}: expected ${spec.type}, got ${valueType}`);
          }
          
          if (spec.enum && !spec.enum.includes(value)) {
            throw new Error(`Invalid value for ${field}: ${value}`);
          }
        }
      }
    }
  }

  /**
   * Check rate limits
   */
  checkRateLimit(identifier) {
    const count = this.messageRates.get(identifier) || 0;
    
    if (count >= this.options.maxMessagesPerSecond) {
      throw new Error(`Rate limit exceeded: ${identifier}`);
    }
    
    this.messageRates.set(identifier, count + 1);
  }

  /**
   * Encrypt message
   */
  async encryptMessage(pluginId, message) {
    if (!this.options.encryptMessages) {
      return message;
    }
    
    const key = this.encryptionKeys.get(pluginId);
    if (!key) {
      throw new Error('No encryption key for plugin');
    }
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.options.algorithm, key, iv);
    
    const messageStr = JSON.stringify(message);
    const encrypted = Buffer.concat([
      cipher.update(messageStr, 'utf8'),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64')
    };
  }

  /**
   * Decrypt message
   */
  async decryptMessage(pluginId, encryptedData) {
    if (!this.options.encryptMessages) {
      return encryptedData;
    }
    
    const key = this.encryptionKeys.get(pluginId);
    if (!key) {
      throw new Error('No decryption key for plugin');
    }
    
    const decipher = crypto.createDecipheriv(
      this.options.algorithm,
      key,
      Buffer.from(encryptedData.iv, 'base64')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'base64'));
    
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedData.encrypted, 'base64')),
      decipher.final()
    ]);
    
    return JSON.parse(decrypted.toString('utf8'));
  }

  /**
   * Audit message
   */
  auditMessage(pluginId, direction, message) {
    if (!this.options.auditEnabled) return;
    
    const auditEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      pluginId,
      direction,
      messageType: message.type,
      messageId: message.id,
      size: Buffer.byteLength(JSON.stringify(message))
    };
    
    this.auditLog.push(auditEntry);
    
    this.emit('audit-entry', auditEntry);
  }

  /**
   * Handle message error
   */
  handleMessageError(pluginId, error, originalMessage) {
    const errorEntry = {
      pluginId,
      error: error.message,
      timestamp: Date.now(),
      originalMessage: originalMessage ? {
        type: originalMessage.type,
        id: originalMessage.id
      } : null
    };
    
    this.emit('message-error', errorEntry);
    
    // Audit error
    if (this.options.auditEnabled) {
      this.auditLog.push({
        ...errorEntry,
        type: 'error'
      });
    }
  }

  /**
   * Get channel status
   */
  getChannelStatus(pluginId) {
    const channel = this.channels.get(pluginId);
    if (!channel) return null;
    
    const queue = this.messageQueues.get(pluginId) || [];
    
    return {
      id: channel.id,
      pluginId,
      active: channel.active,
      created: channel.created,
      messageCount: channel.messageCount,
      queueSize: queue.length,
      encrypted: this.options.encryptMessages
    };
  }

  /**
   * Get all channel statuses
   */
  getAllChannelStatuses() {
    const statuses = {};
    
    for (const [pluginId] of this.channels) {
      statuses[pluginId] = this.getChannelStatus(pluginId);
    }
    
    return statuses;
  }

  /**
   * Close channel
   */
  closeChannel(pluginId) {
    const channel = this.channels.get(pluginId);
    if (!channel) return;
    
    channel.active = false;
    
    // Terminate worker
    const worker = this.workers.get(pluginId);
    if (worker) {
      worker.terminate();
      this.workers.delete(pluginId);
    }
    
    // Cleanup
    this.channels.delete(pluginId);
    this.messageQueues.delete(pluginId);
    this.encryptionKeys.delete(pluginId);
    
    this.emit('channel-closed', {
      pluginId,
      channelId: channel.id
    });
  }

  /**
   * Get audit log
   */
  getAuditLog(pluginId = null, limit = 100) {
    let log = this.auditLog;
    
    if (pluginId) {
      log = log.filter(entry => entry.pluginId === pluginId);
    }
    
    return log.slice(-limit);
  }

  /**
   * Cleanup old audit entries
   */
  cleanupAuditLog() {
    const cutoff = Date.now() - this.options.auditRetentionMs;
    this.auditLog = this.auditLog.filter(entry => entry.timestamp > cutoff);
  }

  /**
   * Generate security report
   */
  generateSecurityReport() {
    const report = {
      timestamp: new Date().toISOString(),
      channels: {
        total: this.channels.size,
        active: Array.from(this.channels.values()).filter(c => c.active).length
      },
      messages: {
        total: Array.from(this.channels.values()).reduce((sum, c) => sum + c.messageCount, 0),
        queued: Array.from(this.messageQueues.values()).reduce((sum, q) => sum + q.length, 0)
      },
      audit: {
        entries: this.auditLog.length,
        errors: this.auditLog.filter(e => e.type === 'error').length
      },
      encryption: {
        enabled: this.options.encryptMessages,
        algorithm: this.options.algorithm
      }
    };
    
    return report;
  }

  /**
   * Cleanup
   */
  cleanup() {
    // Clear intervals
    if (this.auditCleanupInterval) {
      clearInterval(this.auditCleanupInterval);
    }
    
    // Close all channels
    for (const [pluginId] of this.channels) {
      this.closeChannel(pluginId);
    }
    
    // Clear data
    this.workers.clear();
    this.channels.clear();
    this.messageQueues.clear();
    this.encryptionKeys.clear();
    this.auditLog = [];
  }
}

module.exports = SecurityBoundary;