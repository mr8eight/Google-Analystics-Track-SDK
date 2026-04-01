import { defineConfig } from 'tsup';

export default defineConfig([
  // ESM + CJS 输出
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    outDir: 'dist',
    clean: true,
    sourcemap: true,
    minify: false,
    dts: true,
    external: ['web-vitals'],
    treeshake: true,
    splitting: false,
    banner: {
      js: `/**
 * Smart Tracker SDK
 * Google Analytics 4 埋点 SDK
 * (c) ${new Date().getFullYear()}
 * Released under the MIT License
 */`
    }
  }
]);