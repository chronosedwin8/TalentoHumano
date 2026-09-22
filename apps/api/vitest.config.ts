import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.service.ts', 'src/common/**/*.ts'],
      thresholds: { lines: 60, functions: 55, statements: 60, branches: 45 },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@talento/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
