import express from 'express';

import { photoProxyHandler } from 'app/handlers/places/photoProxy.handler.js';

const placesRouter = express.Router();

// SEC-01 (2026-04-06 audit): the photo proxy is protected by strict
// ref-format validation in photoProxyHandler (PHOTO_REF_PATTERN) which
// limits requests to valid Google Places photo resource names only.
// Google Places photos are publicly accessible content; removing auth
// here fixes cross-origin image loading (browsers don't send cookies
// with <img> src requests to cross-origin servers).
placesRouter.get('/photo', photoProxyHandler);

export { placesRouter };
