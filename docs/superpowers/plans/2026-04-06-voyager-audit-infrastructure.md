# Voyager Audit Infrastructure & Triage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 8 Voyager-tailored audit slash-commands (thin wrappers over the canonical role definitions at `~/.claude/audits/<role>.md`), run them in parallel, and triage the findings into a P0/P1 fix queue plus a P2/P3 `ISSUES.md` rolling log.

**Architecture:** Phase 1 writes 8 thin prompt files under `.claude/commands/`, each of which delegates to the corresponding canonical role file at `~/.claude/audits/<role>.md` and adds only Voyager-specific inputs (file paths, project-specific concerns, output location). Phase 2 dispatches 8 subagents in parallel using `isolation: "worktree"` so concurrent commits never conflict; each subagent reads its canonical role file for persona + required sections + disposition, then applies that role to the Voyager codebase. Phase 3 reads all 8 audit files and produces a single consolidated triage document plus an `ISSUES.md` update.

**Canonical role list (from `~/.claude/CLAUDE.md` Audit Roles section):** engineering, ux, design, marketing, financial, security, legal, criticism.

**Layering rule:** anything that would apply to any project (persona, mission, required report sections, disposition) lives at the top level in `~/.claude/audits/<role>.md` and is never duplicated. Anything Voyager-specific (file paths, agent-loop concerns, SerpApi quota, dead Amadeus references, monorepo structure) lives in the project command.

**Tech Stack:** Claude Code slash-commands (Markdown prompts), Agent tool with worktree isolation. No Playwright/Vitest work in this plan.

**Scope note:** This plan covers Phases 1–3 of the full design at `docs/superpowers/specs/2026-04-06-doppelscript-learnings-to-voyager-design.md`. Phase 4 (E2E coverage) and Phase 5 (test gates + P0/P1 fixes) will be written as separate plans (Plan B and Plan C) after this plan completes and the triage file exists — those plans depend on the triage output to scope prerequisite fixes and P0/P1 fix queues.

**Source spec:** `docs/superpowers/specs/2026-04-06-doppelscript-learnings-to-voyager-design.md`

**Working branch:** `plan/audit-2026-04-06` in the worktree at `.claude/worktrees/plan-audit-2026-04-06/`

---

## File structure

Files created or modified by this plan:

```
voyager/
├── .claude/commands/
│   ├── audit-engineering.md    [CREATE — thin wrapper]
│   ├── audit-security.md       [CREATE — thin wrapper]
│   ├── audit-design.md         [CREATE — thin wrapper]
│   ├── audit-ux.md             [CREATE — thin wrapper]
│   ├── audit-marketing.md      [CREATE — thin wrapper]
│   ├── audit-financial.md      [CREATE — thin wrapper]
│   ├── audit-legal.md          [CREATE — thin wrapper]
│   └── audit-criticism.md      [CREATE — thin wrapper]
├── docs/audits/                [CREATE directory]
│   ├── .gitkeep                [CREATE — tracks empty dir before Phase 2]
│   ├── 2026-04-06-engineering.md    [CREATE by subagent in Phase 2]
│   ├── 2026-04-06-security.md       [CREATE by subagent in Phase 2]
│   ├── 2026-04-06-design.md         [CREATE by subagent in Phase 2]
│   ├── 2026-04-06-ux.md             [CREATE by subagent in Phase 2]
│   ├── 2026-04-06-marketing.md      [CREATE by subagent in Phase 2]
│   ├── 2026-04-06-financial.md      [CREATE by subagent in Phase 2]
│   ├── 2026-04-06-legal.md          [CREATE by subagent in Phase 2]
│   ├── 2026-04-06-criticism.md      [CREATE by subagent in Phase 2]
│   └── 2026-04-06-triage.md         [CREATE in Phase 3]
└── ISSUES.md                   [CREATE or APPEND in Phase 3]
```

**Conventions:**

- Audit command files are Markdown prompts. They have no tests of their own; the "test" is that Phase 2 runs them successfully.
- Tasks 2–9 (writing the 8 commands) are short because each is a thin wrapper.
- Phase 2 and Phase 3 have verification steps (file existence, required section presence, every finding traced) that act as their tests.

---

## Task 1: Scaffold `docs/audits/` directory

**Files:**

- Create: `docs/audits/.gitkeep`

- [ ] **Step 1: Verify current state**

Run: `ls docs/ 2>&1`

Expected: `audits/` subdirectory does not exist yet.

- [ ] **Step 2: Create the directory and `.gitkeep` sentinel**

Use the Write tool to create `docs/audits/.gitkeep` with empty content. (Write creates parent directories automatically.)

- [ ] **Step 3: Verify creation**

Run: `ls -la docs/audits/`

Expected: `.gitkeep` exists.

- [ ] **Step 4: Do NOT commit yet**

Bundled into the Phase 1 commit in Task 10.

---

## Task 2: Write `audit-engineering.md` command

**Files:**

- Create: `.claude/commands/audit-engineering.md`

- [ ] **Step 1: Write the thin-wrapper command file**

Use the Write tool to create `.claude/commands/audit-engineering.md` with this exact content:

```markdown
# /audit-engineering — Voyager Engineering Audit

Invoke the canonical Engineering (CTO) audit role. **Your persona, mission, advisory autonomy, required report sections, failure modes, and disposition are all defined in `~/.claude/audits/engineering.md` — read that file first.** This command only adds Voyager-specific context on top of the canonical role.

## Voyager-specific context

Apply the canonical Engineering role to the Voyager codebase with these project-specific inputs.

**Primary read targets:**

- `server/` — Express API, services, repositories, handlers, middleware
- `web-client/` — Next.js 15 frontend
- `packages/` — shared packages across the pnpm workspace
- `server/migrations/` — Postgres migrations (pg driver, raw SQL, no ORM)
- `Dockerfile.server`, `railway.toml` — deploy config
- `.github/workflows/` — CI / CD (if present)
- `lefthook.yml` — pre-commit / pre-push hooks

**Voyager-specific concerns to evaluate carefully:**

- **Agent loop correctness** — `server/src/services/agent.service.ts` and related tool executor code. Evaluate tool-call budget enforcement (max 15 per turn), malformed tool-response handling, reasoning-between-calls integrity, streaming behavior, and critically: **does the tool executor support adapter injection so E2E tests can swap SerpApi / Google Places for mocks via an env flag? This is a prerequisite for Plan B (E2E coverage).** If adapters are not supported, flag it as P1.
- **External API integration** — SerpApi caching + quota management (250 searches/month free tier is unforgiving), Google Places rate limiting, retry logic, cost per agent turn in Claude tokens.
- **Monorepo hygiene** — pnpm workspace structure, shared types between `server/` and `web-client/`, duplication across packages.
- **Dead Amadeus references** — `server/src/schemas/trips.ts` has `amadeus_offer_id` / `amadeus_hotel_id` columns, and several tests reference Amadeus as a label string, but there is no Amadeus client in `server/src/`. Call out this spec-vs-implementation drift and recommend either removing the dead references or actually implementing the integration.
- **Docker & Railway build** — `Dockerfile.server` multi-stage effectiveness, image size, env var hygiene, `railway.toml` `dockerfilePath` correctness.
- **E2E readiness** — per the canonical role's "Operational Basics" requirement: do E2E tests exist? Are they wired to any trigger (pre-push, CI, nightly)? Voyager currently has only minimal E2E coverage — `e2e/auth.spec.ts` and `e2e/navigation.spec.ts`. Flag the gap.

**Project convention files (read before writing):**

- `.claude/bottomlessmargaritas/CLAUDE-BACKEND.md`
- `.claude/bottomlessmargaritas/CLAUDE-DATABASE.md`
- `.claude/bottomlessmargaritas/CLAUDE-FRONTEND.md`
- `.claude/bottomlessmargaritas/CLOUD-DEPLOYMENT.md`

**Product documents:**

- `docs/FULL_APPLICATION_SPEC.md`
- `docs/USER_STORIES.md`
- `CLAUDE.md` (project root)
- `README.md`

## Output

- **File:** `docs/audits/YYYY-MM-DD-engineering.md` (use today's date)
- **Commit:** to the current branch. Do not create a separate audit branch.
- **Report back:** executive summary plus the top 3 blockers per the canonical role's required output format.
```

- [ ] **Step 2: Verify the file**

Read the file back and confirm it references `~/.claude/audits/engineering.md`, lists Voyager-specific concerns (agent loop, SerpApi, Amadeus, adapter injection), and writes output to `docs/audits/YYYY-MM-DD-engineering.md`. The file should be ~60 lines.

- [ ] **Step 3: Do NOT commit yet**

---

## Task 3: Write `audit-security.md` command

**Files:**

- Create: `.claude/commands/audit-security.md`

- [ ] **Step 1: Write the thin-wrapper command file**

Use the Write tool to create `.claude/commands/audit-security.md` with this exact content:

```markdown
# /audit-security — Voyager Security Audit

Invoke the canonical Security (CISO) audit role. **Your persona, mission, advisory autonomy, required report sections, failure modes, and disposition are all defined in `~/.claude/audits/security.md` — read that file first.** This command only adds Voyager-specific context on top of the canonical role.

## Voyager-specific context

Apply the canonical Security role to the Voyager codebase with these project-specific inputs.

**Primary read targets:**

- `server/src/` — all auth, middleware, agent loop, tool executors, API routes
- `server/migrations/` — schema for RLS-relevant tables
- `web-client/src/` — auth flows, API calls, credential handling
- `Dockerfile.server`, `railway.toml`, environment variable configuration
- `package.json` and `pnpm-lock.yaml` for dependency vulnerability review

**Voyager-specific concerns to evaluate carefully:**

- **LLM & agent loop security** — how is the Anthropic API key handled inside the agent loop? Can it leak through tool results, error messages, or response streams? Is the max-15 tool-call budget enforced? Are malformed tool responses handled safely?
- **Prompt injection surface** — Voyager takes free-text user messages and feeds them into Claude's tool-use loop, which then constructs queries to SerpApi and Google Places. Evaluate the injection path: user message → agent reasoning → tool call arguments → third-party API query. What is the worst an attacker can do with a crafted user message?
- **External API key management** — SerpApi key, Google Places key, Anthropic key. Rotation hygiene, scoping per environment (dev/staging/prod), env var scoping across Railway and Vercel.
- **Supabase auth & RLS** — is Supabase auth configured correctly? Are RLS policies in place on trip data so users can only see their own trips?
- **CSRF pattern** — verify which variant Voyager uses (header-based or cookie-based) and evaluate whether it works with Vercel preview URL origins.
- **CORS config** — `CORS_ORIGIN` is comma-separated for Railway; confirm every preview URL origin is covered and credentials flow works.
- **Known-issues cross-check** — read `~/.claude/KNOWN-ISSUES.md` for prior incident patterns (CSRF SameSite, cookie scoping, Vercel env var baking) and verify none are repeated in Voyager.

**Project convention files (read before writing):**

- `.claude/bottomlessmargaritas/CLAUDE-BACKEND.md`
- `.claude/bottomlessmargaritas/CLOUD-DEPLOYMENT.md`

**Product documents:**

- `docs/FULL_APPLICATION_SPEC.md`
- `CLAUDE.md`

## Output

- **File:** `docs/audits/YYYY-MM-DD-security.md` (use today's date)
- **Commit:** to the current branch.
- **Report back:** executive summary, top 3 critical findings, and any credential / config requiring immediate rotation or hardening.
```

- [ ] **Step 2: Verify the file**

Read back and confirm it references `~/.claude/audits/security.md`, includes prompt-injection and LLM-specific concerns, and references `~/.claude/KNOWN-ISSUES.md`. ~55 lines.

- [ ] **Step 3: Do NOT commit yet**

---

## Task 4: Write `audit-design.md` command

**Files:**

- Create: `.claude/commands/audit-design.md`

- [ ] **Step 1: Write the thin-wrapper command file**

