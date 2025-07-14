import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  external: [/^@autoweave\//, 'winston', 'winston-transport', 'async', 'logform', 'readable-stream', 'triple-beam', 'is-stream'],
  noExternal: ['@apidevtools/swagger-parser'],
});
