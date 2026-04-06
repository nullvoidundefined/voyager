# Voyager Engineering Audit

**Date:** 2026-04-06
**Auditor:** Engineering (CTO role)
**Branch / worktree:** `agent-a23ae2b5` (from `main`, tip `f505467`)
**Scope:** `server/`, `web-client/`, `packages/shared-types`, `eval/`, `e2e/`, Dockerfile, Railway config, GitHub Actions, lefthook hooks, last 80 commits

---

## Executive Summary

Voyager is in a better state than most apps at this stage. It has a reasonable layered backend, a Zod-validated tool executor, a circuit breaker around SerpApi, a wall-clock timeout on the agent loop, CI with Postgres + Redis service containers, unit and integration tests that actually run in CI, and a post-deploy health check workflow. The authors have clearly been iterating on discipline (rate limiter, conversation lock, graceful Redis degradation, logging standardization).

That said, there are three categories of problem that a CTO should block on:

1. **E2E coverage is effectively nil.** Only two Playwright files exist (`e2e/auth.spec.ts`, `e2e/navigation.spec.ts`), and neither is wired to CI. The critical path, the agentic chat loop, has zero E2E coverage. Git history (commit `334b41c`, `32fd054`) claims extensive E2E tests were added, but those files are not in the tree on `main` today. Spec-vs-reality drift.
2. **Bug-fix discipline is optimism-driven.** In the last ~60 commits, 13 of 20 commits tagged `fix:` ship without any accompanying test change. That is a P1 behavioral finding per the canonical role. The project `CLAUDE.md` explicitly mandates "test first, not optimism" and the team is not following it.
3. **Spec-vs-implementation drift around Amadeus.** `server/src/schemas/trips.ts` still carries `amadeus_offer_id` and `amadeus_hotel_id` on `TripFlight` / `TripHotel` interfaces (lines 43, 61), and three migrations (`1771879388545/6`, `1771879388549`) reference Amadeus columns and cache providers, but there is no Amadeus client code anywhere in `server/src/`. Either finish the integration or excise the dead schema surface; right now it's a landmine for future developers.

Top 3 blockers (P0 / P1):

- **P1:** E2E test coverage for the chat/agent loop does not exist and is not wired to CI. The one feature this app exists to showcase has no end-to-end verification.
- **P1:** Unpaired bug-fix commits (13 in the last 30 days). The project's own rulebook is being violated, and every unpaired fix is a bug that can silently come back.
- **P1:** Dead Amadeus schema surface in the trip schemas + migrations with no implementation behind it. Fix: either delete the columns in a new migration and drop the TS fields, or implement the Amadeus client.

---

## Operational Basics

| Item                         | Status       | Notes                                                                                                                                           |
| ---------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit tests run in CI         | YES          | `.github/workflows/ci.yml` runs `pnpm test:coverage` with Postgres + Redis services                                                             |
| Integration tests run in CI  | YES          | `pnpm --filter agentic-travel-agent-server run test:integration` in the same job                                                                |
| E2E tests exist              | PARTIAL / P1 | Only `e2e/auth.spec.ts` and `e2e/navigation.spec.ts`. No chat, trips, checkout, preferences, or account flows                                   |
| E2E tests wired to CI        | NO / P1      | `pnpm test:e2e` is not invoked anywhere in `.github/workflows/ci.yml`. `playwright.config.ts` exists but nothing runs it                        |
| Linting in CI                | YES          | `pnpm lint` and `pnpm format:check` both run                                                                                                    |
| Build verified in CI         | YES          | `pnpm --filter agentic-travel-agent-server build`                                                                                               |
| Coverage thresholds enforced | YES          | per commit `acc9645`                                                                                                                            |
| Smoke test script            | MISSING / P2 | `scripts/smoke-test.sh` is referenced from `package.json` but was not located in `scripts/`. Verify on main                                     |
| Post-deploy health check     | YES          | `.github/workflows/post-deploy.yml` checks `/health`, CORS, `/`, `/login`, opens issue on failure                                               |
| Error tracking (Sentry)      | NO / P2      | No Sentry integration found in `server/src/` or `web-client/src/`. A multi-step agent loop without error tracking is guesswork during incidents |
| Rollback plan documented     | NO / P3      | `CLAUDE.md` covers deploy but not rollback. Railway has built-in rollback, but the procedure is not written down                                |
| Pre-commit / pre-push hooks  | YES          | `lefthook.yml` enforces format, lint, build on pre-push; format + lint on pre-commit                                                            |

