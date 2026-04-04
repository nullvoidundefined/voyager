import { executeTool } from "app/tools/executor.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("app/repositories/trips/trips.js", () => ({
  updateTrip: vi.fn().mockResolvedValue({ id: "trip-1" }),
  insertTripFlight: vi.fn().mockResolvedValue(undefined),
  insertTripHotel: vi.fn().mockResolvedValue(undefined),
  insertTripCarRental: vi.fn().mockResolvedValue(undefined),
  insertTripExperience: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("app/tools/flights.tool.js", () => ({
  searchFlights: vi.fn().mockResolvedValue([]),
}));
vi.mock("app/tools/hotels.tool.js", () => ({
  searchHotels: vi.fn().mockResolvedValue([]),
}));
vi.mock("app/tools/experiences.tool.js", () => ({
  searchExperiences: vi.fn().mockResolvedValue([]),
}));
vi.mock("app/tools/car-rentals.tool.js", () => ({
  searchCarRentals: vi.fn().mockResolvedValue({ rentals: [] }),
}));
vi.mock("app/tools/budget.tool.js", () => ({
  calculateRemainingBudget: vi.fn().mockReturnValue({ remaining: 500 }),
}));
vi.mock("app/tools/destination.tool.js", () => ({
  getDestinationInfo: vi
    .fn()
    .mockReturnValue({ city_name: "Barcelona", iata_code: "BCN" }),
}));
vi.mock("app/utils/logs/logger.js", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const ctx = { tripId: "trip-1", userId: "user-1" };

describe("executeTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Zod validation", () => {
    it("rejects search_flights with missing required fields", async () => {
      const result = await executeTool("search_flights", {});
      expect(result).toHaveProperty("error");
      expect((result as { error: string }).error).toContain("Validation");
    });

    it("rejects search_flights with invalid date format", async () => {
      const result = await executeTool("search_flights", {
        origin: "JFK",
        destination: "BCN",
        departure_date: "07/01/2026",
        passengers: 2,
      });
      expect(result).toHaveProperty("error");
      expect((result as { error: string }).error).toContain("Validation");
    });

    it("accepts valid search_flights input", async () => {
      const result = await executeTool("search_flights", {
        origin: "JFK",
        destination: "BCN",
        departure_date: "2026-07-01",
        passengers: 2,
      });
      expect(result).not.toHaveProperty("error");
    });

    it("rejects search_hotels with non-numeric guests", async () => {
      const result = await executeTool("search_hotels", {
        city: "Barcelona",
        check_in: "2026-07-01",
        check_out: "2026-07-05",
        guests: "two",
      });
      expect(result).toHaveProperty("error");
    });

    it("rejects calculate_remaining_budget with string instead of number", async () => {
      const result = await executeTool("calculate_remaining_budget", {
        total_budget: "three thousand",
        flight_cost: 0,
        hotel_total_cost: 0,
        experience_costs: [],
      });
      expect(result).toHaveProperty("error");
    });

    it("rejects update_trip with invalid date format", async () => {
      const result = await executeTool(
        "update_trip",
        { departure_date: "next Tuesday" },
        ctx,
      );
      expect(result).toHaveProperty("error");
    });

    it("accepts valid update_trip with no fields", async () => {
      const result = await executeTool("update_trip", {}, ctx);
      expect(result).not.toHaveProperty("error");
    });

    it("rejects select_flight with missing required fields", async () => {
      const result = await executeTool(
        "select_flight",
        { airline: "Delta" },
        ctx,
      );
      expect(result).toHaveProperty("error");
    });

    it("accepts valid select_flight", async () => {
      const result = await executeTool(
        "select_flight",
        {
          airline: "Delta",
          flight_number: "DL100",
          origin: "JFK",
          destination: "BCN",
          price: 450,
          currency: "USD",
        },
        ctx,
      );
      expect(result).toEqual({
        success: true,
        message: "Flight selection saved",
      });
    });
  });

  describe("routing", () => {
    it("throws on unknown tool name", async () => {
      await expect(executeTool("nonexistent_tool", {})).rejects.toThrow(
        "Unknown tool",
      );
    });

    it("throws when context-required tools lack context", async () => {
      await expect(
        executeTool("update_trip", { destination: "Paris" }),
      ).rejects.toThrow("requires trip context");
    });

    it("returns input as-is for format_response", async () => {
      const input = { text: "Hello!" };
      const result = await executeTool("format_response", input);
      expect(result).toEqual(input);
    });
  });
});
