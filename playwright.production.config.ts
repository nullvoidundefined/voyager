import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

/**
 * Production smoke config. Runs e2e/production/ specs against the live
 * deployment. No webServer block -- servers are already running.
 * Covers public pages plus authenticated reachability and trip persistence.
 * It deliberately does NOT drive the agent's live search: agent and tile-card
 * flows are exercised deterministically in the mocked e2e lane (E2E_MOCK_TOOLS),
 * so the production smoke never depends on or consumes the live SerpApi quota.
 */

const ROOT_DIR = __dirname;

export default defineConfig({
  testDir: path.resolve(ROOT_DIR, 'e2e/production'),
  timeout: 30_000,
  retries: 1,
  workers: 1,
  reporter: process.env.CI ? 'html' : 'list',
  use: {
    baseURL: 'https://voyager.iangreenoughdeveloper.com',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
