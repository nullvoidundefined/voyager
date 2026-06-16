import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SelectableCardGroup } from '../SelectableCardGroup';

afterEach(cleanup);

const items = [
  {
    id: 'flight-1',
    label: 'Delta DL100',
    data: {
      airline: 'Delta',
      flight_number: 'DL100',
      price: 300,
      currency: 'USD',
    },
    node: (selected: boolean, onClick: () => void) => (
      <button
        type='button'
        aria-pressed={selected}
        onClick={onClick}
        data-testid='card-flight-1'
      >
        Flight 1 {selected ? '(selected)' : ''}
      </button>
    ),
  },
  {
    id: 'flight-2',
    label: 'United UA200',
    data: {
      airline: 'United',
      flight_number: 'UA200',
      price: 350,
      currency: 'USD',
    },
    node: (selected: boolean, onClick: () => void) => (
      <button
        type='button'
        aria-pressed={selected}
        onClick={onClick}
        data-testid='card-flight-2'
      >
        Flight 2 {selected ? '(selected)' : ''}
      </button>
    ),
  },
];

describe('SelectableCardGroup', () => {
  it('renders all items', () => {
    render(<SelectableCardGroup items={items} onConfirm={vi.fn()} />);
    expect(screen.getByTestId('card-flight-1')).toBeInTheDocument();
    expect(screen.getByTestId('card-flight-2')).toBeInTheDocument();
  });

  it('does not show confirm button before any selection', () => {
    render(<SelectableCardGroup items={items} onConfirm={vi.fn()} />);
    expect(screen.queryByText('Confirm Selection')).not.toBeInTheDocument();
  });

  it('does not call onConfirm on a single tile click (US-23 AC)', async () => {
    const onConfirm = vi.fn();
    render(<SelectableCardGroup items={items} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByTestId('card-flight-1'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('reveals confirm button after selecting a tile', async () => {
    render(<SelectableCardGroup items={items} onConfirm={vi.fn()} />);
    await userEvent.click(screen.getByTestId('card-flight-1'));
    expect(screen.getByText('Confirm Selection')).toBeInTheDocument();
  });

  it('marks the selected tile as pressed', async () => {
    render(<SelectableCardGroup items={items} onConfirm={vi.fn()} />);
    const card = screen.getByTestId('card-flight-1');
    await userEvent.click(card);
    expect(card).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches selection when clicking a different tile before confirming', async () => {
    const onConfirm = vi.fn();
    render(<SelectableCardGroup items={items} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByTestId('card-flight-1'));
    await userEvent.click(screen.getByTestId('card-flight-2'));
    expect(screen.getByTestId('card-flight-1')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByTestId('card-flight-2')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onConfirm with selected item when Confirm Selection clicked', async () => {
    const onConfirm = vi.fn();
    render(<SelectableCardGroup items={items} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByTestId('card-flight-2'));
    await userEvent.click(screen.getByText('Confirm Selection'));
    expect(onConfirm).toHaveBeenCalledWith('United UA200', {
      airline: 'United',
      flight_number: 'UA200',
      price: 350,
      currency: 'USD',
    });
  });

  it('shows confirmed checkmark and hides confirm button when confirmedId is set', () => {
    render(
      <SelectableCardGroup
        items={items}
        onConfirm={vi.fn()}
        confirmedId='flight-1'
      />,
    );
    expect(screen.getByText(/Delta DL100/)).toBeInTheDocument();
    expect(screen.queryByText('Confirm Selection')).not.toBeInTheDocument();
  });

  it('ignores clicks and does not show confirm button when disabled', async () => {
    const onConfirm = vi.fn();
    render(
      <SelectableCardGroup items={items} onConfirm={onConfirm} disabled />,
    );
    await userEvent.click(screen.getByTestId('card-flight-1'));
    expect(screen.queryByText('Confirm Selection')).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('ignores clicks when already confirmed', async () => {
    const onConfirm = vi.fn();
    render(
      <SelectableCardGroup
        items={items}
        onConfirm={onConfirm}
        confirmedId='flight-1'
      />,
    );
    await userEvent.click(screen.getByTestId('card-flight-2'));
    expect(screen.getByText(/Delta DL100/)).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
