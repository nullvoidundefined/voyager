# Plan C: Voyager Demo-Readiness Fix Loop

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Voyager into a polished, honest portfolio demo optimized for showing to a CTO / founder in the travel space. Fix every triage item that is visible during a demo walkthrough or during a casual code review, plus the operational basics any competent engineer would check first. Drop the legal / commercial items that do not apply to a portfolio demo. Use the Criticism audit's brutal findings as a deliberate demo asset, not a liability to hide.

## Context

Voyager is a **portfolio demo**, not a commercial product. It is being built:

1. As an ongoing craft project that Ian enjoys building.
2. As a demo piece that can be shown to anyone in the travel / agentic-AI space. A specific stealth travel startup CEO (Booking.com-backed) is a potential recipient, but there is no firm date and no dependency on him responding.
3. As a portfolio artifact that stands on its own even if the demo never happens.

**No deadline.** Scope is broad because there is time for craft, but task ordering is demo-walkthrough-first: the things a CTO sees in the first 5 minutes of exploring Voyager land before the subtle tech debt.

**The Criticism audit is an asset, not a liability.** Walking a sophisticated viewer through "here is what I think is broken about my own work" is a differentiating signal. The audit artifacts (`docs/audits/2026-04-06-*.md`) are part of the demo, linked prominently from the README.

**What drops from Plan C with the portfolio-demo framing:**

- **All legal P0s and P1s that assume a commercial product.** No Privacy Policy, no Terms of Service, no cookie consent banner, no DPAs, no trademark search, no age gating, no deletion mechanism. A demo shown to a few named viewers does not need any of this. The register-page dead-link issue gets replaced by deleting the dead links and adding a "this is a demo, not a commercial product" banner.
- **Marketing P0/P1s that assume SEO traffic.** OG image, sitemap, robots.txt all drop. The hero copy still gets rewritten, but to speak to a CTO evaluating Ian, not to an anonymous visitor who is three seconds from bouncing.
- **The $9 Pro plan phantom, the "no hallucinated prices" claim, and the FAQ Amadeus lie all still get fixed.** They are sloppy attention to detail that a CTO will notice within 30 seconds of exploring. Cheap wins.

**What STAYS and becomes more important:**

- **Walkthrough-path fixes.** Trip delete without confirmation, booking auto-advance, "Planning..." literal destination, SSE chat error handling. Every bug on the walkthrough path is a P0 regardless of original audit severity.
- **Operational basics the CTO will check.** Anthropic spending cap, SerpApi counter, unauthenticated photo proxy, `pnpm audit` CVEs. "Have you capped Anthropic?" is question number one from any operator in this space.
- **Code-review hygiene.** The bug fix discipline retrospective (13 of 20 unpaired fixes) is an asset if it is fixed before the demo; it is an embarrassment if not. The Amadeus dead code cleanup is a visible signal of engineering discipline.
- **The tool executor adapter seam (ENG-04).** Prerequisite for Plan B. Plan B's test backbone is itself a demo asset.

## Fix topology

- **Single branch** `fix/audit-2026-04-06-p0p1`, opened in a new worktree `.claude/worktrees/plan-c-fixes-2026-04-06/`.
- **One commit per fix.** Each commit contains both the reproducing test and the fix, per the global test-first rule in `~/.claude/CLAUDE.md`.
- **Commit messages:** `fix(<triage-id>): <description>`, e.g. `fix(SEC-01): require auth on /places/photo`.
- **Merge strategy:** one PR against `main` titled `fix: audit 2026-04-06 P0/P1 findings`, merged with a merge commit (not squash), preserving per-fix history.
- **Lefthook fix-commit gate** catches unpaired fixes in warning mode. Promote to blocking after one clean week.

## Timeline calibration

Effort estimates in this plan are **minimal** not padded. "S" means under an hour. "M" means an afternoon or less. "L" means a full focused day. No task here is "a week" because none of them is. Ian ships afternoon-scale things in afternoons; do not pad.

## Task ordering

Ordered by demo-walkthrough priority, not by audit severity. Groups:

- **Group 0 (Tasks 1 to 8):** Demo framing and honest positioning. Low-effort copy fixes that immediately improve first impression.
- **Group 1 (Tasks 9 to 12):** Walkthrough path bulletproof. Fix every bug a viewer will hit in the first 10 minutes of clicking around.
- **Group 2 (Tasks 13 to 16):** Operational basics. Spending caps, photo proxy hardening. Things a CTO asks about in the first 60 seconds of a code review.
- **Group 3 (Tasks 17 to 21):** Code-review hygiene. CVEs, tool input allowlist, test backfill for critical unpaired fixes, Amadeus cleanup, adapter seam (unblocks Plan B).
- **Group 4 (Tasks 22 to 24):** Demo asset enrichment. README links to the audit reports. A DEMO-WALKTHROUGH.md. A "what's broken" section quoting the Criticism audit.
- **Group 5 (Tasks 25 to 34):** Polish. Design system work, Radix migration, Lighthouse a11y, banned words sweep, financial observability.
- **Group 6 (Task 35):** Exit, verification, PR, merge.

Execute groups in order; within a group, take items in listed order (they are pre-sorted by dependency).

---

## Group 0: Demo framing and honest positioning

### Task 1: Add demo-mode banner to landing page and FAQ

**Files:**

- Modify: `web-client/src/app/page.tsx`
- Modify: `web-client/src/app/faq/page.tsx`

**Triage IDs closed:** (framing, not a specific triage item)

- [ ] **Step 1:** Write a test (component or E2E) asserting that a visible banner with text like "This is a technical demonstration of an agentic AI travel planning pattern, not a commercial booking service" appears on the landing page and the FAQ. Run. CONFIRM FAIL.
- [ ] **Step 2:** Add the banner as a small component used by both pages. SCSS module with a soft, non-alarming style (thin top strip or a small highlighted block under the hero).
- [ ] **Step 3:** Run test. CONFIRM PASS.
- [ ] **Step 4:** Full verification chain (`pnpm format:check && pnpm lint && pnpm test && pnpm build`).
- [ ] **Step 5:** Commit: `fix(DEMO-01): add demo-mode banner to landing and faq`

### Task 2: Rewrite hero copy for CTO / founder audience

**Files:**

- Modify: `web-client/src/app/page.tsx` (hero section, lines ~152 to 168)

**Triage IDs closed:** MKT-01, MKT-08

- [ ] **Step 1:** Write a test asserting the new hero H1 and subhead. Run. FAIL.
- [ ] **Step 2:** Rewrite the hero to speak to a CTO evaluating Ian's engineering taste, not an SEO visitor. Something like:
  - H1: "An agentic trip planner, built as a portfolio piece"
  - Subhead: "Multi-step Claude tool loop. Real Google Flights and Hotels data via SerpApi. Budget-aware itinerary assembly. Full source and audit trail linked below."
  - Primary CTA: "Try the chat demo"
  - Secondary link: "Read the engineering audit" (links to `/docs/audits/2026-04-06-engineering.md` or a rendered version)
- [ ] **Step 3:** Run. PASS.
- [ ] **Step 4:** Verification chain.
- [ ] **Step 5:** Commit: `fix(MKT-01): rewrite hero for portfolio demo framing`

### Task 3: Fix FAQ Amadeus misrepresentation

**Files:**

- Modify: `web-client/src/app/faq/page.tsx` (lines ~38 to 41)

**Triage IDs closed:** LEG-02, MKT-02, CRIT-03-part

- [ ] **Step 1:** Write a test asserting the FAQ mentions SerpApi, not Amadeus. FAIL.
- [ ] **Step 2:** Replace with: "Flight and hotel data comes from live Google Flights and Google Hotels results, fetched via SerpApi at the moment you search. Experiences and restaurants come from the Google Places API."
- [ ] **Step 3:** Run. PASS. Verification. Commit: `fix(LEG-02): correct FAQ data source misrepresentation`

### Task 4: Remove phantom $9 Pro plan from FAQ

**Files:**

- Modify: `web-client/src/app/faq/page.tsx` (lines ~60 to 63)

**Triage IDs closed:** LEG-03

- [ ] **Step 1:** Test asserts the FAQ does not mention a "$9" or "Pro plan". FAIL.
- [ ] **Step 2:** Delete the phantom pricing copy. Replace with a sentence explaining the demo is free and is not a commercial product.
- [ ] **Step 3:** Run. PASS. Verification. Commit: `fix(LEG-03): remove phantom Pro plan from FAQ`

### Task 5: Soften unsubstantiable "no hallucinated prices" claim

**Files:**

