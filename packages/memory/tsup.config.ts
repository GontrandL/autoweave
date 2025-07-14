import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: false, // Disable DTS for now due to type issues
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  external: [
    /^@autoweave\//,
    'ioredis',
    'qdrant-js',
    '@qdrant/js-client',
    'openai',
    'uuid',
    'neo4j-driver',
    '@langchain/community'
  ],
});
