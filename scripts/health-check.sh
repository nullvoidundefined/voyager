#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:?Usage: health-check.sh <base-url> [frontend-url]}"
FRONTEND_URL="${2:-}"
FAILURES=0

check() {
  local description="$1"
  local url="$2"
  local expected_status="$3"
  local body_check="${4:-}"

  response=$(curl -s -o /tmp/hc_body -w "%{http_code}" "$url" \
    -H "Origin: ${FRONTEND_URL:-http://localhost:3000}" \
    -H "X-Requested-With: XMLHttpRequest" \
    -b /tmp/hc_cookies -c /tmp/hc_cookies \
    --max-time 10 2>/dev/null || echo "000")

  if [ "$response" != "$expected_status" ]; then
    echo "FAIL: $description, expected $expected_status, got $response"
    FAILURES=$((FAILURES + 1))
    return
  fi

  if [ -n "$body_check" ]; then
    if ! grep -q "$body_check" /tmp/hc_body 2>/dev/null; then
      echo "FAIL: $description, response body missing '$body_check'"
      FAILURES=$((FAILURES + 1))
      return
    fi
  fi

  echo "PASS: $description"
}

check_cors() {
  local url="$1"
  local origin="${FRONTEND_URL:-http://localhost:3000}"

  cors_header=$(curl -s -D - -o /dev/null "$url" \
    -H "Origin: $origin" \
    --max-time 10 2>/dev/null | grep -i "access-control-allow-origin" || echo "")

  if echo "$cors_header" | grep -q "$origin"; then
    echo "PASS: CORS allows $origin"
  else
    echo "FAIL: CORS missing Access-Control-Allow-Origin for $origin"
    FAILURES=$((FAILURES + 1))
  fi
}

check_login_rejects_bad_creds() {
  # This app uses origin-based CSRF (csrfGuard middleware validates the Origin
  # header against an allowlist); there is no CSRF-token endpoint. Send a valid
  # Origin so the guard passes, then bad credentials should yield 401.
  login_status=$(curl -s -o /tmp/hc_body -w "%{http_code}" \
    -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -H "X-Requested-With: XMLHttpRequest" \
    -H "Origin: ${FRONTEND_URL:-http://localhost:3000}" \
    -d '{"email":"smoke@test.invalid","password":"wrongpassword"}' \
    --max-time 10 2>/dev/null || echo "000")

  if [ "$login_status" = "401" ]; then
    echo "PASS: Login rejects bad credentials with 401"
  else
    echo "FAIL: Login with bad creds returned $login_status (expected 401)"
    FAILURES=$((FAILURES + 1))
  fi
}

rm -f /tmp/hc_body /tmp/hc_cookies

echo "=== Health checks for $BASE_URL ==="
check "GET /health" "$BASE_URL/health" "200" "ok"
check "GET /health/ready (db)" "$BASE_URL/health/ready" "200" '"db":"connected"'
check "GET /health/ready (cache)" "$BASE_URL/health/ready" "200" '"cache":"connected"'
check "GET /health/ready (commit)" "$BASE_URL/health/ready" "200" '"commit":"'

check_cors "$BASE_URL/health/ready"
check_login_rejects_bad_creds

if [ -n "$FRONTEND_URL" ]; then
  echo ""
  echo "=== Frontend checks for $FRONTEND_URL ==="
  check "GET /" "$FRONTEND_URL" "200"
  check "GET /login" "$FRONTEND_URL/login" "200"
fi

echo ""
if [ "$FAILURES" -gt 0 ]; then
  echo "RESULT: $FAILURES check(s) failed"
  rm -f /tmp/hc_body /tmp/hc_cookies
  exit 1
else
  echo "RESULT: All checks passed"
  rm -f /tmp/hc_body /tmp/hc_cookies
  exit 0
fi
