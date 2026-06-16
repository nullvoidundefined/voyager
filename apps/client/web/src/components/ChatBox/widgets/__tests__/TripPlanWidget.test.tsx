import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import type { TripPlanCard } from '@voyager/shared-types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TripPlanWidget } from '../TripPlanWidget';

afterEach(cleanup);

const basePlanCard: TripPlanCard = {
  categories: [
    {
      id: 'flights',
      label: 'Flights',
      enabled: true,
      not_applicable: false,
      sub_options: [
        {
          type: 'radio',
          id: 'trip_type',
          label: 'Trip type',
          options: [
            { id: 'round_trip', label: 'Round trip' },
            { id: 'one_way', label: 'One way' },
          ],
          value: 'round_trip',
        },
      ],
    },
    {
      id: 'hotels',
      label: 'Hotel',
      enabled: true,
      not_applicable: false,
    },
    {
      id: 'car_rental',
      label: 'Car rental',
      enabled: false,
      not_applicable: false,
    },
    {
      id: 'experiences',
      label: 'Experiences',
      enabled: true,
      not_applicable: false,
      sub_options: [
        {
          type: 'multi',
          id: 'interests',
          label: 'Interests',
          options: [
            { id: 'dining', label: 'Dining' },
            { id: 'activities', label: 'Activities' },
          ],
          values: [],
        },
      ],
    },
  ],
};

const noop = () => undefined;

