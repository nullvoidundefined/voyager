import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NodeRenderer } from '@/components/ChatBox/NodeRenderer';

describe('NodeRenderer travel_plan_form with initialValues', () => {
  it('pre-fills destination input when initialValues.destination is provided', () => {
    render(
      <NodeRenderer
        node={{
          type: 'travel_plan_form',
          fields: [
            { name: 'destination', label: 'Destination', required: true },
          ],
          submitted: false,
        }}
        callbacks={{
          initialValues: { destination: 'Kyoto' },
          onFormSubmit: vi.fn(),
        }}
      />,
    );
    expect(screen.getByLabelText(/destination/i)).toHaveValue('Kyoto');
  });
});

describe('NodeRenderer travel_plan_form type union', () => {
  it('renders trip_type toggle when travel_plan_form includes trip_type field', () => {
    render(
      <NodeRenderer
        node={{
          type: 'travel_plan_form',
          fields: [
            { name: 'trip_type', label: 'Trip Type' },
            { name: 'destination', label: 'Destination', required: true },
          ],
          submitted: false,
        }}
        callbacks={{
          onFormSubmit: vi.fn(),
        }}
      />,
    );
    expect(screen.getByText('Round Trip')).toBeInTheDocument();
    expect(screen.getByText('One Way')).toBeInTheDocument();
  });
});