**Blockers:** E2E gap and missing Sentry / error tracking are the two operational basics you should not ship without. E2E is P1 because the chat loop is the product. Sentry is P2 because logs-plus-post-deploy-check partially mitigates the gap.

---

## Architecture & Design

**Layering (server).** Handlers → services → repositories → db is clean. `server/src/handlers/chat/chat.ts` correctly delegates to `agent.service.ts`, which delegates to `AgentOrchestrator`, which delegates to `executor.ts`. No handler reaches into the db directly. Good.

**AgentOrchestrator.** `server/src/services/AgentOrchestrator.ts` is well-structured. It:

- Enforces `DEFAULT_MAX_ITERATIONS = 15` (line 7) per spec.
- Enforces a wall-clock timeout (`DEFAULT_MAX_DURATION_MS = 120_000`, line 10) added in commit `f6168a0`.
- Accepts a custom Anthropic client (`config.client`, line 68) for testing. Good injection point.
- Catches tool executor errors and feeds them back as `tool_result` blocks with `is_error: true` (line 261). Correct Anthropic SDK pattern.
- Emits tool progress and text deltas over SSE.

One concern: the tool-call limit check (line 174) looks at `toolCalls.length + toolUseBlocks.length > this.maxIterations`. If a single model turn emits 5 tool uses and we are already at 14, we stop the whole batch and return the "reached the tool call limit" message without executing any of them. That is conservative and safe, but the returned `toolCallsUsed` and `nodes` arrays lose that partial progress visibility. Not a bug, just worth noting. P3.

**Adapter injection for E2E / eval.** The user asked whether the tool executor supports adapter injection so E2E can swap SerpApi / Google Places for mocks. The current mechanism is `EVAL_MOCK_SEARCH=true` checked inside each individual tool (`flights.tool.ts` line 103, `hotels.tool.ts`, `experiences.tool.ts`, `car-rentals.tool.ts`). That works for the `eval/` package, but it is env-global and not a proper injection seam:

- The executor itself (`server/src/tools/executor.ts`) has no `adapter` / `dependencies` parameter. It imports `searchFlights` etc. at the top of the file.
- You cannot run an E2E with real flight logic and mocked hotel logic, for example.
- `onToolExecuted` and `toolExecutor` ARE injectable at the orchestrator level, so a Playwright test setup could inject a fake executor that bypasses all real tools. That is enough for E2E but is not currently used.

**Verdict:** Adapter injection is adequate but undocumented. Add a test helper like `createMockToolExecutor()` and wire it into `playwright.config.ts` via an env flag. P2, not P1, because the seam exists.

**Monorepo hygiene.** Clean. `pnpm-workspace.yaml` declares `server`, `web-client`, `packages/shared-types`, `eval`. `@agentic-travel-agent/shared-types` is consumed via `workspace:*` in both apps. No type duplication found.

**Naming drift.** The project was renamed "Agentic Travel Agent → Voyager" in commit `f505467`, but package names (`agentic-travel-agent-server`, `agentic-travel-agent-web`, `@agentic-travel-agent/shared-types`) and railway link IDs in `CLAUDE.md` still say `agentic-travel-agent`. The path is `/production/voyager/`. Inconsistent names cost future grep attempts. P3.

---

## Code Quality

