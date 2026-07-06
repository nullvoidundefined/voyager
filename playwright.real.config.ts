import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

// Real-API E2E config: runs specs in e2e/real/ against an
// un-mocked server (no E2E_MOCK_ANTHROPIC, no E2E_MOCK_TOOLS,
// no page.route intercepts). These specs exercise the actual
// agent loop, real Anthropic responses, and real SerpApi /
// Google Places tool calls.
//
// Costs: each run consumes Anthropic tokens and SerpApi quota
// (~3-8 tool calls per agent turn). Intended for a nightly job
// or pre-release verification, not the per-push fast lane.

const ROOT_DIR = __dirname;

export default defineConfig({
  testDir: path.resolve(ROOT_DIR, 'e2e/real'),
  timeout: 300_000,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? 'html' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-real',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npx tsx src/index.ts',
      cwd: path.resolve(ROOT_DIR, 'apps/server'),
      port: 3001,
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
      env: {
        ...(process.env as Record<string, string>),
        PORT: '3001',
        NODE_ENV: 'test',
        ...(process.env.DATABASE_URL_E2E_LOCAL
          ? { DATABASE_URL: process.env.DATABASE_URL_E2E_LOCAL }
          : {}),
        E2E_BYPASS_RATE_LIMITS: '1',
        CORS_ORIGIN: 'http://localhost:3000',
      },
    },
    {
      command: 'npx next dev --port 3000',
      cwd: path.resolve(ROOT_DIR, 'apps/client/web'),
      port: 3000,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
