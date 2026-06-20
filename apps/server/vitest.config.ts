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
        '**/database/**',
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
        // R-200 anti-pattern #5 fix (2026-05-29): the 4 repositories
        // below were unit-tested via tautological pool mocks
        // (mockResolvedValue(row); expect(result).toEqual(row)). The
        // unit tests were deleted in favor of the integration tests
        // in src/__tests__/integration/repositories/* which hit a real
        // Postgres. Integration tests are excluded from the default
        // vitest run, so the unit-coverage pass should not count
        // these files against the threshold. The repositories ARE
        // still covered, just at the integration layer.
        'src/repositories/auth.ts',
        'src/repositories/conversations.ts',
        'src/repositories/toolCallLog.ts',
        'src/repositories/userPreferences.ts',
      ],
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      // Raised from 80 to 85 on 2026-04-07 (PR-K, ENG-19).
      // History:
      //   - Original threshold: 80.
      //   - PR-C (2026-04-06) removed rateLimiter.ts from the
      //     exclude list (the SEC-04 boot crash was in hidden
      //     code).
      //   - PR-G (2026-04-06) dropped threshold to 75 because
      //     PR-C's inclusion exposed pre-existing gaps.
      //   - PR-J (2026-04-07) wrote 47 tests for trip-context,
      //     logger, trips/places routers. Branch coverage
      //     76.43 -> 80.38. Threshold restored to 80.
      //   - PR-K (2026-04-07) ENG-19 wrote 45 more tests for
      //     chat.helpers, flights/hotels/executor tools,
      //     node-builder, requestLogger, agent.service
      //     (advisory/quick_replies branches), trips handler
      //     (destination-change clear-selections path).
      //     Branch coverage 80.38 -> 85.22. Threshold raised
      //     to 85.
      //
      // If coverage drops below 85, EITHER add tests to bring
      // it back up OR document a temporary lowering as a
      // tracked ENG issue. Do not silently adjust the number.
      thresholds: {
        branches: 85,
        functions: 85,
        lines: 85,
        statements: 85,
      },
    },
    environment: 'node',
    exclude: [
      ...configDefaults.exclude,
      'migrations/**',
      'src/__tests__/integration/**',
      'dist/**',
    ],
    globals: true,
    include: ['src/__tests__/**/*.test.ts'],
  },
});
