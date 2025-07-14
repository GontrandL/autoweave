import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  minify: false,
  external: ['vm2', 'bullmq', 'ioredis'],
  target: 'node18',
  outDir: 'dist',
});