- Modify: `web-client/src/app/page.tsx` (line ~206)

**Triage IDs closed:** LEG-04, MKT-07

- [ ] **Step 1:** Test asserts the landing page does not contain the exact string "No hallucinated prices". FAIL.
- [ ] **Step 2:** Replace with "Grounded in live API data" or similar.
- [ ] **Step 3:** Run. PASS. Verification. Commit: `fix(LEG-04): soften unsubstantiable hallucination claim`

### Task 6: Remove dead TOS / Privacy links from register page

**Files:**

- Modify: `web-client/src/app/(auth)/register/page.tsx` (lines ~155 to 159)

**Triage IDs closed:** LEG-01

- [ ] **Step 1:** Test asserts the register page does not contain any link to `/terms` or `/privacy` (since those pages do not exist). FAIL.
- [ ] **Step 2:** Remove the "By registering, you agree to our Terms of Service and Privacy Policy" line entirely. For a portfolio demo with no real transactions, this line serves no purpose and creates legal exposure. If legal boilerplate is wanted later, it can be reintroduced when the product is real.
- [ ] **Step 3:** Run. PASS. Verification. Commit: `fix(LEG-01): remove dead TOS and privacy links from register`

### Task 7: Product identity cleanup (pick one name)

**Files:**

- Modify: `package.json`, `server/package.json`, `web-client/package.json`, `packages/shared-types/package.json`
- Modify: `railway.toml`, `Dockerfile.server`, `web-client/vercel.json`
- Modify: `README.md`, `CLAUDE.md`, `docs/FULL_APPLICATION_SPEC.md`
- Modify: any remaining `agentic-travel-agent` or `Atlas` or `Global` references in source

**Triage IDs closed:** CRIT-03, ENG-12

- [ ] **Step 1:** Grep for every identity name: `grep -rnE "agentic-travel-agent|Agentic Travel Agent|Voyager|Atlas|Global" --include='*.{ts,tsx,json,md,toml,yaml,yml,js,jsx}' .`
- [ ] **Step 2:** Write a test (a single grep-based assertion in a test file, or a build-time check) that fails if any file contains both "Voyager" and "agentic-travel-agent" as product identifiers. FAIL.
- [ ] **Step 3:** Pick one name (recommend: Voyager). Update every reference. Run the grep again. Confirm zero conflicts.
- [ ] **Step 4:** Verification chain. Commit: `fix(CRIT-03): unify product identity to Voyager`

### Task 8: Rewrite README for portfolio demo framing

**Files:**

- Modify: `README.md`

**Triage IDs closed:** (framing)

- [ ] **Step 1:** Test asserts the README opens with a "Portfolio demo" section and links to `docs/audits/2026-04-06-triage.md`. FAIL.
- [ ] **Step 2:** Rewrite the README top to:
  - Frame Voyager as a portfolio demo of the agentic tool-use pattern
  - Name the tech stack in one line (Express + Next.js 15 + Postgres + Claude + SerpApi + Google Places)
  - Link to `docs/audits/` and note "yes, I audited my own work and wrote down what I think is broken"
  - Link to the Criticism audit as a feature, not an embarrassment
  - Link to the engineering audit
- [ ] **Step 3:** Run. PASS. Verification. Commit: `docs(README): reframe as portfolio demo, link to audits`

---

## Group 1: Walkthrough path bulletproof

### Task 9: Fix trip delete without confirmation (UX-01)

**Files:**

- Modify: `web-client/src/app/(protected)/trips/page.tsx`
- Optionally: add `components/ui/AlertDialog.tsx` if no Radix primitive exists yet (or inline a simple confirmation for now and migrate later)

**Triage IDs closed:** UX-01

- [ ] **Step 1:** Write an E2E test: load the trips page, click the delete `×` on a trip card, assert a confirmation dialog appears, click cancel, assert the trip is still in the list; click delete again, confirm, assert the trip is gone. FAIL.
- [ ] **Step 2:** Wrap the delete button in an AlertDialog (Radix or inline). On confirm, call the existing delete mutation.
- [ ] **Step 3:** Run E2E test. PASS.
- [ ] **Step 4:** Verification chain. Commit: `fix(UX-01): add confirmation dialog before trip deletion`

### Task 10: Fix booking confirm auto-advance (UX-02)

**Files:**

- Modify: `web-client/src/components/BookingConfirmation/BookingConfirmation.tsx`

