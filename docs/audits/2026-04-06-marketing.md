# Voyager Marketing Audit

**Date:** 2026-04-06
**Auditor:** Marketing (CMO)
**Scope:** Landing page, explore/destinations, FAQ, layout SEO, MockChatBox demo, README/spec positioning

---

## Executive Summary

**What is this product and who is it for (one sentence):** Voyager is an AI trip planner that turns a budget and a vague idea ("a week in Barcelona, $4k, food and architecture") into a complete, priced itinerary pulled from live flight, hotel, and experience APIs, for self-directed leisure travelers who currently open six Kayak tabs and still feel unsure.

**The three priorities the team should fix this week:**

1. **P0 -- The hero does not say what the product does or why you would pick it over ChatGPT.** "Your next journey, planned by AI" is a description every competitor already makes. The subhead buries the single differentiator ("real flights, hotels, experiences") behind an em dash. The page never names a competitor it beats, never states a time-to-plan, never states a price. A visitor who has already tried ChatGPT for trip planning has no reason to sign up.
2. **P0 -- The FAQ is factually wrong about the data source.** It claims flight/hotel data comes from Amadeus ("the same data source used by major travel agencies worldwide"). The product actually uses SerpApi scraping Google Flights and Google Hotels. This is a trust-destroying misrepresentation and a legal exposure. If a user books based on this claim and something goes wrong, the false provenance is the first thing a plaintiff's lawyer finds.
3. **P0 -- There is no OG image, no sitemap, no robots.txt, and no Twitter card metadata.** Any link to voyager shared in Slack, Twitter/X, iMessage, or LinkedIn renders as a broken preview. The entire organic sharing loop is dead on arrival. This is hours of work to fix and is quietly costing every signup that would have come from a shared link.

**Banned-word count on the landing page alone:** 5 em dashes, "seamlessly"-adjacent copy in destination descriptions, and "world-class"-equivalent phrasing. Details below.

---

## Brand & Positioning

### What the landing page currently says

- **Eyebrow:** "AI Travel Concierge"
- **H1:** "Your next journey, planned by AI."
- **Subhead:** "Describe your dream trip. Our agent searches real flights, hotels, and experiences -- then assembles a complete, budget-aware itinerary in seconds."
- **Primary CTA:** "Start Planning"
- **Secondary CTA:** "How it Works"

### What is wrong

**1. "AI Travel Concierge" is the most crowded category label on the internet in 2026.** Every travel startup that raised a seed round in the last 24 months calls itself this. Kayak ships an "AI Trip Planner." Booking.com has "Smart Filter AI." Expedia has "Romie." ChatGPT plans trips for free. Perplexity plans trips for free. Google Gemini plans trips for free inside Maps. Calling yourself an "AI Travel Concierge" is like a 2012 startup calling itself "the Uber for X." It signals "me too" and nothing else.

**2. The H1 makes a promise the product already delivers -- but does not claim it credibly.** "Planned by AI" is the feature, not the benefit. The benefit is "planned in 30 seconds, priced down to the dollar, stays under your budget, and every flight and hotel is real inventory you can actually book." The current H1 could describe any of nine competitors. It does not answer the only question a visitor has: _why this, not ChatGPT?_

**3. The subhead hides the differentiator.** "Real flights, hotels, and experiences" is the moat. It is the ONLY thing a generic LLM cannot do without hallucinating. But the subhead buries it mid-sentence after "dream trip" (generic), ends with "budget-aware itinerary" (jargon), and uses an em dash for drama. The word "real" needs to be in the H1, not paragraph two.

**4. The target persona is not visible anywhere.** Is this for the Kayak power user who already spends six hours researching? The budget backpacker? The couple planning an anniversary? The business traveler extending into a long weekend? Every one of those needs different copy. Right now the copy speaks to nobody specifically, which means it converts no one strongly.

### Recommended rewrite -- hero

