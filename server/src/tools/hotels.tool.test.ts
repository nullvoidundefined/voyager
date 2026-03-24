import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("app/services/amadeus.service.js");
vi.mock("app/services/cache.service.js");
vi.mock("app/utils/logs/logger.js", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

let searchHotels: typeof import("app/tools/hotels.tool.js").searchHotels;
let amadeusService: typeof import("app/services/amadeus.service.js");
let cacheService: typeof import("app/services/cache.service.js");

const mockHotelOffers = {
  data: [
    {
      hotel: {
        hotelId: "HTBCN001",
        name: "Hotel Barcelona Beach",
        rating: "4",
        address: { lines: ["Passeig Maritim 12"], cityName: "Barcelona" },
      },
      offers: [
        {
          id: "offer1",
          price: { total: "150.00", currency: "USD" },
          checkInDate: "2026-07-01",
          checkOutDate: "2026-07-06",
        },
      ],
    },
    {
      hotel: {
        hotelId: "HTBCN002",
        name: "Budget Inn Barcelona",
        rating: "2",
        address: { lines: ["Carrer de la Rambla 5"], cityName: "Barcelona" },
      },
      offers: [
        {
          id: "offer2",
          price: { total: "80.00", currency: "USD" },
          checkInDate: "2026-07-01",
          checkOutDate: "2026-07-06",
        },
      ],
    },
  ],
};

describe("hotels.tool", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    vi.doMock("app/services/amadeus.service.js", () => ({
      amadeusGet: vi.fn(),
    }));
    vi.doMock("app/services/cache.service.js", () => ({
      cacheGet: vi.fn(),
      cacheSet: vi.fn(),
      normalizeCacheKey: vi.fn().mockReturnValue("test-hotel-cache-key"),
    }));
    vi.doMock("app/utils/logs/logger.js", () => ({
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));

    const hotelsMod = await import("app/tools/hotels.tool.js");
    searchHotels = hotelsMod.searchHotels;
    amadeusService = await import("app/services/amadeus.service.js");
    cacheService = await import("app/services/cache.service.js");
  });

  describe("searchHotels", () => {
    it("returns cached results when available", async () => {
      const cached = [{ name: "Hotel Barcelona", price_per_night: 150 }];
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(cached);

      const result = await searchHotels({
        city_code: "BCN",
        check_in: "2026-07-01",
        check_out: "2026-07-06",
        guests: 2,
      });

      expect(result).toEqual(cached);
      expect(amadeusService.amadeusGet).not.toHaveBeenCalled();
    });

    it("calls Amadeus API and returns normalized results", async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(amadeusService.amadeusGet).mockResolvedValueOnce(mockHotelOffers);

      const result = await searchHotels({
        city_code: "BCN",
        check_in: "2026-07-01",
        check_out: "2026-07-06",
        guests: 2,
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("name");
      expect(result[0]).toHaveProperty("total_price");
      expect(result[0]).toHaveProperty("star_rating");
      expect(result[0]).toHaveProperty("hotel_id");
    });

    it("sorts results by total price ascending", async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(amadeusService.amadeusGet).mockResolvedValueOnce(mockHotelOffers);

      const result = await searchHotels({
        city_code: "BCN",
        check_in: "2026-07-01",
        check_out: "2026-07-06",
        guests: 2,
      });

      expect(result[0].total_price).toBeLessThanOrEqual(result[1].total_price);
    });

    it("caches results after fetching", async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(amadeusService.amadeusGet).mockResolvedValueOnce(mockHotelOffers);

      await searchHotels({
        city_code: "BCN",
        check_in: "2026-07-01",
        check_out: "2026-07-06",
        guests: 2,
      });

      expect(cacheService.cacheSet).toHaveBeenCalledWith(
        "test-hotel-cache-key",
        expect.any(Array),
        3600,
      );
    });

    it("handles empty results gracefully", async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(amadeusService.amadeusGet).mockResolvedValueOnce({ data: [] });

      const result = await searchHotels({
        city_code: "XYZ",
        check_in: "2026-07-01",
        check_out: "2026-07-06",
        guests: 1,
      });

      expect(result).toEqual([]);
    });

    it("passes optional parameters (star_rating_min, max_price_per_night)", async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(amadeusService.amadeusGet).mockResolvedValueOnce({ data: [] });

      await searchHotels({
        city_code: "BCN",
        check_in: "2026-07-01",
        check_out: "2026-07-06",
        guests: 2,
        star_rating_min: 3,
        max_price_per_night: 200,
      });

      expect(amadeusService.amadeusGet).toHaveBeenCalledWith(
        "/v3/shopping/hotel-offers",
        expect.objectContaining({
          cityCode: "BCN",
          adults: 2,
          ratings: 3,
        }),
      );
    });
  });
});
