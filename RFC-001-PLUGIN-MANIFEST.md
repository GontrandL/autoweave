# RFC-001: Plugin Manifest & Hot-Swap Architecture

**Status:** Draft  
**Author:** AutoWeave Team  
**Created:** 2025-07-14  
**Sprint:** 0 (Requirements Freeze)

## Abstract

Ce RFC définit la spécification complète du manifeste `autoweave.plugin.json`
permettant le chargement/déchargement à chaud des plugins AutoWeave, leur
isolation en Worker Threads, et leur validation sécurisée via AJV et signature
SHA-256.

## 1. Motivation

La plateforme AutoWeave doit pouvoir charger dynamiquement des plugins sans
redémarrage du daemon principal. Cette capacité nécessite :

- Un format de manifeste standardisé et validé
- Une isolation stricte des plugins en Worker Threads
- Un système de permissions granulaires
- Une validation cryptographique des plugins
- Des hooks de cycle de vie bien définis

## 2. Spécification du Manifeste

### 2.1 Schéma JSON Complet

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AutoWeave Plugin Manifest",
  "type": "object",
  "required": ["name", "version", "entry", "permissions", "hooks"],
  "additionalProperties": false,
  "properties": {
    "name": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$",
      "minLength": 3,
      "maxLength": 50,
      "description": "Nom unique du plugin (kebab-case)"
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9-]+)?$",
      "description": "Version sémantique du plugin"
    },
    "description": {
      "type": "string",
      "maxLength": 200,
      "description": "Description courte du plugin"
    },
    "author": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "email": { "type": "string", "format": "email" },
        "url": { "type": "string", "format": "uri" }
      },
      "required": ["name"]
    },
    "entry": {
      "type": "string",
      "pattern": "^[a-zA-Z0-9-_/]+\\.(js|ts|mjs)$",
      "description": "Point d'entrée principal du plugin"
    },
    "permissions": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "filesystem": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "path": { "type": "string" },
              "mode": { "enum": ["read", "write", "readwrite"] }
            },
            "required": ["path", "mode"]
          }
        },
        "network": {
          "type": "object",
          "properties": {
            "outbound": {
              "type": "array",
              "items": {
                "type": "string",
                "format": "uri"
              }
            },
            "inbound": {
              "type": "object",
              "properties": {
                "port": {
                  "type": "integer",
                  "minimum": 1024,
                  "maximum": 65535
                },
                "interface": { "enum": ["localhost", "all"] }
              }
            }
          }
        },
        "usb": {
          "type": "object",
          "properties": {
            "vendor_ids": {
              "type": "array",
              "items": { "type": "string", "pattern": "^0x[0-9a-fA-F]{4}$" }
            },
            "product_ids": {
              "type": "array",
              "items": { "type": "string", "pattern": "^0x[0-9a-fA-F]{4}$" }
            }
          }
        },
        "memory": {
          "type": "object",
          "properties": {
            "max_heap_mb": {
              "type": "integer",
              "minimum": 10,
              "maximum": 1024
            },
            "max_workers": { "type": "integer", "minimum": 1, "maximum": 8 }
          }
        },
        "queue": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-z0-9-]+$"
          },
          "description": "Noms des queues BullMQ autorisées"
        }
      }
    },
    "hooks": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "onLoad": {
          "type": "string",
          "description": "Fonction appelée au chargement du plugin"
        },
        "onUnload": {
          "type": "string",
          "description": "Fonction appelée au déchargement du plugin"
        },
        "onUSBAttach": {
          "type": "string",
          "description": "Fonction appelée lors de l'attachement USB"
        },
        "onUSBDetach": {
          "type": "string",
          "description": "Fonction appelée lors du détachement USB"
        },
        "onJobReceived": {
          "type": "string",
          "description": "Fonction appelée à la réception d'un job BullMQ"
        }
      }
    },
    "dependencies": {
      "type": "object",
      "properties": {
        "autoweave": {
          "type": "string",
          "description": "Version compatible d'AutoWeave"
        },
        "node": {
          "type": "string",
          "description": "Version Node.js requise"
        }
      }
    },
    "signature": {
      "type": "object",
      "properties": {
        "algorithm": { "enum": ["SHA-256"] },
        "value": {
          "type": "string",
          "pattern": "^[a-fA-F0-9]{64}$"
        },
        "signer": { "type": "string" }
      },
      "required": ["algorithm", "value"]
    }
  }
}
```

### 2.2 Validation AJV

```typescript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

