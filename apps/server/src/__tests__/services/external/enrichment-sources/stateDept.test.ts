import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/services/cache/cacheService.js', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn(),
}));
vi.mock('app/clients/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

let fetchStateDeptAdvisory: typeof import('app/services/external/enrichment-sources/stateDept.js').fetchStateDeptAdvisory;
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

  const mod =
    await import('app/services/external/enrichment-sources/stateDept.js');
  fetchStateDeptAdvisory = mod.fetchStateDeptAdvisory;
  const loggerMod = await import('app/clients/logger.js');
  logger = loggerMod.logger;
});

describe('fetchStateDeptAdvisory', () => {
  it('returns null and logs warn when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));

    const result = await fetchStateDeptAdvisory('US');

    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'state_dept' }),
      expect.any(String),
    );

    vi.unstubAllGlobals();
  });

  it('returns null when feed responds non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503 } as Response),
    );

    const result = await fetchStateDeptAdvisory('US');

    expect(result).toBeNull();
    vi.unstubAllGlobals();
  });

  it('passes an AbortSignal with a finite timeout to fetch', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ advisories: [] }),
    } as Response);
    vi.stubGlobal('fetch', fetchSpy);

    await fetchStateDeptAdvisory('US');

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    vi.unstubAllGlobals();
  });

  it('returns advisory node when match found in feed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          advisories: [
            { iso_code: 'US', advisory_level: 2, advisory_text: 'Caution' },
          ],
        }),
      } as Response),
    );

    const result = await fetchStateDeptAdvisory('US');

    expect(result).not.toBeNull();
    expect(result?.type).toBe('advisory');
    if (result?.type === 'advisory') {
      expect(result.title).toContain('Level 2');
      expect(result.body).toBe('Caution');
    }
    vi.unstubAllGlobals();
  });
});
