#!/bin/sh
# Container entrypoint: apply pending database migrations before the server
# accepts traffic, then hand off to the Node process. Runs migrations explicitly
# (not via an npm pre/post lifecycle hook) so behavior does not depend on pnpm's
# enable-pre-post-scripts setting. A migration failure aborts boot (set -e).
set -e

echo "Running database migrations..."
pnpm --filter voyager-server exec node-pg-migrate up

echo "Starting server..."
exec node apps/server/dist/index.js
