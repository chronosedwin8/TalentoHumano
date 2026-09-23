import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

/**
 * Unit tests live next to the code they cover; `e2e/` belongs to Playwright
 * and is excluded so `pnpm test` never tries to run browser flows.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@talento/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
});
