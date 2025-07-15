import { EventEmitter } from 'events';
import { watch, FSWatcher } from 'chokidar';
import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { dirname } from 'path';

export interface WatcherOptions {
  debounceMs?: number;
  maxDepth?: number;
  ignorePatterns?: string[];
  manifestOnly?: boolean;
}

export interface FileChange {
  path: string;
  type: 'add' | 'change' | 'unlink';
  hash?: string;
  timestamp: number;
}

export class OptimizedPluginWatcher extends EventEmitter {
  private watcher?: FSWatcher;
  private options: Required<WatcherOptions>;
  private fileHashes = new Map<string, string>();
  private pendingChanges = new Map<string, NodeJS.Timeout>();
  private watchedManifests = new Set<string>();

  constructor(options: WatcherOptions = {}) {
    super();
    this.options = {
      debounceMs: options.debounceMs || 500,
      maxDepth: options.maxDepth || 2,
      ignorePatterns: options.ignorePatterns || [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.cache/**',
        '**/*.log',
        '**/*.tmp'
      ],
      manifestOnly: options.manifestOnly !== false // Default true
    };
  }

  async watch(directory: string): Promise<void> {
    if (this.watcher) {
      throw new Error('Watcher already running');
    }

    // Verify directory exists
    if (!existsSync(directory)) {
      throw new Error(`Directory does not exist: ${directory}`);
    }

    // Create watcher with optimized settings
    this.watcher = watch(directory, {
      persistent: true,
      ignored: this.options.ignorePatterns,
      ignoreInitial: false,
      followSymlinks: false,
      depth: this.options.maxDepth,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100
      },
      // Only watch for manifest files if manifestOnly is true
      ...(this.options.manifestOnly && {
        // Watch only specific files
        ignored: [
          ...this.options.ignorePatterns,
          // Ignore everything except manifest files
          (path: string) => {
            const isManifest = path.endsWith('autoweave.plugin.json');
            const isInIgnored = this.options.ignorePatterns.some(pattern => {
              const regex = new RegExp(pattern.replace(/\*/g, '.*'));
              return regex.test(path);
            });
            return !isManifest && !isInIgnored;
          }
        ]
      })
    });

    // Set up event handlers
    this.watcher
      .on('add', (path) => this.handleFileEvent('add', path))
      .on('change', (path) => this.handleFileEvent('change', path))
      .on('unlink', (path) => this.handleFileEvent('unlink', path))
      .on('error', (error) => this.emit('error', error))
      .on('ready', () => {
        console.log(`Plugin watcher ready, monitoring: ${directory}`);
        this.emit('ready');
      });
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
    }

    // Clear pending changes
    for (const timer of this.pendingChanges.values()) {
      clearTimeout(timer);
    }
    this.pendingChanges.clear();
    this.fileHashes.clear();
    this.watchedManifests.clear();
  }

  private handleFileEvent(type: 'add' | 'change' | 'unlink', path: string): void {
    // For manifest-only mode, only process manifest files
    if (this.options.manifestOnly && !path.endsWith('autoweave.plugin.json')) {
      return;
    }

    // Clear existing debounce timer for this path
    const existingTimer = this.pendingChanges.get(path);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set up debounced processing
    const timer = setTimeout(() => {
      this.pendingChanges.delete(path);
      this.processFileChange(type, path);
    }, this.options.debounceMs);

    this.pendingChanges.set(path, timer);
  }

  private async processFileChange(type: 'add' | 'change' | 'unlink', path: string): Promise<void> {
    try {
      const change: FileChange = {
        path,
        type,
        timestamp: Date.now()
      };

      // For unlink events, we can't compute hash
      if (type === 'unlink') {
        this.fileHashes.delete(path);
        
        // If it was a manifest file, emit plugin removed event
        if (path.endsWith('autoweave.plugin.json')) {
          const pluginPath = dirname(path);
          this.watchedManifests.delete(path);
          this.emit('plugin:removed', { pluginPath, manifestPath: path });
        }
        
        this.emit('change', change);
        return;
      }

      // Compute file hash for add/change events
      const hash = await this.computeFileHash(path);
      
      // Check if file actually changed (hash-based detection)
      const previousHash = this.fileHashes.get(path);
      if (type === 'change' && previousHash === hash) {
        // File didn't actually change, ignore
        return;
      }

      // Update hash
      this.fileHashes.set(path, hash);
      change.hash = hash;

      // Handle manifest file changes
      if (path.endsWith('autoweave.plugin.json')) {
        await this.handleManifestChange(type, path, hash);
      }

      // Emit general change event
      this.emit('change', change);
    } catch (error) {
      this.emit('error', error);
    }
  }

  private async handleManifestChange(
    type: 'add' | 'change', 
    manifestPath: string, 
    hash: string
  ): Promise<void> {
    try {
      const pluginPath = dirname(manifestPath);
      const manifestContent = readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestContent);

      if (type === 'add') {
        this.watchedManifests.add(manifestPath);
        this.emit('plugin:added', {
          pluginPath,
          manifestPath,
          manifest,
          hash
        });
      } else {
        this.emit('plugin:changed', {
          pluginPath,
          manifestPath,
          manifest,
          hash,
          previousHash: this.fileHashes.get(manifestPath)
        });
      }
    } catch (error) {
      this.emit('error', new Error(`Failed to process manifest ${manifestPath}: ${error}`));
    }
  }

  private async computeFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const content = readFileSync(filePath);
        const hash = createHash('sha256').update(content).digest('hex');
        resolve(hash);
      } catch (error) {
        reject(error);
      }
    });
  }

  getWatchedManifests(): string[] {
    return Array.from(this.watchedManifests);
  }

  getFileHash(path: string): string | undefined {
    return this.fileHashes.get(path);
  }

  isWatching(): boolean {
    return this.watcher !== undefined;
  }

  getStats(): {
    watchedFiles: number;
    pendingChanges: number;
    watchedManifests: number;
  } {
    return {
      watchedFiles: this.fileHashes.size,
      pendingChanges: this.pendingChanges.size,
      watchedManifests: this.watchedManifests.size
    };
  }

  // Optimization: batch check multiple files
  async batchCheckChanges(paths: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    await Promise.all(paths.map(async (path) => {
      try {
        if (!existsSync(path)) {
          results.set(path, true); // File removed
          return;
        }
        
        const currentHash = await this.computeFileHash(path);
        const previousHash = this.fileHashes.get(path);
        results.set(path, currentHash !== previousHash);
      } catch {
        results.set(path, true); // Error reading file, consider it changed
      }
    }));
    
    return results;
  }
}