# Voyager Criticism Audit

**Date:** 2026-04-06
**Auditor:** Criticism (Devil's Advocate) role, per `~/.claude/audits/criticism.md`
**Scope:** Whether Voyager should exist in its current form. Not whether it is well executed.

---

## The Brutal Truth

Voyager is a technically impressive demo of an agentic tool-use loop, wrapped around a product nobody needs and nobody will pay for. It searches flights, hotels, and experiences. It never books anything. It competes directly with a category (AI trip planning) that already contains ChatGPT with browsing, Google Gemini with Maps integration, Kayak Chat, Booking.com's AI trip planner, Expedia's ChatGPT plugin, Mindtrip, Layla, Wonderplan, and roughly a dozen other well-funded competitors, and it has no distribution, no affiliate booking links, no data advantage, and no moat. The team's per-turn cost is dominated by Anthropic tokens against a zero-revenue backend, and the free SerpApi tier of 250 searches per month is exhausted in under ~30 user trips. Meanwhile the last 30 days of git history shows 289 commits of which roughly half are process, infrastructure, eval harnesses, audit scaffolding, formatting, lint, and convention work, and the README's own "Long-Term Vision" item 13 is "Move from search-only to actual booking" - which is to say, the team has privately acknowledged that the product as currently built is not a product. This is a capstone portfolio project masquerading as a product. Stop pretending otherwise. Either commit to it being a portfolio piece and ship the narrative that way, or pivot it into something someone would actually pay for. The current middle position is the worst of both.

---

## What's Actually Good

Being fair, briefly:

- The **agentic loop architecture** (`server/src/services/AgentOrchestrator.ts`, `server/src/services/agent.service.ts`) is cleanly implemented - timeout guards, 15-call safety limit, circuit breaker, typed SSE events, tool call logging for observability. This is genuinely portfolio-quality engineering.
- The **typed ChatNode protocol** with a `shared-types` workspace package is a clever abstraction that most production chat apps don't bother with.
- The **eval harness** (`eval/`) with persona-driven customer agents, programmatic assertions, and LLM judge scoring is above what most portfolio projects attempt.
- The **dual-layer caching** (Redis hot + Postgres cold, normalized keys) is exactly the right pattern for the external API quota problem.
- The **Explore mode** with 30 curated destination pages is a real, shippable content surface that doesn't depend on any LLM cost.

None of this changes the strategic verdict below. The engineering is A-grade. The product is C-grade. Engineering grades are irrelevant when the frame is wrong.

---

## Lies the Team Tells Itself

### Lie #1: "This is a product"

It is not a product. It is a tech demo. The README item 13 under "Long-Term Vision" is literally: **"Real-Time Booking Integration - Move from search-only to actual booking via affiliate links or direct API booking."** The team has already told itself, in its own README, that the current product does not book trips. A trip planner that does not book trips is a research assistant. Research assistants are called ChatGPT. They are free. Voyager has no pricing page (verified: no `/pricing` route in `web-client/src/app/`), no paid tier, no affiliate revenue wiring, no booking partner integrations. There is no way for this product to make a dollar today even if a million people used it.

Call it what it is. This is a portfolio piece demonstrating agentic AI patterns. Ship it as a portfolio piece. Put it on a resume. Put it on a personal site. Stop describing it as a product.

### Lie #2: "The agent is our differentiator"

The agent is a commodity. Every serious AI travel app in 2026 has an agentic loop. The differentiator a year ago is table stakes today. Kayak Chat, Mindtrip, Layla, Wonderplan, and Booking.com AI Trip Planner all do multi-step tool use against real flight and hotel inventory. They also have booking funnels, affiliate revenue, brand trust, and actual flight inventory instead of scraped SerpApi snapshots. The Voyager agent loop is well-executed but architecturally identical to every other chat-based trip planner shipping in 2026. "Agentic" is not a moat. It is a feature description.

### Lie #3: "SerpApi is good enough"

SerpApi is a scraper of Google Flights and Google Hotels. It is not a booking inventory system. Prices shown to the user are **not bookable** - by the time the user wants to buy, the price may be stale, the fare class may be gone, availability may have shifted. This is a disclosure problem and a trust problem rolled into one. A user who finds a $450 SFO→BCN flight in Voyager, then goes to actually book it and discovers the price is now $680, will never come back. The product has no story for this failure mode.

### Lie #4: "The 250-search free tier is fine because we cache aggressively"

Do the math (below). It is not fine. And the caching tier cannot rescue unit economics because the cache hit rate on user-generated trip searches is low. Every trip to Barcelona in April is a new SerpApi hit if the dates differ even slightly. Cache key normalization on `{origin, destination, dates}` makes cache hits viable only for popular identical searches, which is the opposite of what a personalized trip planner produces.

### Lie #5: "We'll figure out monetization later"

There is no "later" when the base layer is `ChatGPT + Google Gemini + Booking.com AI`. Every month this product does not ship a monetization path is a month those competitors compound their lead. "Later" means "never" in this category.

### Lie #6: "Voyager has an identity"

The product was called `Agentic Travel Agent`, then `Atlas`, then `Global`, then `Voyager`. The spec file is still `FULL_APPLICATION_SPEC.md` titled `App 8: Agentic Travel Agent`. The Vercel project is `agentic-travel-agent`. The Railway linking instructions reference `agentic-travel-agent`. Half the repo thinks it is called Voyager and half thinks it is called Agentic Travel Agent. If the team cannot keep the product's name consistent inside its own codebase, nobody outside the codebase will remember it.

### Lie #7: "Dead code is fine, we'll clean it up"

The schema at `server/src/schemas/trips.ts:43,61` still references `amadeus_offer_id` and `amadeus_hotel_id`. The migrations at `server/migrations/1771879388545_create-trip-flights-table.js` and `1771879388546_create-trip-hotels-table.js` still create those columns. `server/src/services/agent.service.test.ts` and `server/src/repositories/tool-call-log/tool-call-log.test.ts` still contain Amadeus references. Commit `dafed94 Replace Amadeus with SerpApi for flight and hotel search` happened and the cleanup never followed. This is a small thing that says a big thing: **the team finishes the exciting work and abandons the tail.** Every portfolio audit a hiring manager runs will find this in 30 seconds. It says "this person ships 80% and calls it done."

---

## The Business Model Problem

**This section is required by the canonical role and is the most important section in the audit.** Voyager has paid third-party dependencies with cost risk on three axes. It has zero revenue. The math:

### Cost axis 1: Anthropic tokens

Per `AgentOrchestrator.ts`:

- Model: `claude-sonnet-4-20250514` (Sonnet pricing: ~$3 per 1M input tokens, ~$15 per 1M output tokens)
- Max iterations: 15 tool calls per turn
- Default max output: 4096 tokens per iteration
- Typical agentic turn per the README: **3–8 tool calls**

A realistic single user turn (6 tool calls, full conversation history reloaded each iteration, system prompt + trip context + prior messages growing with each iteration):

- Input tokens per turn: roughly `6 iterations × (system prompt ~1500 + trip context ~500 + accumulated conversation ~4000) ≈ 36,000 input tokens`, growing with conversation length. Conservative: **30k-50k input tokens per turn.**
- Output tokens per turn: roughly `6 × ~800 ≈ 4,800 output tokens per turn`. Conservative: **3k-5k output tokens per turn.**

Cost per turn:

- Input: 40k × $3/1M = **$0.12**
- Output: 4k × $15/1M = **$0.06**
- **Total: ~$0.18 per agent turn**

A single trip planning session involves multiple turns (the README and system prompt both assume iterative refinement: "find cheaper flights", "switch the hotel"). Call it **4 turns per trip** conservatively.

**Anthropic cost per trip: ~$0.72.**

Voyager has no pricing page, no paid tier, and no affiliate booking revenue integration. Revenue per trip: **$0.00.**

Loss per trip on LLM alone: **$0.72.** A thousand trips per month is ~$720/month in Anthropic costs, with zero offsetting revenue. Ten thousand trips is $7,200/month. This is the "we'll figure out monetization later" trap the canonical role explicitly names.

### Cost axis 2: SerpApi

- Free tier: **250 searches/month** per CLAUDE.md
- Each trip triggers `search_flights` + `search_hotels`, sometimes multiple times as the user iterates. Call it **3 SerpApi calls per trip** average (flights + hotels + one refinement).
- **250 / 3 ≈ 83 trips per month** before the free tier is exhausted.

Paid SerpApi starts at ~$75/month for 5,000 searches. That's $0.015/search × 3 = $0.045/trip SerpApi cost.

If the cache hit rate on user trip searches is 30% (optimistic, most trips are personalized), the effective SerpApi-per-trip drops to ~$0.032. Still nonzero, still offset by zero revenue.

**At 83 free trips/month you have not even validated product-market fit.** If Voyager ever gets one Hacker News post of traction it will blow through the free tier in a day and start paying cash for failed demos.

### Cost axis 3: Google Places

- Text Search (New): $32 per 1000 requests = **$0.032 per call**
- Each trip makes ~2-4 experience searches depending on user interest categories
- **Google Places cost per trip: ~$0.10**
- Plus the photo proxy endpoint (`server/src/handlers/places`) which adds additional per-photo billing

### Total per-trip cost

| Line item                | Cost       |
| ------------------------ | ---------- |
| Anthropic Claude         | $0.72      |
| SerpApi (post free tier) | $0.045     |
| Google Places            | $0.10      |
| **Total cost per trip**  | **~$0.87** |
| **Revenue per trip**     | **$0.00**  |
| **Margin per trip**      | **-$0.87** |

This loss does not shrink at scale. It grows linearly. Every marginal user is a marginal loss. There is no operating leverage in this business.

**The only ways out:**

1. **Affiliate booking commissions** - but the product does not book anything and there is no affiliate integration anywhere in the codebase.
2. **Subscription** - but there is no pricing page, no Stripe, no paywall, and nothing about the product justifies a subscription against free ChatGPT alternatives.
3. **Enterprise/B2B** - but there is no enterprise story, no team accounts, no white-label, no SSO, no SLA.
4. **Data licensing** - impossible, the data is other people's (SerpApi's scrapes of Google).

