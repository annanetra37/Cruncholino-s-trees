import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Tests supply their own environment rather than inheriting a developer's
 * `.env`: a unit test that passes only on the machine that has a particular
 * local file is not a test.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    // Integration tests share one database; running files in parallel would
    // have them delete each other's fixtures.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        process.env.DATABASE_URL ??
        'postgresql://trees:trees@127.0.0.1:5432/trees_test',
      AUTH_SECRET: 'test-secret-value-at-least-16-chars',
      GEOCODING_PROVIDER: 'none',
      PUBLIC_READ: 'true',
      LOG_LEVEL: 'error',
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