> **Eyebrow:** Planned in 30 seconds. Booked in your name.
>
> **H1:** Tell us where, when, and how much. We'll plan the rest.
>
> **Subhead:** Voyager searches live Google Flights and Hotels, prices every option against your budget, and hands you a day-by-day itinerary you can actually book. No hallucinations. No fake prices. No six tabs of Kayak.
>
> **Primary CTA:** Plan my first trip (free)
> **Secondary CTA:** See a 30-second demo

(Note the deliberate choice: no em dashes, concrete numbers, names two competitors by implication ("no six tabs of Kayak," "no hallucinations"), promises something specific ("30 seconds", "free"), and the CTA tells the user exactly what happens next.)

---

## Landing Page & Conversion

### Section-by-section findings

**Hero (P0)** -- Covered above. Rewrite required.

**Demo section (P1)**

- Copy: _"See it in action. Watch the agent plan a 5-day Barcelona trip in real time."_
- Problem: The demo on the page is for **Monterey**, not Barcelona. The copy lies. Fix the copy or fix the demo data, but do not ship them out of sync.
- Rewrite: _"Watch Voyager plan a 5-day Monterey trip in 30 seconds."_ (Put a real time on it so the user knows what they're signing up for.)
- The demo label _"Live demo -- sign in to try it"_ uses an em dash and sends a mixed signal ("live" plus "sign in"). Rewrite: _"This is a replay. Sign in to run a real plan."_

**How It Works (P2)**

- Step 2: _"It calls 3-8 real APIs per turn, reasoning between each."_
- This is engineer-speak. A traveler does not care about "per turn" or "APIs." They care that the result is accurate.
- Rewrite Step 2: _"Voyager searches. It compares flights, filters hotels by your budget, and looks up the experiences you'd actually enjoy. In seconds, not hours."_

**Features grid (P1)**

- "Real Flights" -- the word "Real" is finally surfaced here but it is section four of the page. Move it to the hero.
- "Curated Hotels" -- "Curated" is a stretch when the source is Google Hotels scraping. Rewrite to "Hotels in your budget."
- "Local Experiences" -- "Discovers restaurants, tours, and hidden gems" -- "hidden gems" is a travel cliché. Rewrite to "Finds the restaurants, museums, and tours locals actually go to."
- "Budget-Aware" / _"Never goes over your limit."_ -- good, keep this one. It is specific and testable.

**Explore Destinations section**

- _"Browse 30 curated travel guides with local tips, dining recommendations, and insider knowledge."_
- "Insider knowledge" is banned vocabulary. Everyone claims insider knowledge. Rewrite: _"Browse 30 city guides. Each one has hotels, restaurants, neighborhoods, and month-by-month weather, so you know what you're getting into."_

**Final CTA**

- _"Ready to go?"_ / _"Create a free account and plan your first trip in under a minute."_
- This one is actually fine. The "under a minute" is a specific, testable promise. Keep.
- But: _"Get Started Free"_ is the most overused button label in SaaS. Rewrite: _"Plan my first trip"_ (matches the hero CTA so the user is primed).

### Friction points

- No pricing visible anywhere on the landing page. Pricing is buried inside the FAQ ($9/month Pro). Prospects who want to know what this costs have to scroll through 15 FAQ entries. **Add a pricing line to the hero or a dedicated pricing section.** Hiding price does not increase conversion, it kills it.
- No testimonials, no "as seen in," no user count, no "trips planned" counter. Zero social proof. (See Trust Signals section.)
- Login flow from CTA is unclear -- "Start Planning" → what? A signup wall? A free demo? Tell the user before they click.

---

## Competitive Positioning

### The five competitors Voyager is actually fighting

1. **ChatGPT (and Claude.ai, Perplexity, Gemini).** The generalist LLMs plan trips for free. They hallucinate prices. They cannot book. Voyager's only real moat versus them is **real inventory with real prices**. This must be the hero claim.
2. **Kayak Trips / Kayak AI.** The incumbent with brand recognition and 20 years of flight data. Kayak's weakness: its UI is a 2015 artifact, it surfaces sponsored results, and its "AI" is search filters with a chat layer. Voyager should attack on "no sponsored results, no filter hell."
3. **Booking.com / Expedia / Hopper.** OTAs with AI bolt-ons. Their weakness: conflict of interest (they only recommend properties they can book), filtering inside walled gardens, and clunky UIs. Voyager is neutral and this should be stated.
4. **Mindtrip, Wonderplan, Layla, Roam Around (2024–2025 AI trip planner startups).** These are Voyager's direct category peers. Most of them hallucinate prices or show "estimated" flight costs with no booking link. Voyager's differentiator is the **budget-aware tool loop with live pricing**.
5. **A human travel agent (for the luxury segment).** Not Voyager's target, but worth naming to clarify positioning. Human agents cost $200–$500 per trip and take days. Voyager does it for free in seconds. This is the "budget of a backpacker, service of an agent" angle.

### The one sentence of differentiation the landing page is missing

> "Every flight price you see is a price you can actually book. Every hotel is real inventory. Voyager doesn't hallucinate -- it searches the same sources Google does, then reasons about your budget like a travel agent would."

### Where Voyager is vulnerable

- **When ChatGPT ships function-calling for Kayak/Expedia natively** (likely within 12 months), Voyager's moat narrows to UX, brand, and trip persistence. The team should be building the retention and trip-history features now, not the agent loop.
- **SerpApi is scraping Google.** Google can shut this down or Amadeus can undercut SerpApi's pricing. The data layer is not defensible. Position on the **reasoning layer and the UX**, not on the data source.
- **No "why should I trust this on a $4,000 trip" signal.** No testimonials, no press, no user count, no founder story. See Trust Signals.

---

## Copy Quality & Voice

### Banned-word inventory

**Em dashes used for drama (P1 per canonical role definition):**

| File                                                    | Line(s)              | Offending text                                                                                                                                                                          |
| ------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web-client/src/app/page.tsx`                           | 159                  | "real flights, hotels, and experiences -- then assembles"                                                                                                                               |
| `web-client/src/app/explore/page.tsx`                   | 71–72                | "dining recommendations, and insider knowledge -- then plan"                                                                                                                            |
| `web-client/src/app/explore/[slug]/page.tsx`            | 27, 30               | Title: "Travel Guide -- Voyager" in `generateMetadata`                                                                                                                                  |
| `web-client/src/app/faq/page.tsx`                       | 8, 11                | Meta title: "FAQ -- Voyager \| AI Trip Planner"                                                                                                                                         |
| `web-client/src/app/faq/page.tsx`                       | 31, 35, 44, 103, 113 | Multiple FAQ answers use em dashes for drama ("destination, dates, budget, and preferences -- ", "reasons about your requirements and calls real APIs 3-8 times per turn -- searching") |
| `web-client/src/app/layout.tsx`                         | 16                   | Root metadata title: "Voyager -- AI Travel Concierge"                                                                                                                                   |
| `web-client/src/components/MockChatBox/MockChatBox.tsx` | 303                  | "Live demo -- sign in to try it"                                                                                                                                                        |
| `web-client/src/data/destinations.ts`                   | 55                   | Tokyo description: "The transit system is a marvel in itself -- clean, punctual"                                                                                                        |
| `README.md`                                             | 5, 7                 | "assembles a complete itinerary -- all streamed", "not just answering questions -- it is _acting_"                                                                                      |

**Em dashes are acceptable in body prose where they replace a parenthetical.** The canonical role bans _em dashes used for drama_ -- specifically the AI-voice tic where every sentence has one in it to signal thoughtfulness. The FAQ and landing page cross that line. The destination descriptions are closer to normal travel writing and can keep a few, but the team should still audit and cap.

**Other banned phrases flagged:**

- "insider knowledge" (landing page explore section, and throughout destination copy) -- generic travel-marketing sludge
- "curated" (hero feature grid, "curated travel guides", "curated hotels") -- overused to the point of meaninglessness
- "hidden gems" (features section) -- travel cliché
- "masterclass in precision and care" (Tokyo description) -- empty superlative
- "electric contrasts" (Tokyo description) -- vague travel-magazine voice
- "marvel in itself" (Tokyo description) -- empty superlative
- "a city of [noun]" (destination template phrasing) -- formulaic

**Not flagged but worth watching:**

- "budget-aware" is used eight times across the codebase. It's technically accurate but it's a feature word, not a benefit word. A user doesn't buy "budget-awareness" -- they buy "will not blow my budget." Consider retiring the phrase from user-facing copy.

### AI-written-feeling phrases

The FAQ has the strongest AI-voice tells:

- "Voyager uses a multi-step tool-use loop powered by Claude." -- This is internal documentation voice leaking into marketing copy. Users do not care what the loop is called. Rewrite to "Voyager plans trips the way a human travel agent would: it searches, compares, checks your budget, adjusts, and repeats until it finds something that fits."
- "just like a human travel advisor would" -- fine phrasing but immediately after the tool-use-loop-speak, making the whole paragraph read as translated-from-engineering.
- "Unlike simple chatbots" -- the "unlike X" construction is an LLM tic. Cut it.

### Destination content quality

**The 30 destination pages are above average for auto-generated travel SEO content.** I read the Tokyo entry in full. It has real, specific detail (Toyosu Market tuna auction, Shimokitazawa vintage shops, Yanaka old Edo, Suica card, Ameyoko under the Yamanote tracks). This is not GPT slop. Whoever wrote these either did the research or used a very careful prompt.

**But there are still problems:**

1. **The voice is "travel magazine circa 2015"** -- "neon-drenched Shibuya," "electric contrasts," "masterclass in precision and care." This is the register Condé Nast Traveler retired three years ago. It reads as slightly fake.
2. **Every destination follows the exact same template paragraph structure**, and careful readers will spot the pattern after scanning 3 or 4 pages. Consider breaking the mold -- some destinations should lead with food, some with a neighborhood story, some with a single iconic experience. Right now they all read as "overview, then food, then transit."
3. **No first-person voice or attribution.** Who wrote these? "Voyager's editors"? A specific travel writer? Anonymous SEO content is less trusted than named content. Even a single byline ("Notes from the Voyager travel desk") would help.
4. **No dates or freshness signals.** "Updated January 2026" would signal the content is maintained. Right now a visitor has no idea if this is 2026 information or 2022 information.
5. **The sections "about / experiences / dining / neighborhoods / weather / visa" are exhaustive but lifeless.** Dining is a list of restaurants with a cuisine label -- no standout dishes, no price ranges tied to specific items, no "if you go to one place, go here." The experience cards show a price but no time commitment, no booking link, no "is this worth it for a first-time visitor" signal.

### CTAs & microcopy inventory

| Location                      | Current                          | Problem                                           | Suggested rewrite                               |
| ----------------------------- | -------------------------------- | ------------------------------------------------- | ----------------------------------------------- |
| Hero primary                  | "Start Planning"                 | Generic. Doesn't say what happens next.           | "Plan my first trip (free)"                     |
| Hero secondary                | "How it Works"                   | Bland.                                            | "Watch the 30-sec demo"                         |
| Explore CTA                   | "Discover destinations"          | Fine but ordinary.                                | "Browse 30 city guides"                         |
| Final hero CTA                | "Get Started Free"               | The single most overused SaaS button label.       | "Plan my first trip"                            |
| Destination page CTA          | "Plan a trip to {dest.name}"     | Actually good -- specific, intent-matching. Keep. | (keep)                                          |
| Footer tagline                | "AI-powered travel concierge"    | Generic category label.                           | "Real flights. Real hotels. Real budgets."      |
| FAQ CTA button                | "Get Started"                    | Generic.                                          | "Plan a free trip"                              |
| MockChatBox label             | "Live demo -- sign in to try it" | Contradictory (live + sign-in). Uses em dash.     | "This is a replay. Sign in to run a real plan." |
| MockChatBox input placeholder | "Where do you want to go?"       | Good. Keep.                                       | (keep)                                          |

### Empty states and error messages

Not reviewed in depth in this audit -- deferred to UX audit. But one flag: the landing page has no visible empty state for "I'm logged in but have no trips yet." The auth flow redirects logged-in users to `/trips` immediately (line 120 of `page.tsx`), so the empty trips screen is doing the conversion work for returning users. That screen should be reviewed for copy -- first impression after signup is made there, not on the landing page.

---

## Monetization Model Review

### Current model (as stated in FAQ)

- **Free tier:** 3 trips per month with full agent conversations
- **Pro tier:** $9/month, unlimited trips, priority API access, save/share, PDF/calendar export

### My position

**The $9/month subscription is the wrong primary model for this product.** Here is why, and what to do instead:

**1. Trip planning is episodic, not continuous.** A typical leisure traveler plans 1–3 trips a year. Asking them to pay $9/month (=$108/year) for a free-tier that already covers "3 trips per month" makes no sense. The free tier is too generous relative to actual usage. A casual user can plan their entire year on the free tier and never convert.

**2. The Pro tier benefits are weak.** "Priority API access," "save and share," "PDF export" -- none of these are worth $9/month to someone planning two trips a year. Priority access is a feature users only care about during the 20 minutes they are actively planning. The rest are nice-to-haves.

**3. Subscription creates a churn treadmill for a product with episodic demand.** Users will subscribe to plan one trip, then cancel. The team will chase retention metrics for a product that structurally cannot retain casuals.

### What I recommend instead

**Hybrid: free up to 2 trips/month + per-trip "unlock" at $4.99 + optional $29/year "frequent traveler" plan for unlimited**

- **Free tier:** 2 fully planned trips per month. Enough to let users feel the product, not enough to never convert. Harder cap than current "3/month."
- **Per-trip unlock: $4.99.** User hits the cap, gets offered a single-trip unlock. Price anchors against "one coffee." High conversion on intent signals (they hit the cap; they want the trip).
- **Annual plan: $29/year** ("Frequent Traveler"). Unlimited trips, save/share, PDF export, and -- critically -- **a "trip reminder" re-engagement loop** (email 30 days before a saved departure date with "need to adjust your plan?"). The annual frame fits the annual cadence of leisure travel. Monthly subscription does not.
- **Kill the $9/month tier entirely.** It's a false middle option that cannibalizes annual and confuses the pricing page.

**Additionally:** start exploring an affiliate layer _transparently disclosed_ as a revenue source. The FAQ currently says "We do not take affiliate commissions that bias our recommendations." That is a nice commitment but it leaves money on the table in a category where OTAs pay 5–15% commission on booked stays. Voyager can take affiliate revenue ethically by being transparent ("the hotel you're seeing is ranked purely by your budget and stars; if you book it through our link, we get a commission but the price is the same"). This is what Wirecutter does. It is the correct model for an affiliate-revenue content-heavy product with editorial integrity.

**Do not hedge on this.** The current subscription model will miss revenue targets and the team will debug it for six months. Switch now.

---

## SEO & Discoverability

### What is missing (all of these are fixable in a single afternoon)

| Item                                                | Current state                                                                 | Severity |
| --------------------------------------------------- | ----------------------------------------------------------------------------- | -------- |
| OG image                                            | Missing (no `opengraph-image.*` in `web-client/app/`, no `public/og-image.*`) | **P0**   |
| Twitter Card metadata                               | Missing from root `layout.tsx`                                                | **P0**   |
| `sitemap.xml`                                       | Missing                                                                       | **P1**   |
| `robots.txt`                                        | Missing                                                                       | **P1**   |
| Canonical URLs                                      | Set on FAQ only; missing on landing, explore, destination pages               | **P1**   |
| Structured data (SoftwareApplication, Organization) | Missing (only FAQPage schema on `/faq`)                                       | **P2**   |
| Meta description length on landing                  | Short (131 chars); could be richer                                            | **P3**   |
| Keywords/category metadata                          | Missing                                                                       | **P3**   |
| `manifest.json` / PWA metadata                      | Not reviewed                                                                  | P3       |
| `favicon.ico` / apple-touch-icon                    | Not verified (no `public/` directory found)                                   | **P1**   |

### The P0: the OG image problem

Any link to `voyager.interviewiangreenough.xyz` shared in a text, a Slack, a tweet, a LinkedIn post renders as a broken blank card. This is the single highest-leverage fix in this audit. **Ship a branded OG image today.** Design spec: 1200x630, Voyager logo, tagline, a destination photo background, no text at micro-size. Save to `web-client/app/opengraph-image.png` and Next.js picks it up automatically.

### What the destination pages are doing right

- Per-page metadata is generated from `generateMetadata`
- Destinations produce static params, so pages are pre-rendered and indexable
- Content is non-trivial (see Copy Quality section) -- not thin SEO pages
- FAQPage JSON-LD schema on the FAQ page

### What the destination pages are doing wrong

- Metadata title uses an em dash: `${dest.name} Travel Guide -- Voyager`
- No `TouristAttraction` or `Place` structured data per destination -- Voyager is sitting on 30 pages of structured travel data and not emitting schema.org markup for any of it. This is leaving Google rich snippets on the table.
- OG tags exist per-destination but no `images` array -- so the shared preview is text-only
- No canonical URLs on `[slug]` pages

---

## Onboarding & Activation

Not exhaustively reviewed in this audit (the canonical role flags onboarding as in-scope and the team should do a deeper pass). Quick observations:

- **Redirect-on-login goes straight to `/trips`.** This means a brand-new user who just signed up lands on a blank trips list. That screen's copy, empty state, and single CTA are doing the activation work. If that screen says something boring like "You have no trips yet" the whole landing page work is wasted.
- **Time to first value (TTFV) appears to be ~30 seconds** once a user is in the chat, which is excellent. But the user has to go through signup → empty state → new-trip form → chat before hitting the "wow" moment. **Recommend a demo-without-signup path** -- let anonymous visitors run one planning session, then ask for signup to save it. This is the single highest-conversion lever available.
- The current hero CTA "Start Planning" goes to `/register`, not to a live product tour. Friction that should not be there.

---

## Growth Loops & Retention

Not a primary audit focus but worth flagging:

- **No referral program.** A product where users are planning trips for themselves and their friends is a natural referral product. Missing lever.
- **No shareable itineraries.** A user plans a trip, wants to send it to their partner or their travel companion. What happens? Copy-paste? The Pro tier mentions "save and share" but there is no shareable public URL visible.
- **No email re-engagement.** When does Voyager email a user? Only transactional? Missing hook: 30 days before a saved departure date, email the user with "your Barcelona trip is 30 days away, need to update anything?" This is free retention and it converts.
- **No trip-memory loop.** After a user returns from a trip, Voyager should know the trip happened and ask "how was it?" or "plan the next one." Without this, a trip plan is a one-shot interaction.

---

## Trust Signals

### Current state

- **No testimonials.** Zero.
- **No press mentions or "as seen in."**
- **No user count** ("trusted by 10,000 travelers"). No trip count ("planned 50,000 trips this month").
- **No founder story or about page.**
- **No pricing transparency on the landing page.** Pricing buried in the FAQ.
- **Privacy messaging is good** in the FAQ (no data sales, no ad bias, deletion in 30 days) -- but none of this is surfaced on the landing page where it would build trust at the critical moment.
- **No data source disclosure on the landing page.** The SerpApi/Google Flights/Google Places sourcing is a competitive advantage (versus hallucinating LLMs) and should be named explicitly on the hero: "Powered by live Google Flights and Google Hotels data."

### The factual-accuracy problem

**The FAQ currently states flight and hotel data comes from Amadeus.** The codebase and spec use SerpApi. This is a P0 trust-destroying misstatement. The fix is to update the FAQ copy to match reality. Fix before any marketing push.

### Recommended additions (in priority order)

1. **Data source line on landing page hero:** "Powered by live Google Flights and Google Hotels data." (P0 -- do this today.)
2. **"No hallucinations" trust badge or section.** A short callout that says "Voyager does not make up prices. Every flight you see is a real, searchable result." Versus ChatGPT this is the moat. (P0)
3. **Beta / launch counter.** Even "50 trips planned this week" is better than nothing. (P1)
4. **A founder's note or about page.** Who made this? Why should I trust their judgment on my vacation? (P2)
5. **Testimonials** -- once you have users willing to be quoted. Do not fake these. (P2, evergreen)

---

## Prioritized Recommendations

### P0 -- Fix this week

| #   | Fix                                                                                            | Impact |
| --- | ---------------------------------------------------------------------------------------------- | ------ |
| 1   | Rewrite hero H1, subhead, eyebrow, and primary CTA (see "Recommended rewrite -- hero" above).  | H      |
| 2   | Fix the FAQ's Amadeus misstatement. Replace with "SerpApi (Google Flights and Google Hotels)." | H      |
| 3   | Ship an OG image at `web-client/app/opengraph-image.png` (1200x630).                           | H      |
| 4   | Add Twitter Card metadata to root `layout.tsx`.                                                | H      |
| 5   | Fix the demo copy mismatch: landing page says "Barcelona" but demo shows "Monterey."           | H      |
| 6   | Add "Powered by live Google Flights and Google Hotels" data-source line on the landing page.   | H      |
| 7   | Fix all em-dash-for-drama instances in landing, FAQ, layout metadata, and MockChatBox label.   | M      |

### P1 -- Fix this month

| #   | Fix                                                                                                                                 | Impact |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 8   | Add `sitemap.xml` and `robots.txt` (use Next.js `app/sitemap.ts`).                                                                  | M      |
| 9   | Add canonical URLs to all marketing pages (landing, explore, destination pages).                                                    | M      |
| 10  | Add a pricing section to the landing page. Do not hide it in the FAQ.                                                               | H      |
| 11  | Rewrite the monetization model per recommendation above (kill $9/month, add per-trip unlock + $29/year annual).                     | H      |
| 12  | Add a demo-without-signup path for anonymous visitors.                                                                              | H      |
| 13  | Rewrite feature grid copy (retire "curated", "hidden gems", "insider knowledge").                                                   | M      |
| 14  | Add at least one trust signal: user count, trip count, beta badge, or named founder.                                                | M      |
| 15  | Scan destination JSON files for em dashes and empty superlatives; cap em dashes to max 1 per paragraph in destination descriptions. | M      |

### P2 -- Next quarter

| #   | Fix                                                                                      | Impact |
| --- | ---------------------------------------------------------------------------------------- | ------ |
| 16  | Add schema.org `TouristAttraction` / `Place` structured data to destination pages.       | M      |
| 17  | Retire the "tool-use loop" language from user-facing FAQ. Rewrite in travel-agent terms. | M      |
| 18  | Build a shareable-itinerary public URL feature. Name each URL a "Voyager Trip" for SEO.  | H      |
| 19  | Build the 30-day-before-departure re-engagement email.                                   | M      |
| 20  | Commission or write a founder's note / about page.                                       | M      |
| 21  | Vary destination-page template structure so the 30 pages don't all read identically.     | M      |

### P3 -- Evergreen

| #   | Fix                                                                            | Impact        |
| --- | ------------------------------------------------------------------------------ | ------------- |
| 22  | Add "last updated" timestamps on destination guides.                           | L             |
| 23  | Build a referral program.                                                      | M             |
| 24  | Testimonials + press page once users exist.                                    | M             |
| 25  | Consider a transparently-disclosed affiliate revenue layer (Wirecutter model). | H (long-term) |

---

## Closing note

Voyager has real substance. The product does something meaningfully different from ChatGPT (real inventory, real prices, real budget reasoning), the destination content is above the SEO-slop line, and the 30-second time-to-value is exceptional. The marketing does not communicate any of this. The landing page reads as generic "AI Travel Concierge" copy that a visitor has seen from five competitors this week, the FAQ misrepresents the data source, and the OG image problem means every shared link is dead. Fix the hero, fix the FAQ, ship the OG image, and the conversion rate should visibly move within a sprint.

The monetization model needs a harder decision than the team has made so far. $9/month subscription for an episodic-demand product is structurally wrong. Switch to a per-trip unlock plus $29/year annual plan, cut the monthly entirely, and stop leaving money on the table by rejecting affiliate revenue as categorically "biased." A transparent affiliate layer is ethically fine and financially necessary.