export class PluginManifestValidator {
  private ajv: Ajv;
  private schema: object;

  constructor() {
    this.ajv = new Ajv({
      strict: true,
      allErrors: true,
      removeAdditional: false,
    });
    addFormats(this.ajv);
    this.schema = JSON.parse(
      readFileSync('./plugin-manifest-schema.json', 'utf8'),
    );
  }

  validateManifest(manifest: object): { valid: boolean; errors?: string[] } {
    const validate = this.ajv.compile(this.schema);
    const valid = validate(manifest);

    if (!valid) {
      return {
        valid: false,
        errors: validate.errors?.map(
          (err) => `${err.instancePath}: ${err.message}`,
        ),
      };
    }

    return { valid: true };
  }

  validateSignature(manifest: any, pluginPath: string): boolean {
    if (!manifest.signature) return false;

    const { signature, ...manifestWithoutSig } = manifest;
    const manifestContent = JSON.stringify(manifestWithoutSig, null, 2);
    const pluginFiles = this.getPluginFiles(pluginPath);

    const hash = createHash('sha256');
    hash.update(manifestContent);

    pluginFiles.forEach((file) => {
      hash.update(readFileSync(file));
    });

    const computedHash = hash.digest('hex');
    return computedHash === signature.value;
  }

  private getPluginFiles(pluginPath: string): string[] {
    // Implementation to recursively get all plugin files
    // excluding node_modules, .git, etc.
    return [];
  }
}
```

## 3. Architecture Plugin Loader

### 3.1 Worker Thread Isolation

```typescript
import { Worker } from 'worker_threads';
import { join } from 'path';

export class PluginWorker {
  private worker: Worker;
  private manifest: PluginManifest;

  constructor(manifest: PluginManifest, pluginPath: string) {
    this.manifest = manifest;
    this.worker = new Worker(join(__dirname, 'plugin-worker-runner.js'), {
      workerData: {
        manifest,
        pluginPath,
        permissions: manifest.permissions,
      },
      resourceLimits: {
        maxOldGenerationSizeMb: manifest.permissions.memory?.max_heap_mb || 128,
        maxYoungGenerationSizeMb: 32,
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.worker.on('message', this.handleWorkerMessage.bind(this));
    this.worker.on('error', this.handleWorkerError.bind(this));
    this.worker.on('exit', this.handleWorkerExit.bind(this));
  }

  async load(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Plugin load timeout'));
      }, 10000);

      this.worker.postMessage({ type: 'LOAD' });

      this.worker.once('message', (message) => {
        clearTimeout(timeout);
        if (message.type === 'LOAD_SUCCESS') {
          resolve();
        } else {
          reject(new Error(message.error));
        }
      });
    });
  }

  async unload(): Promise<void> {
    this.worker.postMessage({ type: 'UNLOAD' });
    return this.worker.terminate();
  }
}
```

### 3.2 Plugin Worker Runner

```typescript
// plugin-worker-runner.js
import { parentPort, workerData } from 'worker_threads';
import { join } from 'path';

class PluginSandbox {
  private plugin: any;
  private manifest: PluginManifest;

  constructor() {
    this.manifest = workerData.manifest;
    this.setupSecurityContext();
  }

  private setupSecurityContext(): void {
    // Restrict global objects based on permissions
    if (!this.manifest.permissions.network) {
      delete global.fetch;
      delete global.WebSocket;
    }

    // Override require/import to check permissions
    this.overrideModuleLoading();
  }

  async loadPlugin(): Promise<void> {
    try {
      const pluginPath = join(workerData.pluginPath, this.manifest.entry);
      this.plugin = await import(pluginPath);

      if (
        this.manifest.hooks.onLoad &&
        this.plugin[this.manifest.hooks.onLoad]
      ) {
        await this.plugin[this.manifest.hooks.onLoad]();
      }

      parentPort?.postMessage({ type: 'LOAD_SUCCESS' });
    } catch (error) {
      parentPort?.postMessage({
        type: 'LOAD_ERROR',
        error: error.message,
      });
    }
  }

  async unloadPlugin(): Promise<void> {
    if (
      this.manifest.hooks.onUnload &&
      this.plugin[this.manifest.hooks.onUnload]
    ) {
      await this.plugin[this.manifest.hooks.onUnload]();
    }
  }
}

