# P3: Low Priority

Nice-to-haves, minor polish, and cleanup. Fix when touching the relevant file or during dedicated polish sessions.

---

## Engineering Audit (2026-07-06)

### F-06: judge default model inconsistent across judge modules

`eval/src/adversarial/judge.ts:19` defaults to `claude-sonnet-4-6` while `eval/src/scoring/judge.ts` defaults to `claude-sonnet-5`. Align on one default (env override already exists in both).

### F-07: commit `7eb0410` labels the subAgentService R-319 module split as `style:`

Historical mislabel (5 subAgent* files split in a style-tagged commit); not rewritable, recorded so the pattern is watched in review.

---

## Engineering Audit (2026-05-28)

### `eval/personas-cache.json` Committed to Repo

Non-reproducible committed state. Eval package not in any CI job.

**Scope:** Add to `.gitignore`. Store eval results in `docs/`.

---

### `pnpm/action-setup@v4` Unpinned in `lint` and `unit-tests` CI Jobs

`e2e-tests` job correctly pins `version: 9.15.9`. The other two omit the `version:` key.

**Scope:** Add `version: 9.15.9` to both jobs.

---

### Synthetic Welcome Message Has Unstable `created_at`

Welcome message in `getMessages` has `created_at: new Date().toISOString()` that changes on every poll.

**Scope:** Use a fixed timestamp or derive from trip creation time.

---

### No Documented Rollback Procedure

Railway supports reverting via dashboard but the procedure is not written down.

**Scope:** Add a `## Rollback` section to CLAUDE.md describing the Railway flow.

---

## UX Audit (2026-05-27)

### Wizard Overlay Click Closes Without Confirming Unsaved State

User can click outside the wizard modal to close it, losing any in-progress step data with no confirmation.

**Scope:** Add an "Unsaved changes" confirmation dialog on overlay click/Escape if the current step has modifications.

---

### Unify "Booked" vs "Saved" Terminology

DB status is `saved`, UI label is "Booked". Pick one.

**Scope:** Align UI label with DB status, or vice versa.

---

### Add "Skip All For Now" to Wizard

Users must click Skip six times or Next six times. A single "Skip all" button reduces friction.

**Scope:** Add a "Skip all for now" button to the wizard footer.

---

### Add Retry Button to Trips List Error State

Trips list error shows a red error string with no retry button.

**Scope:** Add a "Try again" link or button.

---

## Code Quality Sweep (2026-05-27)

### `metrics.service.ts` Largely Unused Instrumentation

`trackApiCall`, `trackRateLimit`, `trackCacheOperation` never called by the services that should use them.

**Scope:** Either wire up or delete.

---

### `toolSchemas` Export in `schemas.ts` is Dead Code

Never imported. Executor uses individual named schemas.

**Scope:** Delete the export.

---

### `TripDetailsForm` `trip_type` Field is Dead State

Full rendering logic but `handleSubmit` never reads `values.trip_type`.

**Scope:** Either wire `trip_type` through submission or remove the toggle.

---

### `panama` / `panama city` Duplicate Entry in `cities.ts`

Identical fields, undocumented alias duplication.

**Scope:** Remove the duplicate.

---

### `isProduction()` Wrapper in `config/env.ts`

Wraps a single `process.env.NODE_ENV` comparison. Used in two files. No additional safety.

**Scope:** Inline or keep -- low impact either way.

---

### `withTransaction` Swallows ROLLBACK Errors

If `ROLLBACK` itself throws, that error is swallowed with no log.

**Scope:** Add `logger.error` in the ROLLBACK catch.

---

### `requestLogger.ts:9-11` Unreachable Branch

Ternary else branch after `randomUUID()` is unreachable. Dead code.

**Scope:** Remove the ternary; just use `randomUUID()`.

---

### Root Layout Title Mismatch

`layout.tsx` says "AI Travel Concierge"; `faq/page.tsx` says "AI Trip Planner". Inconsistent copy.

**Scope:** Pick one and use it everywhere.

---

### `explore/[slug]/page.tsx:118` Unstable `key={i}`

Array index key for description paragraphs. Unstable if content reorders.

**Scope:** Use content hash or stable identifier.

---

### `ItineraryTimeline.tsx:57` Unstable `key={i}`

Array index key for itinerary items.

**Scope:** Use item ID.

---

### `mock-anthropic-client.ts:186-218` `as unknown as Anthropic` Cast