**The unit economics are unworkable as designed.** Flag this as **Fatal.**

---

## What's Broken (strategically, not code-level)

1. **No booking funnel.** Product name is "travel agent." Travel agents book travel. This one does not. Every user who makes it to the end of an agent flow hits a wall labeled "Confirm booking" that transitions a database status to `'saved'` and plays a checkmark animation. Nothing is booked. Nothing is charged. Nothing happens. A user who believed they booked a trip and then discovers they did not is a user who hates the brand forever.
2. **No way to pay.** No Stripe, no pricing, no paywall, no premium tier. The entire cost structure is a donation to Anthropic, SerpApi, and Google.
3. **Price trust is broken at the root.** SerpApi scrapes are not bookable inventory. The cards show prices the user cannot actually pay. When the user clicks through to actually book (via what, by the way? there is no click-through), the prices will have changed. This is the defining failure mode of every "AI trip planner that doesn't actually book" app, and it has killed multiple competitors already.
4. **No distribution strategy.** Nothing in the repo or docs addresses how anyone will find this product. No SEO strategy (the Explore pages at `web-client/src/app/explore/` are a start but are not competitive with Lonely Planet or TripAdvisor for organic search). No paid acquisition plan. No referral loop. No virality mechanic. Products with zero distribution and zero margin do not compound.
5. **Identity drift.** Spec says "Agentic Travel Agent." Repo says "Voyager." Vercel project says "agentic-travel-agent." Dead code says "Amadeus." The team has not decided what this thing is called or what it sells.