**Triage IDs closed:** UX-02, CRIT-02

- [ ] **Step 1:** E2E test: open a trip in bookable state, click `Confirm Booking`, assert a "Cancel" affordance is visible during the 2.2s spinner, click cancel, assert the trip status is NOT changed to `saved`, the modal returns to review stage. Separately: click confirm, wait, assert `onConfirm` fires only after explicit user action in the spinner stage. FAIL.
- [ ] **Step 2:** Either (a) add a visible Cancel button during the `booking` stage, or (b) remove the auto-advance entirely and require a second click on `Really confirm` after the review. The second option is simpler and more honest.
- [ ] **Step 3:** While you are in this file: since this is a portfolio demo, rename the button from `Confirm Booking` to `Save itinerary` and add a "no actual bookings are made" helper text. That closes CRIT-02 (the trust bomb fake booking flow) at the same time.
- [ ] **Step 4:** Run. PASS. Verification. Commit: `fix(UX-02,CRIT-02): remove fake booking auto-advance, rename to Save itinerary`

### Task 11: Fix "Planning..." literal destination (UX-05)

**Files:**

- Modify: `web-client/src/app/(protected)/trips/new/page.tsx` (line 26)
- Modify: `web-client/src/app/(protected)/trips/page.tsx` (trip card rendering)
- Modify: `web-client/src/app/(protected)/trips/[id]/page.tsx` (trip detail hero)

**Triage IDs closed:** UX-05

- [ ] **Step 1:** E2E test: click "New Trip" on the trips page. Assert the new trip card does not show the literal string "Planning...". Instead it shows "New Trip" or similar. Assert the detail hero does not show "Planning..." either. FAIL.
- [ ] **Step 2:** Change `destination: 'Planning...'` to `destination: null`. Update the trip card and detail hero to fall back to "New Trip" or "Untitled trip" when destination is null.
- [ ] **Step 3:** Run. PASS. Verification. Commit: `fix(UX-05): replace literal Planning placeholder with New Trip fallback`

### Task 12: Fix SSE chat error handling (UX-03)

**Files:**

- Modify: `web-client/src/components/ChatBox/useSSEChat.ts` (lines 73 to 75 and 135 to 139)
- Modify: the Toast component integration in ChatBox

**Triage IDs closed:** UX-03

- [ ] **Step 1:** Test: simulate an SSE error event during a chat turn, assert a Toast appears with the error (not inline text), assert a retry button is present, assert the partial streaming nodes rendered before the error are preserved in the chat history. FAIL.
- [ ] **Step 2:** Replace the raw error assignment to `streamingText` with a Toast call. Add a retry button. Preserve partial streaming nodes in the messages array before clearing the streaming state.
- [ ] **Step 3:** Run. PASS. Verification. Commit: `fix(UX-03): route chat SSE errors through Toast, preserve partial state`

---

## Group 2: Operational basics

### Task 13: Anthropic spending cap, per-user daily token budget, lower maxIterations

**Files:**

- Modify: `server/src/services/AgentOrchestrator.ts` (`DEFAULT_MAX_ITERATIONS`, line ~7)
- Create: `server/src/services/tokenBudget.service.ts`
- Modify: `server/src/services/agent.service.ts` (check token budget before calling orchestrator)
- External: set hard $50/mo cap in Anthropic console (manual; document in a comment in `tokenBudget.service.ts`)

**Triage IDs closed:** FIN-01, FIN-05, FIN-06

- [ ] **Step 1:** Unit test `tokenBudget.service.ts`: increment a Redis counter keyed by `user_id:YYYY-MM-DD`, return the current daily usage, return a boolean `isOverBudget(userId, budget)`. FAIL.
- [ ] **Step 2:** Implement the service.
- [ ] **Step 3:** Test passes. Integration test in `agent.service.test.ts`: mock a user over budget, assert the agent loop refuses to start and returns a graceful error. FAIL.
- [ ] **Step 4:** Wire `isOverBudget` check into `agent.service.ts` before `orchestrator.run()`. Surface a helpful error message. Lower `DEFAULT_MAX_ITERATIONS` from 15 to 8.
- [ ] **Step 5:** Test passes. Verification chain. Commit: `fix(FIN-01,FIN-05,FIN-06): add per-user daily token budget, lower maxIterations to 8`
- [ ] **Step 6:** Manual action: set the $50/mo hard cap in the Anthropic console. Document the date and amount in `docs/BILLING.md` (create if missing).