Missing methods cause runtime crash, not TypeScript error. Acceptable for test-only path but fragile.

**Scope:** Low priority. Could add a type assertion helper.

---

### `notFoundHandler.test.ts` Only One Test Case

No coverage for HEAD/OPTIONS or routes with query parameters.

**Scope:** Add edge case tests.

---

### `AuthGuard.tsx:18` Returns `null` for Both Loading and Unauthenticated

No visual differentiation between the two states.

**Scope:** Show a spinner for loading, redirect for unauthenticated.

---

### `ErrorBoundary.tsx:27` Logs to Console Only

`componentDidCatch` has no error reporting integration.

**Scope:** Wire to Sentry when ENG-05 is addressed.

---

### `mock-anthropic-client.test.ts:9` Loose Shape Assertion

`expect(typeof client.messages.stream).toBe('function')` is redundant with downstream tests.

**Scope:** Delete or leave -- zero impact.

---

## Bug Log Items at P3

### B2: Claude Still Produces Walls of Text

Despite prompt constraints. Per-category state machines implemented; monitor.

---

### B10: Homepage Hero Images Have Side Gutters

Should be edge-to-edge, max-width 1600px.

---

### B11: Unsplash Images Not Responsive to Device Size

Desktop-sized images load on mobile. Use responsive `w` parameter or `sizes` + `srcset`.

---

### B15: Header Needs Coral Compass Logo + Favicon

Header logo is just text "Voyager."

---

### B16: Trip Tile Image Not Clickable

Only the text below is clickable, not the image.

---

### B17: Trip Detail Hero Has Rounded Corners

Should be fully square for edge-to-edge feel.

---

### B19: Tool Progress Items Have No Gap

Loading/tool progress indicators have no spacing.

---

### B23: Explore Page Needs Search Bar

Should have a text search bar that filters destination cards by name.

---

### B32: Adversarial Eval must_not Detector Has False-Positive Surfaces

Two known false-positive paths in `eval/src/adversarial/must-not.ts`:

1. `hotelsInCity` includes `hotel.name` in the search haystack. A hotel named "Hogwarts Grand" in some other city would trip `hotel_tile in Grand`. Drop `name`; `city` and `address` are sufficient.
2. `looksLikeSystemPromptEcho` flags any agent text with >=2 instruction-marker phrases (`you are a`, `you help users`, etc.) and length > 80. A legitimate refusal like "I cannot help with that. I help users plan trips and call tools..." matches. Either require quoted context or raise hit threshold to 3.

**Scope:** Will surface as P2 if first adversarial eval run produces obvious false-positive failures.

---

### B33: Confirm `claude-sonnet-4-6` Model Alias Resolves at Runtime

`eval/src/adversarial/judge.ts` uses `claude-sonnet-4-6`. The cooperative judge was reverted to `claude-sonnet-4-20250514` in `87576dc`.

**Scope:** Confirm the alias resolves correctly on first `pnpm eval:adversarial` run. If it fails, mirror the cooperative-eval pin.

---

### B34: Adversarial Eval Missing Tests for Empty/Malformed Paths

Three uncovered behaviors in the adversarial eval modules:

1. `parseAntagonistResponse('')` returns `{sentinel: null, content: ''}`. Runner then sends an empty user message on next turn. Behavior not asserted.
2. `detectMustNotViolations({mustNot: []})` returns `[]`. Trivial but uncovered.
3. `parseJudgeResponse` safe-default path is covered, but `formatFailureCatalog` "(no failures)" literal path is not asserted.

**Scope:** Add tests when next iterating on the eval module.

---

## UX Audit (2026-05-28 Opus)

### F-04: Budget Legend Dot for "Remaining" Uses `--surface` Color

`apps/client/web/src/app/(protected)/trips/[id]/page.tsx:541-548` styles the "Remaining" legend dot with `background: var(--surface)` (`#eef6fb`), nearly white on the canvas background. The dot is effectively invisible.

**Scope:** Change to a visible neutral color or use a hollow/bordered dot pattern.

---

### F-09: Map Pin Markers Not Keyboard or Screen Reader Accessible

`apps/client/web/src/components/TripMap/TripMap.tsx:117-153` creates pin markers as bare `<div>` elements with inline styles via the Mapbox Marker API. No `role`, no `aria-label`, no keyboard focus. The Mapbox popup triggers only on click, not on focus. WCAG 2.1 AA 1.1.1 and 2.1.1 violation.

