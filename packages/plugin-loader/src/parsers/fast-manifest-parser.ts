import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

import type { ValidateFunction } from 'ajv';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { LRUCache } from 'lru-cache';

import type { PluginManifest, PluginValidationResult } from '../types/plugin';


export interface ParseOptions {
  validateSchema?: boolean;
  validateSignature?: boolean;
  includeDefaults?: boolean;
}

export interface ParseResult {
  manifest?: PluginManifest;
  valid: boolean;
  errors?: string[];
  cached?: boolean;
  parseTime?: number;
}

export class FastManifestParser {
  private static instance: FastManifestParser;

  private ajv: Ajv;
  private schemaValidator?: ValidateFunction;
  private cache: LRUCache<string, { manifest: PluginManifest; hash: string }>;
  private schema: object;
  private compiledSchemaPromise?: Promise<ValidateFunction>;

  private constructor() {
    // Initialize AJV with optimizations
    this.ajv = new Ajv({
      strict: false, // Faster parsing
      allErrors: true,
      removeAdditional: true, // Clean up extra properties
      useDefaults: true, // Apply defaults from schema
      coerceTypes: true, // Type coercion for flexibility
      // cache: true // Enable schema caching - not available in Options type
    });

    addFormats(this.ajv);

    // Initialize LRU cache
    this.cache = new LRUCache<string, { manifest: PluginManifest; hash: string }>({
      max: 100, // Cache up to 100 manifests
      ttl: 1000 * 60 * 5, // 5 minute TTL
      updateAgeOnGet: true,
      updateAgeOnHas: true
    });

    // Load and pre-compile schema
    this.schema = this.loadSchema();
    void this.precompileSchema();
  }

  static getInstance(): FastManifestParser {
    if (!FastManifestParser.instance) {
      FastManifestParser.instance = new FastManifestParser();
    }
    return FastManifestParser.instance;
  }

  private loadSchema(): object {
    try {
      const schemaPath = join(__dirname, '../schemas/manifest-schema.json');
      return JSON.parse(readFileSync(schemaPath, 'utf8'));
    } catch (error) {
      console.error('Failed to load manifest schema:', error);
      // Return a minimal schema as fallback
      return {
        type: 'object',
        required: ['name', 'version', 'entry', 'permissions', 'hooks'],
        properties: {
          name: { type: 'string' },
          version: { type: 'string' },
          entry: { type: 'string' },
          permissions: { type: 'object' },
          hooks: { type: 'object' }
        }
      };
    }
  }

  private async precompileSchema(): Promise<void> {
    if (!this.compiledSchemaPromise) {
      this.compiledSchemaPromise = new Promise((resolve) => {
        // Compile schema asynchronously
        setImmediate(() => {
          this.schemaValidator = this.ajv.compile(this.schema);
          resolve(this.schemaValidator);
        });
      });
    }
  }

  async parseManifest(
    manifestPath: string,
    options: ParseOptions = {}
  ): Promise<ParseResult> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = manifestPath;
      const content = readFileSync(manifestPath, 'utf8');
      const contentHash = createHash('sha256').update(content).digest('hex');

      const cached = this.cache.get(cacheKey);
      if (cached && cached.hash === contentHash) {
        return {
          manifest: cached.manifest,
          valid: true,
          cached: true,
          parseTime: Date.now() - startTime
        };
      }

      // Parse JSON
      const parsedData = this.parseJSON(content);
      if (!parsedData) {
        return {
          valid: false,
          errors: ['Invalid JSON format'],
          parseTime: Date.now() - startTime
        };
      }

      // Validate schema if requested
      if (options.validateSchema !== false) {
        const validation = await this.validateManifest(parsedData);
        if (!validation.valid) {
          return {
            valid: false,
            errors: validation.errors,
            parseTime: Date.now() - startTime
          };
        }
      }

      // Apply defaults and clean up
      const manifest = this.normalizeManifest(parsedData);

      // Cache the result
      this.cache.set(cacheKey, { manifest, hash: contentHash });

