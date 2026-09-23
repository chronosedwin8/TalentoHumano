import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      /**
       * The contract every app depends on: the permission catalog and its
       * wildcard matching, the system roles, the Colombian calendar and the
       * vacation accrual. A regression here silently changes who can see what
       * and how many days somebody is owed, so the gate is strict.
       */
      include: ['src/permissions.ts', 'src/roles.ts', 'src/utils.ts'],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 80 },
    },
  },
  resolve: {
    alias: { '@talento/shared': resolve(__dirname, './src/index.ts') },
  },
});
