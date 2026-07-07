/**
 * vitest.config.ts
 * ─────────────────────────────────────────────────────────────
 * Mirrors the @/ path alias from tsconfig.json so test files
 * can import with the same paths as application code.
 * ─────────────────────────────────────────────────────────────
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/__tests__/**/*.test.ts'],
    exclude: ['node_modules', '.next'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      // Only measure coverage on the pure-logic modules that have
      // tests. Server/framework glue (route handlers, middleware,
      // components) requires integration tests with a real Supabase
      // instance — don't penalise coverage stats for those.
      include: [
        'lib/auth/synthetic-email.ts',
        'lib/auth/roles.ts',
        'lib/auth/rate-limit.ts',
        'lib/validation/schemas.ts',
        'lib/api/response.ts',
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
