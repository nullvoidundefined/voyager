import type { ChatMessage, ChatNodeOfType } from '@repo/types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { VirtualizedChat } from '@/components/ChatBox/VirtualizedChat';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img alt='' {...props} />,
}));

vi.mock('@/services/destinationImage', () => ({
  getDestinationImage: () => ({ url: null }),
}));

// Renders every message synchronously instead of windowing, matching the
// approach in ChatBox.invariants.test.tsx: the virtualizer is not the unit
// under test in the offer-confirm tests below.
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

const defaultProps = {
  messages: [],
  streamingNodes: [],
  toolProgress: [],
  streamingText: '',
  isSending: false,
  onQuickReply: vi.fn(),
};

function buildOfferMessage(
  offerNode: ChatNodeOfType<'offer_tiles'>,
): ChatMessage {
  return {
    id: 'msg-1',
    role: 'assistant',
    nodes: [offerNode],
    sequence: 0,
    created_at: '2026-07-05T00:00:00Z',
  };
}

const destinationOfferNode: ChatNodeOfType<'offer_tiles'> = {
  type: 'offer_tiles',
  offer_kind: 'destination',
  selectable: true,
  offers: [
    {
      id: 'd1',
      title: 'Lisbon',
      selection_label: 'Lisbon',
      price: 0,
      currency: 'USD',
    },
  ],
};

const flightOfferNode: ChatNodeOfType<'offer_tiles'> = {
  type: 'offer_tiles',
  offer_kind: 'flight',
  selectable: true,
  offers: [
    {
      id: 'f1',
      title: 'JetBlue B6 75',
      selection_label: 'JetBlue B6 75',
      price: 512,
      currency: 'USD',
      detail: {
        airline: 'JetBlue',
        flight_number: 'B6 75',
      },
    },
  ],
};

describe('VirtualizedChat empty state', () => {
  it('renders a starter prompt chip when messages is empty', () => {
    render(<VirtualizedChat {...defaultProps} />);
    expect(
      screen.getByRole('button', { name: /plan a trip/i }),
    ).toBeInTheDocument();
  });

  it('clicking the chip calls onQuickReply with the starter text', async () => {
    const onQuickReply = vi.fn();
    render(<VirtualizedChat {...defaultProps} onQuickReply={onQuickReply} />);
    await userEvent.click(screen.getByRole('button', { name: /plan a trip/i }));
    expect(onQuickReply).toHaveBeenCalledWith(
      expect.stringMatching(/plan a trip/i),
    );
  });
});

describe('VirtualizedChat thinking indicator', () => {
  it('shows the thinking dots while content is actively streaming', () => {
    render(
      <VirtualizedChat
        {...defaultProps}
        isSending
        isStreaming
        streamingText='Looking at your options'
      />,
    );
    expect(screen.getByText(/Thinking\.\.\./)).toBeInTheDocument();
  });

  it('does not show the thinking dots in the waiting phase before content streams', () => {
    // 2026-07-07 dual-loader bug: isStreaming alone must not render the dots;
    // they belong to the streaming phase, mutually exclusive with the pending
    // indicator. This is the prop combination that occurs in production.
    render(<VirtualizedChat {...defaultProps} isSending isStreaming />);
    expect(screen.queryByText(/Thinking\.\.\./)).not.toBeInTheDocument();
  });

  it('hides the thinking dots when a turn is not in flight', () => {
    render(<VirtualizedChat {...defaultProps} isStreaming={false} />);
    expect(screen.queryByText(/Thinking\.\.\./)).not.toBeInTheDocument();
  });
});

describe('VirtualizedChat offer confirm', () => {
  it('confirming a destination offer sends the quick-reply message but does not call onSelectItem (destination is non-bookable)', async () => {
    const onSelectItem = vi.fn();
    const onQuickReply = vi.fn();
    render(
      <VirtualizedChat
        {...defaultProps}
        messages={[buildOfferMessage(destinationOfferNode)]}
        onSelectItem={onSelectItem}
        onQuickReply={onQuickReply}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Lisbon/i }));
    await userEvent.click(
      screen.getByRole('button', { name: /confirm selection/i }),
    );
    expect(onSelectItem).not.toHaveBeenCalled();
    expect(onQuickReply).toHaveBeenCalledWith('Let us plan a trip to Lisbon');
  });

  it('confirming a bookable offer (flight) still calls onSelectItem', async () => {
    const onSelectItem = vi.fn();
    const onQuickReply = vi.fn();
    render(
      <VirtualizedChat
        {...defaultProps}
        messages={[buildOfferMessage(flightOfferNode)]}
        onSelectItem={onSelectItem}
        onQuickReply={onQuickReply}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /JetBlue/i }));
    await userEvent.click(
      screen.getByRole('button', { name: /confirm selection/i }),
    );
    expect(onSelectItem).toHaveBeenCalledWith(
      'flight',
      expect.objectContaining({ airline: 'JetBlue', flight_number: 'B6 75' }),
    );
    expect(onQuickReply).toHaveBeenCalledWith(
      "I've selected the JetBlue B6 75 flight",
    );
  });
});
