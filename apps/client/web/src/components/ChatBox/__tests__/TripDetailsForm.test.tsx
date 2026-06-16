import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TripDetailsForm, type TripField } from '../TripDetailsForm';

const FIELDS: TripField[] = [{ type: 'trip_type', label: 'Trip Type' }];

describe('TripDetailsForm trip_type buttons', () => {
  it('sets aria-pressed true on the selected trip type button', async () => {
    render(<TripDetailsForm fields={FIELDS} onSubmit={vi.fn()} />);
    const roundTripBtn = screen.getByRole('button', { name: /round trip/i });
    const oneWayBtn = screen.getByRole('button', { name: /one way/i });
    expect(roundTripBtn).toHaveAttribute('aria-pressed', 'true');
    expect(oneWayBtn).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(oneWayBtn);
    expect(oneWayBtn).toHaveAttribute('aria-pressed', 'true');
    expect(roundTripBtn).toHaveAttribute('aria-pressed', 'false');
  });
});

it('renders Fixed and Flexible buttons when flexible_dates field is present', () => {
  render(
    <TripDetailsForm
      fields={[{ type: 'flexible_dates', label: 'Date flexibility' }]}
      onSubmit={() => {}}
    />,
  );
  expect(screen.getByText('Fixed')).toBeInTheDocument();
  expect(screen.getByText('Flexible')).toBeInTheDocument();
});

it('sets flexible_dates to true when Flexible is clicked', () => {
  const onChange = vi.fn();
  render(
    <TripDetailsForm
      fields={[{ type: 'flexible_dates', label: 'Date flexibility' }]}
      onSubmit={() => {}}
      onValuesChange={onChange}
    />,
  );
  fireEvent.click(screen.getByText('Flexible'));
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ flexible_dates: 'true' }),
  );
});

it('excludes flexible_dates from allFilled requirement', () => {
  render(
    <TripDetailsForm
      fields={[
        { type: 'destination', label: 'Destination', required: true },
        { type: 'flexible_dates', label: 'Date flexibility' },
      ]}
      onSubmit={() => {}}
    />,
  );
  // Submit is disabled because destination is empty, not because flexible_dates is unset
  const submit = screen.getByRole('button', { name: 'Start Planning' });
  expect(submit).toBeDisabled();
});

it('renders inline error when budget input is below the $100 minimum (F-10)', () => {
  render(
    <TripDetailsForm
      fields={[{ type: 'budget', label: 'Budget', required: true }]}
      onSubmit={() => {}}
    />,
  );
  const input = screen.getByRole('spinbutton');
  fireEvent.change(input, { target: { value: '50' } });
  expect(screen.getByRole('alert')).toHaveTextContent(/at least \$100/i);
});

it('does not render the budget error when value is >= 100', () => {
  render(
    <TripDetailsForm
      fields={[{ type: 'budget', label: 'Budget', required: true }]}
      onSubmit={() => {}}
    />,
  );
  const input = screen.getByRole('spinbutton');
  fireEvent.change(input, { target: { value: '500' } });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
