import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/gateway.ts',
    'subgraphs/*/server.ts'
  ],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  target: 'node18',
  outDir: 'dist',
  external: [
    '@autoweave/core',
    '@autoweave/shared',
    '@autoweave/memory',
    '@autoweave/agents',
    '@autoweave/queue',
    '@autoweave/observability'
  ]
});