import { cacheGet, cacheSet } from "app/services/cache.service.js";
import { logger } from "app/utils/logs/logger.js";

const TOKEN_CACHE_KEY = "amadeus:token";
const TOKEN_TTL_BUFFER_SECONDS = 60; // refresh 60s before expiry

function getConfig() {
  const clientId = process.env.AMADEUS_CLIENT_ID;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET;
  const baseUrl = process.env.AMADEUS_BASE_URL || "https://test.api.amadeus.com";

  if (!clientId || !clientSecret) {
    throw new Error("AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET are required");
  }

  return { clientId, clientSecret, baseUrl };
}

export async function getAccessToken(): Promise<string> {
  const cached = await cacheGet<string>(TOKEN_CACHE_KEY);
  if (cached) return cached;

  const { clientId, clientSecret, baseUrl } = getConfig();

  const response = await fetch(`${baseUrl}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error({ status: response.status, body: text }, "Amadeus auth failed");
    throw new Error(`Amadeus auth failed: ${response.status}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  const ttl = Math.max(data.expires_in - TOKEN_TTL_BUFFER_SECONDS, 60);

  await cacheSet(TOKEN_CACHE_KEY, data.access_token, ttl);
  logger.info({ expiresIn: data.expires_in }, "Amadeus token refreshed");

  return data.access_token;
}

async function refreshToken(): Promise<string> {
  // Clear cached token by setting a short TTL, then fetch fresh
  await cacheSet(TOKEN_CACHE_KEY, null, 1);
  // Reset so next getAccessToken call fetches fresh
  const { clientId, clientSecret, baseUrl } = getConfig();

  const response = await fetch(`${baseUrl}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Amadeus token refresh failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  const ttl = Math.max(data.expires_in - TOKEN_TTL_BUFFER_SECONDS, 60);
  await cacheSet(TOKEN_CACHE_KEY, data.access_token, ttl);

  return data.access_token;
}

export async function amadeusGet(
  endpoint: string,
  params: Record<string, string | number | undefined>,
  retries = 1,
): Promise<unknown> {
  const { baseUrl } = getConfig();
  const token = await getAccessToken();

  const queryString = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");

  const url = `${baseUrl}${endpoint}${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401 && retries > 0) {
    logger.warn("Amadeus 401 — refreshing token and retrying");
    const freshToken = await refreshToken();
    const retryResponse = await fetch(url, {
      headers: { Authorization: `Bearer ${freshToken}` },
    });

    if (!retryResponse.ok) {
      const text = await retryResponse.text();
      throw new Error(`Amadeus API error after retry: ${retryResponse.status} ${text}`);
    }

    return retryResponse.json();
  }

  if (response.status === 429 && retries > 0) {
    logger.warn("Amadeus 429 rate limit — retrying after delay");
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000));
    return amadeusGet(endpoint, params, retries - 1);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Amadeus API error: ${response.status} ${text}`);
  }

  return response.json();
}