### Task 14: SerpApi Redis counter and graceful degrade

**Files:**

- Modify: `server/src/services/serpapi.service.ts`
- Modify: `server/src/tools/flights.tool.ts`, `hotels.tool.ts`

**Triage IDs closed:** FIN-02, FIN-07

- [ ] **Step 1:** Unit test: `serpApiGet` checks a Redis monthly counter keyed by `serpapi:YYYY-MM`. If over 200, returns a structured "degraded" result without calling the real API. Below 200, increments the counter after a successful call. FAIL.
- [ ] **Step 2:** Implement the counter. Extend cache TTL from 1h to 6h in `flights.tool.ts` and `hotels.tool.ts`.
- [ ] **Step 3:** Test passes. Test the degraded path: when `degraded: true` is returned, the agent should surface "flight search temporarily unavailable" to the user and not hallucinate flight data.
- [ ] **Step 4:** Verification chain. Commit: `fix(FIN-02,FIN-07): add SerpApi monthly counter, extend cache TTL`

### Task 15: Google Cloud billing cap on Places project

**Files:** none (manual action in GCP console)

**Triage IDs closed:** FIN-03

- [ ] **Step 1:** Set a hard $50/mo billing cap in Google Cloud Console on the Places API project.
- [ ] **Step 2:** Document the date and amount in `docs/BILLING.md`.
- [ ] **Step 3:** Commit: `docs(FIN-03): document GCP Places billing cap`

### Task 16: Harden `/places/photo` proxy (SEC-01)

**Files:**

- Modify: `server/src/routes/places.ts`
- Modify: `server/src/handlers/places/photoProxy.handler.ts`
- Modify: `server/src/middleware/rateLimiter/rateLimiter.ts` (add a dedicated photo-proxy limiter)

**Triage IDs closed:** SEC-01

- [ ] **Step 1:** Integration test: unauthenticated request to `/places/photo` returns 401. Authenticated request with malformed `ref` returns 400. Authenticated request with well-formed `ref` and `maxwidth` in range returns 200. Rate-limited after N requests. FAIL.
- [ ] **Step 2:** Add `requireAuth` to the route. Add a strict regex allowlist for `ref` (Google Places photo references follow a specific shape). Clamp `maxwidth` to a reasonable range (e.g., 64 to 1600). Add a dedicated rate limiter (stricter than the global 100/15m).
- [ ] **Step 3:** Tests pass. Verification. Commit: `fix(SEC-01): require auth, validate ref, clamp maxwidth on places photo proxy`

---

## Group 3: Code-review hygiene

### Task 17: Upgrade dependencies, fix CVEs, add `pnpm audit` to CI (SEC-02)

**Files:**

- Modify: `server/package.json`, `web-client/package.json`
- Modify: `pnpm-lock.yaml` (via pnpm)
- Modify: `.github/workflows/ci.yml` (add audit step)

**Triage IDs closed:** SEC-02, ENG-06

- [ ] **Step 1:** Run `pnpm audit --prod` and capture the current CVE list.
- [ ] **Step 2:** Upgrade `@anthropic-ai/sdk` to `^0.81.0`. Add pnpm overrides for `path-to-regexp` and any transitive issues (lodash, brace-expansion).
- [ ] **Step 3:** Run `pnpm install` and `pnpm audit --prod` again. Confirm zero high-severity findings remain.
- [ ] **Step 4:** Add a `pnpm audit --prod --audit-level high` step to `.github/workflows/ci.yml` that fails the build on high findings.
- [ ] **Step 5:** Run all tests. Verification chain. Commit: `fix(SEC-02,ENG-06): upgrade deps, close 7 CVEs, add pnpm audit to CI`

### Task 18: Tool input allowlist (SEC-03)

**Files:**

- Modify: `server/src/tools/schemas.ts`

**Triage IDs closed:** SEC-03, SEC-14

- [ ] **Step 1:** Unit test: tool call with a pathological `location` / `city` / `origin` / `destination` value (e.g., contains shell metachars, unicode tricks, extremely long strings) is rejected by Zod before reaching the tool executor. FAIL.
- [ ] **Step 2:** Add a restrictive character class and length cap to each affected field (e.g., `z.string().min(1).max(100).regex(/^[\w\s,.'-]+$/)`).
- [ ] **Step 3:** Tests pass. Verification. Commit: `fix(SEC-03,SEC-14): tighten tool input schemas to restrictive allowlist`

