#!/usr/bin/env bash
#
# e2e-precheck.sh
#
# Runs before the pre-push e2e fast lane. Verifies that the local
# Postgres and Redis dependencies are reachable. If either is down,
# print a helpful message and exit non-zero so the developer fixes
# the environment before Playwright tries to boot the server.

set -e

PG_HOST="${PGHOST:-localhost}"
PG_PORT="${PGPORT:-5432}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"

fail() {
  echo ""
  echo "❌ e2e-precheck failed: $1"
  echo ""
  echo "   The pre-push e2e fast lane needs Postgres and Redis"
  echo "   running locally. Start them with:"
  echo "     brew services start postgresql@16"
  echo "     brew services start redis"
  echo ""
  exit 1
}

if ! command -v pg_isready >/dev/null 2>&1; then
  fail "pg_isready not on PATH (install postgresql client tools)"
fi

if ! pg_isready -h "$PG_HOST" -p "$PG_PORT" >/dev/null 2>&1; then
  fail "Postgres not reachable at $PG_HOST:$PG_PORT"
fi

if ! command -v redis-cli >/dev/null 2>&1; then
  fail "redis-cli not on PATH (install redis client tools)"
fi

if ! redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping >/dev/null 2>&1; then
  fail "Redis not reachable at $REDIS_HOST:$REDIS_PORT"
fi

# Verify the server can boot. Its dotenv/config import only finds
# server/.env when run from the server/ directory, so an empty
# worktree (which never had .env copied in) would crash later
# with "DATABASE_URL is required". Catch that here.
if [ ! -f "server/.env" ]; then
  fail "server/.env is missing (worktrees do not inherit .env from main)"
fi

echo "✓ e2e-precheck: Postgres, Redis, and server/.env are present"
exit 0
