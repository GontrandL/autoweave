// @ts-ignore
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import type { PluginManifest, PluginValidationResult } from '../types/plugin';

export class PluginManifestValidator {
  private ajv: Ajv;
  private schema: object;

  constructor() {
    this.ajv = new Ajv({
      strict: true,
      allErrors: true,
      removeAdditional: false
    });
    addFormats(this.ajv);

    // Load schema from file
    const schemaPath = join(__dirname, '../schemas/manifest-schema.json');
    this.schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  }

  validateManifest(manifest: object): PluginValidationResult {
    const validate = this.ajv.compile(this.schema);
    const valid = validate(manifest);

    if (!valid) {
      return {
        valid: false,
        errors: validate.errors?.map(err => `${err.instancePath}: ${err.message}`)
      };
    }

    return { valid: true };
  }

  validateSignature(manifest: PluginManifest, pluginPath: string): boolean {
    if (!manifest.signature) {return false;}

    const { signature, ...manifestWithoutSig } = manifest;
    const manifestContent = JSON.stringify(manifestWithoutSig, null, 2);
    const pluginFiles = this.getPluginFiles(pluginPath);

    const hash = createHash('sha256');
    hash.update(manifestContent);

    pluginFiles.forEach(file => {
      try {
        hash.update(readFileSync(file));
      } catch (error) {
        console.warn(`Could not read file ${file} for signature validation:`, error);
      }
    });

    const computedHash = hash.digest('hex');
    return computedHash === signature.value;
  }

  private getPluginFiles(pluginPath: string): string[] {
    // Implementation to recursively get all plugin files
    // excluding node_modules, .git, etc.
    const fs = require('fs');
    const path = require('path');

    const files: string[] = [];
    const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.cache'];

    function walkDir(dir: string): void {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (!excludeDirs.includes(entry.name)) {
              walkDir(fullPath);
            }
          } else if (entry.isFile()) {
            // Include source files but exclude temp/cache files
            if (!/\.(tmp|cache|log)$/.test(entry.name)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        console.warn(`Could not read directory ${dir}:`, error);
      }
    }

    walkDir(pluginPath);
    return files.sort(); // Ensure consistent ordering
  }

  generatePluginSignature(manifest: PluginManifest, pluginPath: string): string {
    const { signature: _signature, ...manifestWithoutSig } = manifest;
    const manifestContent = JSON.stringify(manifestWithoutSig, null, 2);
    const pluginFiles = this.getPluginFiles(pluginPath);

    const hash = createHash('sha256');
    hash.update(manifestContent);

    pluginFiles.forEach(file => {
      try {
        hash.update(readFileSync(file));
      } catch (error) {
        console.warn(`Could not read file ${file} for signature generation:`, error);
      }
    });

    return hash.digest('hex');
  }
}