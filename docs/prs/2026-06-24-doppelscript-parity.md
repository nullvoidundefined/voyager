# Doppelscript parity: close 20 engineering-audit gaps

**Date:** 2026-06-24
**Branch:** `feat/doppelscript-parity`
**Time since implementation:** same day (implemented and opened within hours, per `git log`).

## Summary

Implements every finding from the 2026-06-24 comparative engineering audit
(`docs/audits/2026-06-24-engineering-doppelscript-gap.md`), which used Doppelscript
(the team's most secure/stable app) as the reference and Voyager as the target.
20 findings: 6 P1, 8 P2, 6 P3 (no P0). The headline is the data-integrity work the
engagement was opened for: Voyager now has an idempotency layer and deduped booking
writes, so retried or double-submitted mutations run at most once and can no longer
double-count in the budget.

17 commits, one finding per commit (P2-03+P2-04 are inseparable; the executor
test-mock completion for P2-01 landed in the P2-02 commit via an amend).

## What changed

### Data integrity (P1-01, P1-02, P3-01, P2-01, P2-02)

- **P1-01** Idempotency-key middleware + repository + `idempotency_keys` migration + a
  GC sweep, mounted on the non-streaming trip mutation routes (`POST /`,
  `/:id/selections`, `/:id/share`). Not on the SSE chat route.
- **P1-02** Booking selections dedupe on a derived `selection_key` with
  `UNIQUE(trip_id, selection_key)` + `ON CONFLICT DO UPDATE`. Proven: selecting the
  same flight twice yields one row and `flight_cost` stays single-counted.
- **P3-01** Share links idempotent per `(trip_id, created_by)`; share queries moved
  into a `sharedTrips` repository (fixes a handler→DB layering smell).
- **P2-01** `plan_daily_schedule` writes run in one injected transaction with
  `UNIQUE(schedule_id, item_order)` so retries do not duplicate items.
- **P2-02** `UNIQUE(conversation_id, sequence)` makes message ordering a DB invariant,
  not just a runtime-lock guarantee.

### Boot-time safety (P1-03, P1-04)

- **P1-03** Schema-validated, frozen `env` module; secret reads routed through it;
  `validateProductionEnv()` fails fast at boot for missing production keys.
- **P1-04** Container entrypoint runs `node-pg-migrate up` before starting, with a
  CI smoke test guarding the migrate-before-start contract.

### Outbound resilience (P1-05, P2-05, P3-02)

- **P1-05** Anthropic client gets a 45s per-request timeout + bounded retries; the
  agent loop's `messages.stream` call is wrapped in a shared circuit breaker keyed on
  a typed `isTransientAnthropicError` predicate.
- **P2-05** Google Places fetch bounded by `AbortSignal.timeout`.
- **P3-02** Reusable `retryWithJitter` helper; applied to the Places fetch (retries
  only network/abort/timeout rejections, never an HTTP 4xx).

### Client observability (P1-06, P2-07)

- **P2-07** `posthog-js` browser sink (`clients/posthog.ts` + `TelemetryProvider`),
  consistent with the server's PostHog; no-op when unconfigured.
- **P1-06** `app/error.tsx` + `app/global-error.tsx`; `ErrorBoundary` forwards crashes
  to the sink instead of only `console.error`.

### Security + quality hygiene (P2-03, P2-04, P2-06, P2-08, P3-03, P3-04, P3-05, P3-06)

- **P2-04/P2-03** Shared `config/allowedOrigins` consumed by CORS and the CSRF guard;
  the guard now also rejects disallowed `Origin` headers.
- **P2-06** `ApiError.code` typed to a canonical `ERROR_CODES` union; inline literals replaced.
- **P2-08** Pre-push hook runs the server coverage suite and web unit tests (was
  format/lint/build only).
- **P3-04** `PUT /user-preferences` validates values (not just key names) with a zod schema.
- **P3-05** Deleted the orphan `packages/shared-types/` build output (untracked).
- **P3-06** `.node-version` + bounded `engines.node`.
- **P3-03** SameSite `lax` verified as a documented, correct choice (production proxies
  API calls same-origin via Next rewrites; `API_BASE = '/api'`). No change; not a defect.

## Architectural decisions

- **Booking dedupe via a derived `selection_key` (chosen) vs. a UNIQUE over the natural
  columns (alternative).** The natural-id columns (`amadeus_offer_id`, `google_place_id`,
  flight_number/departure_time) are nullable, so a UNIQUE over them would not dedupe rows
  with null ids. `selection_key` prefers `booking_url` and falls back to a join of the
  natural-key columns, giving a NOT-NULL key that supports multi-city trips. **Why:** robust
  against the existing nullable schema without a backfill that could collide.
- **Inject `runInTransaction` into the schedule tool (chosen) vs. importing
  `withTransaction` directly (alternative).** Keeps the tool DB-agnostic and the executor
  importing only repositories (preserves layering R-224); the repository owns the transaction
  runner. **Why:** testable with a pass-through double, no layer inversion.
- **Per-request timeout + circuit breaker for Anthropic (chosen) vs. provider failover
  (alternative, what Doppelscript does).** Voyager has no second LLM provider, so failover is
  out of scope; timeout + breaker is the realistic load-shedding shape. **Why:** bounds a hung
  call and sheds load on sustained outage without inventing a provider.
- **`validateProductionEnv()` called at boot (chosen) vs. throwing at module import
  (alternative).** A throw-at-import would break unit tests that mutate `NODE_ENV`. The lenient
  parse + explicit boot-time assertion keeps fail-fast in production without an import landmine.
- **PostHog browser SDK for client telemetry (chosen) vs. Sentry (alternative, Doppelscript's
  choice).** Matches the server's existing PostHog; no new vendor. **Why:** one telemetry vendor
  across tiers.

## Testing

- Each finding is test-first with its test in the same commit (TDD per project process).
- New integration suites (real Postgres, 11 tests): idempotency, selection dedupe, shared
  trips, schedule dedupe, message sequence. 5 additive migrations applied to the dev DB.
- Full chain green on the branch: `format:check`, `lint` (0 errors), server unit **1159**,
  web unit **256**, full build (types + server + web), integration **11/11**.

## Reflection

What I understand now that I did not at the start: the booking double-count bug and the
idempotency gap are the same data-integrity story, and the cleanest fix is a derived dedupe
key rather than leaning on the nullable provider ids. What I got wrong first: I wrapped the
Anthropic call in the breaker before realizing the executor test mocked `scheduleRepository`
and needed the new `runScheduleTransaction` export added to its mock; and an `--amend`
intended for P2-01 hit the P2-02 HEAD, folding that test-mock fix into the wrong commit
(functionally fine, noted for honesty). The one deliberate omission: the `packageManager`
`+sha512` integrity hash (P3-06), which needs the real published hash via `corepack use` +
network and cannot be safely hand-written.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
