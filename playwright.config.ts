import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

// Playwright loads this config via CommonJS so __dirname is the
// directory of this file regardless of CWD. We use it to keep
// the testDir absolute, which lets the config work whether
// invoked from the monorepo root or from inside web-client
// (where the @playwright/test binary lives).
const ROOT_DIR = __dirname;

export default defineConfig({
  testDir: path.resolve(ROOT_DIR, 'e2e'),
  // The nightly real-API smoke suite lives at e2e/real-apis/ and
  // must NOT run in the main mocked suite. The e2e-real-apis.yml
  // workflow points at it explicitly with --grep or by passing the
  // path as an argument.
  testIgnore: ['**/real-apis/**'],
  timeout: 30_000,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'html' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'cd server && npx tsx src/index.ts',
      port: 3001,
      timeout: 15_000,
      reuseExistingServer: !process.env.CI,
      env: {
        PORT: '3001',
        NODE_ENV: 'test',
        // Plan B (2026-04-06): force the server to use mock tool
        // adapters so E2E runs do not burn real SerpApi / Google
        // Places quota. The real-API smoke suite in e2e/real-apis/
        // runs in a separate nightly workflow with this flag unset.
        E2E_MOCK_TOOLS: '1',
      },
    },
    {
      command: 'cd web-client && npx next dev --port 3000',
      port: 3000,
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
