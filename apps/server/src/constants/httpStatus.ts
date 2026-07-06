/**
 * Named HTTP status codes for response handlers, so route code never carries
 * bare numeric literals.
 */
export const HTTP_STATUS = {
  BAD_GATEWAY: 502,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  OK: 200,
  REQUEST_TIMEOUT: 408,
  SERVICE_UNAVAILABLE: 503,
} as const;
