import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? '';

// SEC-01 (2026-04-06 audit): strict allowlist for the `ref` query
// parameter. Google Places photo references follow the format
// `places/{placeId}/photos/{photoId}` where both IDs are Google's
// base64url-like opaque strings. Rejecting anything else prevents
// the proxy from being used as an open fetch-through for arbitrary
// Google Places URLs, which would otherwise let an attacker drain
// the paid GOOGLE_PLACES_API_KEY quota via our unauthenticated
// endpoint (before requireAuth was added at the route level).
const PHOTO_REF_PATTERN = /^places\/[\w-]{1,128}\/photos\/[\w-]{1,128}$/;

// SEC-01: clamp maxwidth to a reasonable range. Google Places Photo
// API accepts values up to 4800, but anything above 1600 is wasted
// bandwidth for a web client and amplifies the cost per abused call.
const MIN_MAXWIDTH = 64;
const MAX_MAXWIDTH = 1600;
const DEFAULT_MAXWIDTH = 400;

function clampMaxwidth(raw: unknown): number {
  const parsed = parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAXWIDTH;
  }
  return Math.max(MIN_MAXWIDTH, Math.min(MAX_MAXWIDTH, parsed));
}

export async function photoProxyHandler(req: Request, res: Response) {
  const ref = req.query.ref as string;
  const maxwidth = clampMaxwidth(req.query.maxwidth);

  if (!ref) {
    res
      .status(400)
      .json({ error: 'MISSING_PARAM', message: 'ref is required' });
    return;
  }

  // SEC-01: reject malformed or potentially malicious ref values
  // before touching the upstream API.
  if (!PHOTO_REF_PATTERN.test(ref)) {
    res.status(400).json({
      error: 'INVALID_REF',
      message: 'ref must match Google Places photo reference format',
    });
    return;
  }

  try {
    const url = `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=${maxwidth}`;
    const response = await fetch(url, {
      headers: { 'X-Goog-Api-Key': GOOGLE_API_KEY },
    });

    if (!response.ok) {
      res.status(response.status).json({ error: 'PHOTO_FETCH_FAILED' });
      return;
    }

    const contentType = response.headers.get('content-type') ?? 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    Readable.fromWeb(response.body as WebReadableStream).pipe(res);
  } catch {
    res.status(502).json({ error: 'PHOTO_PROXY_ERROR' });
  }
}
