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
      reporter: ['text', 'html', 'lcov'],
      /**
       * The gate covers what can be exercised without a database and must
       * never regress silently: the column encryption that protects salary,
       * health and hotline content. The permission catalog, the Colombian
       * calendar and the vacation accrual are covered by `@talento/shared`'s
       * own suite; everything that needs the database is covered behaviourally
       * by `pnpm test:e2e`, which runs against a real PostgreSQL and asserts
       * both the HTTP responses and the rows that end up stored.
       */
      include: ['src/common/crypto/**/*.ts'],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 70 },
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