- **Handler size.** `chat.ts` is 251 lines; most of the logic was extracted into `chat.helpers.ts` (commit `b898769`). Reasonable.
- **Dead / drift code.** `TripFlight.amadeus_offer_id` and `TripHotel.amadeus_hotel_id` in `server/src/schemas/trips.ts`, plus three migrations referencing Amadeus. No implementation. P1 (separate finding, Spec-vs-implementation).
- **Error handling.** Standardized on `ApiError` (commit `7b1b262`). Good.
- **Logging.** Pino with structured fields, `requestId` propagation to external API calls (commit `65af76a`). Good.
- **Magic numbers.** `DEFAULT_MAX_ITERATIONS = 15`, `DEFAULT_MAX_DURATION_MS = 120_000`, `DEFAULT_MAX_TOKENS = 4096` are top-of-file constants. Fine.
- **Chat handler `req.socket.setTimeout(150_000)` (line 80).** 150s is longer than the agent's 120s wall clock, good. But this is a magic number duplicated across files. Consider importing from a shared constants file. P3.
- **In-memory `activeConversations` set (line 34).** Works for a single server instance. If Voyager scales horizontally (multi-replica Railway), conversation locking breaks silently: two replicas will let the same conversation run twice. There is a TODO in `chatRateLimiter` about moving to Redis; `activeConversations` has no such TODO. P2.

---

## Security

- **CSRF guard** (`csrfGuard.ts`): header-based (`X-Requested-With`). Simple, acceptable for same-site cookie auth. Not token-based. Consistent with the "header-only" pattern mentioned in ISSUES.md.
- **Rate limiting.** IP-based global rate limiter (100 req / 15 min), per-user chat limit (10 req / 5 min), auth limit (10 req / 15 min). Good. Note: rate limiter storage is in-memory, and the code emits a production warning if `RATE_LIMIT_STORAGE_URI` is missing. That is still a production risk on a multi-replica Railway service. P2.
- **Input validation.** Zod on all LLM tool inputs (`executor.ts`) per commit `f788dd8`. Good.
- **Prompt injection.** Not reviewed in depth; user input flows into `buildClaudeMessages`. Recommend adding a prompt-injection review as a follow-up.
- **Helmet, CORS, cookie-parser** all in place (`app.ts` lines 42-65).
- **Body size limit** `10kb` (lines 54, 57). Good.
- **Google Places API key** was moved from query string to header in commit `81f92d4`. Good fix.
- **Supabase Auth** is the documented stack, but this app appears to use its own session-based auth. Check that session secrets are rotated and that `SESSION_SECRET` is not committed anywhere. (Not reviewed here; flag for security audit.)

---

## Database

- **Driver.** Raw `pg` per conventions. No ORM. Good.
- **Migrations.** 17 migrations in `server/migrations/`, sequential timestamps, idiomatic `node-pg-migrate` style. CI runs `migrate:up` before tests.
- **Amadeus columns.** Migrations `1771879388545_create-trip-flights-table.js`, `1771879388546_create-trip-hotels-table.js`, and `1771879388549_create-api-cache-table.js` reference Amadeus concepts. Schema drift from product pivot. Add a `...remove-amadeus-columns.js` migration if the integration is dead.
- **Transactions.** Commit `573e974` wrapped `clearSelectionsForTrip` in a transaction. Good. Spot-check other multi-row selection inserts for atomicity (not audited exhaustively).
- **Indexing.** Not reviewed. Recommend a separate pass on `tool_call_log` and `api_cache` indexing given the write volume.

---

## API Design

- Routes under `/auth`, `/places`, `/trips`, `/user-preferences`. Clean.
- Chat endpoint is `/trips/:id/chat` (inferred from `chat.ts`), uses SSE with a `done` terminal event.
- Error responses standardized via `ApiError` → `errorHandler` middleware.
- No OpenAPI / contract file. For an app this size, that is fine. P3.

---

## Performance

- **Caching.** SerpApi responses cached in Redis with 1-hour TTL (`flights.tool.ts` line 11). Normalized cache key (alphabetical params, lowercased strings) in `cache.service.ts`. Good.
- **Cache miss behavior.** Fallback to null on failure (graceful degradation, commit `847bcb7`). Good.
- **Frontend.** Uses TanStack Query per conventions. Not deeply audited.
- **Cold start.** Not measured. Railway + Node 22 image is reasonable. The Dockerfile is multi-stage and drops dev deps for production. Good.

---

## Testing

**Unit tests.** Present at every layer. `server/src/services/agent.service.test.ts`, `AgentOrchestrator.test.ts`, `executor.test.ts`, tool tests, handler tests, repository tests, middleware tests. Vitest. 60% coverage threshold enforced.

