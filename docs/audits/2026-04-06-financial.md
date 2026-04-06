# Voyager Financial Audit

**Date:** 2026-04-06
**Auditor:** CFO role (canonical `~/.claude/audits/financial.md`)
**Scope:** Voyager (App 8, Agentic Travel Agent). All paid and free-tier third-party services, unit economics, spending caps, and runway.
**Verdict:** **DO NOT DEPLOY TO PUBLIC TRAFFIC.** Multiple P0 financial controls are missing.

---

## Executive Summary

Voyager is an unmonetized demo that calls three paid external APIs per user turn (Anthropic, SerpApi, Google Places) inside an agentic loop that can issue up to 15 tool calls per turn. There is **no hard monthly spending cap on any paid provider**, no per-user budget enforcement, no cost attribution in the `tool_call_log` table, and no circuit that trips on spend. A single infinite-loop bug, prompt-injection exploit, or abusive user could drive a four to five figure Anthropic bill in hours, and would vaporize the SerpApi free tier of 250 searches in roughly 30 to 60 real user sessions. The cache is Redis-based with a 1-hour TTL, which helps same-session reuse but does essentially nothing for cross-user cost dilution on a demo with low traffic. Every trip plan produced today is pure subsidized cost with zero revenue, so the only open financial question is "how fast is the burn" and "what is the blast radius of a single bad prompt," and the answer to the second question is currently "unbounded." Amadeus is referenced across legacy migrations, schemas, and the spec but has no client code and no env var; it is dead weight but not a live paid integration, so it does not bleed cash.

**Top 3 financial risks:**

1. **P0: No hard monthly cap on Anthropic.** Claude Sonnet 4 at `max_tokens: 4096`, up to 15 tool calls per turn, no user daily limit, no org-level spend cap. One runaway session can exceed a month of expected burn.
2. **P0: SerpApi free tier (250/mo) with no counter, no cap, no degrade path.** Every uncached flight or hotel search is a real billable unit. No fallback once 250 is hit. The agent loop will simply throw and the feature will break silently to users.
3. **P0: No per-user or per-session budget.** `chatRateLimiter` is 10 requests / 5 min keyed by user, but each of those requests can spawn up to 15 tool calls. Real spend ceiling per user per day is effectively uncapped.

---

## Service Inventory

### 1. Anthropic (Claude API) - CRITICAL PAID

- **Usage:** Core agent loop in `server/src/services/AgentOrchestrator.ts`. Model: `claude-sonnet-4-20250514`. `max_tokens: 4096` per call. Max 15 iterations per turn. Tool use + streaming.
- **Billing model:** Per-token input and output. Sonnet 4 pricing (current public rate): approx. $3 / MTok input, $15 / MTok output.
- **Monthly spend today:** Unknown. No Anthropic dashboard access checked. No `ai_jobs` table. The `tool_call_log` table records latency but **not token counts and not cost**.
- **Spending cap configured:** **NO.** Neither in code nor (verified by the absence of any documentation) in the Anthropic org console. **P0 FINDING.**
- **Per-request bound:** 15 tool iterations \* 4096 output tokens max = 61,440 output tokens + growing input context per turn. Worst-case single turn (~15 iterations, each re-sending full conversation + tool results): realistic worst case 200k-400k input tokens reprocessed cumulatively, ~60k output. At Sonnet 4 pricing: ~$0.60 to $1.20 per worst-case turn. A rate-limited user (10 turns / 5 min) can burn ~$12 / 5 min = $144 / hour. 100 such users = $14,400 / hour. **This is a P0 blast radius.**
- **Action items:**
  - Set a hard monthly org-level spend cap in Anthropic console (recommend $50 for demo phase).
  - Add per-user daily token budget enforced in DB before each `orchestrator.run()` call.
  - Log `input_tokens` and `output_tokens` into `tool_call_log` or a new `agent_turn_cost` table for every turn.
  - Lower `maxIterations` default from 15 to 8 until observability is in place.
  - Consider switching to Claude Haiku for non-critical tool-use turns (roughly 10x cheaper).

### 2. SerpApi (Google Flights + Google Hotels) - FREE TIER CLIFF

