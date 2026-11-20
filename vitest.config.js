import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000, // first run downloads the mongod binary
    env: { NODE_ENV: 'test', LOG_LEVEL: 'silent', JWT_SECRET: 'test-secret', PAYMENTS_ENABLED: 'false' },
  },
});