**Integration tests.** `server/src/__integration__/auth.integration.test.ts`, `cors.integration.test.ts`. Auth and CORS are covered. **No integration test for the chat / agent endpoint itself.** That is a P2 gap, the chat endpoint is the critical path.

**E2E tests.** P1 gap per Operational Basics. Only `auth.spec.ts` and `navigation.spec.ts`. The git log shows commits `334b41c` and `32fd054` that purported to add E2E for trips, chat, checkout, preferences, and account, but those files are not on the current branch tip. Either the files were lost in a merge / rebase, or those commits never actually added the files. Investigate and restore.

**Frontend component tests.** Added in commits `e9c9bc1` and `2890a27`. Good.

**Mocking discipline.** Unit tests mock with `vi.mock()`; integration tests use real db. Spot-check: `metrics.service.test.ts` mocks `logger` correctly. `agent.service.test.ts` and `AgentOrchestrator.test.ts` both exist, which is the right place to test orchestration logic.

**Test quality.** `cache.service.test.ts` has an Amadeus reference in a test label; that is fossilized from the pivot. Minor, P3.

---

## Dependencies & Supply Chain

**Runtime (server):**

- `@anthropic-ai/sdk` ^0.80.0: check if latest (cutoff uncertain; worth bumping regularly for model feature parity)
- `express` ^5.2.1, `zod` ^4.3.6, `pg` ^8.18.0, `ioredis` ^5.10.1, `pino` ^10.3.1, `helmet` ^8.1.0: all current major lines
- `bcrypt` ^6.0.0: fine
- `express-rate-limit` ^8.2.1: fine

**Frontend:**

- `next` 15.5.14, `react` ^19.0.0, `@tanstack/react-query` ^5.95.2: all current

**Not reviewed:**

- `pnpm-lock.yaml` for outright CVEs. Recommend running `pnpm audit` in CI (not currently wired up). P2.
- Dependabot / Renovate: not found in `.github/`. P2. A repo with ~40 dependencies and no automated dependency updates will drift into CVEs within 6-12 months.

---

## Deployment & Infrastructure

**Dockerfile.server.** Multi-stage (base + production). Dev deps for build, prod-only reinstall for the runtime layer. Good.

Concerns:

- **Duplicate `pnpm install`.** The build stage runs `pnpm install --filter ... --ignore-scripts` and the production stage reruns it with `--prod`. That is correct for image size but means two lockfile resolutions per build. Acceptable.
- **No healthcheck in the Dockerfile.** `HEALTHCHECK` directive missing. Railway does its own health probe, so this is a P3.
- **`COPY server/src/data/destinations.json server/dist/data/destinations.json`** plus `COPY server/migrations server/migrations` after the build stage. This is a symptom of the bug fixed in commits `90470b1` and `bea33cc`. The Dockerfile now also mirrors the `build` script's `mkdir -p dist/data && cp src/data/*.json dist/data/`. Works, but double-copying static data is fragile. Consider making the build script the single source of truth. P3.
- **Non-root user.** The Dockerfile runs as root. `USER node` (already present in node:22-slim) would be a quick hardening win. P2.

**railway.toml.** One line: `dockerfilePath = "Dockerfile.server"`. Correct per the Railway pitfall note in `CLAUDE.md`.

**Env var hygiene.** `SESSION_SECRET`, `CSRF_SECRET`, `ANTHROPIC_API_KEY`, `SERPAPI_API_KEY`, `DATABASE_URL`, `REDIS_URL`, `CORS_ORIGIN`, `RATE_LIMIT_STORAGE_URI` are all env-driven. `dotenv` is a dependency. No secrets committed (spot-checked).

**CI.** `ci.yml` runs lint, format, build, migrations, unit tests with coverage, integration tests, all in one job with Postgres + Redis services. Single-job is fine at this size. Missing: `pnpm audit`, `pnpm test:e2e`, `npm run smoke`. P2 to add.

**Post-deploy.** `post-deploy.yml` is well-constructed: waits 90s, curls health, curls CORS, curls frontend, curls login, opens a GitHub issue on failure. Good.

---

## Bug Fix Discipline