### Task 19: Backfill regression tests for critical unpaired fixes (ENG-02)

**Files:**

- Create: `server/src/handlers/chat/chat.conversationLock.test.ts` (for commit `7ad2249`)
- Create: `server/src/repositories/userPreferences/userPreferences.migration.test.ts` (for commit `f5968be`)
- Create: `server/src/middleware/rateLimiter/rateLimiter.ipv6.test.ts` (for commit `bea33cc`)

**Triage IDs closed:** ENG-02 (partial; full closure requires the lefthook gate + the fixes themselves staying green going forward)

- [ ] **Step 1:** For each of the three critical unpaired fixes, write a regression test that asserts the behavior the original fix was trying to protect.
  - `7ad2249` conversation lock: concurrent requests for the same conversation should result in a 409 or similar, not two agent loops running in parallel.
  - `f5968be` preferences migration: `normalizePreferences` correctly migrates a v0 preferences object to v1 without data loss.
  - `bea33cc` rate limiter IPv6: the rate limiter correctly handles IPv6 addresses without crashing.
- [ ] **Step 2:** Run each new test. They should all PASS (the original fix already landed). If any FAILS, the original fix regressed and this task becomes more urgent.
- [ ] **Step 3:** Verification chain. Commit: `test(ENG-02): backfill regression tests for three critical unpaired fixes`

### Task 20: Amadeus schema migration and code cleanup (ENG-03)

**Files:**

- Create: `server/migrations/1771879388560_remove-amadeus-columns.js`
- Modify: `server/src/schemas/trips.ts` (remove `amadeus_offer_id`, `amadeus_hotel_id`)
- Modify: tests in `agent.service.test.ts`, `cache.service.test.ts`, `tool-call-log.test.ts` (replace `'amadeus'` labels with `'serpapi'`)
- Modify: `docs/FULL_APPLICATION_SPEC.md` (replace Amadeus references with SerpApi)

**Triage IDs closed:** ENG-03

- [ ] **Step 1:** Write the down-migration / up-migration test ensuring that removing the columns is safe (no data in the columns, no FK dependencies).
- [ ] **Step 2:** Write the new migration file.
- [ ] **Step 3:** Update `server/src/schemas/trips.ts`.
- [ ] **Step 4:** Update tests and spec doc.
- [ ] **Step 5:** Run migrations locally. Run all tests. Verification chain.
- [ ] **Step 6:** Commit: `fix(ENG-03): remove dead Amadeus schema, tests, and spec references`

### Task 21: Tool executor adapter seam (ENG-04, unblocks Plan B)

**Files:**

- Modify: `server/src/tools/executor.ts`
- Modify: `server/src/services/AgentOrchestrator.ts`
- Modify: each tool file to accept injected adapters
- Create: `server/src/tools/adapters/default.ts` and `mock.ts`
- Modify: `playwright.config.ts` to pass `E2E_MOCK_TOOLS=1` via `webServer.env`

**Triage IDs closed:** ENG-04

- [ ] **Step 1:** Unit test: construct an `AgentOrchestrator` with a `toolAdapters` config that uses mock flights and real hotels. Assert a tool call for `search_flights` invokes the mock adapter and returns the mock result. FAIL (current executor has no adapter seam).
- [ ] **Step 2:** Refactor the executor to accept a `toolAdapters` object mapping tool name to a function returning the result. Default adapters use the real clients. Mock adapters return fixture data.
- [ ] **Step 3:** Wire `E2E_MOCK_TOOLS=1` env check to substitute mock adapters on startup.
- [ ] **Step 4:** Test passes. Add an integration test that boots the server with `E2E_MOCK_TOOLS=1` and runs a full agent turn, asserting the mock fixtures are used.
- [ ] **Step 5:** Verification chain. Commit: `fix(ENG-04): add per-tool adapter seam for E2E mocking`
- [ ] **Step 6:** **This unblocks Plan B.** Plan B's Task 1 now passes its prerequisite check.

---

## Group 4: Demo asset enrichment

### Task 22: Link Criticism audit from README as a feature

**Files:**

- Modify: `README.md` (append section)

**Triage IDs closed:** (demo asset)

