import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/playwright/mcp-server.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    'playwright',
    'playwright-core'
  ],
  target: 'node18'
});