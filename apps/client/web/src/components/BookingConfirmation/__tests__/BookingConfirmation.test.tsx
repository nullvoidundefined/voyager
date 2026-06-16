import { cleanup, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BookingConfirmation } from '../BookingConfirmation';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img alt='' {...props} />,
}));

vi.mock('@/lib/destinationImage/destinationImage', () => ({
  getDestinationImage: () => ({ url: null }),
}));

const baseProps = {
  destination: 'Tokyo',
  departureDate: '2026-07-01',
  returnDate: '2026-07-10',
  flights: [],
  hotels: [],
  carRentals: [],
  experiences: [],
  budgetTotal: 3000,
  budgetCurrency: 'USD',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

afterEach(cleanup);

describe('BookingConfirmation', () => {
  it('renders a dialog with accessible title', () => {
    render(<BookingConfirmation {...baseProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Booking confirmation')).toBeInTheDocument();
  });

  it('renders "Save itinerary" button (not "Book now")', () => {
    render(<BookingConfirmation {...baseProps} />);
    expect(
      screen.getByRole('button', { name: 'Save itinerary' }),
    ).toBeInTheDocument();
  });

  it('renders "Make changes" cancel button', () => {
    render(<BookingConfirmation {...baseProps} />);
    expect(
      screen.getByRole('button', { name: 'Make changes' }),
    ).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<BookingConfirmation {...baseProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
