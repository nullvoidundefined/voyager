# P2: Medium Priority

All code-side P2 items shipped. Remaining work is either follow-up to user-action or extension of work already landed.

---

## Engineering Audit (2026-07-06)

### F-02: eval tests regress the package `__tests__/` convention (R-313/R-314)

Nine co-located `*.test.ts` in `eval/src/adversarial/` plus `eval/src/scoring/assertions.test.ts`, while `eval/src/__tests__/` already exists with three tests. Move the co-located files into `eval/src/__tests__/` mirroring source paths.

### F-04: inventory confidence re-verification has no production caller

`adjustInventoryConfidence.ts` (spec section 4.3) is exported and tested but nothing in the serving path calls it, so KB confidence never decays/corrects in production. Wire it into the segment search flow or defer the spec section explicitly.

### F-05: `confirmedOfferIds` dead plumbing in NodeRenderer

`apps/client/web/src/components/ChatBox/NodeRenderer.tsx:27-29` self-documents dead props ("no producer exists today"). Wire or delete.

---

## Manual / user-action follow-ups

### Run cross-model judge validation

Infrastructure shipped: `eval/src/adversarial/cross-model-judge.ts` reruns the adversarial eval across Haiku 4.5, Sonnet 4 20250514, and Opus 4.7 (override via `EVAL_JUDGE_MODELS`), prints the spread, and exits non-zero with a 'report as a range' message when spread > 0.05.

**Scope:** With `ANTHROPIC_API_KEY` set and budget for ~3x normal adversarial eval cost, run `pnpm --filter voyager-eval eval:cross-model-judge`. Record the spread. If spread > 0.05, update the README's published pass-rate to a range. If <= 0.05, the lock-in concern is retracted; note that in the audit follow-up file.

---

## E2E follow-ups (B24 continuation)

The MockAnthropic infrastructure now supports persistent server-side selections via the `selectFlight` scenario (commit `0bc5b4a`). Two more scenarios are needed to fully restore the deleted E2E specs:

### US-19: travel_plan_form scenario

The agent should emit `update_trip` tool_use when the form payload arrives, then `format_response` to acknowledge. Add a `formFill` scenario keyed on the form-derived "I want to go to X, ..." message shape.

### US-36: plan_card scenario

The agent should emit a `format_response` containing a `plan_card` node on the first turn after trip details are collected, then wait for `planConfirmation` to advance. Add a `planCard` scenario that detects the absence of `plan_confirmed` in the booking_state and emits the plan card; once confirmed, advances to the search step.

Once these two scenarios exist, restore US-19, US-23, and US-36 in `e2e/chat-booking-flow.spec.ts` and remove the `void tripUrl;` guard in `e2e/real/happy-path-real.spec.ts:169`.

## ENR-01: state_dept advisory source returns HTML, JSON.parse fails every turn

`apps/server/src/services/external/enrichmentSources/stateDept.ts` logs `SyntaxError: Unexpected token '<'` on every chat turn (seen throughout eval run 2026-07-06); the endpoint now serves an HTML page. Enrichment degrades silently. Add a content-type check and either fix the endpoint or drop the source.

## E2E Coverage Audit (2026-07-07)

Source: `docs/audits/2026-07-07-e2e-coverage-synthesis.md`. Audit-surfaced P2 E2E gaps.

### E2E: agent/tool error and quota states render a Toast, not a stuck UI

No E2E forces a null tool result, quota exhaustion, or Anthropic overload mid-conversation, despite the real F-03 crash in that class.

**Why P2:** A whole error class with zero end-to-end coverage; a stuck spinner on the protagonist flow reads as broken.

**Scope:** New E2E forcing each error via the mock; assert a Toast appears and the input re-enables (no stuck spinner).

**Source:** 2026-07-07 E2E coverage audit (criticism)

### E2E: hotel and experience map pins center near the destination

`tripMapPins.ts` free-text-geocodes hotels (`:54`) and experiences (`:71`) unconstrained; only airports use the backend IATA endpoint. Lower severity than the airport case (hotel names resolve), but no regression test or destination-anchored fallback.

**Why P2:** Same failure family as the Iloilo-City map bug, one layer over.

**Scope:** Coverage that a known hotel geocodes near the trip destination, not elsewhere.

**Source:** 2026-07-07 E2E coverage audit (engineering)

### E2E: checkout confirmation total equals the sum of selections

`checkout.spec.ts` US-26 checks line-item presence but never asserts the dialog total equals the sum of seeded prices, the surface a double-count would show on.

**Why P2:** Cheap assertion on the exact spot a budget defect becomes visible before save.

**Scope:** Extend `checkout.spec.ts` to assert the computed total equals the known sum of `defaultSelections()`.

**Source:** 2026-07-07 E2E coverage audit (engineering)

### US-19 / US-23 / US-36 restoration reaffirmed

The deleted form-fill and tile-confirm specs are covered by "E2E follow-ups (B24 continuation)" above. The 2026-07-07 audit reaffirms their value; tracked there, not duplicated here.