**Methodology:** Scanned commits from `8e6163d` forward (~80 commits, well over the 60-day requirement). Identified every commit whose subject starts with `fix:`. Checked whether the same commit modified any `*.test.*`, `*.spec.*`, `e2e/**`, `__integration__/**`, or `__tests__/**` file.

**Results:** 20 `fix:` commits in window, 13 unpaired.

| SHA       | Subject                                                                            | Verdict                            |
| --------- | ---------------------------------------------------------------------------------- | ---------------------------------- |
| `bea33cc` | fix: Railway crash, copy JSON to dist, fix rate limiter IPv6 validation            | UNPAIRED                           |
| `90470b1` | fix: use fs.readFileSync for destinations JSON to avoid import assertion syntax    | UNPAIRED                           |
| `847bcb7` | fix: graceful Redis degradation, cache failures no longer crash requests           | PAIRED                             |
| `f5968be` | fix: add detectSchemaVersion and migrateV0ToV1 to normalizePreferences             | UNPAIRED                           |
| `81f92d4` | fix: move Google Places API key from query string to X-Goog-Api-Key header         | PAIRED                             |
| `573e974` | fix: wrap clearSelectionsForTrip in database transaction for atomicity             | PAIRED                             |
| `6968de4` | fix: change default server port from 3000 to 3001                                  | UNPAIRED                           |
| `16be042` | fix: proactive search rule + wider mock hotel price range                          | UNPAIRED                           |
| `d3b8859` | fix: add prompt rules to avoid redundant questions and batch updates               | UNPAIRED                           |
| `44d660e` | fix: contextual fallback for empty customer responses, add persona caching         | UNPAIRED                           |
| `0f4afdb` | fix: swap customer agent roles, add empty response handling, prefill judge JSON    | UNPAIRED                           |
| `cd7f3dd` | fix: lazy-init Anthropic clients, load server .env, set NODE_ENV=test              | UNPAIRED                           |
| `be8d19b` | fix: add date validation, conversation truncation, and clearer tool error messages | PAIRED                             |
| `7ad2249` | fix: add conversation lock to prevent concurrent agent loops                       | UNPAIRED                           |
| `e6f452c` | fix: auto-save form data when user sends chat message                              | UNPAIRED                           |
| `35b4d04` | fix: allow Claude to extract trip details from chat during COLLECT_DETAILS         | PAIRED                             |
| `c4ddb12` | fix: trim system prompt to reduce token usage and avoid rate limits                | PAIRED                             |
| `a085bf2` | fix: make header logo and compass both coral/orange                                | UNPAIRED (cosmetic, less critical) |
| `047679b` | fix: resolve bugs B15-B23                                                          | UNPAIRED                           |
| `ec73bf5` | fix: reformat quiz.md to match VibeLens parser expectations                        | UNPAIRED (data file)               |

**Verdict: 13 unpaired fixes in a single 30-day window. The canonical role escalates 3+ to P1. This is a P1 behavioral finding.**

Particularly concerning unpaired fixes (ones that touched executable code and could regress silently):

- `7ad2249` "fix: add conversation lock to prevent concurrent agent loops" changed concurrency behavior in a chat handler with no regression test. If the lock ever breaks, nothing will catch it.
- `f5968be` "fix: add detectSchemaVersion and migrateV0ToV1 to normalizePreferences" is a schema migration function with no unit test. This is a data-corruption-risk fix without protection.
- `047679b` "fix: resolve bugs B15-B23" resolves nine bugs in a single commit with zero test changes. Classic optimism-debugging.
- `bea33cc` "fix: rate limiter IPv6 validation" fixed a Railway crash. No regression test. Fourth production crash waiting to happen.

**Recommendation:** For the next 30 days, enforce "no fix commit merges without a test that was red before the fix and green after." Add a lefthook check if needed. The team wrote the rule in `CLAUDE.md` and has not been enforcing it.

---

## Workspace Hygiene

Searched `~/Desktop/code` for duplicate Voyager / agentic-travel-agent project directories.

**Result:** one canonical location found: `/Users/iangreenough/Desktop/code/personal/production/voyager`.

