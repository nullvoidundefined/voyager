import {
  getBookingStep,
  getStepPrompt,
  type BookingStep,
  type TripState,
} from 'app/prompts/booking-steps.js';
import { describe, expect, it } from 'vitest';

function makeTripState(
  overrides: Partial<TripState> = {},
): TripState {
  return {
    destination: 'Barcelona',
    origin: 'SFO',
    departure_date: '2026-07-01',
    return_date: '2026-07-06',
    budget_total: 3000,
    transport_mode: 'flying',
    flights: [{ id: 'f1' }],
    hotels: [{ id: 'h1' }],
    car_rentals: [{ id: 'c1' }],
    experiences: [{ id: 'e1' }],
    status: 'planning',
    ...overrides,
  };
}

describe('booking-steps', () => {
  describe('getBookingStep', () => {
    it('returns COMPLETE when status is not planning', () => {
      expect(
        getBookingStep(makeTripState({ status: 'saved' })),
      ).toBe('COMPLETE');
    });

    it('returns COLLECT_DETAILS when budget_total is null', () => {
      expect(
        getBookingStep(makeTripState({ budget_total: null })),
      ).toBe('COLLECT_DETAILS');
    });

    it('returns COLLECT_DETAILS when departure_date is null', () => {
      expect(
        getBookingStep(
          makeTripState({ departure_date: null }),
        ),
      ).toBe('COLLECT_DETAILS');
    });

    it('returns COLLECT_DETAILS when return_date is null', () => {
      expect(
        getBookingStep(makeTripState({ return_date: null })),
      ).toBe('COLLECT_DETAILS');
    });

    it('returns COLLECT_DETAILS when origin is null', () => {
      expect(
        getBookingStep(makeTripState({ origin: null })),
      ).toBe('COLLECT_DETAILS');
    });

    it('returns TRANSPORT when transport_mode is null', () => {
      expect(
        getBookingStep(
          makeTripState({ transport_mode: null }),
        ),
      ).toBe('TRANSPORT');
    });

    it('returns TRANSPORT when flying but no flights selected', () => {
      expect(
        getBookingStep(
          makeTripState({
            transport_mode: 'flying',
            flights: [],
          }),
        ),
      ).toBe('TRANSPORT');
    });

    it('returns LODGING when driving (no flights needed)', () => {
      expect(
        getBookingStep(
          makeTripState({
            transport_mode: 'driving',
            flights: [],
            hotels: [],
          }),
        ),
      ).toBe('LODGING');
    });

    it('returns LODGING when flights selected but no hotel', () => {
      expect(
        getBookingStep(
          makeTripState({
            transport_mode: 'flying',
            flights: [{ id: 'f1' }],
            hotels: [],
          }),
        ),
      ).toBe('LODGING');
    });

    it('returns CAR_RENTAL when hotel selected but no car rentals', () => {
      expect(
        getBookingStep(
          makeTripState({
            hotels: [{ id: 'h1' }],
            car_rentals: [],
          }),
        ),
      ).toBe('CAR_RENTAL');
    });

    it('returns CAR_RENTAL when car_rentals is undefined', () => {
      expect(
        getBookingStep(
          makeTripState({
            hotels: [{ id: 'h1' }],
            car_rentals: undefined,
          }),
        ),
      ).toBe('CAR_RENTAL');
    });

    it('returns EXPERIENCES when car rentals present but no experiences', () => {
      expect(
        getBookingStep(
          makeTripState({
            car_rentals: [{ id: 'c1' }],
            experiences: [],
          }),
        ),
      ).toBe('EXPERIENCES');
    });

    it('returns CONFIRM when all selections made and status is planning', () => {
      expect(getBookingStep(makeTripState())).toBe(
        'CONFIRM',
      );
    });

    it('returns COMPLETE for saved status even with incomplete data', () => {
      expect(
        getBookingStep(
          makeTripState({
            status: 'saved',
            flights: [],
            hotels: [],
          }),
        ),
      ).toBe('COMPLETE');
    });
  });

  describe('getStepPrompt', () => {
    const allSteps: BookingStep[] = [
      'COLLECT_DETAILS',
      'TRANSPORT',
      'LODGING',
      'CAR_RENTAL',
      'EXPERIENCES',
      'CONFIRM',
      'COMPLETE',
    ];

    it.each(allSteps)(
      '%s prompt contains format_response',
      (step) => {
        expect(getStepPrompt(step)).toContain(
          'format_response',
        );
      },
    );

    it.each(allSteps)(
      '%s prompt includes brevity instruction',
      (step) => {
        expect(getStepPrompt(step)).toContain(
          '1-2 sentences',
        );
      },
    );

    it('COLLECT_DETAILS mentions form', () => {
      expect(
        getStepPrompt('COLLECT_DETAILS'),
      ).toContain('form');
    });

    it('TRANSPORT mentions flying and driving', () => {
      const prompt = getStepPrompt('TRANSPORT');
      expect(prompt).toContain('flying');
      expect(prompt).toContain('driving');
    });

    it('LODGING mentions hotel', () => {
      expect(getStepPrompt('LODGING')).toContain('hotel');
    });

    it('CAR_RENTAL mentions rental car', () => {
      expect(getStepPrompt('CAR_RENTAL')).toContain(
        'rental car',
      );
    });

    it('EXPERIENCES mentions preferences', () => {
      expect(getStepPrompt('EXPERIENCES')).toContain(
        'preferences',
      );
    });

    it('CONFIRM mentions confirm or book', () => {
      expect(getStepPrompt('CONFIRM')).toMatch(
        /confirm|book/i,
      );
    });

    it('COMPLETE mentions follow-up', () => {
      expect(getStepPrompt('COMPLETE')).toContain(
        'follow-up',
      );
    });

    it('shared rules include max tool calls limit', () => {
      expect(
        getStepPrompt('COLLECT_DETAILS'),
      ).toContain('15');
    });

    it('shared rules include update_trip instruction', () => {
      expect(
        getStepPrompt('COLLECT_DETAILS'),
      ).toContain('update_trip');
    });
  });
});
