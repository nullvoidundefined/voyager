import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/utils/logs/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

let serpApiService: typeof import('app/services/serpapi.service.js');

describe('serpapi.service', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    vi.doMock('app/utils/logs/logger.js', () => ({
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));

    process.env.SERPAPI_API_KEY = 'test-serpapi-key';

    serpApiService = await import('app/services/serpapi.service.js');
  });

  afterEach(() => {
    delete process.env.SERPAPI_API_KEY;
  });

  describe('serpApiGet', () => {
    it('makes GET request with engine and api_key params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ best_flights: [] }),
      });

      await serpApiService.serpApiGet('google_flights', {
        departure_id: 'SFO',
        arrival_id: 'BCN',
      });

      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url).toContain('engine=google_flights');
      expect(url).toContain('api_key=test-serpapi-key');
      expect(url).toContain('departure_id=SFO');
      expect(url).toContain('arrival_id=BCN');
    });

    it('returns parsed JSON on success', async () => {
      const data = { properties: [{ name: 'Hotel X' }] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => data,
      });

      const result = await serpApiService.serpApiGet('google_hotels', {
        q: 'hotels in Paris',
      });
      expect(result).toEqual(data);
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key',
      });

      await expect(
        serpApiService.serpApiGet('google_flights', {}),
      ).rejects.toThrow('SerpApi error: 401');
    });

    it('throws when SERPAPI_API_KEY is not set', async () => {
      delete process.env.SERPAPI_API_KEY;

      vi.resetModules();
      vi.doMock('app/utils/logs/logger.js', () => ({
        logger: {
          error: vi.fn(),
          info: vi.fn(),
          warn: vi.fn(),
          debug: vi.fn(),
        },
      }));
      const freshModule = await import('app/services/serpapi.service.js');

      await expect(
        freshModule.serpApiGet('google_flights', {}),
      ).rejects.toThrow('SERPAPI_API_KEY is required');
    });

    it('omits undefined params from query string', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await serpApiService.serpApiGet('google_flights', {
        departure_id: 'SFO',
        return_date: undefined,
      });

      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url).not.toContain('return_date');
    });
  });
});
