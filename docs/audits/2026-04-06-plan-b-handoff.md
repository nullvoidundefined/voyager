# Plan B Handoff: E2E Coverage and Test Gates

**Branch:** `plan/e2e-and-gates-2026-04-06`
**Date:** 2026-04-06
**Source plan:** `docs/superpowers/plans/2026-04-06-voyager-plan-b-e2e-and-gates.md`

## Summary

Plan B builds the E2E test coverage backbone and wires it into pre-push and CI test gates. Every user story (US-1 through US-35) now has a Playwright test, three end-to-end journey tests exercise the canonical user paths, and a separate nightly workflow runs a small real-API smoke suite against live SerpApi, Google Places, and Anthropic.

## Exit metrics

| Metric                           | Target | Actual |
| -------------------------------- | ------ | ------ |
| Story tests with `US-N:` prefix  | 35     | 35     |
| Unique US IDs covered            | 35     | 35     |
| Journey tests in `e2e/journeys/` | 3      | 3      |
| Real-API smoke tests             | 1+     | 1      |
| `pnpm build`                     | green  | green  |
| `pnpm lint` errors               | 0      | 0      |

## Tests marked `test.fixme`

Ten tests are marked `test.fixme` pending Plan C follow-up work. They establish the contract. When the underlying selectors stabilize, the markers can be removed.

| Spec                        | Test                                  | Reason                                 |
| --------------------------- | ------------------------------------- | -------------------------------------- |
| `chat-booking-flow.spec.ts` | US-19 fill trip details form          | No stable form-field naming convention |
| `chat-booking-flow.spec.ts` | US-22 browse tile cards               | Tile-card data attributes pending      |
| `chat-booking-flow.spec.ts` | US-23 select and confirm tile         | Tile-card data attributes pending      |
| `chat-booking-flow.spec.ts` | US-24 use quick reply chips           | Quick-reply chip selectors pending     |
| `checkout.spec.ts`          | US-25 open booking confirmation modal | Depends on chat-flow stability         |
| `checkout.spec.ts`          | US-26 review itemized breakdown       | Depends on chat-flow stability         |
| `checkout.spec.ts`          | US-27 confirm and book trip           | Depends on chat-flow stability         |
| `checkout.spec.ts`          | US-28 booked trip locked state        | Depends on chat-flow stability         |
| `preferences.spec.ts`       | US-30 navigate through wizard steps   | Wizard step selectors pending          |
| `preferences.spec.ts`       | US-32 incomplete preferences badge    | Badge data attribute pending           |

## Files added

- `e2e/fixtures/`: `mock-serpapi.ts`, `mock-google-places.ts`, `test-users.ts`
- `e2e/helpers/`: `auth.ts`, `chat.ts`, `trip.ts`
- `e2e/`: `public-pages.spec.ts`, `trip-management.spec.ts`, `chat-booking-flow.spec.ts`, `checkout.spec.ts`, `preferences.spec.ts`, `account.spec.ts` (auth.spec.ts rewritten)
- `e2e/journeys/`: `happy-path-booking.spec.ts`, `returning-user-iterates.spec.ts`, `failure-path.spec.ts`
- `e2e/real-apis/`: `smoke.spec.ts`
- `playwright.config.real-apis.ts`
- `scripts/e2e-precheck.sh`
- `.github/workflows/e2e.yml`
- `.github/workflows/e2e-real-apis.yml`

## Files modified

- `playwright.config.ts`: chromium project, absolute testDir, html reporter under CI, testIgnore for real-apis
- `package.json`: `test:e2e` and `test:e2e:fast` scripts
- `lefthook.yml`: pre-push gains `e2e-precheck` and `e2e-fast`
- `eslint.config.bottomlessmargaritas.js`: ignore `playwright.config.real-apis.ts`
- `server/src/tools/mock/isMockMode.ts`: recognizes `E2E_MOCK_TOOLS=1`

## Open follow-ups for Plan C

1. Stabilize tile-card data attributes so the four chat-flow `test.fixme` tests can be unblocked.
2. Standardize the trip-details form field naming so US-19 unblocks.
3. Add a `data-testid` on the preferences wizard step container so US-30 unblocks.
4. Add a `data-testid` on the incomplete-preferences badge so US-32 unblocks.
5. The legacy `web-client/e2e/*.spec.ts` files predate Plan B and should be deleted or migrated. They are no longer the source of truth.
6. CI: add the `e2e` job as a required check on `main` branch protection (manual GitHub settings step).
