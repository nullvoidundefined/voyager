import { executeTool } from 'app/tools/executor.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/repositories/trips/trips.js', () => ({
  updateTrip: vi.fn().mockResolvedValue({ id: 'trip-1' }),
  insertTripFlight: vi.fn().mockResolvedValue(undefined),
  insertTripHotel: vi.fn().mockResolvedValue(undefined),
  insertTripCarRental: vi.fn().mockResolvedValue(undefined),
  insertTripExperience: vi.fn().mockResolvedValue(undefined),
  getActualCostsForTrip: vi.fn().mockResolvedValue({
    total_budget: 3000,
    flight_cost: 900,
    hotel_total_cost: 1200,
    car_rental_cost: 0,
    experience_costs: [50, 75],
  }),
}));
vi.mock('app/tools/flightsTool.js', () => ({
  searchFlights: vi.fn().mockResolvedValue([]),
}));
vi.mock('app/tools/hotelsTool.js', () => ({
  searchHotels: vi.fn().mockResolvedValue([]),
}));
vi.mock('app/tools/experiencesTool.js', () => ({
  searchExperiences: vi.fn().mockResolvedValue([]),
}));
vi.mock('app/tools/carRentalsTool.js', () => ({
  searchCarRentals: vi.fn().mockResolvedValue({ rentals: [] }),
}));
vi.mock('app/tools/budgetTool.js', () => ({
  calculateRemainingBudget: vi.fn().mockReturnValue({ remaining: 500 }),
}));
vi.mock('app/tools/destinationTool.js', () => ({
  getDestinationInfo: vi
    .fn()
    .mockReturnValue({ city_name: 'Barcelona', iata_code: 'BCN' }),
}));
vi.mock('app/tools/legsTool.js', () => ({
  handleAddLeg: vi.fn().mockResolvedValue({ success: true, leg_id: 'leg-1' }),
  handleRemoveLeg: vi.fn().mockResolvedValue({ success: true }),
  handleReorderLegs: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock('app/tools/scheduleTool.js', () => ({
  handlePlanDailySchedule: vi
    .fn()
    .mockResolvedValue({ success: true, days_planned: 3 }),
}));
vi.mock('app/repositories/trips/tripLegsRepository.js', () => ({
  createLeg: vi.fn(),
  deleteLeg: vi.fn(),
  listLegs: vi.fn(),
  reorderLegs: vi.fn(),
}));
vi.mock('app/repositories/trips/scheduleRepository.js', () => ({
  addScheduleItem: vi.fn(),
  upsertScheduleDay: vi.fn(),
}));
vi.mock('app/utils/logs/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const ctx = { tripId: 'trip-1', userId: 'user-1' };

describe('executeTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Zod validation', () => {
    it('rejects search_flights with missing required fields', async () => {
      const result = await executeTool('search_flights', {});
      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toContain('Validation');
    });

    it('rejects search_flights with invalid date format', async () => {
      const result = await executeTool('search_flights', {
        origin: 'JFK',
        destination: 'BCN',
        departure_date: '07/01/2026',
        passengers: 2,
      });
      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toContain('Validation');
    });

    it('accepts valid search_flights input', async () => {
      const result = await executeTool('search_flights', {
        origin: 'JFK',
        destination: 'BCN',
        departure_date: '2026-07-01',
        passengers: 2,
      });
      expect(result).not.toHaveProperty('error');
    });

    it('rejects search_hotels with non-numeric guests', async () => {
      const result = await executeTool('search_hotels', {
        city: 'Barcelona',
        check_in: '2026-07-01',
        check_out: '2026-07-05',
        guests: 'two',
      });
      expect(result).toHaveProperty('error');
    });

    it('rejects calculate_remaining_budget with string instead of number', async () => {
      const result = await executeTool('calculate_remaining_budget', {
        total_budget: 'three thousand',
        flight_cost: 0,
        hotel_total_cost: 0,
        experience_costs: [],
      });
      expect(result).toHaveProperty('error');
    });

    it('rejects update_trip with invalid date format', async () => {
      const result = await executeTool(
        'update_trip',
        { departure_date: 'next Tuesday' },
        ctx,
      );
      expect(result).toHaveProperty('error');
    });

    it('accepts valid update_trip with no fields', async () => {
      const result = await executeTool('update_trip', {}, ctx);
      expect(result).not.toHaveProperty('error');
    });

    it('accepts update_trip with travelers and persists the value', async () => {
      const { updateTrip } = await import('app/repositories/trips/trips.js');
      const result = await executeTool('update_trip', { travelers: 2 }, ctx);
      expect(result).not.toHaveProperty('error');
      expect(updateTrip).toHaveBeenCalledWith(
        'trip-1',
        'user-1',
        expect.objectContaining({ travelers: 2 }),
      );
    });

    it('rejects update_trip with non-positive travelers', async () => {
      const result = await executeTool('update_trip', { travelers: 0 }, ctx);
      expect(result).toHaveProperty('error');
    });

    it('rejects select_flight with missing required fields', async () => {
      const result = await executeTool(
        'select_flight',
        { airline: 'Delta' },
        ctx,
      );
      expect(result).toHaveProperty('error');
    });

    it('accepts valid select_flight', async () => {
      const result = await executeTool(
        'select_flight',
        {
          airline: 'Delta',
          flight_number: 'DL100',
          origin: 'JFK',
          destination: 'BCN',
          price: 450,
          currency: 'USD',
        },
        ctx,
      );
      expect(result).toEqual({
        success: true,
        message: 'Flight selection saved',
      });
    });

    it('accepts valid select_hotel', async () => {
      const result = await executeTool(
        'select_hotel',
        {
          name: 'Hotel Barcelona',
          price_per_night: 150,
          total_price: 750,
          currency: 'USD',
        },
        ctx,
      );
      expect(result).toEqual({
        success: true,
        message: 'Hotel selection saved',
      });
    });

    it('rejects select_hotel with missing required fields', async () => {
      const result = await executeTool('select_hotel', { name: 'X' }, ctx);
      expect(result).toHaveProperty('error');
    });

    it('throws when select_hotel lacks context', async () => {
      await expect(
        executeTool('select_hotel', {
          name: 'X',
          price_per_night: 1,
          total_price: 1,
          currency: 'USD',
        }),
      ).rejects.toThrow('requires trip context');
    });

    it('accepts valid select_car_rental', async () => {
      const result = await executeTool(
        'select_car_rental',
        {
          provider: 'Hertz',
          car_name: 'Toyota Camry',
          total_price: 180,
          currency: 'USD',
        },
        ctx,
      );
      expect(result).toEqual({
        success: true,
        message: 'Car rental selection saved',
      });
    });

    it('rejects select_car_rental with missing required fields', async () => {
      const result = await executeTool(
        'select_car_rental',
        { provider: 'Hertz' },
        ctx,
      );
      expect(result).toHaveProperty('error');
    });

    it('throws when select_car_rental lacks context', async () => {
      await expect(
        executeTool('select_car_rental', {
          provider: 'Hertz',
          car_name: 'Camry',
          total_price: 1,
          currency: 'USD',
        }),
      ).rejects.toThrow('requires trip context');
    });

    it('accepts valid select_experience', async () => {
      const result = await executeTool(
        'select_experience',
        {
          name: 'Bay Cruise',
          estimated_cost: 75,
        },
        ctx,
      );
      expect(result).toEqual({
        success: true,
        message: 'Experience selection saved',
      });
    });

    it('rejects select_experience with missing name', async () => {
      const result = await executeTool(
        'select_experience',
        { estimated_cost: 50 },
        ctx,
      );
      expect(result).toHaveProperty('error');
    });

    it('throws when select_experience lacks context', async () => {
      await expect(
        executeTool('select_experience', {
          name: 'Tour',
          estimated_cost: 50,
        }),
      ).rejects.toThrow('requires trip context');
    });
  });

  describe('update_trip failure response', () => {
    it('returns error field when updateTrip returns null', async () => {
      const { updateTrip } = await import('app/repositories/trips/trips.js');
      vi.mocked(updateTrip).mockResolvedValueOnce(null);

      const result = await executeTool(
        'update_trip',
        { destination: 'Paris' },
        ctx,
      );

      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toContain(
        'Failed to update trip',
      );
    });
  });

  describe('calculate_remaining_budget DB-truth (P1-03)', () => {
    it('uses DB-truth costs instead of agent-supplied values when context exists', async () => {
      const { calculateRemainingBudget } =
        await import('app/tools/budgetTool.js');
      const mockCalc = vi.mocked(calculateRemainingBudget);
      mockCalc.mockClear();

      await executeTool(
        'calculate_remaining_budget',
        {
          total_budget: 9999,
          flight_cost: 0,
          hotel_total_cost: 0,
          experience_costs: [],
        },
        ctx,
      );

      expect(mockCalc).toHaveBeenCalledWith({
        total_budget: 3000,
        flight_cost: 900,
        hotel_total_cost: 1200,
        car_rental_cost: 0,
        experience_costs: [50, 75],
      });
    });

    it('falls back to agent-supplied values when no context is provided', async () => {
      const { calculateRemainingBudget } =
        await import('app/tools/budgetTool.js');
      const mockCalc = vi.mocked(calculateRemainingBudget);
      mockCalc.mockClear();

      await executeTool('calculate_remaining_budget', {
        total_budget: 1000,
        flight_cost: 500,
        hotel_total_cost: 300,
        car_rental_cost: 50,
        experience_costs: [100],
      });

      expect(mockCalc).toHaveBeenCalledWith({
        total_budget: 1000,
        flight_cost: 500,
        hotel_total_cost: 300,
        car_rental_cost: 50,
        experience_costs: [100],
      });
    });
  });

  describe('validation for previously-unvalidated tools', () => {
    it('rejects re_open_category with an invalid category', async () => {
      const result = await executeTool('re_open_category', {
        category: 'spaceships',
      });
      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toContain('Validation');
    });

    it('rejects add_leg with missing required fields', async () => {
      const result = await executeTool('add_leg', { origin: 'JFK' }, ctx);
      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toContain('Validation');
    });

    it('rejects reorder_legs when ordered_leg_ids is not an array', async () => {
      const result = await executeTool(
        'reorder_legs',
        { ordered_leg_ids: 'not-an-array' },
        ctx,
      );
      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toContain('Validation');
    });

    it('rejects plan_daily_schedule with missing days', async () => {
      const result = await executeTool('plan_daily_schedule', {}, ctx);
      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toContain('Validation');
    });
  });

  describe('leg + schedule tool routing', () => {
    it('routes add_leg to handleAddLeg with input and context', async () => {
      const { handleAddLeg } = await import('app/tools/legsTool.js');
      const mock = vi.mocked(handleAddLeg);
      mock.mockClear();

      await executeTool(
        'add_leg',
        {
          origin: 'JFK',
          destination: 'CDG',
          depart_date: '2026-09-01',
          leg_order: 1,
        },
        ctx,
      );

      expect(mock).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: 'JFK',
          destination: 'CDG',
          depart_date: '2026-09-01',
          leg_order: 1,
        }),
        ctx,
        expect.any(Object),
      );
    });

    it('throws when add_leg lacks context', async () => {
      await expect(
        executeTool('add_leg', {
          origin: 'JFK',
          destination: 'CDG',
          depart_date: '2026-09-01',
          leg_order: 1,
        }),
      ).rejects.toThrow('requires trip context');
    });

    it('routes remove_leg to handleRemoveLeg with leg_id', async () => {
      const { handleRemoveLeg } = await import('app/tools/legsTool.js');
      const mock = vi.mocked(handleRemoveLeg);
      mock.mockClear();

      await executeTool('remove_leg', { leg_id: 'leg-1' }, ctx);

      expect(mock).toHaveBeenCalledWith(
        { leg_id: 'leg-1' },
        ctx,
        expect.any(Object),
      );
    });

    it('throws when remove_leg lacks context', async () => {
      await expect(
        executeTool('remove_leg', { leg_id: 'leg-1' }),
      ).rejects.toThrow('requires trip context');
    });

    it('routes reorder_legs with ordered_leg_ids', async () => {
      const { handleReorderLegs } = await import('app/tools/legsTool.js');
      const mock = vi.mocked(handleReorderLegs);
      mock.mockClear();

      await executeTool(
        'reorder_legs',
        { ordered_leg_ids: ['leg-2', 'leg-1', 'leg-3'] },
        ctx,
      );

      expect(mock).toHaveBeenCalledWith(
        { ordered_leg_ids: ['leg-2', 'leg-1', 'leg-3'] },
        ctx,
        expect.any(Object),
      );
    });

    it('throws when reorder_legs lacks context', async () => {
      await expect(
        executeTool('reorder_legs', { ordered_leg_ids: ['a'] }),
      ).rejects.toThrow('requires trip context');
    });

    it('routes plan_daily_schedule with days payload', async () => {
      const { handlePlanDailySchedule } =
        await import('app/tools/scheduleTool.js');
      const mock = vi.mocked(handlePlanDailySchedule);
      mock.mockClear();

      const days = [
        {
          day_number: 1,
          day_date: '2026-09-01',
          items: [],
        },
      ];
      await executeTool('plan_daily_schedule', { days }, ctx);

      expect(mock).toHaveBeenCalledWith(
        expect.objectContaining({ days }),
        ctx,
        expect.any(Object),
      );
    });

    it('throws when plan_daily_schedule lacks context', async () => {
      await expect(
        executeTool('plan_daily_schedule', { days: [] }),
      ).rejects.toThrow('requires trip context');
    });
  });

  describe('routing', () => {
    it('throws on unknown tool name', async () => {
      await expect(executeTool('nonexistent_tool', {})).rejects.toThrow(
        'Unknown tool',
      );
    });

    it('throws when context-required tools lack context', async () => {
      await expect(
        executeTool('update_trip', { destination: 'Paris' }),
      ).rejects.toThrow('requires trip context');
    });

    it('returns input as-is for format_response', async () => {
      const input = { text: 'Hello!' };
      const result = await executeTool('format_response', input);
      expect(result).toEqual(input);
    });

    it('re_open_category returns success', async () => {
      const result = await executeTool('re_open_category', {
        category: 'hotels',
      });
      expect(result).toEqual({ success: true });
    });
  });
});