Use the Write tool to create `.claude/commands/audit-design.md` with this exact content:

```markdown
# /audit-design — Voyager Design Audit

Invoke the canonical Design (CDO) audit role. **Your persona, mission, advisory autonomy, required report sections, failure modes, and disposition are all defined in `~/.claude/audits/design.md` — read that file first.** This command only adds Voyager-specific context on top of the canonical role.

## Voyager-specific context

Apply the canonical Design role to the Voyager web-client with these project-specific inputs.

**Primary read targets:**

- `web-client/src/app/` — Next.js 15 App Router pages (home, explore, destinations, trips, account)
- `web-client/src/components/` — all shared components
- `web-client/src/styles/` — global styles, CSS custom properties, design tokens
- SCSS modules throughout the web-client (`*.module.scss`)
- Image assets in `web-client/public/`

**Voyager-specific surfaces to evaluate carefully:**

- **Home page** — hero carousel (5 destination photos), feature highlight cards, live demo chat (MockChatBox), CTAs ("Get Started", "Discover destinations"). Does the visual execution match a premium travel brand?
- **Explore page** — 30-destination grid with category filtering. Card consistency, photography quality, responsive grid behavior.
- **Destination detail pages** — hero, quick stats bar, about, top experiences, dining, neighborhoods, weather chart, visa info, "Plan a trip" CTA. Information density vs. calm layout.
- **Chat & trip pages** — the chat UI is the product's core. Evaluate message bubbles, loading/thinking indicators during tool calls, tile-card layouts for flights/hotels/experiences, selection states, confirmation flows.
- **Itinerary display** — how is a completed trip presented? Visual hierarchy across flights, hotels, activities.
- **Mobile breakpoints** — test at 375, 390, 414 widths. The itinerary and chat experience on mobile are critical.

**Project convention files (read before writing):**

- `.claude/bottomlessmargaritas/CLAUDE-FRONTEND.md`
- `.claude/bottomlessmargaritas/CLAUDE-STYLING.md`

**Product documents:**

- `docs/FULL_APPLICATION_SPEC.md`
- `docs/USER_STORIES.md`

## Output

- **File:** `docs/audits/YYYY-MM-DD-design.md` (use today's date)
- **Commit:** to the current branch.
- **Report back:** executive summary and the top 3 style-drift or visual-consistency issues.
```

- [ ] **Step 2: Verify the file**

Read back and confirm. ~50 lines.

- [ ] **Step 3: Do NOT commit yet**

---

## Task 5: Write `audit-ux.md` command

**Files:**

- Create: `.claude/commands/audit-ux.md`

- [ ] **Step 1: Write the thin-wrapper command file**

Use the Write tool to create `.claude/commands/audit-ux.md` with this exact content:

```markdown
# /audit-ux — Voyager UX Audit

Invoke the canonical UX (Chief Experience Officer) audit role. **Your persona, mission, advisory autonomy, required report sections, failure modes, and disposition are all defined in `~/.claude/audits/ux.md` — read that file first.** This command only adds Voyager-specific context on top of the canonical role.

## Voyager-specific context

Apply the canonical UX role to Voyager with these project-specific inputs.

**Primary read targets:**

- `web-client/src/app/` — every page / route
- `web-client/src/components/` — especially the chat UI, tile-card flow, and any wizard / onboarding components
- `docs/USER_STORIES.md` — **exhaustively walk through every user story (US-1 through US-35)** per the canonical role's User Story Coverage requirement. For each story, mark passed / failed / blocked with evidence, and flag any story without an E2E test.
- `e2e/` — current E2E coverage (expect only `auth.spec.ts` and `navigation.spec.ts`; everything else is a coverage gap)

**Voyager-specific surfaces to evaluate carefully:**

- **Conversational agent UX** — Voyager's core value is a multi-turn chat with Claude that calls tools (flights, hotels, experiences) mid-conversation. Evaluate: turn latency perception, loading states during tool calls, tool-call transparency (can users see what the agent is doing? what it found? why it chose this flight?), perceived user control, how users feel when the agent makes decisions for them.
- **Error recovery mid-conversation** — what happens if a tool call fails, if Claude hallucinates a result, if SerpApi returns empty, or if the user changes their mind mid-plan? Can the user undo? Can they steer the agent back on track?
- **Trip iteration experience** — per user stories US-16 through US-24 (chat & booking flow), how does a user iterate on a plan? Swap a flight? Adjust budget? Undo a confirmed tile-card selection?
- **Onboarding & preferences wizard** — US-29 through US-33. Is the wizard's time-to-value acceptable? Does it explain what the product does?
- **Destructive / paid action guardrails** — US-27 ("Confirm and book the trip") is the most sensitive. Confirmation dialog required, clear itemized breakdown, no one-click-book footguns.
- **User story coverage gap** — flag that only 2 of 35 user stories currently have E2E coverage. This is the biggest UX-hygiene finding and feeds directly into Plan B (E2E coverage).

**Product documents:**

- `docs/FULL_APPLICATION_SPEC.md`
- `docs/USER_STORIES.md`
- `CLAUDE.md`

## Output

- **File:** `docs/audits/YYYY-MM-DD-ux.md` (use today's date)
- **Commit:** to the current branch.
- **Report back:** executive summary, yes/no on whether a new user can complete the primary happy path without help, and the full user story coverage table.
```

- [ ] **Step 2: Verify the file**

Read back. ~55 lines.

- [ ] **Step 3: Do NOT commit yet**

---

## Task 6: Write `audit-marketing.md` command

**Files:**

- Create: `.claude/commands/audit-marketing.md`

- [ ] **Step 1: Write the thin-wrapper command file**

Use the Write tool to create `.claude/commands/audit-marketing.md` with this exact content:

```markdown
# /audit-marketing — Voyager Marketing Audit

Invoke the canonical Marketing (CMO) audit role. **Your persona, mission, advisory autonomy, required report sections, failure modes, and disposition are all defined in `~/.claude/audits/marketing.md` — read that file first.** This command only adds Voyager-specific context on top of the canonical role.

## Voyager-specific context

Apply the canonical Marketing role to Voyager with these project-specific inputs.

**Primary read targets:**

- `web-client/src/app/page.tsx` and any landing-related components (hero carousel, feature cards, MockChatBox demo, CTAs)
- `web-client/src/app/explore/` — destination browse page (marketing as much as it is product)
- `web-client/src/app/destinations/[slug]/` — destination detail pages (thin SEO vs. real travel content)
- `web-client/src/app/faq/` — FAQ page
- Meta tags, OG images, `layout.tsx` for SEO surface area
- `README.md` for intended positioning

**Voyager-specific concerns to evaluate carefully:**

- **Positioning** — how is Voyager described? "AI travel agent" vs. "agentic travel planner" vs. "Kayak but smarter" vs. something else? Who is the target persona and does the copy speak to them?
- **Competitive positioning** — how does Voyager stand against legacy competitors (Kayak, Expedia, Booking.com) AND generic LLM competitors (ChatGPT with browsing, Perplexity)? What is the moat? Where is it vulnerable?
- **Destination content quality** — do the 30 destination detail pages read as high-quality travel content that builds trust, or as thin SEO pages? For each detail page area (about, experiences, dining, neighborhoods, weather, visa), is the voice authoritative or generic?
- **Banned-word check** — scan landing / FAQ / destination copy for em dashes used for drama, "delve," "leverage," "unlock," "seamlessly," "world-class," "cutting-edge," "revolutionary," and empty superlatives. Flag every instance.
- **CTAs & microcopy** — button labels, empty states, error messages throughout the product.
- **Trust signals** — testimonials? Social proof? Pricing transparency? "Real bookings" vs. "research only" positioning clarity?

**Product documents:**

- `docs/FULL_APPLICATION_SPEC.md`
- `README.md`

## Output

- **File:** `docs/audits/YYYY-MM-DD-marketing.md` (use today's date)
- **Commit:** to the current branch.
- **Report back:** executive summary, the one-sentence "what is this product and who is it for," and the top 3 copy rewrites.
```

- [ ] **Step 2: Verify the file**

Read back. ~50 lines.

- [ ] **Step 3: Do NOT commit yet**

---

## Task 7: Write `audit-financial.md` command

**Files:**

- Create: `.claude/commands/audit-financial.md`

- [ ] **Step 1: Write the thin-wrapper command file**

Use the Write tool to create `.claude/commands/audit-financial.md` with this exact content:

```markdown
# /audit-financial — Voyager Financial Audit

Invoke the canonical Financial (CFO) audit role. **Your persona, mission, advisory autonomy, required report sections, failure modes, and disposition are all defined in `~/.claude/audits/financial.md` — read that file first.** This command only adds Voyager-specific context on top of the canonical role.

## Voyager-specific context

Apply the canonical Financial role to Voyager with these project-specific inputs.

**Paid services to inventory:**

- **Anthropic** — Claude API for the agent loop. Cost per agent turn in tokens. Is there a hard monthly spending cap configured? Voyager's agent loop can call tools up to 15 times per turn, and tool calls are billed.
- **SerpApi** — Google Flights + Google Hotels. Free tier is **250 searches / month**. This is uncomfortably close to exhaustion after even light testing. Calculate the realistic searches-per-trip-plan and divide into 250 to project how many trip plans the free tier supports.
- **Google Places API** — for experiences / destination content. What tier? What is the per-request cost?
- **Railway** — API server + Postgres (Neon is separate or hosted on Railway?). Plan, current monthly cost, resource usage.
- **Vercel** — web-client deployment. Plan, usage.
- **Neon** — Postgres (if hosted here rather than Railway). Plan, usage.
- **Supabase** — auth. Plan, MAU.
- **Any other service referenced in env vars** — scan `.env.example` and deploy configs for clues.

**Voyager-specific concerns to evaluate carefully:**

- **Unit economics** — what is the projected cost per full trip plan (one end-to-end multi-turn agent conversation)? Anthropic tokens + SerpApi searches + Google Places calls + Postgres queries. Compare to any monetization model (currently: none visible — so every trip plan is subsidized cost with no revenue).
- **Free-tier cliffs** — SerpApi 250/month is the most dangerous. What happens on search 251? Does the agent loop crash, degrade, or fall back? Is there a cache that reduces calls per search?
- **Missing spending caps** — every third-party API should have a hard monthly cap configured. Flag each that does not. Anthropic in particular is a P0 risk — an infinite tool-call loop bug could produce a five-figure surprise bill in hours.
- **Cache effectiveness** — the spec mentions aggressive SerpApi caching. Evaluate `server/src/services/cache.service.ts` and related code. Is the cache actually saving calls?
- **Dead paid integrations** — Amadeus is referenced in the spec and schema but there is no actual client. Is a paid account accidentally provisioned for it?

**Product documents:**

- `docs/FULL_APPLICATION_SPEC.md`
- `CLAUDE.md` (especially the "Critical implementation note" about SerpApi free tier)
- `README.md`

## Output

- **File:** `docs/audits/YYYY-MM-DD-financial.md` (use today's date)
- **Commit:** to the current branch.
- **Report back:** projected cost per trip plan, the free-tier cliff analysis (how many trips before SerpApi / Anthropic caps are hit), and any missing spending caps as P0 findings.
```

- [ ] **Step 2: Verify the file**

Read back. ~55 lines.

- [ ] **Step 3: Do NOT commit yet**

---

## Task 8: Write `audit-legal.md` command

**Files:**

- Create: `.claude/commands/audit-legal.md`

- [ ] **Step 1: Write the thin-wrapper command file**

Use the Write tool to create `.claude/commands/audit-legal.md` with this exact content:

```markdown
# /audit-legal — Voyager Legal & Compliance Audit

Invoke the canonical Legal & Compliance audit role. **Your persona, mission, advisory autonomy, required report sections, failure modes, and disposition are all defined in `~/.claude/audits/legal.md` — read that file first.** This command only adds Voyager-specific context on top of the canonical role.

## Voyager-specific context

Apply the canonical Legal role to Voyager. **Expected output is a checklist of missing legal documents rather than findings in existing ones** — Voyager is an early-stage product and is unlikely to have Terms of Service, a Privacy Policy, or any of the other legally-required documents yet. The audit's job is to enumerate what is missing, not to critique what exists.

**Things to look for (and expect to be missing):**

- **Terms of Service** — does any page link to a `/terms` or similar? Is there a TOS markdown file anywhere in the repo?
- **Privacy Policy** — does any page link to `/privacy`? Is there a policy document? If it exists, does it match Voyager's actual data handling (which includes sending user messages to Anthropic's API for LLM processing)?
- **Cookie Policy / Consent** — does the product set any non-essential cookies? Is there a consent mechanism?
- **Data Processing Agreements** — with Anthropic (LLM provider processing user trip queries), SerpApi (search queries), Google Places (location searches), Supabase (auth + user data), Neon / Railway (database host). These are all third-party data processors under GDPR.
- **AI disclosures** — Voyager is an AI product. Is it clearly disclosed to users that their trip queries are processed by an LLM? Are model accuracy claims substantiated?
- **Travel booking legal** — if the product actually books trips (as opposed to "research only"), there is a large additional legal surface: fiduciary responsibility, consumer protection, refund handling. If it is "research only," the positioning must say so clearly.
- **Accessibility compliance** — ADA / EAA exposure based on target markets.
- **Marketing claims** — "AI travel agent" is a claim. Does the product do what that phrase implies?

**Primary read targets:**

- `web-client/src/app/` — look for `/terms`, `/privacy`, `/cookies`, or any legal page
- `web-client/src/app/layout.tsx` — cookie consent banner? Footer legal links?
- Everything referenced in `docs/FULL_APPLICATION_SPEC.md` around data handling
- `README.md`

## Output

- **File:** `docs/audits/YYYY-MM-DD-legal.md` (use today's date)
- **Commit:** to the current branch.
- **Report back:** compliance posture (Missing / Partial / Adequate), the checklist of missing legal documents, and the top 3 launch blockers (items that must exist before Voyager can be shown publicly without legal exposure).
```

- [ ] **Step 2: Verify the file**

Read back. ~45 lines.

- [ ] **Step 3: Do NOT commit yet**

---

## Task 9: Write `audit-criticism.md` command

**Files:**

- Create: `.claude/commands/audit-criticism.md`

- [ ] **Step 1: Write the thin-wrapper command file**

Use the Write tool to create `.claude/commands/audit-criticism.md` with this exact content:

```markdown
# /audit-criticism — Voyager Criticism Audit

Invoke the canonical Criticism (Devil's Advocate) audit role. **Your persona, mission, advisory autonomy, required report structure, failure modes, and disposition are all defined in `~/.claude/audits/criticism.md` — read that file first.** This command only adds Voyager-specific context on top of the canonical role.

## Voyager-specific context

Apply the canonical Criticism role to Voyager. Your job is to evaluate whether the product should exist in its current form, not whether it is well-executed. The other 7 audits will cover execution quality — yours covers intent, strategy, unit economics, moat, and organizational self-deception.

**Voyager-specific concerns you are expected to address directly:**

- **The core idea** — is "agentic AI travel planner" a real product category or a feature? Is this solving a problem anyone actually has, or is it a tech demo that needs a use case?
- **Unit economics (REQUIRED — see canonical role's Business Model Problem section)** — Voyager's per-trip cost structure is the most obvious strategic risk:
  - Anthropic tokens per agent turn × 3–5 turns per trip × average turn size
  - SerpApi searches per trip (250 free tier / month divides by calls-per-trip = how many trips before you're paying)
  - Google Places calls per trip
  - **Do the unit economics work?** Show the math. If the free tier supports fewer than N trips per month before paid tiers kick in, flag it.
- **Moat** — what prevents ChatGPT Plus with browsing from eating this category? What prevents Kayak or Expedia from adding "chat to plan a trip"? What does Voyager know or do that competitors cannot replicate in 6 months?
- **Positioning drift** — the spec calls it an "Agentic Travel Agent" but the repo was renamed to "Voyager." Is the product's identity clear to the team? Clear to users?
- **Dead code as signal** — the dead Amadeus references (in `server/src/schemas/trips.ts`, migrations, tests, docs) suggest a feature was planned, partially scoped, and abandoned without cleanup. What does this say about the team's decision discipline?
- **Real bookings vs. research-only** — does Voyager actually book trips, or does it just generate itineraries? The difference is massive from a legal, business model, and trust standpoint. If it is research-only, why would a user pay for it vs. using ChatGPT?
- **User story reality check** — do the 35 user stories in `docs/USER_STORIES.md` describe a product users would actually pay for, or do they describe a feature tour?

**Read EVERYTHING** per the canonical role's instructions: full codebase, `docs/FULL_APPLICATION_SPEC.md`, `docs/USER_STORIES.md`, the landing page, the agent loop, the database schema, deployment config, marketing copy, `README.md`, recent commit history.

## Output

- **File:** `docs/audits/YYYY-MM-DD-criticism.md` (use today's date)
- **Commit:** to the current branch.
- **Report back:** the one-paragraph "Brutal Truth" and the top 5 things to fix before showing Voyager to anyone.
```

- [ ] **Step 2: Verify the file**

Read back. ~55 lines.

- [ ] **Step 3: Do NOT commit yet**

---

## Task 10: Commit Phase 1 — all 8 audit commands + `.gitkeep`

**Files:**

- Stage and commit the files from Tasks 1–9.

- [ ] **Step 1: Verify all 8 audit commands exist**

Run: `ls .claude/commands/audit-*.md`

Expected output (alphabetical):

```
.claude/commands/audit-criticism.md
.claude/commands/audit-design.md
.claude/commands/audit-engineering.md
.claude/commands/audit-financial.md
.claude/commands/audit-legal.md
.claude/commands/audit-marketing.md
.claude/commands/audit-security.md
.claude/commands/audit-ux.md
```