const sandbox = new PluginSandbox();

parentPort?.on('message', async (message) => {
  switch (message.type) {
    case 'LOAD':
      await sandbox.loadPlugin();
      break;
    case 'UNLOAD':
      await sandbox.unloadPlugin();
      break;
  }
});
```

## 4. Exemples Concrets

### 4.1 Plugin USB Scanner

```json
{
  "name": "usb-scanner-plugin",
  "version": "1.0.0",
  "description": "Plugin pour détecter et configurer les scanners USB",
  "author": {
    "name": "AutoWeave Team",
    "email": "dev@autoweave.dev"
  },
  "entry": "src/index.js",
  "permissions": {
    "usb": {
      "vendor_ids": ["0x04A9", "0x03F0"],
      "product_ids": ["0x220E", "0x0C17"]
    },
    "filesystem": [
      {
        "path": "/tmp/scans",
        "mode": "readwrite"
      }
    ],
    "queue": ["scan-processing"],
    "memory": {
      "max_heap_mb": 256,
      "max_workers": 2
    }
  },
  "hooks": {
    "onLoad": "initialize",
    "onUnload": "cleanup",
    "onUSBAttach": "handleScannerAttach",
    "onUSBDetach": "handleScannerDetach",
    "onJobReceived": "processScanJob"
  },
  "dependencies": {
    "autoweave": "^1.0.0",
    "node": ">=18.0.0"
  },
  "signature": {
    "algorithm": "SHA-256",
    "value": "a1b2c3d4e5f6789abcdef1234567890abcdef1234567890abcdef1234567890ab",
    "signer": "autoweave-official"
  }
}
```

### 4.2 Plugin LLM Worker

```json
{
  "name": "llm-worker-plugin",
  "version": "2.1.0",
  "description": "Worker pour traitement LLM avec OpenAI/Anthropic",
  "author": {
    "name": "AI Team",
    "email": "ai@autoweave.dev"
  },
  "entry": "dist/llm-worker.mjs",
  "permissions": {
    "network": {
      "outbound": ["https://api.openai.com", "https://api.anthropic.com"]
    },
    "queue": ["llm-requests", "llm-responses"],
    "memory": {
      "max_heap_mb": 512,
      "max_workers": 4
    }
  },
  "hooks": {
    "onLoad": "initializeLLMClients",
    "onUnload": "shutdownClients",
    "onJobReceived": "processLLMRequest"
  },
  "dependencies": {
    "autoweave": "^1.0.0",
    "node": ">=20.0.0"
  },
  "signature": {
    "algorithm": "SHA-256",
    "value": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12",
    "signer": "autoweave-official"
  }
}
```

## 5. Critères de Validation

### 5.1 Tests de Conformité

- [ ] Validation AJV complète du schéma
- [ ] Vérification signature SHA-256
- [ ] Isolation Worker Thread effective
- [ ] Respect des limites mémoire
- [ ] Permissions filesystem respectées
- [ ] Hooks de cycle de vie fonctionnels

### 5.2 Tests de Performance

- [ ] Chargement plugin < 2 secondes
- [ ] Déchargement propre < 1 seconde
- [ ] Aucune fuite mémoire après 1000 cycles
- [ ] CPU usage < 5% en idle

### 5.3 Tests de Sécurité

- [ ] Impossible d'accéder aux fichiers non autorisés
- [ ] Restriction réseau effective
- [ ] Validation signature obligatoire
- [ ] Sandbox Worker Thread étanche

## 6. Migration et Compatibilité

### 6.1 Versioning du Manifeste

Le champ `$schema` permet de gérer l'évolution du format :

- v1.0.0 : Version initiale (ce RFC)
- v1.1.0 : Ajout champs optionnels
- v2.0.0 : Breaking changes (rare)

### 6.2 Backward Compatibility

Les plugins v1.x restent compatibles avec AutoWeave 2.x via un adaptateur
automatique.

## 7. Références

- [Node USB Documentation](https://node-usb.github.io/node-usb/)
- [Worker Threads API](https://nodejs.org/api/worker_threads.html)
- [AJV JSON Schema Validator](https://ajv.js.org/)
- [BullMQ Queue System](https://docs.bullmq.io/)

## 8. Changelog

- **2025-07-14** : Version initiale du RFC
