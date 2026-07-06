import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { airportCoordinatesHandler } from 'app/handlers/airportCoordinates.handler.js';

function mockReq(params: Record<string, string> = {}): Request {
  return { params } as unknown as Request;
}

function mockRes(): Response {
  const res = {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

// 2026-07-07 Iloilo-City incident: flight pins were resolved by free-text
// Mapbox geocoding of strings like "SFO airport", which matched a
// neighborhood named "Airport" in Iloilo City, Philippines. This endpoint
// resolves IATA codes against the local CITY_DATABASE instead.
describe('airportCoordinatesHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves a primary IATA code to its city coordinates', () => {
    const res = mockRes();
    airportCoordinatesHandler(mockReq({ code: 'SFO' }), res);

    expect(res.json).toHaveBeenCalledWith({
      city: 'San Francisco',
      code: 'SFO',
      lat: 37.7749,
      lon: -122.4194,
    });
  });

  it('resolves an alternate IATA code to the same city', () => {
    const res = mockRes();
    airportCoordinatesHandler(mockReq({ code: 'OAK' }), res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ city: 'San Francisco', code: 'OAK' }),
    );
  });

  it('is case-insensitive', () => {
    const res = mockRes();
    airportCoordinatesHandler(mockReq({ code: 'auh' }), res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        city: 'Abu Dhabi',
        lat: 24.4539,
        lon: 54.3773,
      }),
    );
  });

  it('throws a 404 ApiError for an unknown code', () => {
    const res = mockRes();
    expect(() =>
      airportCoordinatesHandler(mockReq({ code: 'ZZZ' }), res),
    ).toThrowError(expect.objectContaining({ statusCode: 404 }));
    expect(res.json).not.toHaveBeenCalled();
  });

  it('throws a 400 ApiError for a malformed code (negative input)', () => {
    const res = mockRes();
    expect(() =>
      airportCoordinatesHandler(mockReq({ code: 'S1!' }), res),
    ).toThrowError(expect.objectContaining({ statusCode: 400 }));
    expect(res.json).not.toHaveBeenCalled();
  });

  it('throws a 400 ApiError for an oversized code (negative input)', () => {
    const res = mockRes();
    expect(() =>
      airportCoordinatesHandler(mockReq({ code: 'A'.repeat(500) }), res),
    ).toThrowError(expect.objectContaining({ statusCode: 400 }));
    expect(res.json).not.toHaveBeenCalled();
  });
});
