import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    outDir: 'dist',
    target: 'node18',
    platform: 'node',
    format: ['esm'],
    clean: true,
    splitting: false,
    sourcemap: true,
    minify: false,
    shims: true,
    dts: true
  }
])
