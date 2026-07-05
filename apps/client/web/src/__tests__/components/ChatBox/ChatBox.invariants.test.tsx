import type { ChatMessage } from '@repo/types';
import { cleanup, render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VirtualizedChat } from '@/components/ChatBox/VirtualizedChat';

/**
 * ChatBox data-model invariants.
 *
 * Source of mandate: voyager/CLAUDE.md "ChatBox invariants" section
 * (added 2026-04-06 after the process retrospective traced a 9-commit
 * fix storm in the ChatBox/VirtualizedChat surface to the absence of
 * an invariants test). Every subsequent ChatBox or VirtualizedChat
 * fix MUST extend this spec rather than create a new ad-hoc test.
 *
 * The invariants tested here:
 *
 *   1. Tool-result cards persist after the SSE stream ends.
 *   2. Text nodes never duplicate when the agent re-emits text.
 *   3. Empty state renders when the node list is empty.
 *   4. Virtualizer layout is stable under append (the rendered
 *      message count tracks the input message count).
 *   5. QuickReplyChips render only on the most recent assistant
 *      message of a turn.
 *
 * The tests render VirtualizedChat in isolation with controlled
 * props rather than the full ChatBox shell, because the data
 * merging logic that the invariants protect lives in
 * VirtualizedChat (streaming overlay) and the props it receives
 * from ChatBox (server messages plus optimistic pending message).
 */

afterEach(cleanup);

// Mock the @tanstack/react-virtual virtualizer to render every
// message synchronously instead of windowing. The virtualizer
// is not the unit under test here; we want to assert about node
// presence, not about virtual scrolling.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        key: String(i),
        start: i * 100,
        size: 100,
        end: (i + 1) * 100,
        lane: 0,
      })),
    getTotalSize: () => count * 100,
    scrollToIndex: () => undefined,
    measureElement: () => undefined,
  }),
}));

function makeUserMessage(id: string, text: string): ChatMessage {
  return {
    id,
    role: 'user',
    nodes: [{ type: 'text', content: text }],
    sequence: 1,
    created_at: '2026-04-06T00:00:00.000Z',
  };
}

function makeAssistantMessage(
  id: string,
  nodes: ChatMessage['nodes'],
  sequence: number = 2,
): ChatMessage {
  return {
    id,
    role: 'assistant',
    nodes,
    sequence,
    created_at: '2026-04-06T00:00:00.000Z',
  };
}

const noop = () => undefined;