- [ ] **Step 2: Verify `.gitkeep` exists**

Run: `ls -la docs/audits/`

Expected: `.gitkeep` present.

- [ ] **Step 3: Verify every command references its canonical role file**

Use the Grep tool: `pattern: "~/.claude/audits/"`, `path: ".claude/commands"`, `output_mode: "files_with_matches"`.

Expected: all 8 audit-\*.md files listed.

- [ ] **Step 4: Verify no file tries to create a new audit branch**

Use the Grep tool: `pattern: "Create and check out a new branch|create a new branch|create a new audit branch"`, `path: ".claude/commands"`, `output_mode: "files_with_matches"`.

Expected: zero matches.

- [ ] **Step 5: Verify every command writes to `docs/audits/YYYY-MM-DD-<role>.md`**

Use the Grep tool: `pattern: "docs/audits/YYYY-MM-DD-"`, `path: ".claude/commands"`, `output_mode: "files_with_matches"`.

Expected: all 8 audit-\*.md files listed.

- [ ] **Step 6: Stage and commit**

Run:

```bash
git add .claude/commands/audit-engineering.md .claude/commands/audit-security.md .claude/commands/audit-design.md .claude/commands/audit-ux.md .claude/commands/audit-marketing.md .claude/commands/audit-financial.md .claude/commands/audit-legal.md .claude/commands/audit-criticism.md docs/audits/.gitkeep
```

Then:

```bash
git status
```

Expected: 9 new files staged. No other changes.

Commit:

```bash
git commit -m "$(cat <<'EOF'
feat: add Voyager-tailored audit slash-commands (8 roles)

Adds thin-wrapper audit slash-commands under .claude/commands/ for the
8 canonical audit roles defined at ~/.claude/audits/<role>.md:
engineering, security, design, ux, marketing, financial, legal,
criticism.

Each command delegates persona, mission, advisory autonomy, required
report sections, failure modes, and disposition to the canonical
top-level role file and adds only Voyager-specific context: file
paths, agent-loop concerns, SerpApi quota, dead Amadeus references,
user-story coverage gap, unit-economics questions, and the
prerequisite-for-E2E-mocking check on the tool executor.

Every command writes its audit output to
docs/audits/YYYY-MM-DD-<role>.md and commits to the current branch.

Also adds docs/audits/.gitkeep so the directory exists in git before
any audit files are written into it.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds. Lefthook pre-commit runs `format:check` and `lint` — since the changes are Markdown only, both should pass.

- [ ] **Step 7: Verify the commit**

Run: `git log --oneline -1 && git show --stat HEAD`

Expected: latest commit is `feat: add Voyager-tailored audit slash-commands (8 roles)` with 9 files changed.

---

## Task 11: Phase 2 — dispatch 8 audit subagents in parallel

**Files:**

- Created by subagents: the 8 dated audit files in `docs/audits/`.

**Overview:** Issue 8 `Agent` tool calls in a single message (true parallelism). Each uses `isolation: "worktree"`. Each agent receives the full prompt content from its corresponding audit command file (Tasks 2–9) and is told explicitly to read its canonical role file first, then write its audit file to the worktree at `docs/audits/2026-04-06-<role>.md`, commit it, and return the final file contents in its response.

- [ ] **Step 1: Confirm today's date for the audit filenames**

Today's date is **2026-04-06**. If executing on a different date, substitute that date everywhere below.

- [ ] **Step 2: Read each of the 8 audit command files**

Use the Read tool on each of:

- `.claude/commands/audit-engineering.md`
- `.claude/commands/audit-security.md`
- `.claude/commands/audit-design.md`
- `.claude/commands/audit-ux.md`
- `.claude/commands/audit-marketing.md`
- `.claude/commands/audit-financial.md`
- `.claude/commands/audit-legal.md`
- `.claude/commands/audit-criticism.md`

Keep the full content in context — it becomes each subagent's prompt body.

- [ ] **Step 3: Dispatch all 8 agents in a single message**

In ONE assistant message, issue 8 parallel `Agent` tool calls. For each agent:

- `subagent_type`: `"general-purpose"`
- `isolation`: `"worktree"` (REQUIRED — each audit commits to git; without worktree isolation the 8 agents would clobber each other)
- `description`: e.g. `"Engineering audit"`, `"Security audit"`, `"Financial audit"`, etc. (3–5 words)
- `model`: `"opus"` (audits benefit from the strongest model)
- `prompt`: the FULL content of the matching project audit command file PLUS this execution appendix:

```
---

## Execution notes for this subagent