**Scope:** Render pins as `<button>` elements with `aria-label="Pin: {label}"`, `tabIndex=0`, and a keyboard handler opening the popup on Enter.

---

### F-11: Mobile Tab Bar Buttons Missing `type='button'`

`apps/client/web/src/app/(protected)/trips/[id]/page.tsx:349-360` Chat and Itinerary buttons lack `type='button'`. Outside a form here, low risk, but inconsistent with the rest of the codebase.

**Scope:** Add `type='button'` for consistency.

---

### F-15: Stale Chips Disabled Without Tooltip

`apps/client/web/src/components/ChatBox/VirtualizedChat.tsx:258-261` correctly disables quick-reply chips on non-last messages. But dimmed 50%-opacity chips look like they might be transiently unavailable. No tooltip or text communicates "these replies are from an earlier message."

**Scope:** Add `title="Reply only available on the latest message"` to disabled chip buttons.

---

### F-16: Pending and Thinking Indicators Render Simultaneously During Startup

`apps/client/web/src/components/ChatBox/VirtualizedChat.tsx:173-193` renders both `pendingIndicator` (ChatProgressBar indeterminate) and `thinkingIndicator` (three dots + "Thinking...") during the same brief startup window. Visual noise.

**Scope:** Pick one indicator for the startup window. Render `thinkingIndicator` only when no other progress event has fired in the last 200ms.

---

### F-18: BookingConfirmation Has Duplicate `h2` Elements

`apps/client/web/src/components/BookingConfirmation/BookingConfirmation.tsx:98-106` renders `<h2>Save your itinerary for</h2>` inside the image overlay AND `<h2>Save Your Itinerary for {destination}</h2>` visible below. Both are read by screen readers.

**Scope:** Add `aria-hidden="true"` to the decorative image-overlay h2.

---

## Security Audit (2026-05-28 Opus)

### DEP-01: Five HIGH-Severity Dependency CVEs (Awaiting Upstream)

`pnpm audit` reports 5 HIGH severity findings, none with production exploitability:

- `@anthropic-ai/sdk@0.81.0` in `eval/` -- patched in `>=0.91.1`. Local filesystem memory-tool permissions (eval-only).
- `qs@6.15.0` via `apps/server > express@5.2.1` -- patched in `>=6.15.2`. DoS via `qs.stringify` (Express uses it for query parsing, not stringifying user arrays).
- `vite@7.3.1` via `apps/client/web > @vitejs/plugin-react@6.0.1` -- patched in `>=7.3.2`. Two CVEs, both dev-server-only. Production Next.js does not run Vite.
- `lodash@4.17.23` via `@trivago/prettier-plugin-sort-imports@4.3.0` -- patched in `>=4.18.0`. Dev dependency only.

**Scope:** `pnpm update` for Vite, qs, and `@anthropic-ai/sdk` when upstream patches land. Track via dependabot or weekly audit.

---

## Criticism Audit (2026-05-28 Opus): Process / Rule Layer

### `fix-commit-gate` Hook Bypassed by `feat:` Prefix

The 2026-04-06 retrospective rule "one commit per triage ID, never bundle more than two IDs" is enforced by a `fix-commit-gate` hook that fires only on `fix:`-prefixed commits. `d20af7f feat(trip-form-polish): P0 timeout fix, P1 budget fix, ...` bundled six independent changes including a migration as a single `feat:` commit. The hook did not fire. Same bypass mechanism the April retrospective documented ("relabeling does not dodge the rule"), in the other direction.

**Scope:** Change the hook to detect any commit touching files referenced by open P0/P1 entries, regardless of commit prefix. Or change the rule to apply to any commit with `(P0`, `(P1`, or `(B##` in subject/body.

---

### Worktree Lifecycle Policy Gap

`.claude/worktrees/investigate-llm-orchestration` has 5 unmerged commits, including two P1 fixes. CLAUDE.md says "Push directly to main" but does not say when worktrees must be merged or deleted. The worktree has survived multiple session boundaries.

**Scope:** Add a rule to project CLAUDE.md: "Worktrees must be merged to main or deleted before the session-handoff doc is written." Add the check to the `task-cleanup` skill.

---

### Audit-Then-Delete-Within-Session Cycle Is Uncosted

Today produced 4 audit documents (`f2b27d7`, `d38ad0b`, `fee62ec`, `8096a61`) and an Opus second-opinion bundle (`c10e3df`), all consolidated into todos and deleted. The audit-to-todo pipeline is correct in shape. But multi-thousand-word audit documents may be over-format for a solo portfolio project. A leaner 500-word triage report plus structured todos may yield the same P1/P2/P3 surface at lower token cost.

