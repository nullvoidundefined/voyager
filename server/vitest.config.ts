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
      // Restored to 80 on 2026-04-07 (PR-J). History:
      //   - Original threshold: 80 across all four metrics.
      //   - PR-C (2026-04-06) removed **/rateLimiter.ts from the
      //     exclude list because the SEC-04 boot crash happened
      //     in code that was hidden from coverage.
      //   - PR-G (2026-04-06) dropped the threshold to 75 as a
      //     temporary measure because PR-C's inclusion exposed
      //     pre-existing gaps in routes, logger, trip-context,
      //     and several tool files that had always been below
      //     80 but were silently passing.
      //   - PR-J (2026-04-07) wrote missing tests for
      //     trip-context (35 new tests), logger (4), and the
      //     trips/places routers (8). Branch coverage climbed
      //     from 76.43 to 80.38, so the threshold is restored
      //     to 80 with the same safety margin the original
      //     setting provided.
      //
      // If coverage drops below 80 again, EITHER add tests to
      // bring it back up OR document a temporary lowering as a
      // tracked ENG issue. Do not silently adjust the number.
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