- You are running inside an isolated git worktree of the Voyager repo.
- Today's date is 2026-04-06. Write your audit file to EXACTLY this path: docs/audits/2026-04-06-<role>.md (replacing <role> with your audit type, e.g. "engineering").
- FIRST, read the canonical role file at ~/.claude/audits/<role>.md to get your full persona, mission, advisory autonomy, required report sections, failure modes, and disposition. The project command above provides ONLY Voyager-specific context on top of the canonical role.
- After writing the file, commit it to the current branch with a message like: "audit: <role> 2026-04-06".
- In your final response to the parent session, include: (a) a ~5-sentence executive summary of your top findings, (b) the full contents of the audit file you wrote (so the parent can consolidate all 8 onto real branch).
- Do NOT invoke any other audit. Do NOT dispatch further subagents. Just do the one audit.
- Be specific. Reference actual files, functions, line numbers, copy, or config. Generic reports will be rejected and re-dispatched.
- The project command has already told you not to create a new audit branch — commit to the current branch (which is the worktree's branch).
```

Dispatch all 8 in a single message so they run in parallel.

- [ ] **Step 4: Wait for all 8 subagents to complete**

The Agent tool returns each subagent's final message. For each, extract:

- The file contents for the audit file (to be committed in Task 12)
- The executive summary (for the handoff report in Task 17)

**Truncation fallback:** If any subagent's output is truncated and the audit file content is incomplete, read the file directly from the worktree path returned by the Agent tool (typically `.claude/worktrees/<task-id>-<branch>/docs/audits/2026-04-06-<role>.md`). Use `git worktree list` to locate worktrees if needed.

- [ ] **Step 5: Verify subagent output quality**

For each of the 8 audit file contents received, spot-check:

- Does it mention at least 3 specific file paths (e.g., `server/src/services/agent.service.ts`)?
- Does it have the section headings required by the canonical role file?
- Is the Prioritized Recommendations (or equivalent) section populated with at least 3 items with severity / effort tags?

If any audit fails these checks, re-dispatch that single audit with stricter wording ("Your prior response was too generic — reference specific files and line numbers, not general principles").

- [ ] **Step 6: Do NOT commit yet**

Task 12 consolidates the files onto the plan branch.

---

## Task 12: Consolidate audit files onto plan branch + commit Phase 2

**Files:**

- Create on `plan/audit-2026-04-06`: all 8 `docs/audits/2026-04-06-<role>.md` files.

- [ ] **Step 1: Write each audit file to the real working tree**

Use the Write tool on each path below, using the file contents returned by the corresponding subagent in Task 11:

- `docs/audits/2026-04-06-engineering.md`
- `docs/audits/2026-04-06-security.md`
- `docs/audits/2026-04-06-design.md`
- `docs/audits/2026-04-06-ux.md`
- `docs/audits/2026-04-06-marketing.md`
- `docs/audits/2026-04-06-financial.md`
- `docs/audits/2026-04-06-legal.md`
- `docs/audits/2026-04-06-criticism.md`

- [ ] **Step 2: Verify all 8 files exist and are non-trivial**

Run: `ls -la docs/audits/2026-04-06-*.md && wc -l docs/audits/2026-04-06-*.md`

Expected: all 8 files listed, each with at least ~50 lines. An audit file shorter than 50 lines is suspect — re-dispatch that audit.

- [ ] **Step 3: Stage and commit**

Run: `git add docs/audits/2026-04-06-*.md && git status`

Expected: 8 new files staged.

Then:

```bash
git commit -m "$(cat <<'EOF'
audit: 2026-04-06 run (8 roles — engineering, security, design, ux, marketing, financial, legal, criticism)

Consolidated output of 8 parallel audit subagents dispatched from the
Voyager audit slash-commands. Each audit was run by a fresh Opus
instance in an isolated git worktree, reading its canonical role
definition from ~/.claude/audits/<role>.md and applying it to the
Voyager codebase with project-specific context from the matching
.claude/commands/audit-<role>.md wrapper.

Follow-up: the next commit produces a triage file at
docs/audits/2026-04-06-triage.md that severity-tags every finding and
routes P0/P1 to the fix queue and P2/P3 to ISSUES.md.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds. Lefthook runs — no code changes, should pass.

- [ ] **Step 4: Verify the commit**

Run: `git log --oneline -2 && git show --stat HEAD`

Expected: latest commit has 8 files; prior commit is the audit slash-command commit from Task 10.

- [ ] **Step 5: Worktree cleanup**

Run: `git worktree list`. Any worktrees created by the Task 11 subagents (typically under `.claude/worktrees/`) can be removed with `git worktree remove <path>` if no longer needed. Do NOT remove the plan worktree.

---

## Task 13: Read audits and produce the triage data

**Files:**

- Read: all 8 files in `docs/audits/2026-04-06-*.md`.

- [ ] **Step 1: Read all 8 audit files**

Use the Read tool on each.

- [ ] **Step 2: Enumerate every distinct finding**

For each audit, extract every actionable item. Deduplicate across audits (if engineering and security both flag the same CORS misconfiguration, merge with both sources listed).

- [ ] **Step 3: Severity-tag each finding**

For each finding, assign:

- **Severity:** P0 / P1 / P2 / P3 per the canonical definitions
- **Effort:** S / M / L
- **Category:** bug / security / UX / design / marketing / financial / legal / tech-debt / strategy
- **Source:** which audit file(s) and section(s) raised it

Triage ID prefixes: `ENG-`, `SEC-`, `DES-`, `UX-`, `MKT-`, `FIN-`, `LEG-`, `CRIT-`, numbered sequentially within each prefix starting at 01.

Be honest about severity. Err toward P0/P1 for anything touching security, data integrity, user ability to complete a core flow, or unit economics viability. Err toward P2/P3 for cosmetic or speculative items. If unsure, default to P2 — never hide things in P3 to shrink the fix queue.

- [ ] **Step 4: Hold the triage data in context for Tasks 14–15**

Do not write to disk yet.

---

## Task 14: Write the triage file

**Files:**

- Create: `docs/audits/2026-04-06-triage.md`.

- [ ] **Step 1: Write the triage file**

Use the Write tool to create `docs/audits/2026-04-06-triage.md` with the following structure, replacing placeholders with actual data:

```markdown
# Audit Triage — 2026-04-06

Consolidated triage of findings from the 8 audits run on 2026-04-06.

## Summary

- **Total findings:** <N>
- **P0 (must fix now):** <N>
- **P1 (fix in this effort):** <N>
- **P2 (logged to ISSUES.md, deferred):** <N>
- **P3 (logged to ISSUES.md, deferred):** <N>

P0 and P1 items below are the fix queue for Plan C (the test-first P0/P1 fix loop). P2 and P3 items are in `ISSUES.md` at the repo root.

**Source audits:**

- `docs/audits/2026-04-06-engineering.md`
- `docs/audits/2026-04-06-security.md`
- `docs/audits/2026-04-06-design.md`
- `docs/audits/2026-04-06-ux.md`
- `docs/audits/2026-04-06-marketing.md`
- `docs/audits/2026-04-06-financial.md`
- `docs/audits/2026-04-06-legal.md`
- `docs/audits/2026-04-06-criticism.md`

## P0 — Must fix now

### [ENG-01] <title>

- **Source:** <audit file> §<section>
- **Severity:** P0 · **Effort:** S · **Category:** bug
- **Repro:** <concrete steps or conditions>
- **Fix approach:** <brief concrete technical plan>

<repeat for every P0 item>

## P1 — Fix in this effort

### [SEC-03] <title>

- **Source:** <audit file> §<section>
- **Severity:** P1 · **Effort:** M · **Category:** security
- **Repro:** <concrete steps or conditions>
- **Fix approach:** <brief concrete technical plan>

<repeat for every P1 item>

## P2 / P3

See `ISSUES.md` at the repo root. <N> items logged there, tagged with severity, effort, category, and source.
```

- [ ] **Step 2: Verify the triage file**

Read back and confirm: Summary section with counts, P0 section (even if "None"), P1 section (even if "None"), every entry has Source / Severity / Effort / Category / Repro / Fix approach.

- [ ] **Step 3: Do NOT commit yet**

Tasks 14–16 are bundled into one commit in Task 16.

---

## Task 15: Create / update `ISSUES.md` with P2 / P3 findings

**Files:**

- Create or modify: `ISSUES.md` (at repo root).

- [ ] **Step 1: Check whether `ISSUES.md` already exists**

Run: `ls ISSUES.md 2>&1`

If it exists, read it first.

- [ ] **Step 2: Write or extend `ISSUES.md`**

If creating fresh, start with:

```markdown
# Voyager — Open Issues

Rolling log of open issues, P2 / P3 severity. P0 / P1 items live in the current
triage file under `docs/audits/`.

Each entry includes severity, effort, category, and source. Items are appended
over time — never overwrite this file.

---
```

Append a new dated section:

```markdown
## 2026-04-06 audit run

<every P2 and P3 finding from Task 13, one per entry>
```

Each entry:

```markdown
### [ENG-07] <title>

- **Source:** docs/audits/2026-04-06-engineering.md §<section>
- **Severity:** P2 · **Effort:** M · **Category:** tech-debt
- **Notes:** <1–2 sentences describing the finding and any fix sketch>
```

Use the same stable triage IDs from Task 14.

- [ ] **Step 3: Verify every finding is accounted for**

Count total findings from Task 13. Count entries in the triage file (P0 + P1) plus entries in ISSUES.md (P2 + P3 for this run). Totals must match.

- [ ] **Step 4: Do NOT commit yet**

---

## Task 16: Commit Phase 3 — triage file + `ISSUES.md`

- [ ] **Step 1: Stage both files**

Run: `git add docs/audits/2026-04-06-triage.md ISSUES.md && git status`

Expected: triage file (new) and ISSUES.md (new or modified) staged.

- [ ] **Step 2: Extract severity counts for the commit message**

From Task 13: `N_P0`, `N_P1`, `N_P2`, `N_P3`.

- [ ] **Step 3: Commit**

Run (substituting actual counts):

```bash
git commit -m "$(cat <<'EOF'
docs: triage 2026-04-06 audit findings (<N_P0> P0, <N_P1> P1, <N_P2> P2, <N_P3> P3)

Reads the 8 audit files from the 2026-04-06 run and produces a
consolidated triage file at docs/audits/2026-04-06-triage.md with
the P0/P1 fix queue. P2/P3 findings are logged to ISSUES.md at the
repo root as a rolling log (not overwritten by future runs).

The P0/P1 queue becomes the scope for Plan C (test-first fix loop).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Verify**

Run: `git log --oneline -4`

Expected (newest to oldest):

1. docs: triage 2026-04-06 audit findings
2. audit: 2026-04-06 run (8 roles)
3. feat: add Voyager-tailored audit slash-commands (8 roles)
4. chore: prettier-format spec and plan docs

---

## Task 17: Exit verification and handoff

- [ ] **Step 1: Verify Phase 1 exit criteria**

Run: `ls .claude/commands/audit-*.md`

Expected: exactly 8 files.

Use Grep: `pattern: "~/.claude/audits/"`, `path: ".claude/commands"` — all 8 files should match.

- [ ] **Step 2: Verify Phase 2 exit criteria**

Run: `ls docs/audits/2026-04-06-*.md | grep -v triage`

Expected: exactly 8 dated audit files (not counting the triage file).

Run: `wc -l docs/audits/2026-04-06-*.md`

Expected: each audit file >= 50 lines.

- [ ] **Step 3: Verify Phase 3 exit criteria**

Verify `docs/audits/2026-04-06-triage.md` and `ISSUES.md` exist and have the required sections.

- [ ] **Step 4: Verify git history**

Run: `git log --oneline -5`

Expected last 4 commits (newest to oldest):

1. `docs: triage 2026-04-06 audit findings (<counts>)`
2. `audit: 2026-04-06 run (8 roles — ...)`
3. `feat: add Voyager-tailored audit slash-commands (8 roles)`
4. `chore: prettier-format spec and plan docs`

- [ ] **Step 5: Produce the handoff report**

Write a status message (assistant output, not a committed file) including:

1. Severity counts (N_P0, N_P1, N_P2, N_P3)
2. Top 3 P0 findings by ID and title
3. Top 3 P1 findings by ID and title
4. **Prerequisite for E2E mocking (Plan B input):** does the engineering audit report that the tool executor supports adapter injection, or does it need refactoring to support `E2E_MOCK_TOOLS=1`? If refactoring is needed, flag it as a prerequisite P1 fix in Plan C.
5. **Legal audit status:** how many required documents are missing? Which are launch blockers?
6. **Financial audit unit economics:** projected cost per trip plan, SerpApi free-tier cliff, any missing spending caps as P0.
7. **Criticism audit brutal truth:** the one-paragraph headline finding.
8. Recommendation: write Plan B (E2E coverage + test gates) and Plan C (test-first P0/P1 fixes) immediately, both committed alongside this plan. Neither should execute without user review.

- [ ] **Step 6: Plan A complete**

At this point:

- 8 audit slash-commands exist on the plan branch
- 8 dated audit reports are on the plan branch
- Triage file categorizes every finding
- `ISSUES.md` holds the P2/P3 rolling log
- Git history is clean and coherent

The plan then proceeds to write Plan B and Plan C as sibling documents (outside this plan's scope but promised as the next work).
