import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

/**
 * Production smoke config. Runs e2e/production/ specs against the live
 * deployment. No webServer block -- servers are already running.
 * Only covers public pages (no auth, no agent calls, zero API cost).
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
