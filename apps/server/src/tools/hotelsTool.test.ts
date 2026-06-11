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
vi.mock('app/utils/logs/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

let searchHotels: typeof import('app/tools/hotelsTool.js').searchHotels;
let serpApiService: typeof import('app/services/external/serpapiService.js');
let cacheService: typeof import('app/services/cache/cacheService.js');

const mockHotelsResponse = {
  properties: [
    {
      name: 'Hotel Barcelona Beach',
      overall_rating: 4.5,
      hotel_class: 4,
      rate_per_night: { lowest: '$150', extracted_lowest: 150 },
      total_rate: { lowest: '$750', extracted_lowest: 750 },
    },
    {
      name: 'Budget Inn Barcelona',
      overall_rating: 3.2,
      hotel_class: 2,
      rate_per_night: { lowest: '$80', extracted_lowest: 80 },
      total_rate: { lowest: '$400', extracted_lowest: 400 },
    },
  ],
};

describe('hotelsTool', () => {
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
      normalizeCacheKey: vi.fn().mockReturnValue('test-hotel-cache-key'),
    }));
    vi.doMock('app/utils/logs/logger.js', () => ({
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));
    vi.doMock('app/tools/mock/isMockMode.js', () => ({
      isMockMode: vi.fn().mockReturnValue(false),
    }));
    vi.doMock('app/tools/mock/hotelsMock.js', () => ({
      generateMockHotels: vi.fn(),
    }));

    const hotelsMod = await import('app/tools/hotelsTool.js');
    searchHotels = hotelsMod.searchHotels;
    serpApiService = await import('app/services/external/serpapiService.js');
    cacheService = await import('app/services/cache/cacheService.js');
  });

  describe('searchHotels', () => {
    it('returns cached results when available', async () => {
      const cached = {
        status: 'ok' as const,
        hotels: [{ name: 'Hotel Barcelona', price_per_night: 150 }],
      };
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(cached);

      const result = await searchHotels({
        city: 'Barcelona',
        check_in: '2026-07-01',
        check_out: '2026-07-06',
        guests: 2,
      });

      expect(result).toEqual(cached);
      expect(serpApiService.serpApiGet).not.toHaveBeenCalled();
    });

    it('calls SerpApi and returns normalized results', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce(
        mockHotelsResponse,
      );

      const result = await searchHotels({
        city: 'Barcelona',
        check_in: '2026-07-01',
        check_out: '2026-07-06',
        guests: 2,
      });

      expect(result.status).toBe('ok');
      expect(result.hotels).toHaveLength(2);
      expect(result.hotels[0]).toHaveProperty('name');
      expect(result.hotels[0]).toHaveProperty('total_price');
      expect(result.hotels[0]).toHaveProperty('star_rating');
      expect(result.hotels[0]).toHaveProperty('hotel_id');
    });

    it('sorts results by total price ascending', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce(
        mockHotelsResponse,
      );

      const result = await searchHotels({
        city: 'Barcelona',
        check_in: '2026-07-01',
        check_out: '2026-07-06',
        guests: 2,
      });

      expect(result.hotels[0]!.total_price).toBeLessThanOrEqual(
        result.hotels[1]!.total_price,
      );
    });

    it('caches results after fetching', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce(
        mockHotelsResponse,
      );

      await searchHotels({
        city: 'Barcelona',
        check_in: '2026-07-01',
        check_out: '2026-07-06',
        guests: 2,
      });

      expect(cacheService.cacheSet).toHaveBeenCalledWith(
        'test-hotel-cache-key',
        expect.objectContaining({ status: 'ok' }),
        21600,
      );
    });

    it('returns no_results with pricing-gap message when all hotels have missing prices', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce({
        properties: [
          { name: 'Unpriced Hotel A', overall_rating: 4, hotel_class: 3 },
          { name: 'Unpriced Hotel B', overall_rating: 3.5, hotel_class: 2 },
        ],
      });

      const result = await searchHotels({
        city: 'Barcelona',
        check_in: '2026-07-01',
        check_out: '2026-07-06',
        guests: 2,
      });

      expect(result.status).toBe('no_results');
      expect(result.hotels).toEqual([]);
      expect(result.message).toMatch(/pricing data was unavailable/i);
    });

    it('filters out zero-price hotels and returns only priced ones', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce({
        properties: [
          {
            name: 'Priced Hotel',
            overall_rating: 4,
            hotel_class: 3,
            rate_per_night: { lowest: '$120', extracted_lowest: 120 },
            total_rate: { lowest: '$600', extracted_lowest: 600 },
          },
          { name: 'Unpriced Hotel', overall_rating: 4, hotel_class: 3 },
        ],
      });

      const result = await searchHotels({
        city: 'Barcelona',
        check_in: '2026-07-01',
        check_out: '2026-07-06',
        guests: 2,
      });

      expect(result.status).toBe('ok');
      expect(result.hotels).toHaveLength(1);
      expect(result.hotels[0]!.name).toBe('Priced Hotel');
    });

    it('returns status:no_results when SerpApi has zero properties', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce({
        properties: [],
      });

      const result = await searchHotels({
        city: 'XYZ',
        check_in: '2026-07-01',
        check_out: '2026-07-06',
        guests: 1,
      });

      expect(result.status).toBe('no_results');
      expect(result.hotels).toEqual([]);
    });

    it('filters by star_rating_min', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce(
        mockHotelsResponse,
      );

      const result = await searchHotels({
        city: 'Barcelona',
        check_in: '2026-07-01',
        check_out: '2026-07-06',
        guests: 2,
        star_rating_min: 3,
      });

      expect(result.hotels).toHaveLength(1);
      expect(result.hotels[0]!.name).toBe('Hotel Barcelona Beach');
    });

    it('filters by max_price_per_night', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce(
        mockHotelsResponse,
      );

      const result = await searchHotels({
        city: 'Barcelona',
        check_in: '2026-07-01',
        check_out: '2026-07-06',
        guests: 2,
        max_price_per_night: 100,
      });

      expect(result.hotels).toHaveLength(1);
      expect(result.hotels[0]!.name).toBe('Budget Inn Barcelona');
    });

    it('populates address from nearby_places landmark when present', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce({
        properties: [
          {
            name: 'Hotel Ramblas',
            overall_rating: 4.2,
            hotel_class: 4,
            rate_per_night: { lowest: '$140', extracted_lowest: 140 },
            total_rate: { lowest: '$700', extracted_lowest: 700 },
            nearby_places: [
              { name: 'Las Ramblas' },
              { name: 'Sagrada Familia' },
            ],
          },
        ],
      });

      const result = await searchHotels({
        city: 'Barcelona',
        check_in: '2026-07-01',
        check_out: '2026-07-06',
        guests: 2,
      });

      expect(result.hotels[0]!.address).toBe('Near Las Ramblas, Barcelona');
    });

    it('falls back to city when nearby_places is absent', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce({
        properties: [
          {
            name: 'Generic Hotel',
            overall_rating: 4,
            hotel_class: 3,
            rate_per_night: { lowest: '$120', extracted_lowest: 120 },
            total_rate: { lowest: '$600', extracted_lowest: 600 },
          },
        ],
      });

      const result = await searchHotels({
        city: 'Barcelona',
        check_in: '2026-07-01',
        check_out: '2026-07-06',
        guests: 2,
      });

      expect(result.hotels[0]!.address).toBe('Barcelona');
    });

    it('falls back to city when nearby_places is an empty array', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce({
        properties: [
          {
            name: 'Lonely Hotel',
            overall_rating: 4,
            hotel_class: 3,
            rate_per_night: { lowest: '$120', extracted_lowest: 120 },
            total_rate: { lowest: '$600', extracted_lowest: 600 },
            nearby_places: [],
          },
        ],
      });

      const result = await searchHotels({
        city: 'Barcelona',
        check_in: '2026-07-01',
        check_out: '2026-07-06',
        guests: 2,
      });

      expect(result.hotels[0]!.address).toBe('Barcelona');
    });

    it("parses hotel_class string format (e.g. '4-star hotel')", async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce({
        properties: [
          {
            name: 'Fancy Hotel',
            overall_rating: 4.5,
            hotel_class: '4-star hotel',
            rate_per_night: { lowest: '$200', extracted_lowest: 200 },
            total_rate: { lowest: '$1000', extracted_lowest: 1000 },
          },
        ],
      });

      const result = await searchHotels({
        city: 'Barcelona',
        check_in: '2026-07-01',
        check_out: '2026-07-06',
        guests: 2,
      });

      expect(result.hotels[0]!.star_rating).toBe(4);
    });

    it('returns status:quota_exhausted when SerpApi monthly quota is hit (F-17)', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      const { SerpApiQuotaExceededError } = serpApiService as {
        SerpApiQuotaExceededError: new () => Error;
      };
      vi.mocked(serpApiService.serpApiGet).mockRejectedValueOnce(
        new SerpApiQuotaExceededError(),
      );

      const result = await searchHotels({
        city: 'Barcelona',
        check_in: '2026-07-01',
        check_out: '2026-07-06',
        guests: 2,
      });

      expect(result.status).toBe('quota_exhausted');
      expect(result.hotels).toEqual([]);
      expect(result.message).toMatch(/quota/i);
    });

    it('returns status:error with message when SerpApi throws a non-quota error (F-17)', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockRejectedValueOnce(
        new Error('SerpApi 503: service unavailable'),
      );

      const result = await searchHotels({
        city: 'Barcelona',
        check_in: '2026-07-01',
        check_out: '2026-07-06',
        guests: 2,
      });

      expect(result.status).toBe('error');
      expect(result.hotels).toEqual([]);
      expect(result.message).toBeTruthy();
    });

    it('returns status:timeout when SerpApi aborts (F-17)', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      const timeoutErr = new Error('The operation was aborted due to timeout');
      timeoutErr.name = 'TimeoutError';
      vi.mocked(serpApiService.serpApiGet).mockRejectedValueOnce(timeoutErr);

      const result = await searchHotels({
        city: 'Barcelona',
        check_in: '2026-07-01',
        check_out: '2026-07-06',
        guests: 2,
      });

      expect(result.status).toBe('timeout');
      expect(result.hotels).toEqual([]);
      expect(result.message).toMatch(/timed out/i);
    });

    it('does not throw when SerpApi throws a network error', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockRejectedValueOnce(
        new Error('Network ECONNRESET'),
      );

      await expect(
        searchHotels({
          city: 'Barcelona',
          check_in: '2026-07-01',
          check_out: '2026-07-06',
          guests: 2,
        }),
      ).resolves.toBeDefined();
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
      vi.doMock('app/utils/logs/logger.js', () => ({
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
      vi.doMock('app/tools/mock/hotelsMock.js', () => ({
        generateMockHotels: vi.fn().mockReturnValue({
          status: 'ok',
          hotels: [
            {
              offer_id: 'mock-hotel-0',
              name: 'Test Boutique Hotel',
              city: 'Barcelona',
              star_rating: 4,
              price_per_night: 220,
              total_price: 660,
              currency: 'USD',
              check_in: '2026-07-01',
              check_out: '2026-07-06',
              image_url: null,
              latitude: null,
              longitude: null,
            },
          ],
        }),
      }));
      const mod = await import('app/tools/hotelsTool.js');
      searchHotels = mod.searchHotels;
    });

    it('returns mock results and skips SerpApi when isMockMode() is true', async () => {
      const result = await searchHotels({
        city: 'Barcelona',
        check_in: '2026-07-01',
        check_out: '2026-07-06',
        guests: 2,
      });

      expect(result.hotels).toHaveLength(1);
      expect(result.hotels[0]?.name).toBe('Test Boutique Hotel');
    });
  });
});