- [ ] **Step 1:** Test asserts the README contains a section titled something like "What I think is broken" with a link to `docs/audits/2026-04-06-criticism.md`. FAIL.
- [ ] **Step 2:** Add the section. Quote a few sentences of the Brutal Truth verbatim. Explain that the audit was generated by an autonomous agent running a canonical Criticism role against the codebase, and that linking to it is deliberate.
- [ ] **Step 3:** Run. PASS. Verification. Commit: `docs(demo): link criticism audit from README as deliberate asset`

### Task 23: Create DEMO-WALKTHROUGH.md

**Files:**

- Create: `docs/DEMO-WALKTHROUGH.md`

**Triage IDs closed:** (demo asset)

- [ ] **Step 1:** Write a walkthrough script for a CTO / founder viewer:
  - Landing page: one paragraph on what the demo is and what it is not
  - The agent loop: link to `server/src/services/AgentOrchestrator.ts` and highlight the 15-iteration cap, the Zod-validated executor, the streaming nodes
  - The adapter seam: link to `server/src/tools/adapters/` (created in Task 21) as evidence of testability
  - The 8 audit reports: link to each, note that they were produced by an autonomous multi-agent audit run
  - The unit economics: quote the Criticism audit's math honestly
  - The testing story: link to Plan B artifacts once Plan B lands
  - Known issues: link to `ISSUES.md`
- [ ] **Step 2:** No code change, so no test needed. Verification (format:check will catch Prettier issues).
- [ ] **Step 3:** Commit: `docs(demo): add DEMO-WALKTHROUGH.md`

### Task 24: Add "What's broken" section to README citing Criticism audit

**Files:**

- Modify: `README.md`

**Triage IDs closed:** (demo asset)

- [ ] **Step 1:** (Subsumed into Task 22 if the two naturally merge. Can be combined into one commit.)

---

## Group 5: Polish

Items in this group improve the demo but are not load-bearing. Execute in order; skip any that lose priority based on user review.

### Task 25: Add `prefers-reduced-motion` global block (DES-03, UX-12)

**Files:** `web-client/src/app/globals.scss`

- [ ] Standard test-first. Add `@media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }`. Commit: `fix(DES-03,UX-12): respect prefers-reduced-motion globally`

### Task 26: Typography scale tokens (DES-01)

**Files:** `web-client/src/app/globals.scss`, various SCSS modules

- [ ] Add `--text-xs` through `--text-3xl` tokens. Replace ~40 of the most egregious raw `font-size: Npx` literals with tokens (the audit found 140+; fix the worst and leave the rest for a future sweep). Commit: `fix(DES-01): add type scale tokens, replace worst font-size literals`

### Task 27: Extract shared Button primitive (DES-02)

**Files:** `web-client/src/components/ui/Button/Button.tsx`, `.module.scss`, and replace 6 call sites

- [ ] Test-first. Commit: `fix(DES-02): extract shared Button primitive`

### Task 28: Create `components/ui/` with Radix primitives (DES-04)

**Files:** `web-client/src/components/ui/Dialog/`, `AlertDialog/`, `Toast/`

- [ ] Install Radix UI. Create thin SCSS-module-wrapped components. Commit: `fix(DES-04): scaffold components/ui with Radix primitives`

### Task 29: Migrate BookingConfirmation and PreferencesWizard to Radix Dialog (UX-04)

**Files:** both components plus the new Radix primitives from Task 28

- [ ] Test-first (focus trap, aria-modal, Escape handling). Commit: `fix(UX-04): migrate modal components to Radix Dialog`

### Task 30: Mobile hamburger nav (UX-06)

**Files:** `web-client/src/components/Header/Header.tsx`, `.module.scss`

- [ ] Test at 375px width. Commit: `fix(UX-06): add mobile hamburger nav to header`

### Task 31: Lighthouse a11y pass (UX-07)

**Files:** various, depending on findings

- [ ] Run Lighthouse on every route. Fix color contrast, focus state, aria labels, heading hierarchy until score is 100 on home, login, register, trips, trip detail, account. Commit: `fix(UX-07): lighthouse a11y pass, target 100 on core routes`

### Task 32: Banned words sweep (MKT-04)

**Files:** every visible string in `web-client/src/`