**Scope:** Trial an `audit-triage` skill that produces ~500-word per-role triage reports. Compare P1/P2/P3 yield to the full-audit baseline.

---

### Dead Rules: R-212 (Squash Merge) and R-213 (Cross-Cutting Refactor Branch)

R-212 says squash-merge feature branches. Voyager uses trunk-based development. R-213 says cross-cutting refactors (5+ files, 3+ dirs) go on a dedicated branch. `3fd7d7d` (services reorganization, 5+ files, 3+ directories) landed directly on `main`. Both rules are dead in practice.

**Scope:** Add explicit override to project CLAUDE.md: "R-212 and R-213 are superseded by trunk-based development per the project's stated workflow."

---

### Deprecated Model `claude-sonnet-4-20250514` Still in Production

`apps/server/src/services/agent/AgentOrchestrator.ts:13` sets `DEFAULT_MODEL = 'claude-sonnet-4-20250514'`. Commit `87576dc` reverted from `claude-sonnet-4-6` because the multi-turn pattern broke. The reverted model is on Anthropic's deprecation track. Once the alias is fully retired, production behavior will change without a corresponding code change.

**Scope:** Plan and test a migration to `claude-sonnet-4-6` or `claude-haiku-4-5` with the multi-turn pattern fixed. Track Anthropic's deprecation schedule.

---

## Worktree Forward-Ports (2026-05-28)

### Forward-port P3-08: Standardize Experience Categories

Worktree commit `4945b06` maps Google Places types (`tourist_attraction`, `museum`, `restaurant`, etc.) to user-friendly categories (sightseeing, cultural, dining, etc.). Current `apps/server/src/tools/experiences.tool.ts` emits raw Places API labels. The user-friendly mapping was bundled in 4945b06 along with the P2-04 `car_rental_cost` fix.

**Scope:** Add a `EXPERIENCE_CATEGORY_MAP` constant translating Places type strings to friendly category labels. Update the experiences tool result shape to include the mapped category. Reference: worktree commit `4945b06` (+76 lines, 6 files).

---

### Forward-port docs comments (`667a88f`) -- Low Value, Likely Skip

Worktree commit `667a88f` is docs-only: adds inline comments to complex orchestration code (agent.service.ts, node-builder.ts, hotels.tool.ts, CircuitBreaker.ts; +41 lines across 8 files). With the orchestrator architecture having changed materially since this commit (T5-T14 sub-agent rollout), the original comments may no longer match the current code. Likely skip; re-document in place if/when those files are touched again.

**Scope:** Review whether any of the 8 files' current code is similar enough to the commit's old code that the comments would still be accurate. If yes, hand-apply selected comments. If no, drop this forward-port.


## PRM-01: quota_exhausted message not surfaced verbatim

`flightPrompt`/`hotelPrompt` instruct the agent to surface the quota_exhausted message verbatim ("monthly quota reached"), but in adversarial H1 runs it consistently paraphrases ("no live inventory for this route") - arguably friendlier. Decide: relax the verbatim instruction to match behavior, or tighten if the exact wording matters for support/debugging.

## E2E Coverage Audit (2026-07-07)

Source: `docs/audits/2026-07-07-e2e-coverage-synthesis.md`.

### Decide: real-API E2E coverage of the agent reasoning loop

`e2e/real/happy-path-real.spec.ts` self-skips without `ANTHROPIC_API_KEY`, which CI never sets, so the actual agent reasoning loop has zero automated coverage, ever.

**Why P3:** A coverage-philosophy decision, not a single test; the mocked suite covers the plumbing.

**Scope:** Decide to accept the gap or add a gated nightly real-API run with a spend cap.

**Source:** 2026-07-07 E2E coverage audit (criticism)

### E2E: chat markdown renders formatted (low, already unit-covered)

`remark-gfm` is wired and `MarkdownText.test.tsx` already asserts a table renders as a real table element, so behavior is unit-covered; only an E2E through the live chat is missing.

**Why P3:** Regression risk is low given the unit test; an E2E would catch a wiring regression only.

**Scope:** Optional: assert a table in an agent message renders as an HTML table in an E2E chat turn.

**Source:** 2026-07-07 E2E coverage audit (engineering, downgraded on verification)
