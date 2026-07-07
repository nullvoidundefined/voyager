# P1: High Priority

Fix in the first work session. These are trust-breakers, layout inversions, or missing signals that undermine the portfolio impression within 2 minutes of use.

---

## Sign Anthropic DPA

Every registered user's messages are sent to Anthropic. Without a signed DPA, no GDPR data subject deletion request can be honored downstream.

**Why P1:** Self-service via Anthropic Console, 10 minutes. Removes a compliance gap.

**Scope:** Anthropic Console > sign DPA.

**Roles:** Legal

---

## Verify Google Cloud Places API Billing Cap

`docs/BILLING.md` shows the GCP billing cap as "Blocked" since 2026-04-07. 7+ weeks stale.

**Why P1:** No cap means any photo-proxy or text-search runaway hits Google's pay-as-you-go tier with no ceiling.

**Scope:** Log into GCP Billing, set the $50/month budget cutoff if the audit blocker has cleared. Update BILLING.md.

**Roles:** Financial

---

## Replace Font-Size Pixel Literals with Design Tokens

140+ raw `font-size` pixel literals scattered across SCSS modules bypass the existing `--text-*` scale tokens in `globals.scss`.

**Why P1:** The token system was built for this but components bypass it. Any new component written without checking will diverge further. A design-savvy reviewer will notice the inconsistency.

**Scope:** Replace `14px`, `13px`, `12px`, `11px` occurrences with `var(--text-sm)`, `var(--text-xs)`, etc. from the existing scale.

**Roles:** Design

---

## Fix SEC-02: Rotate Mapbox Public Token Committed in Git History

Commit `f36d7d6` added a live Mapbox public token (`pk.*`) to `web-client/.env.example`. Cleared in `f0dee63` but still retrievable via `git show f36d7d6:web-client/.env.example`. The `secret-scan.sh` hook fired twice during the security audit on this history.

**Why P1:** Token in public git history is permanently exposed. Even read-only scope allows quota exhaustion billed to the token owner. Write scopes (Tilesets, Styles, Datasets) would let an attacker modify map assets.

**Scope:** Rotate token on Mapbox dashboard. Generate a new token scoped to Maps JS API read-only with HTTP origin restriction to production URL only. Update the Railway env var. The old history token becomes inert after rotation.

**Source:** 2026-05-28 security audit (Opus)

---

## E2E Coverage Audit (2026-07-07)

Source: `docs/audits/2026-07-07-e2e-coverage-synthesis.md` (engineering + criticism, each finding verified against the code). Audit-surfaced P0/P1 E2E gaps; the first item is a live bug, not only a missing test.

### Fix the duplicate loading indicator, then guard it with an E2E

`ChatBox.tsx:333` wires `isStreaming={isSending}`, so `VirtualizedChat` renders both the `pendingIndicator` "Thinking" bar (`:246-254`) and the `thinkingIndicator` dots (`:255-266`) at the start of every turn; the dots also persist through tool-progress and streaming. Live in production. The only test on this path (`VirtualizedChat.test.tsx:110-118`) uses `isSending=false`, a combination impossible in production.

**Why P1:** A visible dual-loader on every chat turn, on the protagonist flow, in production now.

**Scope:** Test-first. Decouple `isStreaming` from `isSending`, or give the dots indicator the `pendingIndicator`'s mutual-exclusion guards. Add an E2E asserting exactly one "Thinking" indicator during a live turn and none once content streams.

**Source:** 2026-07-07 E2E coverage audit (engineering + criticism)

### E2E: a single flight selected via both writers stays one row and one budget line

Every selection E2E uses the test-only `/trips/:id/test-selections` backdoor; nothing drives the real tile-click `POST /trips/:id/selections` plus the agent `select_flight` for the same flight, the dual-write path behind the duplicate-flight / double-budget incident (dedup at `trips.ts:149-156, 210-214`). The MockAnthropic `selectFlight` scenario (commit `0bc5b4a`) drives the agent side.

**Why P1:** Directly reproduces a real production incident; the dedup fix has zero end-to-end coverage.

**Scope:** New E2E: select a flight via the tile and via the agent for the same flight; assert one `trip_flights` row and the correct sidebar budget total.

**Source:** 2026-07-07 E2E coverage audit (engineering + criticism)

### E2E: budget set in chat persists across the next turn

Invariant 17 mocks `put`, so it cannot catch two real writes colliding (the 2026-07-06 budget-revert). No E2E covers the form-auto-save-vs-agent-`update_trip` seam.

**Why P1:** Reproduces a real production incident on the budget sidebar; the fix is only unit-covered with a mocked network layer.

**Scope:** New E2E: set budget in the trip form, send a message that updates budget, assert the sidebar Total Budget shows the agent value and survives the next send.

**Source:** 2026-07-07 E2E coverage audit (engineering + criticism)