---

## What's Weak

1. **"Book This Trip" is a checkmark animation.** `fef53426 feat: add Book This Trip / Try Again flow with confirmation overlay` - but it doesn't actually book. A user interacting with this feature for the first time will be confused, and on the second interaction, betrayed.
2. **35 user stories that describe a feature tour, not a jobs-to-be-done.** `docs/USER_STORIES.md` contains stories like "US-32: Incomplete preferences badge" ("small coral dot visible next to Account in the header") and "US-17: Trip cards with images" ("Known destinations show Unsplash photos"). These are UI states, not user outcomes. A real user story is "As a budget traveler, I want to book a flight and hotel in under 5 minutes for under $500 total." Voyager has none of those because Voyager cannot fulfill them - it cannot book, and it has no "under $X" guarantee because SerpApi prices are stale snapshots.
3. **The preferences wizard.** 6 steps, 7 categories, after-registration flow. Completion badges. This is the canonical "complexity because someone thought it was cool" pattern. Users do not want to answer 6 multi-step preference questions before they have gotten any value from the product. Every onboarding UX study in the last decade says this. The team built it anyway.
4. **VibeLens docs at `web-client/public/.vibelens/docs/`** - the product ships a "quiz" for a parser system called VibeLens that exists elsewhere. Why is this inside Voyager's frontend build? What does a travel product need with a 100-question VibeLens quiz? This is cross-contamination from some other project and suggests the team is not thinking in terms of "what ships to users of this product."
5. **The eval harness is bigger than the product surface area it evaluates.** `eval/` contains persona templates, a conversation runner, customer agent roles, LLM judge scoring, CLI orchestration, and a full report writer. For a product with one agent and five tools. This is the canonical "process that does not earn its keep" signal.

