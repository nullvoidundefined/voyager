import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock cache service
vi.mock("app/services/cache.service.js", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));

vi.mock("app/utils/logs/logger.js", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

let amadeusService: typeof import("app/services/amadeus.service.js");
let cacheService: typeof import("app/services/cache.service.js");

describe("amadeus.service", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    vi.doMock("app/services/cache.service.js", () => ({
      cacheGet: vi.fn(),
      cacheSet: vi.fn(),
    }));
    vi.doMock("app/utils/logs/logger.js", () => ({
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));

    process.env.AMADEUS_CLIENT_ID = "test-client-id";
    process.env.AMADEUS_CLIENT_SECRET = "test-client-secret";
    process.env.AMADEUS_BASE_URL = "https://test.api.amadeus.com";

    amadeusService = await import("app/services/amadeus.service.js");
    cacheService = await import("app/services/cache.service.js");
  });

  afterEach(() => {
    delete process.env.AMADEUS_CLIENT_ID;
    delete process.env.AMADEUS_CLIENT_SECRET;
    delete process.env.AMADEUS_BASE_URL;
  });

  describe("getAccessToken", () => {
    it("returns cached token when available", async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce("cached-token-123");

      const token = await amadeusService.getAccessToken();

      expect(token).toBe("cached-token-123");
      expect(cacheService.cacheGet).toHaveBeenCalledWith("amadeus:token");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("fetches new token when cache is empty", async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "new-token-456",
          expires_in: 1799,
          token_type: "Bearer",
        }),
      });

      const token = await amadeusService.getAccessToken();

      expect(token).toBe("new-token-456");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://test.api.amadeus.com/v1/security/oauth2/token",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }),
      );
      // Should cache with TTL slightly less than expires_in
      expect(cacheService.cacheSet).toHaveBeenCalledWith(
        "amadeus:token",
        "new-token-456",
        expect.any(Number),
      );
    });

    it("sends correct OAuth2 client credentials in body", async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "tok",
          expires_in: 1799,
        }),
      });

      await amadeusService.getAccessToken();

      const fetchCall = mockFetch.mock.calls[0];
      const body = fetchCall[1].body as string;
      expect(body).toContain("grant_type=client_credentials");
      expect(body).toContain("client_id=test-client-id");
      expect(body).toContain("client_secret=test-client-secret");
    });

    it("throws on auth failure", async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });

      await expect(amadeusService.getAccessToken()).rejects.toThrow("Amadeus auth failed");
    });
  });

  describe("amadeusGet", () => {
    it("makes authenticated GET request", async () => {
      // Mock getAccessToken indirectly by caching a token
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce("my-token");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: "1" }] }),
      });

      const result = await amadeusService.amadeusGet("/v2/shopping/flight-offers", {
        originLocationCode: "SFO",
      });

      expect(result).toEqual({ data: [{ id: "1" }] });
      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toContain("/v2/shopping/flight-offers?originLocationCode=SFO");
      expect(fetchCall[1].headers.Authorization).toBe("Bearer my-token");
    });

    it("retries with fresh token on 401", async () => {
      // First call: cached token
      vi.mocked(cacheService.cacheGet)
        .mockResolvedValueOnce("expired-token")
        // Second call: no cache (force refresh)
        .mockResolvedValueOnce(null);

      // First API call: 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });

      // Token refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "fresh-token", expires_in: 1799 }),
      });

      // Retry API call: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      });

      const result = await amadeusService.amadeusGet("/v2/test", {});

      expect(result).toEqual({ data: [] });
      // Should have called fetch 3 times: failed GET, token refresh, retry GET
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("throws on non-401 errors", async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce("my-token");
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      await expect(amadeusService.amadeusGet("/v2/test", {})).rejects.toThrow();
    });

    it("handles rate limit (429) with retry", async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValue("my-token");

      // First call: 429
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => "Rate limited",
      });

      // Retry: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: "1" }] }),
      });

      const result = await amadeusService.amadeusGet("/v2/test", {});
      expect(result).toEqual({ data: [{ id: "1" }] });
    });
  });
});
