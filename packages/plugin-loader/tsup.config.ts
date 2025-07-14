import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['worker_threads', 'chokidar', 'ajv'],
  target: 'node18',
  publicDir: 'src/schemas',
  onSuccess: 'cp -r src/schemas dist/schemas'
});