      return {
        manifest,
        valid: true,
        cached: false,
        parseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
        parseTime: Date.now() - startTime
      };
    }
  }

  parseManifestSync(content: string, options: ParseOptions = {}): ParseResult {
    const startTime = Date.now();

    try {
      // Parse JSON
      const parsedData = this.parseJSON(content);
      if (!parsedData) {
        return {
          valid: false,
          errors: ['Invalid JSON format'],
          parseTime: Date.now() - startTime
        };
      }

      // Validate schema if requested (sync version)
      if (options.validateSchema !== false) {
        const validation = this.validateManifestSync(parsedData);
        if (!validation.valid) {
          return {
            valid: false,
            errors: validation.errors,
            parseTime: Date.now() - startTime
          };
        }
      }

      // Apply defaults and clean up
      const manifest = this.normalizeManifest(parsedData);

      return {
        manifest,
        valid: true,
        cached: false,
        parseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
        parseTime: Date.now() - startTime
      };
    }
  }

  private parseJSON(content: string): any {
    try {
      // Remove BOM if present
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
      }

      // Parse with reviver for optimization
      return JSON.parse(content, (_, value) => {
        // Convert string dates to Date objects if needed
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
          return new Date(value);
        }
        return value;
      });
    } catch (error) {
      return null;
    }
  }

  private async validateManifest(data: any): Promise<PluginValidationResult> {
    // Ensure schema is compiled
    if (!this.schemaValidator) {
      await this.compiledSchemaPromise;
    }

    if (!this.schemaValidator) {
      return { valid: false, errors: ['Schema validator not available'] };
    }

    const valid = this.schemaValidator(data);

    if (!valid && this.schemaValidator.errors) {
      return {
        valid: false,
        errors: this.schemaValidator.errors.map(err =>
          `${err.instancePath || 'root'}: ${err.message}`
        )
      };
    }

    return { valid: true };
  }

  private validateManifestSync(data: any): PluginValidationResult {
    if (!this.schemaValidator) {
      // Compile synchronously if not available
      this.schemaValidator = this.ajv.compile(this.schema);
    }

    const valid = this.schemaValidator(data);

    if (!valid && this.schemaValidator.errors) {
      return {
        valid: false,
        errors: this.schemaValidator.errors.map(err =>
          `${err.instancePath || 'root'}: ${err.message}`
        )
      };
    }

    return { valid: true };
  }

  private normalizeManifest(data: any): PluginManifest {
    // Apply defaults
    const manifest: PluginManifest = {
      name: data.name,
      version: data.version,
      description: data.description || '',
      author: data.author || { name: 'Unknown' },
      entry: data.entry,
      permissions: {
        filesystem: data.permissions?.filesystem || [],
        network: data.permissions?.network || {},
        usb: data.permissions?.usb || {},
        memory: data.permissions?.memory || { max_heap_mb: 128 },
        queue: data.permissions?.queue || []
      },
      hooks: {
        onLoad: data.hooks?.onLoad,
        onUnload: data.hooks?.onUnload,
        onUSBAttach: data.hooks?.onUSBAttach,
        onUSBDetach: data.hooks?.onUSBDetach,
        onJobReceived: data.hooks?.onJobReceived
      },
      dependencies: data.dependencies,
      signature: data.signature
    };

    // Normalize paths
    if (manifest.permissions.filesystem) {
      manifest.permissions.filesystem = manifest.permissions.filesystem.map(fs => ({
        ...fs,
        path: fs.path.replace(/\\/g, '/') // Normalize Windows paths
      }));
    }

    return manifest;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): {
    size: number;
    hits: number;
    misses: number;
  } {
    return {
      size: this.cache.size,
      hits: 0, // LRUCache doesn't track this by default
      misses: 0
    };
  }

  // Batch parsing for efficiency
  async parseManifestBatch(
    manifestPaths: string[],
    options: ParseOptions = {}
  ): Promise<Map<string, ParseResult>> {
    const results = new Map<string, ParseResult>();

    // Process in parallel with concurrency limit
    const concurrency = 5;
    const chunks: string[][] = [];

    for (let i = 0; i < manifestPaths.length; i += concurrency) {
      chunks.push(manifestPaths.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(path => this.parseManifest(path, options))
      );

      chunk.forEach((path, index) => {
        const result = chunkResults[index];
        if (result) {
          results.set(path, result);
        }
      });
    }

    return results;
  }

  // Stream parsing for large manifests
  async *parseManifestStream(
    manifestPaths: string[],
    options: ParseOptions = {}
  ): AsyncGenerator<{ path: string; result: ParseResult }> {
    for (const path of manifestPaths) {
      const result = await this.parseManifest(path, options);
      yield { path, result };
    }
  }
}