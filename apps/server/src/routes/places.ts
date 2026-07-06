/**
 * Express router for the places surface, exposing the photo-proxy and
 * airport-coordinates endpoints. Keeps places route wiring separate from the
 * handlers.
 */
import express from 'express';

import { airportCoordinatesHandler } from 'app/handlers/airportCoordinates.handler.js';
import { photoProxyHandler } from 'app/handlers/photoProxy.handler.js';

const placesRouter = express.Router();

// Public reference data: IATA code -> city coordinates for trip-map pins.
// Backed by the local CITY_DATABASE, never free-text geocoding.
placesRouter.get('/airport/:code', airportCoordinatesHandler);

// SEC-01 (2026-04-06 audit): the photo proxy is protected by strict
// ref-format validation in photoProxyHandler (PHOTO_REF_PATTERN) which
// limits requests to valid Google Places photo resource names only.
// Google Places photos are publicly accessible content; removing auth
// here fixes cross-origin image loading (browsers don't send cookies
// with <img> src requests to cross-origin servers).
placesRouter.get('/photo', photoProxyHandler);

export { placesRouter };