- **Usage:** `server/src/services/serpapi.service.ts`, called by `flights.tool.ts` and `hotels.tool.ts` via `serpApiGet(engine, params)`. Two engines: `google_flights`, `google_hotels`.
- **Billing model:** Free tier = **250 searches / month**. Developer plan starts at $75/mo for 5,000 searches. Each `search_flights` or `search_hotels` call = 1 search.
- **Realistic searches per trip plan:** The agent loop calls `search_flights` typically 1-3 times (round trip, date variations) and `search_hotels` 1-2 times per plan. Conservative: **4 SerpApi searches per completed trip plan.** Exploratory/iterative conversations push this to 8-10+.
- **Free-tier capacity:** 250 / 4 = **62 trip plans per month** in the best case. 250 / 8 = **31 trip plans** realistically.
- **Spending cap configured:** **NO.** **P0 FINDING.** SerpApi does not send a warning at 80%. At search 251, `serpApiGet` will receive an HTTP error; `CircuitBreaker` will open after 3 failures with a 60-second cooldown and then re-open. The tool will throw `SerpApi error: ...` repeatedly. The agent will receive `Tool error (do not retry): ...` results and attempt to synthesize an answer anyway, degrading to hallucinated flights. **Users will see broken output and the system will not self-heal until next billing cycle.**
- **Cache effectiveness:** 1-hour TTL in Redis keyed by normalized params. Same (origin, destination, date, passengers) within 1 hour = 1 search. Different users doing the same lookup = 1 search. But every new date/new pair = new search. For a public demo with varied inputs, **cache hit rate will likely be under 20%**. The cache is adequate for development and a single test user. It is inadequate for public traffic on a 250/mo tier.
- **Action items:**
  - **P0: Implement a monthly counter in Redis** keyed by YYYY-MM. Increment on every non-cached SerpApi call. Refuse to call past 200 (reserve 50 for emergencies). Surface a graceful "flight search temporarily unavailable" message.
  - Extend cache TTL from 1 hour to 6-12 hours for flights and hotels. The data is not that volatile and the free tier arithmetic demands it.
  - Add a dashboard metric: "SerpApi searches this month / 250."
  - Consider upgrading to $75/mo plan before any public launch.

### 3. Google Places API - PAID PAY-AS-YOU-GO

- **Usage:** `server/src/tools/experiences.tool.ts`. Text Search (New) endpoint via `https://places.googleapis.com/v1/places:searchText`. Field mask is well-scoped (only id, displayName, address, rating, priceLevel, primaryTypeDisplayName, photos, location).
- **Billing model:** Text Search (New) is charged at approximately $0.032 per request (Essentials IDs) up to $0.040 per request (Pro). Google Maps Platform gives a $200 monthly free credit.
- **Cache:** 1-hour TTL by `(location, categories, limit)`.
- **Cost per trip plan:** Typically 1-3 `search_experiences` calls per plan. ~$0.10 / plan in experiences alone.
- **Free-credit runway:** $200 / $0.04 = 5,000 requests / month, or roughly 1,600-5,000 trip plans before the credit is exhausted. Much safer than SerpApi.
- **Spending cap configured:** **NO** explicit cap in Google Cloud Console (not verified, but no evidence in repo). **P1 FINDING.**
- **Action items:**
  - Set a hard Google Cloud billing cap on the project (recommend $50/mo).
  - Confirm the Places API key is restricted to `places.googleapis.com` and to the Railway server IP if static, or referrer-locked.
  - Cache TTL 1h is fine here.

### 4. Railway - API SERVER + POSTGRES + REDIS

- **Usage:** Express server via `Dockerfile.server`, Redis for cache, possibly Postgres (or Neon).
- **Billing model:** Railway Hobby = $5/mo + usage. Pro = $20/mo + usage. Typical small service: $5-25 / mo.
- **Current monthly cost:** Unknown; not verified with Railway dashboard in this audit. **UNAUDITED.**
- **Action items:**
  - Verify current plan and month-to-date charge in Railway dashboard.
  - Confirm there is exactly one service running (not stale duplicates from past deploys mentioned in the "stale Railway link" note in CLAUDE.md).

### 5. Vercel - FRONTEND

