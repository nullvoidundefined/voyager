import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("app/services/amadeus.service.js");
vi.mock("app/services/cache.service.js");
vi.mock("app/utils/logs/logger.js", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

let searchFlights: typeof import("app/tools/flights.tool.js").searchFlights;
let amadeusService: typeof import("app/services/amadeus.service.js");
let cacheService: typeof import("app/services/cache.service.js");

const mockFlightOffers = {
  data: [
    {
      id: "1",
      price: { total: "450.00", currency: "USD" },
      itineraries: [
        {
          segments: [
            {
              departure: { iataCode: "SFO", at: "2026-07-01T08:00:00" },
              arrival: { iataCode: "BCN", at: "2026-07-01T20:00:00" },
              carrierCode: "UA",
              number: "123",
            },
          ],
        },
      ],
    },
    {
      id: "2",
      price: { total: "380.00", currency: "USD" },
      itineraries: [
        {
          segments: [
            {
              departure: { iataCode: "SFO", at: "2026-07-01T10:00:00" },
              arrival: { iataCode: "BCN", at: "2026-07-02T01:00:00" },
              carrierCode: "IB",
              number: "456",
            },
          ],
        },
      ],
    },
  ],
};

describe("flights.tool", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    vi.doMock("app/services/amadeus.service.js", () => ({
      amadeusGet: vi.fn(),
    }));
    vi.doMock("app/services/cache.service.js", () => ({
      cacheGet: vi.fn(),
      cacheSet: vi.fn(),
      normalizeCacheKey: vi.fn().mockReturnValue("test-cache-key"),
    }));
    vi.doMock("app/utils/logs/logger.js", () => ({
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));

    const flightsMod = await import("app/tools/flights.tool.js");
    searchFlights = flightsMod.searchFlights;
    amadeusService = await import("app/services/amadeus.service.js");
    cacheService = await import("app/services/cache.service.js");
  });

  describe("searchFlights", () => {
    it("returns cached results when available", async () => {
      const cached = [{ origin: "SFO", destination: "BCN", price: 450 }];
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(cached);

      const result = await searchFlights({
        origin: "SFO",
        destination: "BCN",
        departure_date: "2026-07-01",
        passengers: 1,
      });

      expect(result).toEqual(cached);
      expect(amadeusService.amadeusGet).not.toHaveBeenCalled();
    });

    it("calls Amadeus API and returns normalized results", async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(amadeusService.amadeusGet).mockResolvedValueOnce(mockFlightOffers);

      const result = await searchFlights({
        origin: "SFO",
        destination: "BCN",
        departure_date: "2026-07-01",
        passengers: 1,
      });

      expect(amadeusService.amadeusGet).toHaveBeenCalledWith(
        "/v2/shopping/flight-offers",
        expect.objectContaining({
          originLocationCode: "SFO",
          destinationLocationCode: "BCN",
          departureDate: "2026-07-01",
          adults: 1,
          max: 5,
        }),
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("origin", "SFO");
      expect(result[0]).toHaveProperty("destination", "BCN");
      expect(result[0]).toHaveProperty("price");
      expect(result[0]).toHaveProperty("airline");
    });

    it("sorts results by price ascending", async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(amadeusService.amadeusGet).mockResolvedValueOnce(mockFlightOffers);

      const result = await searchFlights({
        origin: "SFO",
        destination: "BCN",
        departure_date: "2026-07-01",
        passengers: 1,
      });

      expect(result[0].price).toBeLessThanOrEqual(result[1].price);
    });

    it("caches results after fetching", async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(amadeusService.amadeusGet).mockResolvedValueOnce(mockFlightOffers);

      await searchFlights({
        origin: "SFO",
        destination: "BCN",
        departure_date: "2026-07-01",
        passengers: 1,
      });

      expect(cacheService.cacheSet).toHaveBeenCalledWith("test-cache-key", expect.any(Array), 3600);
    });

    it("handles empty results gracefully", async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(amadeusService.amadeusGet).mockResolvedValueOnce({ data: [] });

      const result = await searchFlights({
        origin: "SFO",
        destination: "XYZ",
        departure_date: "2026-07-01",
        passengers: 1,
      });

      expect(result).toEqual([]);
    });

    it("passes optional parameters", async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(amadeusService.amadeusGet).mockResolvedValueOnce({ data: [] });

      await searchFlights({
        origin: "SFO",
        destination: "BCN",
        departure_date: "2026-07-01",
        return_date: "2026-07-06",
        passengers: 2,
        max_price: 500,
        cabin_class: "BUSINESS",
      });

      expect(amadeusService.amadeusGet).toHaveBeenCalledWith(
        "/v2/shopping/flight-offers",
        expect.objectContaining({
          returnDate: "2026-07-06",
          adults: 2,
          maxPrice: 500,
          travelClass: "BUSINESS",
        }),
      );
    });

    it("handles API errors gracefully", async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(amadeusService.amadeusGet).mockRejectedValueOnce(new Error("API timeout"));

      await expect(
        searchFlights({
          origin: "SFO",
          destination: "BCN",
          departure_date: "2026-07-01",
          passengers: 1,
        }),
      ).rejects.toThrow("API timeout");
    });
  });
});
