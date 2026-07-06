import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@repo/types': path.resolve(__dirname, '../../../packages/types/src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      exclude: [
        '**/*.config.*',
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '.next/**',
        'e2e/**',
        'public/**',
        'src/test/**',
        'src/app/layout.tsx',
        'src/app/**/loading.tsx',
        'src/app/**/error.tsx',
        'src/app/**/not-found.tsx',
      ],
      // Initial gate calibrated below current numbers (lines 71%,
      // branches 73%, functions 52%, statements 72% as of 2026-05-29)
      // so CI catches regressions without flaking. Raise this when
      // adding tests; never lower silently.
      thresholds: {
        branches: 65,
        functions: 45,
        lines: 65,
        statements: 65,
      },
    },
  },
});
