/**
 * Resolves an IATA airport code to city coordinates from the local
 * CITY_DATABASE, so map pins never free-text geocode airport codes (the
 * 2026-07-07 Iloilo-City incident: Mapbox matched "SFO airport" to a
 * Philippine neighborhood named "Airport").
 */
import type { Request, Response } from 'express';

import { ApiError } from 'app/errors/ApiError.js';
import { getCityByIataCode } from 'app/services/getCityByIataCode.js';

const IATA_CODE_PATTERN = /^[A-Za-z]{3}$/;

export function airportCoordinatesHandler(req: Request, res: Response): void {
  const code = String(req.params.code ?? '');

  if (!IATA_CODE_PATTERN.test(code)) {
    throw ApiError.badRequest('code must be a 3-letter IATA airport code');
  }

  const match = getCityByIataCode(code);
  if (!match) {
    throw ApiError.notFound(
      `No city found for airport code ${code.toUpperCase()}`,
    );
  }

  res.json({
    city: match.cityName,
    code: code.toUpperCase(),
    lat: match.city.lat,
    lon: match.city.lon,
  });
}
