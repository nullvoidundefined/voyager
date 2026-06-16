import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LegList } from '../LegList';

const LEGS = [
  {
    id: '1',
    origin: 'NYC',
    destination: 'LAX',
    depart_date: '2026-08-01',
    leg_order: 1,
  },
  {
    id: '2',
    origin: 'LAX',
    destination: 'ORD',
    depart_date: '2026-08-05',
    leg_order: 2,
  },
];

describe('LegList', () => {
  it('renders each leg origin and destination', () => {
    render(<LegList legs={LEGS} onRemoveLeg={vi.fn()} />);
    expect(screen.getByText('NYC')).toBeInTheDocument();
    expect(screen.getByText('ORD')).toBeInTheDocument();
  });

  it('calls onRemoveLeg with the leg id when remove is clicked', async () => {
    const onRemove = vi.fn();
    render(<LegList legs={LEGS} onRemoveLeg={onRemove} />);
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    await userEvent.click(removeButtons[0]);
    expect(onRemove).toHaveBeenCalledWith('1');
  });

  it('renders an empty state when no legs', () => {
    render(<LegList legs={[]} onRemoveLeg={vi.fn()} />);
    expect(screen.getByText(/no legs/i)).toBeInTheDocument();
  });
});