---

## What's Missing

1. **Any way to actually book a trip.**
2. **Any revenue mechanism at all.**
3. **Price freshness guarantees** on flight and hotel cards. If the price shown is older than X minutes, the UI should say so. It does not.
4. **Clear "this is not a real booking" disclosure** anywhere in the confirmation flow. The product actively misleads users into believing they have booked something.
5. **A reason to use this instead of ChatGPT.** Nothing in the user flow answers the question "why should I plan my trip here instead of just asking Claude or GPT-4 in a chat window?" Both of those can search the web, both can recommend flights, both cost me nothing.
6. **A moat.** Not a single item in the spec or README describes a sustainable competitive advantage. There is no proprietary data, no network effect, no switching cost, no brand, no distribution, no affiliate relationships, no booking inventory advantage.
7. **Email notifications, price drop alerts, calendar integration, multi-city, group splitting.** All listed in "Long-Term Vision." All are the kinds of features that would actually differentiate from ChatGPT, and none of them exist.

---

## The User's Experience, Honestly

Walking through Voyager as a real user who has never seen it before:

1. **Landing page.** A hero carousel of destinations, a mock chat animation, four feature cards ("Real Flights," "Curated Hotels," "Local Experiences," "Budget-Aware"). Looks polished. I click "Get Started." It sends me to register.
2. **Registration.** First name, last name, email, password. Fine. Submit.
3. **Preferences wizard.** Six steps. Accommodation, Travel Pace, Dining, Activities, Travel Party, Budget. I have gotten zero value from this product and it is asking me for a personality profile. I skip through as fast as I can, clicking whatever comes first. **Trust damaged.** I have not seen a single benefit yet and I have done five minutes of work.
4. **Trips list (empty).** I click "New Trip."
5. **Trip detail page.** Chat interface. A welcome message. A form asking for origin, dates, budget, travelers. I fill it in: SFO, Barcelona, April 10-17, $3000, 2 travelers. I submit.
6. **Agent loop fires.** I see "Searching flights SFO → BCN..." Progress indicators. I wait. 20 seconds. I get flight cards showing prices.
7. **I notice the prices are round numbers and from SerpApi, which scrapes Google Flights.** I open a new tab, go to google.com/flights, search the same route. The Voyager prices are already out of date by $80. **Trust further damaged.**
8. **I click a flight card, confirm selection.** Agent keeps going. Hotel cards appear. Same problem - I can spot-check these against booking.com and the prices do not match.
9. **I go through the full flow, end up at "Confirm booking."** I click it, expecting a Stripe checkout or a redirect to a real booking site. Instead I get a modal with an itemized breakdown and a "Confirm" button. I click Confirm. A checkmark animation plays. My trip is now "booked."
10. **Nothing has actually been booked.** I have no confirmation email. I have no reservation number. I have no charge on my card. I check my account: the trip is marked "saved." I am furious.
11. **I leave and do not come back.**

The entire flow is confidence theater. The moment a user realizes "Confirm booking" did not book anything, the product is dead to them. The polish of the chat UI actively makes this worse, because it earned my trust first.

---

## Process-vs-Outcome Balance

**This section is required by the canonical role.**

Git log analysis for the last 30 days (2026-03-07 → 2026-04-06): **289 commits total.**

Breakdown by conventional-commit prefix:

- `feat:` + `fix:`: ~143 commits (shipped product changes, some trivial)
- `docs:`, `chore:`, `ci:`, `test:`, `refactor:`, `style:`: ~69 commits (process and infrastructure)
- Remaining: ungrouped, mostly pre-convention commits from earlier in the window

Non-product infrastructure shipped in the last 30 days:

- **Audit scaffolding** - `.claude/commands/audit-criticism.md` and siblings (the very audit you are reading right now)
- **Eval harness package** - an entire new workspace (`eval/`), persona generator, conversation runner, customer agent, LLM judge scoring, CLI table/JSON report writer, regression comparison, EVAL_MOCK_SEARCH mock data, eval README. Commits `0c04…`, `50854e8`, `fb10958`, `5a82a0f`, `631092e`, `984e9d2`, `ee9361f`, `53391bb`, `cd7f3dd`, `0f4afdb`, `44d660e`, `573e974`, `81f92d4`, `517f02a`, `f5968be`, `c620a7a`.
- **Coverage thresholds in CI**, metrics service abstraction, circuit breakers, rate limiters, wall-clock timeouts, request ID propagation, Zod validation of tool inputs - all real engineering quality work, but these are **safety rails on a product that has no paying users to be protected from.**
- **Multiple convention files**, audit learnings captured, prompt guardrails, edge case hardening, VibeLens documentation regenerated twice, agentic chat redesign spec + implementation plan, agentic chat redesign actual execution.

