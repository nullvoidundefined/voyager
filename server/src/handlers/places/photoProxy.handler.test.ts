import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const FAKE_API_KEY = 'test-google-api-key-12345';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
vi.stubEnv('GOOGLE_PLACES_API_KEY', FAKE_API_KEY);

const { photoProxyHandler } =
  await import('app/handlers/places/photoProxy.handler.js');

function mockReq(query: Record<string, string> = {}) {
  return { query } as any;
}

function mockRes() {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
    pipe: vi.fn(),
  };
  return res;
}

describe('photoProxyHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when ref is missing', async () => {
    const req = mockReq({});
    const res = mockRes();

    await photoProxyHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'MISSING_PARAM',
      message: 'ref is required',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does NOT include API key in the URL query string', async () => {
    const body = Readable.toWeb(Readable.from(Buffer.from('fake-image')));
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'image/jpeg' }),
      body,
    });

    const req = mockReq({ ref: 'places/abc/photos/xyz', maxwidth: '800' });
    const res = mockRes();

    await photoProxyHandler(req, res);

    const calledUrl: string = mockFetch.mock.calls[0]![0];
    expect(calledUrl).not.toContain('key=');
    expect(calledUrl).not.toContain(FAKE_API_KEY);
  });

  it('sends the API key in the X-Goog-Api-Key header', async () => {
    const body = Readable.toWeb(Readable.from(Buffer.from('fake-image')));
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'image/jpeg' }),
      body,
    });

    const req = mockReq({ ref: 'places/abc/photos/xyz' });
    const res = mockRes();

    await photoProxyHandler(req, res);

    const fetchOptions = mockFetch.mock.calls[0]![1];
    expect(fetchOptions).toBeDefined();
    expect(fetchOptions.headers).toBeDefined();
    expect(fetchOptions.headers['X-Goog-Api-Key']).toBe(FAKE_API_KEY);
  });

  it('constructs the correct URL without the key param', async () => {
    const body = Readable.toWeb(Readable.from(Buffer.from('fake-image')));
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'image/jpeg' }),
      body,
    });

    const req = mockReq({ ref: 'places/abc/photos/xyz', maxwidth: '600' });
    const res = mockRes();

    await photoProxyHandler(req, res);

    const calledUrl: string = mockFetch.mock.calls[0]![0];
    expect(calledUrl).toBe(
      'https://places.googleapis.com/v1/places/abc/photos/xyz/media?maxWidthPx=600',
    );
  });

  it('returns upstream error status on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    const req = mockReq({ ref: 'places/abc/photos/xyz' });
    const res = mockRes();

    await photoProxyHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'PHOTO_FETCH_FAILED' });
  });

  it('returns 502 on fetch exception', async () => {
    mockFetch.mockRejectedValue(new Error('network error'));

    const req = mockReq({ ref: 'places/abc/photos/xyz' });
    const res = mockRes();

    await photoProxyHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({ error: 'PHOTO_PROXY_ERROR' });
  });

  // SEC-01: ref validation and maxwidth clamping (2026-04-06 audit).
  describe('SEC-01 input hardening', () => {
    it('returns 400 when ref does not match Google Places photo format', async () => {
      const malformedRefs = [
        '../../../etc/passwd',
        'https://evil.com/photos/x',
        'places/<script>alert(1)</script>/photos/a',
        'places/abc/photos/../../other',
        '; rm -rf',
        'a'.repeat(600),
      ];

      for (const ref of malformedRefs) {
        vi.clearAllMocks();
        const req = mockReq({ ref });
        const res = mockRes();
        await photoProxyHandler(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(mockFetch).not.toHaveBeenCalled();
      }
    });

    it('accepts well-formed Google Places photo references', async () => {
      const body = Readable.toWeb(Readable.from(Buffer.from('fake-image')));
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'image/jpeg' }),
        body,
      });

      const req = mockReq({
        ref: 'places/ChIJN1t_tDeuEmsRUsoyG83frY4/photos/AcJnMuH3xzL',
      });
      const res = mockRes();
      await photoProxyHandler(req, res);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('clamps maxwidth to the 64-1600 range', async () => {
      const body = Readable.toWeb(Readable.from(Buffer.from('fake-image')));
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'image/jpeg' }),
        body,
      });

      // Huge value: should clamp to 1600
      const req = mockReq({
        ref: 'places/abc/photos/xyz',
        maxwidth: '99999',
      });
      const res = mockRes();
      await photoProxyHandler(req, res);
      const calledUrl: string = mockFetch.mock.calls[0]![0];
      expect(calledUrl).toContain('maxWidthPx=1600');
    });

    it('clamps tiny maxwidth values up to 64', async () => {
      const body = Readable.toWeb(Readable.from(Buffer.from('fake-image')));
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'image/jpeg' }),
        body,
      });

      const req = mockReq({
        ref: 'places/abc/photos/xyz',
        maxwidth: '1',
      });
      const res = mockRes();
      await photoProxyHandler(req, res);
      const calledUrl: string = mockFetch.mock.calls[0]![0];
      expect(calledUrl).toContain('maxWidthPx=64');
    });
  });
});
