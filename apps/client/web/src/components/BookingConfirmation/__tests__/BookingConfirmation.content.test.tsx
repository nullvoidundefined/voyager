import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BookingConfirmation } from '../BookingConfirmation';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { fill, ...rest } = props;
    return <img alt='' data-fill={fill} {...rest} />;
  },
}));

vi.mock('@/lib/destinationImage', () => ({
  getDestinationImage: () => ({ url: null, credit: null }),
}));

afterEach(cleanup);

const defaultProps = {
  destination: 'Barcelona',
  departureDate: '2026-07-01',
  returnDate: '2026-07-08',
  flights: [
    {
      airline: 'Iberia',
      flight_number: 'IB101',
      origin: 'JFK',
      destination: 'BCN',
      price: 450,
      currency: 'USD',
    },
  ],
  hotels: [{ name: 'Hotel Arts', total_price: 1200, currency: 'USD' }],
  carRentals: [],
  experiences: [],
  budgetTotal: 3000,
  budgetCurrency: 'USD',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('BookingConfirmation content', () => {
  it('renders "Save itinerary" button text, not "Confirm Booking"', () => {
    render(<BookingConfirmation {...defaultProps} />);

    expect(
      screen.getByRole('button', { name: 'Save itinerary' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Confirm Booking')).not.toBeInTheDocument();
  });

  it('renders disclaimer that nothing is actually booked', () => {
    render(<BookingConfirmation {...defaultProps} />);

    expect(screen.getByText(/Nothing is actually booked/)).toBeInTheDocument();
  });

  it('does not auto-dismiss or auto-confirm on a timer', () => {
    vi.useFakeTimers();

    const onConfirm = vi.fn();
    render(<BookingConfirmation {...defaultProps} onConfirm={onConfirm} />);

    vi.advanceTimersByTime(5000);

    expect(onConfirm).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