User-facing features shipped in the same window:

- Explore mode with 30 curated destination pages (real, shippable value)
- Mediterranean Warmth light palette restyle (polish, not product)
- Preferences wizard (debatable whether this helps or hurts)
- Chat edge case hardening (invisible to users unless they hit the edge)
- Interactive tile cards (flights, hotels, cars, experiences) with confirmation flow
- Booking confirmation modal (that does not actually book)
- E2E Playwright tests for 35 user stories

**Verdict: the ratio is roughly 50/50, with a heavy bias toward polish-and-process over net-new product surface.** A generous reading says the team is building the observability and test infrastructure that will later enable safer shipping. A hostile reading - the one this role requires - says the team is deriving satisfaction from shipping process because shipping actual product is harder and the actual product has a fatal strategic problem that process cannot solve.

**The eval harness is the smoking gun.** A full eval package with persona archetypes, randomized generators, LLM-judge scoring, and regression comparison is the kind of infrastructure a seed-stage AI company builds when it has paying customers, an SLA, and a measurable regression risk. Voyager has zero users and zero revenue. **The eval harness is meta-system performance art.** It demonstrates rigor. It does not ship value. It is process that has not yet earned its keep.

**Recommendation: moratorium on new process infrastructure.** No new eval tooling, no new audit commands, no new CI workflows, no new convention files, until the product has either (a) a real booking integration shipped to users or (b) been accepted as a portfolio-only artifact and frozen for resume-display purposes. Every hour spent on the eval harness is an hour not spent answering "can anyone actually book a trip in this thing."

---

## If I Were Competing Against This

If I were a well-funded competitor (Booking.com, Kayak, Expedia, or a Y Combinator trip-planning startup with $5M raised), here is what I would exploit:

1. **The booking gap.** I would ship a "Book in 30 seconds" button that actually books a real flight or hotel using Duffel or Travelport. Voyager users who get burned by the fake confirmation will come to me.
2. **Price freshness.** I would guarantee prices for 10 minutes at click-time with a "Price Lock" affiliate integration. Voyager has no answer.
3. **Brand trust.** I already have one (Kayak, Booking, Expedia). Voyager has none. I would spend $0 beating it in organic search by virtue of domain authority alone.
4. **Affiliate revenue.** My unit economics are positive at $15–$40 per booked flight and $30–$100 per booked hotel night. Voyager's unit economics are negative at every scale. I can outspend it infinitely on acquisition.
5. **The eval harness theater.** I would point a salesperson at the Voyager codebase, show how many commits went into evals and audits and convention files vs. actual booking surface area, and use it as a cautionary tale when pitching investors against them. "They are building process, we are building revenue."

The more interesting competitor is **ChatGPT with browsing, free tier.** It has the full web, a chat UI polished by OpenAI, zero cost to the user, and the ability to recommend any flight, any hotel, any experience. Users already open it for travel questions. Voyager has **no answer to "why not just ChatGPT."** The agentic loop story does not land with users - they do not know or care whether it is one tool call or ten. They care whether they get good answers and whether the thing works.

---

## The Hard Prioritization - Top 5 Fixes Before Showing Voyager To Anyone

If the team can only fix 5 things before showing Voyager to a hiring manager, an investor, a friend, or a potential user, these are the 5. In order.

### 1. Decide what Voyager is. Product, or portfolio piece? Commit in writing.

This is the single most important decision. Every subsequent decision flows from it.

- **If portfolio piece:** Rewrite the README and landing page to be honest. "Voyager is a portfolio demonstration of the agentic tool-use pattern. Built to show a multi-step AI agent calling real flight, hotel, and experience APIs with budget-aware reasoning. Not a commercial product." Kill the "Confirm booking" flow entirely - replace with "Save this plan" or "Export as PDF" or "Share." Stop pretending this is a product. Ship it with pride as a technical demonstration.
- **If product:** Answer, in writing, (a) how it will make a dollar of revenue, (b) what its moat is against ChatGPT / Kayak / Mindtrip, (c) what its booking path looks like, and (d) what its first 100 users will see that they cannot get from a competitor for free. If you cannot answer all four, it is not a product.