- [ ] Grep for em dashes (globally banned), "delve," "leverage," "unlock," "seamlessly," "world-class," "cutting-edge," "revolutionary". Rewrite each instance. Commit: `fix(MKT-04): banned words sweep across user-facing copy`

### Task 33: Persist token cost, fix cache_hit hardcoded (FIN-04)

**Files:** `server/src/services/agent.service.ts` (line ~68), migration for new columns on `tool_call_log`

- [ ] Test-first. Add `input_tokens`, `output_tokens`, `estimated_cost_usd` columns. Fix `cache_hit: false` hardcoded. Commit: `fix(FIN-04): persist token cost, fix cache_hit observability`

### Task 34: Move rate limiter and activeConversations to Redis (SEC-04)

**Files:** `server/src/middleware/rateLimiter/rateLimiter.ts`, `server/src/handlers/chat/chat.ts`

- [ ] Test-first. Commit: `fix(SEC-04): move rate limiter and conversation lock to Redis`

---

## Group 6: Exit

### Task 35: Final verification, PR creation, merge

- [ ] **Step 1:** Run the full verification chain one more time on every commit in the branch (`git rebase --exec "pnpm format:check && pnpm lint && pnpm test && pnpm build" main`).
- [ ] **Step 2:** Push the branch to the remote.
- [ ] **Step 3:** Create the PR via `gh pr create` with title `fix: audit 2026-04-06 P0/P1 findings` and a body listing every closed triage ID with its commit SHA, grouped by audit category.
- [ ] **Step 4:** Verify the PR is green in CI.
- [ ] **Step 5:** Merge the PR with a merge commit (not squash).
- [ ] **Step 6:** Clean up the worktree.
- [ ] **Step 7:** Update `docs/audits/2026-04-06-triage.md` by annotating each closed P0/P1 item with `**Status: closed in commit <sha>**`. Commit that update separately: `docs(triage): annotate closed P0/P1 items`.

---

## Exit criteria

- [ ] All Group 0 items closed (demo framing, copy fixes, identity cleanup).
- [ ] All Group 1 items closed (walkthrough bulletproof).
- [ ] All Group 2 items closed (operational basics, including manual Anthropic and GCP cap actions documented).
- [ ] All Group 3 items closed (code-review hygiene, ENG-04 adapter seam landed, Plan B unblocked).
- [ ] Group 4 demo assets shipped.
- [ ] At least the top 3 items from Group 5 closed (reduced motion, type scale, Button primitive). Remaining Group 5 items can slip to a follow-up plan without blocking the PR if they are not walkthrough-visible.
- [ ] Single PR merged to `main` preserving per-fix commit history.
- [ ] Triage file annotated with closing commit SHAs.
- [ ] Plan B's ENG-04 prerequisite is satisfied.

---

## Deferred explicitly

These items were in the original Plan C but are dropped under the portfolio-demo framing. They are NOT in ISSUES.md either. They are here as a record of what was deliberately dropped:

- **LEG-05** (Privacy Policy), **LEG-06** (TOS), **LEG-07** (AI disclosure banner, beyond the demo-mode banner in Task 1), **LEG-08** (cookie consent), **LEG-09** (DPAs), **LEG-10** (deletion mechanism), **LEG-11** (USPTO search), **LEG-12** (age gating). None apply to a portfolio demo shown to a handful of named viewers.
- **MKT-03** (OG image, Twitter card, sitemap, robots.txt). No SEO traffic, no value.
- **MKT-05** (destination content rewrite). 30 pages of generic travel content is not walkthrough-critical.
- **MKT-06** (monetization model). No monetization for a portfolio demo.
- **FIN-08** (Amadeus paid account check). Verified by Financial audit to have zero exposure. Noise.

If the product is ever reframed as commercial, these items come back from this list.

---

## Risks

- **Group 5 polish creep.** Design system work has a natural tendency to sprawl. Do not let any Group 5 task exceed a half-day. If a task is taking longer, stop, file it for a future plan, and move on.
- **Adapter seam scope.** Task 21 (ENG-04) is the riskiest task because it touches the executor and every tool file. If the refactor balloons, split the PR: land the adapter seam as one commit that does not break existing behavior, then swap in mock adapters as a second commit.
- **Strategic decision reversal.** If Voyager ever gets reframed as commercial (option B from the earlier Q1), most of the Deferred items come back. Document the current decision in `docs/STRATEGIC-DECISIONS.md` as part of Task 8.