No duplicates or stale ancestor directories. Good.

Note: package names inside the repo still say `agentic-travel-agent*` after the directory rename. If a developer searches by package name, nothing will point them to `voyager/`. Minor cognitive-debt issue, P3.

---

## Tech Debt Register

| #   | Item                                                                                                 | Risk |
| --- | ---------------------------------------------------------------------------------------------------- | ---- |
| 1   | Amadeus schema columns + migrations with no implementation                                           | P1   |
| 2   | In-memory `activeConversations` set does not work in multi-replica mode                              | P2   |
| 3   | In-memory rate limiter in production without `RATE_LIMIT_STORAGE_URI` (warning emitted, not blocked) | P2   |
| 4   | `EVAL_MOCK_SEARCH` mock mode is env-global, not a proper adapter per tool                            | P2   |
| 5   | No Sentry / error tracking                                                                           | P2   |
| 6   | No `pnpm audit` in CI, no Dependabot                                                                 | P2   |
| 7   | No smoke test visible in CI (script referenced but not wired)                                        | P2   |
| 8   | Chat endpoint has no integration test                                                                | P2   |
| 9   | Package names still say `agentic-travel-agent*` after rename to Voyager                              | P3   |
| 10  | Dockerfile runs as root                                                                              | P2   |
| 11  | Partial-progress visibility lost when tool-call limit is tripped mid-batch                           | P3   |
| 12  | No documented rollback procedure                                                                     | P3   |

---

## Prioritized Recommendations

**P1 (block next release):**

1. **Restore E2E test coverage for the chat / agent loop.** Wire `pnpm test:e2e` into `ci.yml` with `EVAL_MOCK_SEARCH=true`. Add happy-path tests for: create trip → ask to plan → receive itinerary → select flight. Impact H, Effort M.
2. **Enforce test-first on bug fixes.** Add a CI check (or lefthook pre-commit hook) that blocks any commit whose subject starts with `fix:` and touches source files but no test files. Or at minimum, open a GitHub Issue tracking each unpaired fix from the table above and backfill a regression test. Impact H, Effort M.
3. **Resolve Amadeus drift.** Decide: keep or kill. If kill, write `1771879388559_remove-amadeus-columns.js`, drop the columns, and remove `amadeus_offer_id` / `amadeus_hotel_id` from `server/src/schemas/trips.ts`. Impact M, Effort L.

**P2 (next sprint):**

4. Add Sentry to both server and web-client. Impact H, Effort L.
5. Add `pnpm audit --prod` and Dependabot config. Impact M, Effort L.
6. Move `activeConversations` lock to Redis, and move the rate limiter store to Redis using `RATE_LIMIT_STORAGE_URI`. Impact H on scale, Effort M.
7. Add integration test for the chat endpoint (SSE flow, auth, rate limit, 409 conflict under lock). Impact M, Effort M.
8. Make `EVAL_MOCK_SEARCH` a proper adapter: accept a `toolAdapters` parameter on the `AgentOrchestrator` constructor and pass it through the executor, so tests can inject per-tool mocks without touching process env. Impact M, Effort M.
9. Non-root user in `Dockerfile.server`. Impact L, Effort L.
10. Verify `scripts/smoke-test.sh` exists and wire it into CI. Impact L, Effort L.

**P3 (backlog):**

11. Rename packages from `agentic-travel-agent*` to `voyager-*` in a single refactor commit. Impact L, Effort M (touches many imports).
12. Write a rollback runbook in `docs/` for Railway + Vercel. Impact L, Effort L.
13. Preserve partial tool-call progress when the 15-call limit is tripped mid-batch. Impact L, Effort L.

---

## What I Did Not Audit

- Frontend accessibility (Lighthouse score). Scope overlap with a11y audit.
- Prompt-injection resistance in `server/src/prompts/system-prompt.ts`. Scope overlap with security audit.
- SQL index design on `tool_call_log` and `api_cache`. Recommend a database-specific pass.
- `pnpm-lock.yaml` CVE scan. Recommend running `pnpm audit` and pasting the output into `ISSUES.md`.
- Evaluation harness quality (`eval/`). The eval suite appears substantial and deserves its own audit.