**Either path is fine. The middle path is not.** The current state, where the product pretends to be a product in the README and landing page but cannot actually transact, is worse than either extreme.

### 2. Delete the fake "Confirm booking" flow, or make it real.

`feat: wire checkout flow - Confirm booking opens modal, status transitions to saved` is the single most dangerous commit in this repo. A user who clicks "Confirm booking," sees the checkmark animation, and believes they have booked a trip is a user you have defrauded by accident.

**Fix options:**

- **Portfolio path:** rename to "Save itinerary" or "Lock in plan." Remove all booking language. Add a clear "This is a planning tool. No bookings are made." disclaimer.
- **Product path:** integrate a real booking API. Duffel for flights, Booking.com affiliate for hotels, Viator or GetYourGuide for experiences. Actually charge the user. Send a real confirmation email. This is a multi-month effort. It is also the only thing that would make Voyager a product.

Do one or the other by end of week. The current state is a ticking trust bomb.

### 3. Clean up the Amadeus dead code. Today.

Every external reader of this codebase will find `amadeus_offer_id` and `amadeus_hotel_id` in `server/src/schemas/trips.ts`, the migrations at `server/migrations/1771879388545_create-trip-flights-table.js` and `1771879388546_create-trip-hotels-table.js`, test references in `server/src/services/agent.service.test.ts` and `server/src/repositories/tool-call-log/tool-call-log.test.ts`, and the spec file `docs/FULL_APPLICATION_SPEC.md` which still lists Amadeus as the provider. This signals **"finishes 80% and walks away"** louder than any resume line item. It is an afternoon of work to fix and you should do it today. Rename columns via migration, update the schema file, purge test fixtures, either update or archive the FULL_APPLICATION_SPEC as historical.

### 4. Decide what the product is called, once, and make the whole codebase agree.

`Agentic Travel Agent` in the spec. `Atlas` in one prior commit. `Global` in another. `Voyager` now. `agentic-travel-agent` in Vercel and Railway linking. `@agentic-travel-agent/shared-types` in the package name. An identity drift this deep inside a 289-commit 30-day window is a team communication failure, not a branding problem. Pick a name. Rename everything. One commit. Today.

### 5. Freeze new process infrastructure until the product has a booking path or a portfolio disclosure.

No new eval features. No new audit commands (the irony of this audit being written is noted). No new convention files. No new CI layers. No new meta-documentation. Not until **either** the product can actually book a trip **or** the README says clearly "this is a portfolio demo, not a commercial product."

Every hour spent on the eval harness, the audit infrastructure, the convention files, and the "process earns its keep" meta-system is an hour not spent answering the only question that matters: **does a single human outside the team care whether this exists?** The answer today is no. Process will not make the answer yes. Shipping a real booking integration, or shipping a great portfolio narrative, will.

---

## Severity Summary

| Finding                                                                | Severity                     |
| ---------------------------------------------------------------------- | ---------------------------- |
| No booking path + no revenue mechanism + negative unit economics       | **Fatal**                    |
| SerpApi prices are not bookable, trust bomb                            | **Fatal**                    |
| "Confirm booking" flow is a checkmark animation                        | **Fatal** (active user harm) |
| Competes directly with ChatGPT / Kayak / Mindtrip with no moat         | **Fatal**                    |
| Identity drift (Voyager vs. Agentic Travel Agent vs. Global vs. Atlas) | **Significant**              |
| Dead Amadeus references across schema, migrations, tests, docs         | **Significant**              |
| Process ratio (eval harness, audits, conventions) vs. product shipping | **Significant**              |
| Preferences wizard blocks time-to-first-value                          | **Worth addressing**         |
| 35 user stories describe UI states, not user outcomes                  | **Worth addressing**         |
| VibeLens cross-contamination in web-client public                      | **Minor**                    |

---

## Final Disposition

Voyager, as currently positioned, should not be shown to a paying user, a hiring manager looking for a shipped product, or an investor. It **can and should** be shown to a hiring manager looking for an engineer who can build a complex agentic AI system, provided the team first commits in writing that this is a portfolio artifact and stops describing it as a product.

The engineering is A-grade. The product frame is C-grade. The canonical role is explicit that engineering grades are irrelevant when the frame itself is wrong. **Fix the frame first.** Everything else - the eval harness, the audit suite, the convention files, the process infrastructure - is noise around a question the team has not yet been willing to answer: **what is this thing, and why does it exist?**

Answer that question. Then decide what the next 30 days look like.
