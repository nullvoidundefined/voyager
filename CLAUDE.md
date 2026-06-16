# Voyager

AI travel planner powered by a multi-step tool-use loop. Users describe a trip (destination, dates, budget, preferences). The agent calls real APIs (SerpApi for flights/hotels via Google Flights & Hotels, Google Places for experiences), reasons about budget constraints, and assembles a complete itinerary. Users iterate conversationally.

## Key AI pattern

Agentic tool-use loop: Claude calls tools 3-8 times per turn, reasoning about results between calls. Unlike app 3 (single-pass tool use), this is multi-step with budget-aware planning. Max 8 tool calls per turn as safety limit.

## Tools the agent uses

- `search_flights` → SerpApi Google Flights
- `search_hotels` → SerpApi Google Hotels
- `search_experiences` → Google Places Text Search
- `calculate_remaining_budget` → local computation
- `get_destination_info` → IATA codes, weather, timezone

## Stack

- **Monorepo:** pnpm workspaces with `apps/server/` and `apps/client/web/` packages
- **Frontend:** Next.js 15
- **API:** Express 5 + TypeScript (Docker)
- **Database:** PostgreSQL on Neon
- **Cache:** Redis (ioredis)
- **External APIs:** SerpApi (Google Flights + Hotels, 250 searches/month free tier), Google Places API
- **LLM:** Anthropic Claude API (tool use + streaming)

## Critical implementation note

The agent loop runs synchronously on the API server. The agent needs immediate results to reason. Cache SerpApi responses aggressively. The free tier is 250 searches/month.

## Frontend conventions

- Use **TanStack Query** (React Query) for all server state: data fetching, caching, mutations, and optimistic updates. No raw useEffect + fetch patterns.
- Use **Toast** component for API/server errors. Never show raw error messages or stack traces inline. Keep inline `{error}` only for form validation messages.

## Deployment

### Server

```bash
railway up --detach
```

- Railway CLI is linked to the monorepo root, where `Dockerfile.server` lives
- Each service has its own config-as-code file: the server reads `railway.server.toml` (`dockerfilePath = "Dockerfile.server"`), the web service reads `railway.web.toml` (`dockerfilePath = "Dockerfile.web"`). Each service's "Railway Config File" setting points at its file. A `railway*.toml` build setting locks the matching dashboard Builder field; edit the file, not the UI.
- `CORS_ORIGIN` env var must match the frontend production URL

### Deploy pitfalls

- **Wrong directory:** Railway must run from the monorepo root, not `apps/server/`.
- **Nixpacks conflict:** Never set `NIXPACKS_ROOT_DIR` or `NIXPACKS_CONFIG_FILE` env vars. They override the Dockerfile.

## Bug fix process: test first, not optimism

When fixing any breaking issue, follow this exact process:

1. **Write a test that reproduces the failure.** Create the exact conditions causing the bug. Run the test. Confirm it **FAILS**.
2. **Fix the code.** Minimal change addressing the root cause.
3. **Run the test again.** Confirm it **PASSES**.
4. **Run the full verification chain:** `pnpm format:check && pnpm lint && pnpm test && pnpm build`
5. **Only then commit and deploy.**

Never claim something is fixed without a failing-then-passing test. Never deploy to "see if it works." Every bug fix commit must contain both the test and the fix.

## Pre-commit / pre-push verification

Lefthook hooks enforce `format:check`, `lint`, and `build` on every commit and push. If hooks aren't blocking bad code, check:

- `git config --local core.hooksPath`. Must not point to a stale directory.
- Run `npx lefthook install` to reinstall hooks if needed.

Voyager is trunk-based. Push directly to `main`. No branch protection, no PR requirement. The lefthook pre-push hook (format, lint, build, e2e fast lane) is the local gate. If the pre-push hook fails due to environment issues (e.g., port conflict with another dev server), `--no-verify` is acceptable for docs-only or non-code changes with explicit user authorization.

## Commit conventions

- Make **separate commits** for unrelated tasks. Do not bundle unrelated changes into one commit.

## Bug and work-item severity tracking

Bugs and work items live in `docs/todos/`, segmented by severity into `P1-high-priority.md`, `P2-medium-priority.md`, and `P3-low-priority.md`. The file an item lives in IS its severity, so no separate `severity:` tag is needed; P0 launch-blockers and any P0/P1 surfaced by an audit belong in the P1 file at the top. This per-file segregation is the structural enforcement of the global "triage by severity" rule. The 2026-04-06 process retrospective found B14 (tile selections do not persist) sitting with no urgency signal, and four cases where P0 fixes were batched alongside P3 cosmetic items in a single commit (`5ab42753`, `15f86be5`, `8f7bae5b`, `047679bc`); keeping each item in its severity file, plus one commit per item (see "Commit conventions"), is what prevents the unscoped-bucket failure those incidents exposed.

