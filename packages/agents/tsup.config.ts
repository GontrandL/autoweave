import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: false, // Disable DTS for now
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  external: [/^@autoweave\//],
});
