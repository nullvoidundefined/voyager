import path from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { app: path.resolve(__dirname, './src') },
  },
  test: {
    coverage: {
      exclude: [
        'dist/**',
        'migrations/**',
        'scripts/**',
        '*.config.*',
        '**/config/**',
        '**/types/**',
        '**/db/**',
        // rateLimiter.ts was previously excluded; the 2026-04-06
        // process retrospective traced a production boot crash
        // (the SEC-04 ioredis enableOfflineQueue:false bug) to
        // exactly this file. Excluding it from coverage hid the
        // gap. The boot regression test in
        // rateLimiter.boot.test.ts now exercises the affected
        // path so the coverage report should reflect it.
        '**/*.d.ts',
        '**/*.test.ts',
        'src/index.ts',
        'src/constants/**',
      ],
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    environment: 'node',
    exclude: [
      ...configDefaults.exclude,
      'migrations/**',
      'src/__integration__/**',
      'dist/**',
    ],
    globals: true,
  },
});
