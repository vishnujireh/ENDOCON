import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/helpers/global-setup.ts'],
    setupFiles: ['./tests/helpers/env.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    include: ['tests/**/*.test.ts'],
  },
});