describe('TripPlanWidget', () => {
  describe('rendering', () => {
    it('renders all category labels', () => {
      render(<TripPlanWidget planCard={basePlanCard} onConfirm={noop} />);

      expect(screen.getByText('Flights')).toBeInTheDocument();
      expect(screen.getByText('Hotel')).toBeInTheDocument();
      expect(screen.getByText('Car rental')).toBeInTheDocument();
      expect(screen.getByText('Experiences')).toBeInTheDocument();
    });

    it('shows sub-options for enabled categories', () => {
      render(<TripPlanWidget planCard={basePlanCard} onConfirm={noop} />);

      // Flights: radio options visible when enabled
      expect(
        screen.getByRole('radio', { name: 'Round trip' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('radio', { name: 'One way' }),
      ).toBeInTheDocument();
    });

    it('hides sub-options when category is disabled', () => {
      const card: TripPlanCard = {
        categories: [
          {
            id: 'flights',
            label: 'Flights',
            enabled: false,
            not_applicable: false,
            sub_options: [
              {
                type: 'radio',
                id: 'trip_type',
                label: 'Trip type',
                options: [{ id: 'round_trip', label: 'Round trip' }],
                value: 'round_trip',
              },
            ],
          },
        ],
      };

      render(<TripPlanWidget planCard={card} onConfirm={noop} />);
      expect(
        screen.queryByRole('radio', { name: 'Round trip' }),
      ).not.toBeInTheDocument();
    });

    it('renders not_applicable category with a disabled checkbox', () => {
      const card: TripPlanCard = {
        categories: [
          {
            id: 'car_rental',
            label: 'Car rental',
            enabled: false,
            not_applicable: true,
            not_applicable_reason: 'No destination set',
          },
        ],
      };

      render(<TripPlanWidget planCard={card} onConfirm={noop} />);

      const checkbox = screen.getByRole('checkbox', { name: /Car rental/i });
      expect(checkbox).toBeDisabled();
    });
  });

  describe('confirm button', () => {
    it('is disabled initially (before interaction and before auto-enable)', () => {
      vi.useFakeTimers();
      render(<TripPlanWidget planCard={basePlanCard} onConfirm={noop} />);

      expect(
        screen.getByRole('button', { name: /Start planning/i }),
      ).toBeDisabled();
      vi.useRealTimers();
    });

    it('is enabled after toggling a category (immediate interaction)', () => {
      vi.useFakeTimers();
      render(<TripPlanWidget planCard={basePlanCard} onConfirm={noop} />);

      const hotelCheckbox = screen.getByRole('checkbox', { name: /Hotel/i });
      fireEvent.click(hotelCheckbox);

      expect(
        screen.getByRole('button', { name: /Start planning/i }),
      ).not.toBeDisabled();
      vi.useRealTimers();
    });

    it('is enabled after 1.5s auto-enable delay without interaction', () => {
      vi.useFakeTimers();
      render(<TripPlanWidget planCard={basePlanCard} onConfirm={noop} />);

      expect(
        screen.getByRole('button', { name: /Start planning/i }),
      ).toBeDisabled();

      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(
        screen.getByRole('button', { name: /Start planning/i }),
      ).not.toBeDisabled();
      vi.useRealTimers();
    });
  });

  describe('confirmation', () => {
    it('calls onConfirm with the modified card and a summary message when confirmed', () => {
      const onConfirm = vi.fn();
      render(<TripPlanWidget planCard={basePlanCard} onConfirm={onConfirm} />);

      // Toggle hotel off to trigger interaction
      const hotelCheckbox = screen.getByRole('checkbox', { name: /Hotel/i });
      fireEvent.click(hotelCheckbox);

      fireEvent.click(screen.getByRole('button', { name: /Start planning/i }));

      expect(onConfirm).toHaveBeenCalledOnce();
      const [confirmedCard, summaryMessage] = onConfirm.mock.calls[0] as [
        TripPlanCard,
        string,
      ];

      // Hotel should now be disabled in the confirmed card
      const hotelCat = confirmedCard.categories.find((c) => c.id === 'hotels');
      expect(hotelCat?.enabled).toBe(false);

      // Summary message should mention flights but not hotel
      expect(summaryMessage).toContain('flights');
      expect(summaryMessage).not.toContain('hotel');
    });

    it('does not call onConfirm when button is disabled', () => {
      vi.useFakeTimers();
      const onConfirm = vi.fn();
      render(<TripPlanWidget planCard={basePlanCard} onConfirm={onConfirm} />);

      fireEvent.click(screen.getByRole('button', { name: /Start planning/i }));
      expect(onConfirm).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('shows read-only summary view when confirmed prop is true', () => {
      render(
        <TripPlanWidget planCard={basePlanCard} onConfirm={noop} confirmed />,
      );

      expect(
        screen.queryByRole('button', { name: /Start planning/i }),
      ).not.toBeInTheDocument();
      expect(screen.getByText(/Plan confirmed/i)).toBeInTheDocument();
    });
  });

  describe('interaction', () => {
    it('toggles a category off when its checkbox is clicked', () => {
      render(<TripPlanWidget planCard={basePlanCard} onConfirm={noop} />);

      const hotelCheckbox = screen.getByRole('checkbox', { name: /Hotel/i });
      expect(hotelCheckbox).toBeChecked();

      fireEvent.click(hotelCheckbox);
      expect(hotelCheckbox).not.toBeChecked();
    });

    it('selecting a radio option updates trip type', () => {
      const onConfirm = vi.fn();
      render(<TripPlanWidget planCard={basePlanCard} onConfirm={onConfirm} />);

      const oneWayRadio = screen.getByRole('radio', { name: 'One way' });
      fireEvent.click(oneWayRadio);

      fireEvent.click(screen.getByRole('button', { name: /Start planning/i }));

      const [confirmedCard] = onConfirm.mock.calls[0] as [TripPlanCard, string];
      const flightCat = confirmedCard.categories.find(
        (c) => c.id === 'flights',
      );
      const radioOpt = flightCat?.sub_options?.find(
        (o) => o.id === 'trip_type',
      );
      expect(radioOpt?.type === 'radio' && radioOpt.value).toBe('one_way');
    });

    it('selecting an interest checkbox includes it in the confirmed card', () => {
      const onConfirm = vi.fn();
      render(<TripPlanWidget planCard={basePlanCard} onConfirm={onConfirm} />);

      const diningCheckbox = screen.getByRole('checkbox', { name: 'Dining' });
      fireEvent.click(diningCheckbox);

      fireEvent.click(screen.getByRole('button', { name: /Start planning/i }));

      const [confirmedCard, summaryMessage] = onConfirm.mock.calls[0] as [
        TripPlanCard,
        string,
      ];
      const expCat = confirmedCard.categories.find(
        (c) => c.id === 'experiences',
      );
      const interestsOpt = expCat?.sub_options?.find(
        (o) => o.id === 'interests',
      );
      expect(interestsOpt?.type === 'multi' && interestsOpt.values).toContain(
        'dining',
      );
      expect(summaryMessage).toContain('dining');
    });
  });
});
