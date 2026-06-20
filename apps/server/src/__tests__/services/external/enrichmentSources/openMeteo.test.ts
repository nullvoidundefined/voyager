import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/services/cache/cacheService.js', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn(),
}));
vi.mock('app/clients/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

let fetchWeatherForecast: typeof import('app/services/external/enrichmentSources/openMeteo.js').fetchWeatherForecast;
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
    await import('app/services/external/enrichmentSources/openMeteo.js');
  fetchWeatherForecast = mod.fetchWeatherForecast;
  const loggerMod = await import('app/clients/logger.js');
  logger = loggerMod.logger;
});

describe('fetchWeatherForecast', () => {
  it('returns null and logs warn when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));

    const result = await fetchWeatherForecast(41.4, 2.2);

    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'open_meteo' }),
      expect.any(String),
    );
    vi.unstubAllGlobals();
  });

  it('returns null when Open-Meteo responds non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response),
    );

    const result = await fetchWeatherForecast(41.4, 2.2);

    expect(result).toBeNull();
    vi.unstubAllGlobals();
  });

  it('passes an AbortSignal with a finite timeout to fetch', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        daily: {
          time: [],
          temperature_2m_max: [],
          temperature_2m_min: [],
          weathercode: [],
          precipitation_probability_max: [],
        },
      }),
    } as Response);
    vi.stubGlobal('fetch', fetchSpy);

    await fetchWeatherForecast(41.4, 2.2);

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    vi.unstubAllGlobals();
  });

  it('returns weather_forecast node with parsed daily data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          daily: {
            time: ['2026-07-01'],
            temperature_2m_max: [30],
            temperature_2m_min: [22],
            weathercode: [0],
            precipitation_probability_max: [10],
          },
        }),
      } as Response),
    );

    const result = await fetchWeatherForecast(41.4, 2.2);

    expect(result).not.toBeNull();
    expect(result?.type).toBe('weather_forecast');
    if (result?.type === 'weather_forecast') {
      expect(result.forecast).toHaveLength(1);
      expect(result.forecast[0]?.high_c).toBe(30);
      expect(result.forecast[0]?.condition).toBe('Clear');
    }
    vi.unstubAllGlobals();
  });
});