- **Usage:** `web-client/` Next.js 15 deployed to project `agentic-travel-agent` on domain `interviewiangreenough.xyz`.
- **Billing model:** Hobby = free (non-commercial, bandwidth caps). Pro = $20/mo/member.
- **Current monthly cost:** Likely $0 on Hobby. **UNAUDITED.** If this app is ever classified as commercial, Hobby ToS is violated.
- **Action items:**
  - Confirm the account tier and whether this project is classified correctly.
  - If the domain `interviewiangreenough.xyz` is used as a portfolio/interview piece and not monetized, Hobby is acceptable.

### 6. Neon (Postgres) - DATABASE

- **Usage:** `DATABASE_URL` in `.env.example` points at a Postgres instance. CLAUDE.md says Neon.
- **Billing model:** Neon Free = 0.5 GB storage, limited compute hours. Launch tier = $19/mo.
- **Current monthly cost:** Unknown. **UNAUDITED.**
- **Action items:** Confirm which project the DB belongs to and current plan.

### 7. Supabase - NOT USED

- Referenced in shared `CLAUDE.md` as the default auth stack for the portfolio, but Voyager appears to use custom bcrypt-based auth (`server/src/routes/auth.ts`, `bcrypt` in deps). **No Supabase env vars in `server/.env.example`.** No cost attributable to Voyager.
- **Action items:** None. Confirmed not used.

### 8. Amadeus - DEAD INTEGRATION

- **Status:** Referenced in `docs/FULL_APPLICATION_SPEC.md` (lines 122, 126, 139, 146, 292) as the original planned flight/hotel provider. Still referenced in DB schema columns (`trip_flights.amadeus_offer_id`, `trip_hotels.amadeus_hotel_id`), migration enum (`api_provider` includes `'amadeus'`), and a few tests.
- **Code status:** **No Amadeus client exists.** No `amadeus.service.ts`. No `AMADEUS_*` env var in `.env.example`.
- **Paid exposure:** **ZERO.** No account is being billed because no credentials are configured.
- **Action items (P2, cleanup):**
  - Remove `amadeus_offer_id` and `amadeus_hotel_id` columns (or rename to `provider_offer_id`).
  - Delete the `amadeus` member from the `api_provider` enum.
  - Update spec and tests to remove Amadeus references.
  - Verify that no personal Amadeus developer account is sitting active with a stored credit card on Ian's dashboard from early prototyping.

### 9. Other services referenced but not used by Voyager

- **Sentry, Resend, PostHog, Stripe, Cloudflare R2:** No env vars in `server/.env.example`, no imports in server code. Zero cost exposure.

---

## AI API Cost Analysis

There is currently **no revenue model**. Every trip plan is a pure cost. The math below is projected, not actual, because the `tool_call_log` table does not record token counts or cost.

### Projected cost per completed trip plan (single happy path)

Assumptions: 4-6 agent iterations, model = Claude Sonnet 4, max_tokens = 4096.

| Component                                               | Qty         | Unit cost                                      | Subtotal          |
| ------------------------------------------------------- | ----------- | ---------------------------------------------- | ----------------- |
| Anthropic input tokens (cumulative with context growth) | ~40k tokens | $3 / MTok                                      | $0.12             |
| Anthropic output tokens                                 | ~8k tokens  | $15 / MTok                                     | $0.12             |
| SerpApi `search_flights`                                | 2 calls     | $0.015 each (at paid $75/5k tier) / $0 on free | $0.03             |
| SerpApi `search_hotels`                                 | 2 calls     | $0.015 each                                    | $0.03             |
| Google Places `search_experiences`                      | 2 calls     | $0.032 each                                    | $0.064            |
| **TOTAL (with SerpApi paid)**                           |             |                                                | **~$0.36 / plan** |
| **TOTAL (inside SerpApi free tier)**                    |             |                                                | **~$0.30 / plan** |

### Projected worst-case turn (runaway)

15 iterations \* 4096 output tokens + cumulative reprocessing of ~30k-60k input tokens per call.

- Input: ~300k tokens cumulative = $0.90
- Output: ~60k tokens = $0.90
- SerpApi worst case: 10 searches at $0.015 = $0.15
- Google Places worst case: 5 searches = $0.20
- **Worst case per turn: ~$2.15**

