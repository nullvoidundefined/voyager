import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/services/cache/cacheService.js', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn(),
}));
vi.mock('app/clients/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

let fetchFCDOAdvisory: typeof import('app/services/external/enrichment-sources/fcdo.js').fetchFCDOAdvisory;
let logger: typeof import('app/clients/logger.js').logger;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();

  vi.doMock('app/services/cache/cacheService.js', () => ({
    cacheGet: vi.fn().mockResolvedValue(null),
    cacheSet: vi.fn(),
  }));
  vi.doMock('app/clients/logger.js', () => ({
    logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  }));

  const mod = await import('app/services/external/enrichment-sources/fcdo.js');
  fetchFCDOAdvisory = mod.fetchFCDOAdvisory;
  const loggerMod = await import('app/clients/logger.js');
  logger = loggerMod.logger;
});

describe('fetchFCDOAdvisory', () => {
  it('returns [] for unknown country without fetching', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await fetchFCDOAdvisory('XX');

    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('returns [] and logs warn when fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    );

    const result = await fetchFCDOAdvisory('US');

    expect(result).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'fcdo' }),
      expect.any(String),
    );
    vi.unstubAllGlobals();
  });

  it('returns [] when GOV.UK responds non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 502 } as Response),
    );

    const result = await fetchFCDOAdvisory('JP');

    expect(result).toEqual([]);
    vi.unstubAllGlobals();
  });

  it('passes an AbortSignal with a finite timeout to fetch', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ details: { parts: [] } }),
    } as Response);
    vi.stubGlobal('fetch', fetchSpy);

    await fetchFCDOAdvisory('JP');

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    vi.unstubAllGlobals();
  });

  it('extracts entry-requirements advisory node when present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          details: {
            parts: [
              {
                title: 'Entry requirements',
                body: '<p>Passport required.</p>',
              },
            ],
          },
        }),
      } as Response),
    );

    const result = await fetchFCDOAdvisory('JP');

    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe('advisory');
    if (result[0]?.type === 'advisory') {
      expect(result[0].title).toBe('Entry & Visa Requirements');
      expect(result[0].body).toBe('Passport required.');
    }
    vi.unstubAllGlobals();
  });
});