describe('ChatBox invariants', () => {
  describe('invariant 1: tool-result cards persist after the stream ends', () => {
    it('keeps a flight offer_tiles node visible after isSending flips from true to false', () => {
      const flightTilesMessage = makeAssistantMessage('msg-1', [
        {
          type: 'offer_tiles',
          offer_kind: 'flight',
          offers: [
            {
              id: 'F1',
              title: 'Delta DL100',
              subtitle: 'DEN to SFO',
              selection_label: 'Delta DL100 - DEN to SFO',
              price: 300,
              currency: 'USD',
              detail: {
                airline: 'Delta',
                flight_number: 'DL100',
                origin: 'DEN',
                destination: 'SFO',
                departure_time: '2026-06-01T08:00:00',
              },
            },
          ],
          selectable: true,
        },
      ]);

      // While streaming
      const { rerender } = render(
        <VirtualizedChat
          messages={[flightTilesMessage]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText=''
          isSending
          onQuickReply={noop}
        />,
      );
      expect(screen.getByText(/DL100/)).toBeInTheDocument();

      // After stream ends
      rerender(
        <VirtualizedChat
          messages={[flightTilesMessage]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText=''
          isSending={false}
          onQuickReply={noop}
        />,
      );
      expect(screen.getByText(/DL100/)).toBeInTheDocument();
    });
  });

  describe('invariant 2: text nodes never duplicate when the agent re-emits text', () => {
    it('does not double-render the same text content across stream-end transition', () => {
      const persistedMessage = makeAssistantMessage('msg-1', [
        { type: 'text', content: 'Here is your flight plan.' },
      ]);

      // First render: simulating the moment AFTER the SSE stream
      // completed and the server message refresh has landed. The
      // streamingText is already cleared, the persisted message
      // contains the same content. The component must not also
      // build a streamingMessage for empty state.
      render(
        <VirtualizedChat
          messages={[persistedMessage]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText=''
          isSending={false}
          onQuickReply={noop}
        />,
      );

      const matches = screen.getAllByText(/Here is your flight plan\./);
      expect(matches).toHaveLength(1);
    });

    it('renders streaming text exactly once while isSending is true', () => {
      const userMessage = makeUserMessage('msg-1', 'Plan a trip');
      render(
        <VirtualizedChat
          messages={[userMessage]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText='Looking at your options...'
          isSending
          onQuickReply={noop}
        />,
      );

      const matches = screen.getAllByText(/Looking at your options/);
      expect(matches).toHaveLength(1);
    });
  });

  describe('invariant 3: empty state renders when the node list is empty', () => {
    it('renders the empty-state header when there are no messages and not streaming', () => {
      render(
        <VirtualizedChat
          messages={[]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText=''
          isSending={false}
          onQuickReply={noop}
        />,
      );

      expect(screen.getByText(/Start planning your trip/i)).toBeInTheDocument();
    });

    it('does NOT render the empty state when streaming has begun even with zero persisted messages', () => {
      render(
        <VirtualizedChat
          messages={[]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText='Working...'
          isSending
          onQuickReply={noop}
        />,
      );

      expect(
        screen.queryByText(/Start planning your trip/i),
      ).not.toBeInTheDocument();
    });
  });

  describe('invariant 4: virtualizer layout is stable under append', () => {
    it('the rendered message count tracks the input message count exactly', () => {
      const m1 = makeUserMessage('m1', 'first');
      const m2 = makeAssistantMessage('m2', [
        { type: 'text', content: 'second' },
      ]);
      const m3 = makeUserMessage('m3', 'third');

      const { rerender } = render(
        <VirtualizedChat
          messages={[m1, m2]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText=''
          isSending={false}
          onQuickReply={noop}
        />,
      );
      expect(screen.getAllByText(/first|second/)).toHaveLength(2);

      // Append a third message and assert all three appear,
      // none disappear, none duplicate.
      rerender(
        <VirtualizedChat
          messages={[m1, m2, m3]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText=''
          isSending={false}
          onQuickReply={noop}
        />,
      );
      expect(screen.getAllByText(/first|second|third/)).toHaveLength(3);
    });
  });

  describe('invariant 5: QuickReplyChips render on assistant messages with the node', () => {
    it('renders quick reply buttons when the assistant message contains a quick_replies node', () => {
      const assistantWithChips = makeAssistantMessage('msg-1', [
        { type: 'text', content: 'Pick one:' },
        {
          type: 'quick_replies',
          options: ["I'll take the cheapest", 'Show me more', 'Confirm'],
        },
      ]);

      render(
        <VirtualizedChat
          messages={[assistantWithChips]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText=''
          isSending={false}
          onQuickReply={noop}
        />,
      );

      // The QuickReplyChips component renders a [role="group"]
      // with aria-label="Quick replies" and one button per option.
      expect(
        screen.getByRole('group', { name: 'Quick replies' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: "I'll take the cheapest" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Show me more' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Confirm' }),
      ).toBeInTheDocument();
    });

    it('does not render a QuickReplyChips group when no assistant message has a quick_replies node', () => {
      const plainAssistant = makeAssistantMessage('msg-1', [
        { type: 'text', content: 'Plain text only.' },
      ]);

      render(
        <VirtualizedChat
          messages={[plainAssistant]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText=''
          isSending={false}
          onQuickReply={noop}
        />,
      );

      expect(
        screen.queryByRole('group', { name: 'Quick replies' }),
      ).not.toBeInTheDocument();
    });

    it('quick reply chips in a non-last message are disabled', async () => {
      const msgWithChips = makeAssistantMessage(
        'msg-1',
        [{ type: 'quick_replies', options: ['Option A', 'Option B'] }],
        1,
      );
      const msgLater = makeAssistantMessage(
        'msg-2',
        [{ type: 'text', content: 'Here is the next response.' }],
        2,
      );

      render(
        <VirtualizedChat
          messages={[msgWithChips, msgLater]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText=''
          isSending={false}
          onQuickReply={noop}
        />,
      );

      const buttons = await screen.findAllByRole('button', {
        name: /Option A|Option B/i,
      });
      expect(buttons.every((b) => (b as HTMLButtonElement).disabled)).toBe(
        true,
      );
    });

    it('quick reply chips in the last message are enabled when not sending', async () => {
      const msgWithChips = makeAssistantMessage('msg-1', [
        { type: 'quick_replies', options: ['Option A', 'Option B'] },
      ]);

      render(
        <VirtualizedChat
          messages={[msgWithChips]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText=''
          isSending={false}
          onQuickReply={noop}
        />,
      );

      const buttons = await screen.findAllByRole('button', {
        name: /Option A|Option B/i,
      });
      expect(buttons.some((b) => !(b as HTMLButtonElement).disabled)).toBe(
        true,
      );
    });

    it('quick reply chips in the last message are disabled while sending', async () => {
      const msgWithChips = makeAssistantMessage('msg-1', [
        { type: 'quick_replies', options: ['Option A', 'Option B'] },
      ]);

      render(
        <VirtualizedChat
          messages={[msgWithChips]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText=''
          isSending={true}
          onQuickReply={noop}
        />,
      );

      const buttons = await screen.findAllByRole('button', {
        name: /Option A|Option B/i,
      });
      expect(buttons.every((b) => (b as HTMLButtonElement).disabled)).toBe(
        true,
      );
    });
  });

  describe('invariant 6: tool_progress nodes collapse into one progress bar', () => {
    it('renders exactly one progressbar element when an assistant message has multiple tool_progress nodes', () => {
      const assistantWithToolProgress = makeAssistantMessage('msg-1', [
        {
          type: 'tool_progress',
          tool_name: 'search_flights',
          tool_id: 't1',
          status: 'done',
        },
        {
          type: 'tool_progress',
          tool_name: 'search_hotels',
          tool_id: 't2',
          status: 'done',
        },
        {
          type: 'tool_progress',
          tool_name: 'search_experiences',
          tool_id: 't3',
          status: 'running',
        },
      ]);

      render(
        <VirtualizedChat
          messages={[assistantWithToolProgress]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText=''
          isSending
          onQuickReply={noop}
        />,
      );

      expect(screen.getAllByRole('progressbar')).toHaveLength(1);
      expect(screen.getByText(/Finding experiences/)).toBeInTheDocument();
    });

    it('renders the progressbar at 100% when all tool_progress nodes are done', () => {
      const allDone = makeAssistantMessage('msg-1', [
        {
          type: 'tool_progress',
          tool_name: 'search_flights',
          tool_id: 't1',
          status: 'done',
        },
        {
          type: 'tool_progress',
          tool_name: 'search_hotels',
          tool_id: 't2',
          status: 'done',
        },
      ]);

      render(
        <VirtualizedChat
          messages={[allDone]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText=''
          isSending={false}
          onQuickReply={noop}
        />,
      );

      const bar = screen.getByRole('progressbar');
      expect(bar).toHaveAttribute('aria-valuenow', '100');
    });
  });

  describe('invariant 8: BookingPrompt tile renders inline as a chat node', () => {
    it('renders exactly one BookingPrompt when an assistant message contains a booking_prompt node', () => {
      const promptMessage = makeAssistantMessage('msg-1', [
        {
          type: 'booking_prompt',
          experiences_empty: true,
          car_rentals_empty: true,
        },
      ]);

      render(
        <VirtualizedChat
          messages={[promptMessage]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText=''
          isSending={false}
          onQuickReply={noop}
        />,
      );

      const matches = screen.getAllByText(/Ready to save this itinerary/);
      expect(matches).toHaveLength(1);
      expect(
        screen.getByRole('button', { name: 'Save itinerary' }),
      ).toBeInTheDocument();
    });
  });

  describe('invariant 9: ChatBox does not use document.getElementById for form values', () => {
    it('ChatBox.tsx source must not contain document.getElementById (P0 DOM-scraping regression guard)', () => {
      const chatBoxSource = fs.readFileSync(
        path.resolve(__dirname.replace('/__tests__/', '/'), 'ChatBox.tsx'),
        'utf-8',
      );
      expect(chatBoxSource).not.toContain('document.getElementById');
    });
  });

  describe('invariant 10: aria-live region announces agent status', () => {
    it('ChatBox.tsx contains an aria-live polite region for screen reader announcements', () => {
      const chatBoxSource = fs.readFileSync(
        path.resolve(__dirname.replace('/__tests__/', '/'), 'ChatBox.tsx'),
        'utf-8',
      );
      expect(chatBoxSource).toContain("aria-live='polite'");
      expect(chatBoxSource).toContain('Agent is searching...');
    });
  });

  describe('invariant 7: pending indicator renders synchronously after send', () => {
    it('shows an indeterminate progress bar with "Thinking" while isSending=true and no nodes have arrived yet', () => {
      const userMsg = makeUserMessage('m1', 'Plan a Beijing trip');

      render(
        <VirtualizedChat
          messages={[userMsg]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText=''
          isSending
          onQuickReply={noop}
        />,
      );

      const bar = screen.getByRole('progressbar', { name: /thinking/i });
      expect(bar).toBeInTheDocument();
      expect(bar).not.toHaveAttribute('aria-valuenow');
    });

    it('removes the pending indicator once the first streaming node arrives', () => {
      const userMsg = makeUserMessage('m1', 'Plan a Beijing trip');

      const { rerender } = render(
        <VirtualizedChat
          messages={[userMsg]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText=''
          isSending
          onQuickReply={noop}
        />,
      );
      expect(
        screen.queryByRole('progressbar', { name: /thinking/i }),
      ).toBeInTheDocument();

      rerender(
        <VirtualizedChat
          messages={[userMsg]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText='Looking at your options'
          isSending
          onQuickReply={noop}
        />,
      );

      expect(
        screen.queryByRole('progressbar', { name: /thinking/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe('invariant 12: plan_card node renders TripPlanWidget', () => {
    it('renders a Start planning button when an assistant message contains a plan_card node', () => {
      const planCardMessage = makeAssistantMessage('msg-1', [
        {
          type: 'plan_card',
          plan_card: {
            categories: [
              {
                id: 'flights' as const,
                label: 'Flights',
                enabled: true,
                not_applicable: false,
              },
              {
                id: 'hotels' as const,
                label: 'Hotel',
                enabled: true,
                not_applicable: false,
              },
            ],
          },
        },
      ]);

      render(
        <VirtualizedChat
          messages={[planCardMessage]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText=''
          isSending={false}
          onQuickReply={noop}
        />,
      );

      expect(
        screen.getByRole('button', { name: /Start planning/i }),
      ).toBeInTheDocument();
    });

    it('shows read-only confirmed view when plan_card node has confirmed=true', () => {
      const confirmedPlanMessage = makeAssistantMessage('msg-1', [
        {
          type: 'plan_card',
          confirmed: true,
          plan_card: {
            categories: [
              {
                id: 'flights' as const,
                label: 'Flights',
                enabled: true,
                not_applicable: false,
              },
            ],
          },
        },
      ]);

      render(
        <VirtualizedChat
          messages={[confirmedPlanMessage]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText=''
          isSending={false}
          onQuickReply={noop}
        />,
      );

      expect(screen.getByText(/Plan confirmed/i)).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Start planning/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe('invariant 11: booking trigger string routes to onBookTrip', () => {
    it('exports the trigger constant with the expected value', async () => {
      const mod = await import('@/components/ChatBox/ChatBox');
      expect(mod.BOOKING_CONFIRMATION_TRIGGER).toBe('Save itinerary');
    });

    it('handleSend(trigger) calls onBookTrip and never enters sendMessage', async () => {
      const sendMessage = vi.fn();
      const onBookTrip = vi.fn();
      vi.resetModules();
      vi.doMock('@/components/ChatBox/useSSEChat', () => ({
        useSSEChat: () => ({
          sendMessage,
          isSending: false,
          streamingNodes: [],
          toolProgress: [],
          streamingText: '',
          error: null,
          clearError: () => {},
        }),
      }));
      vi.doMock('@/api/request', () => ({
        get: vi.fn().mockResolvedValue({ messages: [] }),
        post: vi.fn().mockResolvedValue({}),
        put: vi.fn().mockResolvedValue({}),
      }));
      vi.doMock('@/services/demoScript', () => ({
        runDemoScript: () => () => undefined,
      }));

      const { ChatBox, BOOKING_CONFIRMATION_TRIGGER } =
        await import('@/components/ChatBox/ChatBox');
      const { QueryClient, QueryClientProvider } =
        await import('@tanstack/react-query');
      const { fireEvent } = await import('@testing-library/react');

      const qc = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      render(
        <QueryClientProvider client={qc}>
          <ChatBox tripId='trip-1' onBookTrip={onBookTrip} />
        </QueryClientProvider>,
      );

      const input = screen.getByRole('textbox');
      fireEvent.change(input, {
        target: { value: BOOKING_CONFIRMATION_TRIGGER },
      });
      const form = input.closest('form');
      expect(form).not.toBeNull();
      fireEvent.submit(form!);

      expect(onBookTrip).toHaveBeenCalledTimes(1);
      expect(sendMessage).not.toHaveBeenCalled();
    });
  });
});

describe('ChatBox invariants: generic offer tiles (multimodal refactor)', () => {
  function makeOfferTilesNode(
    kind: string,
    id: string,
    title: string,
  ): ChatMessage['nodes'][number] {
    return {
      type: 'offer_tiles',
      offer_kind: kind,
      offers: [{ id, title, price: 100, currency: 'USD' }],
      selectable: true,
    } as ChatMessage['nodes'][number];
  }

  it('invariant 13: offer_tiles cards persist after the stream ends for every kind', () => {
    const kinds = ['flight', 'hotel', 'car_rental', 'experience'] as const;
    const messages = kinds.map((kind, i) =>
      makeAssistantMessage(
        `offer-${kind}`,
        [makeOfferTilesNode(kind, `${kind}-1`, `Offer ${kind}`)],
        i + 2,
      ),
    );
    const { rerender } = render(
      <VirtualizedChat
        messages={messages}
        streamingNodes={[]}
        toolProgress={[]}
        streamingText=''
        isSending
        onQuickReply={noop}
      />,
    );
    rerender(
      <VirtualizedChat
        messages={messages}
        streamingNodes={[]}
        toolProgress={[]}
        streamingText=''
        isSending={false}
        onQuickReply={noop}
      />,
    );
    for (const kind of kinds) {
      expect(screen.getByText(new RegExp(`Offer ${kind}`))).toBeInTheDocument();
    }
  });

  it('invariant 14: an unknown offer kind renders the fallback card, never throws', () => {
    const message = makeAssistantMessage('offer-unknown', [
      makeOfferTilesNode('hovercraft', 'hv-1', 'Hover Deluxe'),
    ]);
    expect(() =>
      render(
        <VirtualizedChat
          messages={[message]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText=''
          isSending={false}
          onQuickReply={noop}
        />,
      ),
    ).not.toThrow();
    expect(screen.getByText('Hover Deluxe')).toBeInTheDocument();
  });

  it('invariant 15: layout stays stable when offer_tiles of different kinds append', () => {
    const first = makeAssistantMessage('mix-1', [
      makeOfferTilesNode('flight', 'f1', 'Mixed Flight'),
    ]);
    const second = makeAssistantMessage(
      'mix-2',
      [makeOfferTilesNode('hotel', 'h1', 'Mixed Hotel')],
      3,
    );
    const { rerender } = render(
      <VirtualizedChat
        messages={[first]}
        streamingNodes={[]}
        toolProgress={[]}
        streamingText=''
        isSending={false}
        onQuickReply={noop}
      />,
    );
    expect(screen.getByText(/Mixed Flight/)).toBeInTheDocument();
    rerender(
      <VirtualizedChat
        messages={[first, second]}
        streamingNodes={[]}
        toolProgress={[]}
        streamingText=''
        isSending={false}
        onQuickReply={noop}
      />,
    );
    expect(screen.getByText(/Mixed Flight/)).toBeInTheDocument();
    expect(screen.getByText(/Mixed Hotel/)).toBeInTheDocument();
  });

  it('invariant 16: QuickReplyChips still render only after the final assistant message when offer tiles are present', () => {
    const withTiles = makeAssistantMessage('qr-1', [
      makeOfferTilesNode('flight', 'f1', 'QR Flight'),
      { type: 'quick_replies', options: ['Skip flights'] },
    ]);
    const later = makeAssistantMessage(
      'qr-2',
      [{ type: 'text', content: 'Anything else?' }],
      3,
    );
    render(
      <VirtualizedChat
        messages={[withTiles, later]}
        streamingNodes={[]}
        toolProgress={[]}
        streamingText=''
        isSending={false}
        onQuickReply={noop}
      />,
    );
    // Chips on a non-final assistant message must be disabled or absent.
    const chip = screen.queryByRole('button', { name: 'Skip flights' });
    if (chip) {
      expect(chip).toBeDisabled();
    }
  });
});