A single user at 10 turns / 5 minutes sustained = $25.80 / hour / user. A 100-user burst = **$2,580 / hour**. A 24-hour attack = **$61,920**.

### Estimate vs. actual

- **Cannot calculate.** `tool_call_log` schema does not store token counts. `insertToolCallLog` (called from `agent.service.ts`) records `latency_ms`, `cache_hit: false` (hardcoded, never true!), and error messages but **never records input_tokens, output_tokens, or cost**.
- **P1 FINDING: `cache_hit` is hardcoded to `false`** at `server/src/services/agent.service.ts` line 68. Even when Redis returns a cached SerpApi response, it's logged as a cache miss. Observability is already broken.
- **P1 FINDING: Token usage is returned by the orchestrator** (`OrchestratorResult.tokensUsed`) but not persisted.

### Margin math

Revenue per plan = **$0**. Cost per plan = **~$0.30 to $2.15**. Margin = **-infinity**. Every user action is a loss. Target margin of 15% is irrelevant without revenue; if the product is positioned as a portfolio/interview piece, this is acceptable **only if** total monthly cost is capped. **It is not.**

---

## Spending Caps In Place

| Service       | Hard monthly cap configured?                            | Finding            |
| ------------- | ------------------------------------------------------- | ------------------ |
| Anthropic     | **NO**                                                  | **P0**             |
| SerpApi       | **NO** (free tier is a de facto ceiling but no counter) | **P0**             |
| Google Places | **NO** (uses $200 Google free credit as soft buffer)    | **P1**             |
| Railway       | Unknown (dashboard not checked)                         | **P2 / unaudited** |
| Vercel        | Unknown                                                 | **P2 / unaudited** |
| Neon          | Unknown                                                 | **P2 / unaudited** |

**Every paid service in Voyager is missing a hard cap.** This is the single most important finding in this audit.

---

## Margin Violations

There are no paid user actions. Therefore there is nothing to charge and nothing to margin. The entire product is a margin violation by construction because it generates cost without revenue. This is **acceptable for a portfolio demo** only if and only if total monthly burn is bounded by a hard cap. **It is not bounded.**

**Recommended disposition:**

1. Either add spending caps that bound burn to a known monthly number (recommend total $50/mo across Anthropic + SerpApi + Google Places), OR
2. Keep the app private / behind auth with a fixed, known set of test users, OR
3. Add trivial monetization (Stripe $1 per plan or $5/mo subscription) so there is at least a revenue floor against abuse.

---

## Unaudited Services

- **Railway** billing dashboard (current plan and MTD charges) - not checked.
- **Vercel** billing dashboard - not checked.
- **Neon** billing dashboard - not checked.
- **Anthropic** console spend - not checked.
- **Google Cloud** billing console for Places project - not checked.
- **SerpApi** usage dashboard (current month search count) - not checked.

All of the above should be confirmed before any public promotion of the app. Every unverified number in this audit is a placeholder assumption, not fact.

---

## Unused Services

- **Amadeus:** referenced in spec, schema, migrations, and tests, but no client code and no env var. Zero live billing, but technical debt and audit noise. Recommend removal.
- **Supabase:** referenced in portfolio-wide shared conventions but not used in Voyager. No action needed.

---

## Runway Forecast

Runway cannot be computed because:

1. No revenue exists to offset burn.
2. Current actual monthly burn is not measured (no billing dashboards checked, no token logging in DB).
3. Burn is unbounded at the upper end due to missing caps.

**Best-case projected burn (demo with ~30 trip plans/mo):**

- Anthropic: ~$8 (within SerpApi free tier, small Claude volume)
- SerpApi: $0 (free tier) or $75/mo (if upgraded)
- Google Places: ~$3 (well within $200 free credit)
- Railway: ~$10-25
- Vercel: $0 (Hobby)
- Neon: $0-19
- **Best case: $25-130 / month**

**Worst-case projected burn (single runaway session or abuse):**

- Anthropic: **$5,000 to $60,000 in 24 hours** (unbounded)
- SerpApi: bounded by free tier breakdown (feature fails, no incremental cost)
- Google Places: bounded by ~$200 credit, then pay-as-you-go
- **Worst case: effectively unbounded**

