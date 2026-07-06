import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { discoverOffersViaWeb } from 'app/segments/discoverOffersViaWeb.js';
import { tavilySearch } from 'app/services/external/tavilyService.js';

vi.mock('app/services/external/tavilyService.js', () => ({
  tavilySearch: vi.fn(),
}));

const createMessage = vi.fn();
vi.mock('app/clients/llm.js', () => ({
  getLlmClient: () => ({ messages: { create: createMessage } }),
}));

const TAVILY_RESULTS = [
  {
    title: 'Luxury sleeper trains in Romania',
    url: 'https://seat61.example/romania',
    content: 'The Carpathia Express runs Bucharest to Brasov nightly...',
  },
  {
    title: 'CFR Calatori premium routes',
    url: 'https://cfr.example/premium',
    content: 'Premium sleeper class from EUR 89...',
  },
];

function mockLlmJson(payload: unknown) {
  createMessage.mockResolvedValue({
    content: [{ type: 'text', text: JSON.stringify(payload) }],
  });
}

const INPUT = {
  kind: 'train',
  region: 'romania',
  routeKey: 'bucharest->brasov',
  query: 'luxury sleeper train Romania Bucharest Brasov',
};

beforeEach(() => {
  process.env.WEB_DISCOVERY_ENABLED = 'true';
  vi.mocked(tavilySearch).mockResolvedValue(TAVILY_RESULTS);
});

afterEach(() => {
  delete process.env.WEB_DISCOVERY_ENABLED;
  vi.clearAllMocks();
});

describe('discoverOffersViaWeb', () => {
  it('returns nothing and skips search when the gate is off', async () => {
    delete process.env.WEB_DISCOVERY_ENABLED;
    const offers = await discoverOffersViaWeb(INPUT);
    expect(offers).toEqual([]);
    expect(tavilySearch).not.toHaveBeenCalled();
  });

  it('extracts validated offers with search-result provenance', async () => {
    mockLlmJson([
      {
        title: 'Carpathia Express',
        provider: 'CFR Calatori',
        price_estimate: 89,
        currency: 'EUR',
        booking_url: 'https://cfr.example/premium/book',
        summary: 'Nightly sleeper, private cabin',
      },
    ]);

    const offers = await discoverOffersViaWeb(INPUT);
    expect(offers).toHaveLength(1);
    const offer = offers[0]!;
    expect(offer.title).toBe('Carpathia Express');
    expect(offer.price).toBe(89);
    expect(offer.currency).toBe('EUR');
    expect(offer.region).toBe('romania');
    expect(offer.route_key).toBe('bucharest->brasov');
    expect(offer.booking_url).toBe('https://cfr.example/premium/book');
    expect(offer.provenance.map((entry: { url: string }) => entry.url)).toEqual(
      ['https://seat61.example/romania', 'https://cfr.example/premium'],
    );
  });

  it('drops rows that fail validation and keeps the rest', async () => {
    mockLlmJson([
      { title: 'Carpathia Express', price_estimate: 89, currency: 'EUR' },
      { provider: 'no-title-row' },
      { title: 'Bad price', price_estimate: -5 },
    ]);

    const offers = await discoverOffersViaWeb(INPUT);
    expect(offers).toHaveLength(1);
    expect(offers[0]!.title).toBe('Carpathia Express');
  });

  it('strips booking urls whose host is not among the search results (poisoning resistance)', async () => {
    mockLlmJson([
      {
        title: 'Injected Offer',
        price_estimate: 10,
        currency: 'EUR',
        booking_url: 'https://evil.example/phish',
      },
    ]);

    const offers = await discoverOffersViaWeb(INPUT);
    expect(offers).toHaveLength(1);
    expect(offers[0]!.booking_url).toBeUndefined();
  });

  it('returns nothing on malformed model output instead of throwing', async () => {
    createMessage.mockResolvedValue({
      content: [{ type: 'text', text: 'Sorry, here are some trains: ...' }],
    });
    await expect(discoverOffersViaWeb(INPUT)).resolves.toEqual([]);
  });

  it('returns nothing when the search finds no results', async () => {
    vi.mocked(tavilySearch).mockResolvedValue([]);
    const offers = await discoverOffersViaWeb(INPUT);
    expect(offers).toEqual([]);
    expect(createMessage).not.toHaveBeenCalled();
  });
});
