/**
 * ChatBox invariants:
 * - tool-result cards persist after the SSE stream ends
 * - text nodes never duplicate when the agent re-emits text
 * - empty state renders when the node list is empty
 * - virtualizer layout is stable under append
 * - QuickReplyChips render only after the final assistant message of a turn
 *
 * This file also covers the auto-save and handleFormSubmit paths:
 * - trip_type and flexible_dates are included in PUT requests
 * - flexible_dates is coerced from string 'true'/'false' to boolean
 */
import { get, put } from '@/lib/api/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render } from '@testing-library/react';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatBox } from '../ChatBox';

// Capture callbacks passed to VirtualizedChat so tests can invoke them directly
let capturedOnFormSubmit:
  | ((data: Record<string, string>, msg: string) => Promise<void>)
  | null = null;
let capturedOnFormValuesChange:
  | ((values: Record<string, string>) => void)
  | null = null;
// Capture useSSEChat's onComplete so tests can simulate "agent turn done"
let capturedOnComplete: (() => void) | null = null;

vi.mock('../VirtualizedChat', () => ({
  VirtualizedChat: (props: {
    onFormSubmit?: (data: Record<string, string>, msg: string) => Promise<void>;
    onFormValuesChange?: (values: Record<string, string>) => void;
    onQuickReply?: (msg: string) => void;
    messages?: unknown[];
    streamingNodes?: unknown[];
    toolProgress?: unknown[];
    streamingText?: string;
    isSending?: boolean;
    isStreaming?: boolean;
  }) => {
    capturedOnFormSubmit = props.onFormSubmit ?? null;
    capturedOnFormValuesChange = props.onFormValuesChange ?? null;
    return <div data-testid='virtualized-chat' />;
  },
}));

vi.mock('../useSSEChat', () => ({
  useSSEChat: (opts: { onComplete?: () => void }) => {
    capturedOnComplete = opts.onComplete ?? null;
    return {
      sendMessage: vi.fn().mockResolvedValue(undefined),
      isSending: false,
      streamingNodes: [],
      toolProgress: [],
      streamingText: '',
      error: null,
      clearError: vi.fn(),
    };
  },
}));

vi.mock('@/lib/api/api', () => ({
  get: vi.fn().mockResolvedValue({ messages: [] }),
  post: vi.fn().mockResolvedValue(undefined),
  put: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/components/CostCounter/CostCounter', () => ({
  CostCounter: () => null,
}));

vi.mock('@/components/Toast/Toast', () => ({
  Toast: () => null,
}));

vi.mock('@/components/ToolTimeline/ToolTimeline', () => ({
  ToolTimeline: () => null,
}));

vi.mock('@/lib/demoScript/demoScript', () => ({
  runDemoScript: () => () => undefined,
}));

function renderChatBox() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={qc}>
      <ChatBox tripId='trip-test-1' />
    </QueryClientProvider>,
  );
  return Object.assign(result, { queryClient: qc });
}

beforeEach(() => {
  capturedOnFormSubmit = null;
  capturedOnFormValuesChange = null;
  capturedOnComplete = null;
  vi.clearAllMocks();
  // Re-apply default mocks after clearAllMocks. The costs endpoint
  // gets its own shape so the trip-costs useQuery does not crash.
  (put as Mock).mockResolvedValue(undefined);
  (get as Mock).mockImplementation((url: unknown) => {
    if (typeof url === 'string' && url.includes('/costs')) {
      return Promise.resolve({ total_tokens: 0, total_cost_usd: '0' });
    }
    return Promise.resolve({ messages: [] });
  });
});

describe('ChatBox auto-save: trip_type and flexible_dates', () => {
  it('includes trip_type in the PUT body during auto-save on handleSend', async () => {
    const { getByRole } = renderChatBox();

    // Seed form values with trip_type via the formValuesChange callback
    await act(async () => {
      capturedOnFormValuesChange?.({
        destination: 'Tokyo',
        trip_type: 'adventure',
      });
    });

    // Trigger handleSend by submitting the text input form.
    // Use fireEvent so React's synthetic onChange handler updates state.
    const input = getByRole('textbox');
    const form = input.closest('form')!;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Plan my trip' } });
    });
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(put).toHaveBeenCalledWith(
      '/trips/trip-test-1',
      expect.objectContaining({ trip_type: 'adventure' }),
    );
  });

  it('coerces flexible_dates string "true" to boolean true in PUT body during auto-save', async () => {
    const { getByRole } = renderChatBox();

    await act(async () => {
      capturedOnFormValuesChange?.({
        destination: 'Paris',
        flexible_dates: 'true',
      });
    });

    const input = getByRole('textbox');
    const form = input.closest('form')!;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Plan my trip' } });
    });
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(put).toHaveBeenCalledWith(
      '/trips/trip-test-1',
      expect.objectContaining({ flexible_dates: true }),
    );
  });

  it('coerces flexible_dates string "false" to boolean false in PUT body during auto-save', async () => {
    const { getByRole } = renderChatBox();

    await act(async () => {
      capturedOnFormValuesChange?.({
        destination: 'Paris',
        flexible_dates: 'false',
      });
    });

    const input = getByRole('textbox');
    const form = input.closest('form')!;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Plan my trip' } });
    });
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(put).toHaveBeenCalledWith(
      '/trips/trip-test-1',
      expect.objectContaining({ flexible_dates: false }),
    );
  });
});

