import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BookingLinks } from '../BookingLinks';

const LINKS = [
  {
    id: '1',
    label: 'Delta Flight NYC-LAX',
    url: 'https://booking.example.com/flight/1',
    type: 'flight' as const,
  },
  {
    id: '2',
    label: 'Hotel Sunset',
    url: 'https://booking.example.com/hotel/2',
    type: 'hotel' as const,
  },
];

describe('BookingLinks', () => {
  it('renders a link for each booking', () => {
    render(<BookingLinks links={LINKS} />);
    expect(screen.getByRole('link', { name: /delta flight/i })).toHaveAttribute(
      'href',
      LINKS[0].url,
    );
    expect(screen.getByRole('link', { name: /hotel sunset/i })).toHaveAttribute(
      'href',
      LINKS[1].url,
    );
  });

  it('all booking links open in a new tab with safe rel', () => {
    render(<BookingLinks links={LINKS} />);
    screen.getAllByRole('link').forEach((link) => {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  it('renders empty state when no links', () => {
    render(<BookingLinks links={[]} />);
    expect(screen.getByText(/no bookings/i)).toBeInTheDocument();
  });
});