**This is not a runway problem; it is a blast-radius problem.** The business does not run out of money over months; it runs out of money in hours if the wrong prompt hits production.

---

## Compliance

- **Stripe tax:** Not applicable. No Stripe integration.
- **DPAs with providers:** Anthropic, Google, SerpApi all have standard DPAs in their ToS. Not a P0 concern for a non-production demo, but if this ever ingests real user PII (trip details including passport or billing), an explicit DPA review is warranted.
- **PII in logs:** `logger.debug({ engine, params, requestId }, 'SerpApi request')` logs origin, destination, dates, passenger counts. These are not high-sensitivity but should be scrubbed if logs are retained long-term.
- **Anthropic data use:** By default, API traffic is not used for model training, but the org should confirm "no training" is selected in the console.

---

## Prioritized Recommendations

| #   | Recommendation                                                                                                                        | Priority | Impact | Effort |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ | ------ |
| 1   | Set a hard monthly spending cap in the Anthropic console (recommend $50)                                                              | **P0**   | H      | L      |
| 2   | Implement a Redis-backed monthly SerpApi counter with a 200-search cap and graceful degradation                                       | **P0**   | H      | M      |
| 3   | Set a hard Google Cloud billing cap ($50/mo) on the Places project                                                                    | **P0**   | H      | L      |
| 4   | Persist `input_tokens`, `output_tokens`, and computed `estimated_cost_usd` in `tool_call_log` or a new `agent_turn_cost` table        | **P1**   | H      | M      |
| 5   | Fix `cache_hit` hardcoded to `false` in `agent.service.ts:68`; propagate the real cache-hit flag from each tool                       | **P1**   | M      | L      |
| 6   | Lower `DEFAULT_MAX_ITERATIONS` from 15 to 8 until per-turn cost is measurable                                                         | **P1**   | M      | L      |
| 7   | Extend SerpApi cache TTL from 1h to 6-12h for flights and hotels                                                                      | **P1**   | M      | L      |
| 8   | Add a per-user daily token budget (e.g. 50k output tokens/day) enforced before each agent turn                                        | **P1**   | H      | M      |
| 9   | Verify Anthropic org-level "no training on API data" setting is selected                                                              | **P2**   | L      | L      |
| 10  | Remove Amadeus from schema, migrations, tests, and spec; add a backfill migration to rename `amadeus_offer_id` to `provider_offer_id` | **P2**   | L      | M      |
| 11  | Confirm Railway, Vercel, Neon plans and current MTD spend; document in a `BILLING.md`                                                 | **P2**   | M      | L      |
| 12  | Add a `/health/cost` admin endpoint returning MTD spend per provider (once logging exists)                                            | **P3**   | L      | M      |

---

## P0 Findings Summary (report-back)

1. **No hard monthly cap on Anthropic.** Worst-case burn is unbounded; a single runaway turn is ~$2, a 100-user burst is ~$2,580/hour.
2. **No SerpApi monthly counter or cap.** Free tier is 250/mo; current realistic capacity is 31-62 trip plans/mo; on search 251 the feature silently breaks and the agent may hallucinate flights from error strings.
3. **No Google Cloud billing cap on Places project.** Buffered by $200 free credit but still unbounded after that.
4. **Token usage and cost are not persisted** in `tool_call_log`; `cache_hit` is hardcoded to `false`. Observability for financial purposes is effectively zero.
5. **No per-user daily budget.** `chatRateLimiter` is 10 req / 5 min, but each request can spawn 15 tool calls.

---

## Unit Economics Recap

- **Projected cost per completed trip plan (typical):** ~$0.30 to $0.36
- **Projected cost per worst-case turn (runaway 15-iteration agent loop):** ~$2.15
- **Revenue per trip plan:** $0
- **Gross margin per trip plan:** -100% (pure subsidized cost)
- **Free-tier cliff (SerpApi):** ~31 to 62 trip plans / month, hard stop with silent degradation at search 251
- **Best-case monthly burn:** $25-130
- **Worst-case monthly burn:** unbounded; realistic attack scenario $60k in 24 hours on Anthropic alone