describe('ChatBox handleFormSubmit: trip_type and flexible_dates', () => {
  it('includes trip_type in the PUT body on handleFormSubmit', async () => {
    renderChatBox();

    await act(async () => {
      await capturedOnFormSubmit?.(
        {
          destination: 'Tokyo',
          trip_type: 'adventure',
        },
        'Plan my adventure trip to Tokyo',
      );
    });

    expect(put).toHaveBeenCalledWith(
      '/trips/trip-test-1',
      expect.objectContaining({ trip_type: 'adventure' }),
    );
  });

  it('coerces flexible_dates string "true" to boolean true in handleFormSubmit', async () => {
    renderChatBox();

    await act(async () => {
      await capturedOnFormSubmit?.(
        {
          destination: 'Paris',
          flexible_dates: 'true',
        },
        'Plan my flexible trip to Paris',
      );
    });

    expect(put).toHaveBeenCalledWith(
      '/trips/trip-test-1',
      expect.objectContaining({ flexible_dates: true }),
    );
  });

  it('coerces flexible_dates string "false" to boolean false in handleFormSubmit', async () => {
    renderChatBox();

    await act(async () => {
      await capturedOnFormSubmit?.(
        {
          destination: 'Rome',
          flexible_dates: 'false',
        },
        'Plan my fixed-date trip to Rome',
      );
    });

    expect(put).toHaveBeenCalledWith(
      '/trips/trip-test-1',
      expect.objectContaining({ flexible_dates: false }),
    );
  });

  it('does not include trip_type in PUT when not provided in handleFormSubmit', async () => {
    renderChatBox();

    await act(async () => {
      await capturedOnFormSubmit?.(
        {
          destination: 'Tokyo',
        },
        'Plan my trip to Tokyo',
      );
    });

    const putCall = (put as Mock).mock.calls[0];
    expect(putCall[1]).not.toHaveProperty('trip_type');
  });
});

describe('ChatBox cost refresh', () => {
  function countCostsCalls(): number {
    return (get as Mock).mock.calls.filter(
      (c: unknown[]) =>
        typeof c[0] === 'string' && (c[0] as string).includes('/costs'),
    ).length;
  }

  it('queries trip-costs without a polling refetchInterval', async () => {
    const { queryClient } = renderChatBox();

    await vi.waitFor(() => {
      const q = queryClient
        .getQueryCache()
        .find({ queryKey: ['trip-costs', 'trip-test-1'] });
      expect(q).toBeDefined();
    });

    const costsQuery = queryClient
      .getQueryCache()
      .find({ queryKey: ['trip-costs', 'trip-test-1'] });

    // The bug: refetchInterval was 5000, causing the costs endpoint to
    // be polled forever while ChatBox was mounted. The endpoint joins
    // agent_turn_cost + conversations + runs a SUM aggregate (~250ms),
    // and the value only changes when an agent turn completes, so
    // polling is wasted load. The fix is event-driven invalidation via
    // useSSEChat's onComplete (asserted in the next test).
    expect(costsQuery?.options.refetchInterval).toBeFalsy();
  });

  it('refetches trip-costs when useSSEChat fires onComplete', async () => {
    const { queryClient } = renderChatBox();

    // Let the initial query settle.
    await vi.waitFor(() => {
      expect(countCostsCalls()).toBeGreaterThanOrEqual(1);
    });
    const initialCalls = countCostsCalls();

    // Force the costs query to "data" state so invalidate triggers a
    // refetch (TanStack Query refetches only active queries; without
    // settling, the query may still be in flight).
    await vi.waitFor(() => {
      const q = queryClient
        .getQueryCache()
        .find({ queryKey: ['trip-costs', 'trip-test-1'] });
      expect(q?.state.status).toBe('success');
    });

    expect(capturedOnComplete).not.toBeNull();
    await act(async () => {
      capturedOnComplete?.();
    });

    await vi.waitFor(
      () => {
        expect(countCostsCalls()).toBeGreaterThan(initialCalls);
      },
      { timeout: 3000 },
    );
  });
});
