import path from 'node:path';

import { expect, test } from '@playwright/test';

import { existingUser, seedUser } from './fixtures/test-users';
import { login } from './helpers/auth';

// ---------------------------------------------------------------------------
// Breakpoints
// ---------------------------------------------------------------------------

const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'mobile-lg', width: 480, height: 896 },
  { name: 'tablet-sm', width: 600, height: 1024 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop-sm', width: 800, height: 900 },
  { name: 'desktop', width: 1024, height: 900 },
  { name: 'desktop-lg', width: 1440, height: 900 },
] as const;

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const PUBLIC_ROUTES: Array<{ name: string; path: string }> = [
  { name: 'home', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'register', path: '/register' },
  { name: 'explore', path: '/explore' },
  { name: 'faq', path: '/faq' },
];

const PROTECTED_ROUTES: Array<{ name: string; path: string }> = [
  { name: 'trips', path: '/trips' },
  { name: 'account', path: '/account' },
];

const OUTPUT_DIR = path.join(__dirname, '..', 'screenshots');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitForPageReady(page: import('@playwright/test').Page) {
  // domcontentloaded, not networkidle: the explore page has 88
  // destination images and networkidle never settles within the
  // 30s test timeout on shared CI runners.
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------
// Public routes
// ---------------------------------------------------------------------------

test.describe('Public page screenshots', () => {
  for (const route of PUBLIC_ROUTES) {
    for (const bp of BREAKPOINTS) {
      test(`${route.name} @ ${bp.name}`, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: bp.width, height: bp.height },
        });
        const page = await context.newPage();
        await page.goto(route.path);
        await waitForPageReady(page);

        await page.screenshot({
          fullPage: true,
          path: path.join(OUTPUT_DIR, bp.name, `${route.name}.png`),
        });
        expect(true).toBe(true);
        await context.close();
      });
    }
  }
});

// ---------------------------------------------------------------------------
// Protected routes
// ---------------------------------------------------------------------------

test.describe('Protected page screenshots', () => {
  let user: Awaited<ReturnType<typeof existingUser>>;

  test.beforeAll(async () => {
    user = await seedUser(existingUser());
  });

  for (const route of PROTECTED_ROUTES) {
    for (const bp of BREAKPOINTS) {
      test(`${route.name} @ ${bp.name}`, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: 1440, height: 900 },
        });
        const page = await context.newPage();
        await login(page, {
          email: user.email,
          password: user.password,
        });

        await page.setViewportSize({
          width: bp.width,
          height: bp.height,
        });
        await page.goto(route.path);
        await waitForPageReady(page);

        await page.screenshot({
          fullPage: true,
          path: path.join(OUTPUT_DIR, bp.name, `${route.name}.png`),
        });
        expect(true).toBe(true);
        await context.close();
      });
    }
  }
});
