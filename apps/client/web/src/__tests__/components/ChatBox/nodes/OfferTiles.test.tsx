import type { ChatNodeOfType } from '@repo/types';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OfferTiles } from '@/components/ChatBox/nodes/OfferTiles';
import { buildOfferSelectionMessage } from '@/components/ChatBox/nodes/offerCardRegistry';

const flightNode: ChatNodeOfType<'offer_tiles'> = {
  type: 'offer_tiles',
  offer_kind: 'flight',
  selectable: true,
  offers: [
    {
      id: 'f1',
      title: 'JetBlue B6 75',
      subtitle: 'JFK to CDG',
      selection_label: 'JetBlue B6 75 - JFK to CDG',
      price: 512,
      currency: 'USD',
      detail: {
        airline: 'JetBlue',
        flight_number: 'B6 75',
        origin: 'JFK',
        destination: 'CDG',
        departure_time: '2026-08-01T18:30:00Z',
      },
    },
  ],
};

afterEach(cleanup);

describe('OfferTiles', () => {
  it('confirms with the selection label and the detail-merged payload', async () => {
    const onConfirm = vi.fn();
    render(<OfferTiles node={flightNode} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: /JetBlue/i }));
    expect(onConfirm).not.toHaveBeenCalled(); // select-then-confirm gate (US-23)
    await userEvent.click(
      screen.getByRole('button', { name: /confirm selection/i }),
    );
    expect(onConfirm).toHaveBeenCalledWith(
      'JetBlue B6 75 - JFK to CDG',
      expect.objectContaining({
        airline: 'JetBlue',
        flight_number: 'B6 75',
        price: 512,
        currency: 'USD',
      }),
    );
  });

  it('renders the fallback card, not a crash, for an unregistered kind', () => {
    const unknownKindNode = {
      ...flightNode,
      offer_kind: 'hovercraft',
    } as unknown as ChatNodeOfType<'offer_tiles'>;
    expect(() => render(<OfferTiles node={unknownKindNode} />)).not.toThrow();
    expect(screen.getByText('JetBlue B6 75')).toBeInTheDocument();
  });

  it('renders non-selectable offers without a confirm affordance', () => {
    render(<OfferTiles node={{ ...flightNode, selectable: false }} />);
    expect(
      screen.queryByRole('button', { name: /confirm selection/i }),
    ).not.toBeInTheDocument();
  });
});

describe('buildOfferSelectionMessage', () => {
  it('reproduces the legacy per-kind selection message templates', () => {
    expect(buildOfferSelectionMessage('flight', 'X')).toBe(
      "I've selected the X flight",
    );
    expect(buildOfferSelectionMessage('hotel', 'X')).toBe("I've selected X");
    expect(buildOfferSelectionMessage('car_rental', 'X')).toBe(
      "I've selected the X rental",
    );
    expect(buildOfferSelectionMessage('experience', 'X')).toBe(
      "I've selected X",
    );
  });
});
