# Stop the production smoke from depending on live SerpApi (#60)

**Date:** 2026-06-25
**Branch:** `fix/prod-smoke-mock-serpapi`
**Closes:** #60

## Summary

The Post-Deploy Health Check workflow failed on every run for days. The `health-check` job passed; the `e2e-production` job failed. Root cause: `e2e/production/smoke.spec.ts` had an `agent turn: trip creation and tile response` test that, against the **live** deployment, drove the agent and waited 120s for a real flight/hotel tile to render. That depends on live SerpApi results, and SerpApi's free tier is 250 searches/month, burned on every deploy. So the gate flaked on quota/agent timing, not on any code regression.

This also violated `playwright.production.config.ts`'s own stated contract ("public pages, no auth, no agent calls, zero API cost").

## What changed

- **Removed the live-SerpApi `creation-and-tile-response` test** from the production smoke. Its deterministic equivalent already exists in the mocked e2e lane: `e2e/chat-booking-flow.spec.ts` US-22 asserts `[data-tile-card="flight"]` / `[data-tile-card="hotel"]` under `E2E_MOCK_TOOLS=1`, where flight/hotel results are mocked. The tile-card assertion is therefore still covered, against mocked SerpApi, just not against live quota.
- **Trimmed `trip persists across sessions`** to not send an agent message. Persistence is established by `POST /trips`, and the test keys its list assertion off the created `tripId`, so it never needed to drive a live search.
- **Updated the config doc comment** (per request): the production smoke has moved beyond public pages. It now documents that the lane covers public pages plus authenticated reachability and trip persistence, and deliberately does not drive live agent search (that lives, mocked, in the fast lane).

Net effect: the production smoke makes zero live SerpApi calls, so it is deterministic and quota-free, while the agent/tile coverage remains via the mocked fast lane.

## Architectural decisions

- **Rely on the existing mocked fast-lane coverage rather than add a prod-reachable mock seam (chosen).** The production smoke runs against the live deployment, where SerpApi is called server-side; you cannot mock it from Playwright (browser-side) without reconstructing the SSE agent stream, and adding a production env flag or test-only endpoint that serves mock search data risks shipping fake data to real users. Since `chat-booking-flow.spec.ts` already exercises the tile flow deterministically under `E2E_MOCK_TOOLS`, the correct fix is to stop duplicating that flow against live quota, not to invent a prod mock path.
- **Kept the production smoke driving real auth + persistence (not reverted to public-only).** Matches the intent that the smoke has grown beyond public pages; those paths are deterministic and cost nothing.

## Testing

- `e2e/production/smoke.spec.ts` retains all public-page and authenticated-reachability tests plus the (now search-free) persistence test; the only removed coverage (live tile rendering) is covered mocked in `chat-booking-flow.spec.ts`.
- Lint: e2e specs are in the eslint ignore set; the fast lane (`e2e/`, separate testDir) is unaffected by this change to `e2e/production/`.
- The live-prod smoke can only be exercised by the post-deploy workflow against the deployment; this change removes its dependency on live SerpApi.

## Reflection

The failing gate was not a code regression but a test-design problem: a per-deploy gate asserting on a live, paid, quota-limited dependency. The deterministic coverage already existed in the mock lane; the live duplicate only added flakiness and cost.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
