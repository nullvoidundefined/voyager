import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { buildOfferSelectionMessage } from '@/components/ChatBox/nodes/offerCardRegistry';
import { DestinationOfferCard } from '@/components/ChatBox/nodes/offerCards/DestinationOfferCard';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img alt='' {...props} />,
}));

vi.mock('@/services/destinationImage', () => ({
  getDestinationImage: () => ({ url: null }),
}));

const offer = {
  badges: ['June - August', 'beach'],
  currency: 'USD',
  detail: { best_season: 'June - August', price_level: 2 },
  id: 'lisbon',
  price: 90,
  price_unit: 'per_day' as const,
  subtitle: 'Portugal',
  title: 'Lisbon',
};

describe('DestinationOfferCard', () => {
  it('shows the destination name, country, and estimated per-day budget', () => {
    render(<DestinationOfferCard offer={offer} />);
    expect(screen.getByText('Lisbon')).toBeInTheDocument();
    expect(screen.getByText('Portugal')).toBeInTheDocument();
    expect(screen.getByText(/\$90\/day \(est\.\)/)).toBeInTheDocument();
  });

  it('fires onClick when selected', () => {
    const onClick = vi.fn();
    render(<DestinationOfferCard offer={offer} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('registers a planning-commit selection message for destinations', () => {
    expect(buildOfferSelectionMessage('destination', 'Lisbon')).toBe(
      'Let us plan a trip to Lisbon',
    );
  });
});
