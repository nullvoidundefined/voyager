import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { DailySchedule } from '../DailySchedule';

const DAYS = [
  {
    id: 'd1',
    day_number: 1,
    day_date: '2026-08-01',
    items: [
      {
        id: 'i1',
        time_of_day: 'morning',
        title: 'Museum visit',
        item_type: 'activity',
        item_order: 1,
        description: null,
        place_id: null,
        booking_url: null,
        price_usd: null,
      },
    ],
  },
];

describe('DailySchedule', () => {
  it('renders the day heading', () => {
    render(<DailySchedule days={DAYS} />);
    expect(screen.getByText(/day 1/i)).toBeInTheDocument();
  });

  it('renders item titles', () => {
    render(<DailySchedule days={DAYS} />);
    expect(screen.getByText('Museum visit')).toBeInTheDocument();
  });

  it('renders empty state when no days', () => {
    render(<DailySchedule days={[]} />);
    expect(screen.getByText(/no schedule/i)).toBeInTheDocument();
  });

  it('collapses a day when the heading is clicked', async () => {
    render(<DailySchedule days={DAYS} />);
    const heading = screen.getByRole('button', { name: /day 1/i });
    await userEvent.click(heading);
    expect(screen.queryByText('Museum visit')).not.toBeInTheDocument();
  });
});