## ChatBox invariants

Before landing any further fix to `apps/client/web/src/components/ChatBox/`, write a `apps/client/web/src/components/ChatBox/__tests__/ChatBox.invariants.test.tsx` that enumerates the invariants the data model must hold:

- Tool-result cards persist after the SSE stream ends.
- Text nodes never duplicate when the agent re-emits text.
- Empty state renders when the node list is empty.
- Virtualizer layout is stable under append (no layout thrash on the last node).
- QuickReplyChips render only after the final assistant message of a turn.

Every subsequent ChatBox fix must extend this spec, not create a new ad-hoc test next to the file. The 2026-04-06 process retrospective found a 9-commit fix storm (`183eb289` through `9e2eab7d`) in 85 minutes touching `apps/client/web/src/components/ChatBox/*` exclusively, with one `debug:` commit landing console.logs directly on main. Each fix patched a symptom without unifying the data model, so each new fix risked reintroducing an earlier symptom. The invariants spec exists to make those regressions impossible.

## Incident history

Several rules in the global Claude Code rulebook (`~/.claude/CLAUDE.md`) were motivated by specific Voyager incidents. The rules themselves are codified globally and generalized across projects. This section records the Voyager-specific context so future auditors reviewing this repo understand which past events justified which disciplines. Treat this as authoritative historical context, not optional reading. This is distinct from the shorter retrospective callouts elsewhere in this file (severity tracking at "Bug and work-item severity tracking," ChatBox fix-storm at "ChatBox invariants," pre-push bypass discipline at "Pre-commit / pre-push verification"), which cite the retrospective inline with the rule they motivate.

### 2026-04-06 retrospective

A retrospective on 2026-04-06 surveyed commit history since the test-first discipline had been introduced and found four distinct rule violations. Each became a globally codified rule. Full retrospective at `docs/audits/2026-04-06-process-retrospective.md`.

#### 68.6 percent bug-fix-without-test violation rate

51 `fix:` commits were audited for whether they included a corresponding test in the same commit. 35 of them did not. 68.6 percent. This was true even after the test-first-bug-fixing rule had already been explicitly codified in commit `27e41de2`. 8 of the 35 violators were arguably justified mislabels (e.g., `ec73bf53` was a `quiz.md` reformat tagged `fix:`), but the remaining 27 were genuine rule violations. The lesson: discipline lives in the thinking, not in the commit label. Relabeling a `fix:` to `chore:` does not make a latent test unnecessary; it just hides the gap. Motivated the "relabeling does not dodge the rule" clause in the global test-first-bug-fixing section.

#### Batched unrelated bug IDs in a single commit

Four commits each fixed four to nine unrelated bug IDs in a single diff:

- `5ab42753` covered B1, B3, B8, B9.
- `047679bc` covered B15 through B23, mixing a P0 NaN fix with cosmetic gap spacing.

Batching destroyed per-bug revertability, hid which specific change caused any new regression, and made test-per-bug traceability impossible. Motivated the global rule: one commit per triage ID, never bundle more than two IDs, and the commit subject must be explicit (`fix(B5, B12): ...`) with a body line-item per ID.

#### Repeated `style: format all files` commits

Three independent "style: format all files" commits landed in 13 days:

- `047ad4aa`
- `5441c42e`
- `91018165`

A deliberate-bad-format probe (`27e7c4bc`, reverted by `823e2ec1`) during the same window confirmed the pre-commit hook was silently failing or being manually probed. The correct response to formatting drift is to fix the hook; landing the drift-correction as a standalone commit without diagnosing hook state is how drift becomes recurring. Motivated the global rule that `style: format all files` commits must be paired with a "hook verification" commit in the same session.

#### Railway production crash from missing dist asset (`bea33cc5`)

Commit `bea33cc5` fixed a Railway production crash traced to `destinations.json` not being copied to `dist/` because `tsc` does not transitively copy JSON assets. A near-miss two days earlier (`9f08897b`) had been worked around by inlining the JSON into TypeScript rather than fixing the build contract. The team learned the same lesson twice, which is the part the retrospective treated as the real failure. Motivated the global "production-asset build contracts require a dist-content smoke test" rule: for every runtime-loaded non-code asset, a script must run after `tsc` (and in CI, and inside the Dockerfile build stage) asserting the file exists under `dist/` at the expected resolved path.
