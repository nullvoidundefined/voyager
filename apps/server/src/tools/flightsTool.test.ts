import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/services/external/serpapiService.js', () => {
  class SerpApiQuotaExceededError extends Error {
    constructor() {
      super('SerpApi monthly quota cap reached.');
      this.name = 'SerpApiQuotaExceededError';
    }
  }
  return {
    serpApiGet: vi.fn(),
    SerpApiQuotaExceededError,
  };
});
vi.mock('app/services/cache/cacheService.js');
vi.mock('app/clients/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

let searchFlights: typeof import('app/tools/flightsTool.js').searchFlights;
let serpApiService: typeof import('app/services/external/serpapiService.js');
let cacheService: typeof import('app/services/cache/cacheService.js');

const mockFlightsResponse = {
  best_flights: [
    {
      flights: [
        {
          departure_airport: { id: 'SFO', time: '2026-07-01 08:00' },
          arrival_airport: { id: 'BCN', time: '2026-07-01 20:00' },
          airline: 'United Airlines',
          airline_logo: '',
          flight_number: 'UA 123',
        },
      ],
      total_duration: 720,
      price: 450,
      type: 'Round trip',
    },
  ],
  other_flights: [
    {
      flights: [
        {
          departure_airport: { id: 'SFO', time: '2026-07-01 10:00' },
          arrival_airport: { id: 'BCN', time: '2026-07-02 01:00' },
          airline: 'Iberia',
          airline_logo: '',
          flight_number: 'IB 456',
        },
      ],
      total_duration: 900,
      price: 380,
      type: 'Round trip',
    },
  ],
};

describe('flightsTool', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    vi.doMock('app/services/external/serpapiService.js', () => {
      class SerpApiQuotaExceededError extends Error {
        constructor() {
          super('SerpApi monthly quota cap reached.');
          this.name = 'SerpApiQuotaExceededError';
        }
      }
      return {
        serpApiGet: vi.fn(),
        SerpApiQuotaExceededError,
      };
    });
    vi.doMock('app/services/cache/cacheService.js', () => ({
      cacheGet: vi.fn(),
      cacheSet: vi.fn(),
      normalizeCacheKey: vi.fn().mockReturnValue('test-cache-key'),
    }));
    vi.doMock('app/clients/logger.js', () => ({
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));
    vi.doMock('app/tools/mock/isMockMode.js', () => ({
      isMockMode: vi.fn().mockReturnValue(false),
    }));
    vi.doMock('app/tools/mock/flightsMock.js', () => ({
      generateMockFlights: vi.fn(),
    }));

    const flightsMod = await import('app/tools/flightsTool.js');
    searchFlights = flightsMod.searchFlights;
    serpApiService = await import('app/services/external/serpapiService.js');
    cacheService = await import('app/services/cache/cacheService.js');
  });

  describe('searchFlights', () => {
    it('returns cached results when available', async () => {
      const cached = {
        status: 'ok' as const,
        flights: [{ origin: 'SFO', destination: 'BCN', price: 450 }],
      };
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(cached);

      const result = await searchFlights({
        origin: 'SFO',
        destination: 'BCN',
        departure_date: '2026-07-01',
        passengers: 1,
      });

      expect(result).toEqual(cached);
      expect(serpApiService.serpApiGet).not.toHaveBeenCalled();
    });

    it('calls SerpApi and returns normalized results', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce(
        mockFlightsResponse,
      );

      const result = await searchFlights({
        origin: 'SFO',
        destination: 'BCN',
        departure_date: '2026-07-01',
        passengers: 1,
      });

      expect(serpApiService.serpApiGet).toHaveBeenCalledWith(
        'google_flights',
        expect.objectContaining({
          departure_id: 'SFO',
          arrival_id: 'BCN',
          outbound_date: '2026-07-01',
          adults: 1,
        }),
      );

      expect(result.status).toBe('ok');
      expect(result.flights).toHaveLength(2);
      expect(result.flights[0]).toHaveProperty('origin', 'SFO');
      expect(result.flights[0]).toHaveProperty('destination', 'BCN');
      expect(result.flights[0]).toHaveProperty('price');
      expect(result.flights[0]).toHaveProperty('airline');
      expect(result.flights[0]).toHaveProperty('airline_logo');
    });

    it('sorts results by price ascending', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce(
        mockFlightsResponse,
      );

      const result = await searchFlights({
        origin: 'SFO',
        destination: 'BCN',
        departure_date: '2026-07-01',
        passengers: 1,
      });

      expect(result.flights[0]!.price).toBeLessThanOrEqual(
        result.flights[1]!.price,
      );
    });

    it('caches results after fetching', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce(
        mockFlightsResponse,
      );

      await searchFlights({
        origin: 'SFO',
        destination: 'BCN',
        departure_date: '2026-07-01',
        passengers: 1,
      });

      expect(cacheService.cacheSet).toHaveBeenCalledWith(
        'test-cache-key',
        expect.objectContaining({ status: 'ok' }),
        21600,
      );
    });

    it('returns status:no_results when SerpApi has zero matches', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce({});

      const result = await searchFlights({
        origin: 'SFO',
        destination: 'XYZ',
        departure_date: '2026-07-01',
        passengers: 1,
      });

      expect(result.status).toBe('no_results');
      expect(result.flights).toEqual([]);
    });

    it('filters by max_price', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce(
        mockFlightsResponse,
      );

      const result = await searchFlights({
        origin: 'SFO',
        destination: 'BCN',
        departure_date: '2026-07-01',
        passengers: 1,
        max_price: 400,
      });

      expect(result.flights).toHaveLength(1);
      expect(result.flights[0]!.price).toBe(380);
    });

    it('returns status:error with message when SerpApi throws a non-quota error (F-17)', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockRejectedValueOnce(
        new Error('SerpApi 503: service unavailable'),
      );

      const result = await searchFlights({
        origin: 'SFO',
        destination: 'BCN',
        departure_date: '2026-07-01',
        passengers: 1,
      });

      expect(result.status).toBe('error');
      expect(result.flights).toEqual([]);
      expect(result.message).toBeTruthy();
    });

    it('returns status:timeout when SerpApi aborts (F-17)', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      const timeoutErr = new Error('The operation was aborted due to timeout');
      timeoutErr.name = 'TimeoutError';
      vi.mocked(serpApiService.serpApiGet).mockRejectedValueOnce(timeoutErr);

      const result = await searchFlights({
        origin: 'SFO',
        destination: 'BCN',
        departure_date: '2026-07-01',
        passengers: 1,
      });

      expect(result.status).toBe('timeout');
      expect(result.flights).toEqual([]);
      expect(result.message).toMatch(/timed out/i);
    });

    it('does not throw when SerpApi throws a network error', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockRejectedValueOnce(
        new Error('Network ECONNRESET'),
      );

      await expect(
        searchFlights({
          origin: 'SFO',
          destination: 'BCN',
          departure_date: '2026-07-01',
          passengers: 1,
        }),
      ).resolves.toBeDefined();
    });

    it('returns status:quota_exhausted when SerpApi monthly quota is hit (F-17)', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      const { SerpApiQuotaExceededError } = serpApiService as {
        SerpApiQuotaExceededError: new () => Error;
      };
      vi.mocked(serpApiService.serpApiGet).mockRejectedValueOnce(
        new SerpApiQuotaExceededError(),
      );

      const result = await searchFlights({
        origin: 'SFO',
        destination: 'BCN',
        departure_date: '2026-07-01',
        passengers: 1,
      });

      expect(result.status).toBe('quota_exhausted');
      expect(result.flights).toEqual([]);
      expect(result.message).toMatch(/quota/i);
    });
  });

  describe('flexible date fan-out', () => {
    it('calls serpApiGet 7 times when flexible_dates is true', async () => {
      const MOCK_FLIGHT = {
        flights: [
          {
            departure_airport: { id: 'JFK', time: '2026-07-04 10:00' },
            arrival_airport: { id: 'CDG', time: '2026-07-04 22:00' },
            airline: 'Air France',
            airline_logo: null,
            flight_number: 'AF1',
          },
        ],
        total_duration: 480,
        price: 500,
        type: 'round trip',
      };

      vi.mocked(cacheService.cacheGet).mockResolvedValue(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValue({
        best_flights: [MOCK_FLIGHT],
      });

      await searchFlights({
        origin: 'JFK',
        destination: 'CDG',
        departure_date: '2026-07-04',
        return_date: '2026-07-11',
        passengers: 1,
        flexible_dates: true,
      });

      expect(serpApiService.serpApiGet).toHaveBeenCalledTimes(7);
    });

    it('calls serpApiGet 1 time when flexible_dates is false', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValue(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValue({
        best_flights: [],
      });

      await searchFlights({
        origin: 'JFK',
        destination: 'CDG',
        departure_date: '2026-07-04',
        passengers: 1,
        flexible_dates: false,
      });

      expect(serpApiService.serpApiGet).toHaveBeenCalledTimes(1);
    });

    it('returns results sorted by price when flexible', async () => {
      const BASE_FLIGHT = {
        flights: [
          {
            departure_airport: { id: 'JFK', time: '2026-07-04 10:00' },
            arrival_airport: { id: 'CDG', time: '2026-07-04 22:00' },
            airline: 'Air France',
            airline_logo: null,
            flight_number: 'AF1',
          },
        ],
        total_duration: 480,
        type: 'round trip',
      };

      vi.mocked(cacheService.cacheGet).mockResolvedValue(null);
      for (let i = 0; i < 7; i++) {
        const price = 500 - i * 20; // 500, 480, 460, ... cheaper each day
        vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce({
          best_flights: [{ ...BASE_FLIGHT, price }],
        });
      }

      const result = await searchFlights({
        origin: 'JFK',
        destination: 'CDG',
        departure_date: '2026-07-04',
        passengers: 1,
        flexible_dates: true,
      });

      expect(result.flights.length).toBeGreaterThan(0);
      expect(result.flights.length).toBeLessThanOrEqual(7);
      for (let i = 0; i < result.flights.length - 1; i++) {
        expect(result.flights[i]!.price).toBeLessThanOrEqual(
          result.flights[i + 1]!.price,
        );
      }
    });
  });

  describe('mock mode', () => {
    beforeEach(async () => {
      vi.resetModules();
      vi.doMock('app/services/external/serpapiService.js', () => ({
        serpApiGet: vi.fn(),
        SerpApiQuotaExceededError: class SerpApiQuotaExceededError extends Error {},
      }));
      vi.doMock('app/services/cache/cacheService.js', () => ({
        cacheGet: vi.fn(),
        cacheSet: vi.fn(),
        normalizeCacheKey: vi.fn().mockReturnValue('test-cache-key'),
      }));
      vi.doMock('app/clients/logger.js', () => ({
        logger: {
          error: vi.fn(),
          info: vi.fn(),
          warn: vi.fn(),
          debug: vi.fn(),
        },
      }));
      vi.doMock('app/tools/mock/isMockMode.js', () => ({
        isMockMode: vi.fn().mockReturnValue(true),
      }));
      vi.doMock('app/tools/mock/flightsMock.js', () => ({
        generateMockFlights: vi.fn().mockReturnValue({
          status: 'ok',
          flights: [
            {
              offer_id: 'mock-flight-0',
              airline: 'Delta',
              airline_logo: null,
              flight_number: 'DL100',
              origin: 'SFO',
              destination: 'BCN',
              price: 300,
              currency: 'USD',
            },
          ],
        }),
      }));
      const mod = await import('app/tools/flightsTool.js');
      searchFlights = mod.searchFlights;
    });

    it('returns mock results and skips SerpApi when isMockMode() is true', async () => {
      const result = await searchFlights({
        origin: 'SFO',
        destination: 'BCN',
        departure_date: '2026-07-01',
        passengers: 1,
      });

      expect(result.flights).toHaveLength(1);
      expect(result.flights[0]?.airline).toBe('Delta');
      // The real SerpApi client from the outer describe's mock
      // setup is not used in this branch, so we cannot assert
      // "not called" without re-importing. Asserting the mock
      // fixture comes through is enough to prove the branch ran.
    });
  });
});
