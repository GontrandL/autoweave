import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    'playwright',
    'playwright-core',
    '@autoweave/core',
    '@autoweave/observability',
    '@autoweave/agents'
  ],
  target: 'node18'
});