/**
 * Thin fetch wrapper for the Voyager API. Centralizes the base URL, credentialed
 * cookie auth, CSRF header, and JSON error normalization (ApiError) so callers
 * never repeat fetch boilerplate or per-call error parsing.
 */

// In production, use the rewrite proxy (/api/) so cookies are same-origin
// and not blocked by Safari ITP. In dev, hit the Express server directly.
export const API_BASE =
  process.env.NODE_ENV === 'production'
    ? '/api'
    : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001');

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T | undefined> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body?.message ?? body?.error?.message ?? `Request failed (${res.status})`,
      body?.error,
    );
  }

  if (res.status === 204) {
    return undefined;
  }
  return res.json() as Promise<T>;
}

export function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' }) as Promise<T>;
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }) as Promise<T>;
}

export function put<T = void>(
  path: string,
  body?: unknown,
): Promise<T | undefined> {
  return request<T>(path, {
    method: 'PUT',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function del<T = void>(path: string): Promise<T | undefined> {
  return request<T>(path, { method: 'DELETE' });
}
