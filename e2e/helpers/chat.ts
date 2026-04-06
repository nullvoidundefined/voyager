/**
 * Page-object helpers for the chat flow on a trip detail page.
 */
import { type Page, expect } from '@playwright/test';

export async function sendMessage(page: Page, text: string): Promise<void> {
  const input = page.locator(
    'textarea[placeholder*="message" i], input[placeholder*="message" i], textarea[aria-label*="message" i]',
  );
  await input.first().fill(text);
  await page.click(
    'button[type="submit"]:has-text("Send"), button[aria-label*="Send" i]',
  );
}

export async function waitForAgentResponse(
  page: Page,
  opts: { timeoutMs?: number } = {},
): Promise<void> {
  const timeout = opts.timeoutMs ?? 30_000;
  await expect(
    page.locator('[data-role="assistant"], [data-author="agent"]').first(),
  ).toBeVisible({ timeout });
}

export async function assertToolCallIndicator(
  page: Page,
  toolName: string,
): Promise<void> {
  await expect(
    page.locator(`text=/searching ${toolName}|${toolName}/i`).first(),
  ).toBeVisible({ timeout: 15_000 });
}

export async function selectTileCard(
  page: Page,
  cardSelector: string,
): Promise<void> {
  await page.click(cardSelector);
}

export async function assertStreamingText(
  page: Page,
  expectedSubstring: string,
): Promise<void> {
  await expect(page.locator(`text=${expectedSubstring}`).first()).toBeVisible({
    timeout: 15_000,
  });
}
