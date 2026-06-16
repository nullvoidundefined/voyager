import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Content guard for useSSEChat error handling.
 *
 * Locks in the UX-03 fix: the pre-audit hook routed both raw SSE
 * error events and fetch failures through setStreamingText, which
 * meant the UI displayed raw error messages inline inside the chat
 * bubble instead of routing through the Toast convention in
 * CLAUDE-FRONTEND.md.
 */

const hookPath = resolve(__dirname, '..', 'useSSEChat.ts');
const hookSource = readFileSync(hookPath, 'utf-8');

describe('useSSEChat error handling', () => {
  it('does not write raw error text into streamingText', () => {
    // Pre-audit anti-pattern: setStreamingText(event.error)
    expect(hookSource).not.toMatch(/setStreamingText\(event\.error\)/);
  });

  it('does not write a hardcoded "Something went wrong" into streamingText', () => {
    expect(hookSource).not.toMatch(
      /setStreamingText\(['"]Something went wrong/,
    );
  });

  it('exposes an error state that consumers can route to Toast', () => {
    const hasErrorState =
      /setError|const \[error/.test(hookSource) &&
      /error:\s*string\s*\|\s*null|error\?:/.test(hookSource);
    expect(hasErrorState).toBe(true);
  });

  it('exposes a clearError function for retry flows', () => {
    expect(hookSource).toMatch(/clearError/);
  });

  it('guards JSON.parse against malformed SSE data', () => {
    // JSON.parse of SSE data must be wrapped in its own try/catch
    // so that a malformed line does not trigger the misleading
    // "Could not reach the agent" error from the outer catch.
    expect(hookSource).toMatch(/try\s*\{[\s\S]*?JSON\.parse[\s\S]*?\}\s*catch/);
  });

  it('handles the budget event to expose live token usage', () => {
    expect(hookSource).toMatch(/case 'budget'/);
    expect(hookSource).toMatch(/setLiveTokens/);
    expect(hookSource).toMatch(/liveTokens/);
  });
});
