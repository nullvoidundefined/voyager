#!/usr/bin/env bash
# Deploys the server to Railway.
# Writes the current git SHA to src/data/version.json before uploading
# so /health/ready can report the deployed commit.
set -euo pipefail

SHA=$(git rev-parse HEAD)
echo '{"commit":"'"$SHA"'"}' > apps/server/src/data/version.json
echo "Written commit SHA $SHA to apps/server/src/data/version.json"

railway up --detach
