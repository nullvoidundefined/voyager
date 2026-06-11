/**
 * Streaming disconnect and error-recovery tests for useSSEChat.
 *
 * Gap tested here: the existing useSSEChat.content.test.ts audits
 * the source for correct error-routing patterns (no raw error text
 * in streamingText). This spec tests the runtime behavior when the
 * stream is interrupted, so we can confirm:
 *
 *   1. An AbortError (user-initiated cancel or component unmount)
 *      clears isSending without setting an error message -- the
 *      user chose to cancel, not a failure they need to act on.
 *   2. A network error (fetch throws, connection drops mid-stream)
 *      clears isSending AND sets a user-facing error string.
 *   3. A non-ok HTTP response (500, 429) clears isSending AND sets
 *      an error string.
 *   4. After any of the above, a second sendMessage call succeeds
 *      (the hook is not permanently wedged).
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSSEChat } from './useSSEChat';

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/lib/api/api', () => ({
  API_BASE: 'http://localhost:3001',
}));

function buildSseStream(
  lines: string[],
  abortAfterMs?: number,
): { body: ReadableStream<Uint8Array>; abortController?: AbortController } {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      if (abortAfterMs !== undefined) {
        await new Promise<void>((resolve) => setTimeout(resolve, abortAfterMs));
        controller.error(
          Object.assign(new Error('AbortError'), { name: 'AbortError' }),
        );
        return;
      }
      for (const line of lines) {
        controller.enqueue(encoder.encode(line + '\n'));
      }
      controller.close();
    },
  });
  return { body: stream };
}

const DONE_SSE = [
  'event: done',
  'data: {"type":"done","message":{"id":"msg-1","role":"assistant","nodes":[],"sequence":2,"created_at":"2026-01-01T00:00:00.000Z"}}',
  '',
];

describe('useSSEChat disconnect and error recovery', () => {
  const TRIP_ID = 'trip-abc-123';
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clears isSending after a successful stream completes', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: buildSseStream(DONE_SSE).body,
    } as Response);

    const { result } = renderHook(() => useSSEChat({ tripId: TRIP_ID }));

    await act(async () => {
      await result.current.sendMessage('Plan a trip');
    });

    expect(result.current.isSending).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('clears isSending without setting error when fetch is aborted (AbortError)', async () => {
    const abortError = Object.assign(new Error('The operation was aborted'), {
      name: 'AbortError',
    });
    fetchMock.mockRejectedValueOnce(abortError);

    const { result } = renderHook(() => useSSEChat({ tripId: TRIP_ID }));

    await act(async () => {
      await result.current.sendMessage('Plan a trip');
    });

    // AbortError is intentional (cancel or unmount); no user-facing error.
    expect(result.current.isSending).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets error and clears isSending on network failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Failed to fetch'));

    const { result } = renderHook(() => useSSEChat({ tripId: TRIP_ID }));

    await act(async () => {
      await result.current.sendMessage('Plan a trip');
    });

    expect(result.current.isSending).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(result.current.error).toMatch(/connection|agent|reach/i);
  });

  it('sets error and clears isSending on non-ok HTTP response (500)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      body: null,
    } as Response);

    const { result } = renderHook(() => useSSEChat({ tripId: TRIP_ID }));

    await act(async () => {
      await result.current.sendMessage('Plan a trip');
    });

    expect(result.current.isSending).toBe(false);
    expect(result.current.error).toBeTruthy();
  });

  it('sets error and clears isSending on non-ok HTTP response (429)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      body: null,
    } as Response);

    const { result } = renderHook(() => useSSEChat({ tripId: TRIP_ID }));

    await act(async () => {
      await result.current.sendMessage('Plan a trip');
    });

    expect(result.current.isSending).toBe(false);
    expect(result.current.error).toBeTruthy();
  });

  it('hook is not permanently wedged after an error: second sendMessage works', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: buildSseStream(DONE_SSE).body,
      } as Response);

    const { result } = renderHook(() => useSSEChat({ tripId: TRIP_ID }));

    // First call: fails
    await act(async () => {
      await result.current.sendMessage('Plan a trip');
    });
    expect(result.current.error).toBeTruthy();

    // Clear the error
    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();

    // Second call: succeeds
    await act(async () => {
      await result.current.sendMessage('Try again');
    });
    expect(result.current.isSending).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('does not set isSending when message is empty', async () => {
    const { result } = renderHook(() => useSSEChat({ tripId: TRIP_ID }));

    await act(async () => {
      await result.current.sendMessage('   ');
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.isSending).toBe(false);
  });
});
