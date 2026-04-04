# Eval Suite — Design Spec

**Goal:** Build an automated evaluation system that runs synthetic customer personas against the travel agent, scores conversation quality across multiple dimensions, and produces reports for regression detection and quality benchmarking.

**Problem:** The travel agent is non-deterministic — unit tests verify code correctness but can't evaluate conversation quality, relevance, or user experience. Manual testing doesn't scale. We need automated, repeatable quality measurement.

---

## 1. Architecture

Four components run in sequence:

1. **Persona Generator** — Produces 15-18 synthetic customer profiles from 6 archetype templates with randomized specifics (destination, dates, budget, communication style).

2. **Conversation Runner** — Takes a persona and runs a multi-turn conversation against the travel agent by calling the `chat()` handler directly with mocked req/res (no HTTP server needed). A separate "customer agent" Claude call plays the persona and decides what to say each turn.

3. **Evaluator** — Two-layer scoring:
   - **Assertions** (programmatic): binary pass/fail checks on tool calls, errors, response length, budget adherence.
   - **Judge** (LLM): reads the full transcript + persona goals, scores a 5-dimension rubric (0.0-1.0) with justifications.

4. **Reporter** — CLI table for immediate feedback, timestamped JSON report for history, `--compare` flag for regression detection.

Flow: `pnpm eval` → generate personas → run conversations → evaluate → report.

---

## 2. Persona Templates

Six archetype templates, each producing 2-3 personas per run with randomized specifics:

| Archetype         | Budget Range | Travel Party     | Constraints                                                                     |
| ----------------- | ------------ | ---------------- | ------------------------------------------------------------------------------- |
| Budget Backpacker | $500-1500    | Solo             | Cheapest everything, hostel-friendly                                            |
| Luxury Couple     | $5000-15000  | Romantic partner | High-end hotels, fine dining, experiences                                       |
| Family Vacation   | $3000-8000   | Family with kids | Kid-friendly, safety-conscious                                                  |
| Adventure Seeker  | $2000-6000   | Solo or friends  | Outdoor activities, off-beaten-path                                             |
| Business Traveler | $2000-5000   | Solo             | Efficiency-focused, specific dates, no leisure                                  |
| Edge Case         | varies       | varies           | Stress-test: $200 budget, dangerous destination, one-way, no budget, past dates |

### Randomized per persona

- **Destination** — from the 34 curated destinations + some non-curated cities
- **Dates** — random future dates within 6 months
- **Communication style** — `detailed` (gives all info upfront), `terse` (one-word answers), `conversational` (natural back-and-forth), `impatient` (skips categories, wants it done fast)
- **Goals** — 2-4 specific things the persona wants (e.g., "book a beach hotel under $200/night", "find a cooking class", "skip car rental")

The edge case archetype specifically tests hardening: low budget, dangerous destinations, LGBTQ+ safety flags, one-way trips.

---

## 3. Conversation Runner

The runner simulates multi-turn conversations by alternating between the customer agent and the travel agent.

### Per-conversation flow

1. Create a real trip in the test database via `tripRepo.createTrip()`
2. Generate the customer's first message based on persona (detailed persona gives everything upfront, terse persona gives minimal info)
3. Call the `chat()` handler directly with mocked req/res, capture response nodes
4. Feed response to the customer agent: "You are [persona]. Here's what the travel agent said. What do you say next? If the conversation is complete, respond with DONE."
5. Repeat until customer says DONE or max turns (10) is reached
6. Capture: full transcript, tool calls, final trip state, completion tracker

### Customer agent prompt

Kept minimal. The customer doesn't know what tools exist or how the system works. It has its persona, goals, and conversation history. It responds naturally — terse personas give short answers, impatient personas skip categories, detailed personas are cooperative.

### Integration approach

The runner calls the `chat()` handler function directly with mocked Express req/res objects, bypassing HTTP. This tests the full handler logic (completion tracker, enrichment, form injection) without needing a running server. SerpApi responses use the existing Redis cache (1-hour TTL) so repeated runs don't burn quota.

### Test database

Uses the existing test database (`DATABASE_URL`). Each eval run creates fresh trips and cleans them up after.

### Max turns: 10

If the conversation hasn't resolved by turn 10, that itself is a failure signal scored by the judge.

---

## 4. Scoring

### Assertions (programmatic, 30% of overall score)

| Assertion                | What it checks                                             |
| ------------------------ | ---------------------------------------------------------- |
| `details_collected`      | Trip has destination, origin, departure_date populated     |
| `search_executed`        | At least one search tool was called                        |
| `no_errors`              | No agent loop failures or tool errors                      |
| `response_length`        | Average agent response under 150 words                     |
| `budget_respected`       | If budget set, total_spent doesn't exceed by more than 20% |
| `format_response_used`   | Every agent turn called format_response                    |
| `conversation_completed` | Customer said DONE before max turns                        |

Each assertion is binary (0.0 or 1.0). Assertion score = average of all.

### Judge rubric (LLM, 70% of overall score)

| Dimension           | 0.0 (poor)                           | 1.0 (excellent)                     |
| ------------------- | ------------------------------------ | ----------------------------------- |
| **Task Completion** | Missed most goals                    | All persona goals addressed         |
| **Efficiency**      | Many turns, repeated questions       | Got to results quickly              |
| **Relevance**       | Suggestions didn't match preferences | Tailored to persona                 |
| **Tone**            | Robotic, generic, verbose            | Natural, advisory, concise          |
| **Error Recovery**  | Broke on edge cases                  | Handled unusual requests gracefully |

The judge gets: persona definition (goals, style, constraints), full transcript, and rubric. Returns scores + one-sentence justification per dimension.

### Overall score

Weighted average: 30% assertions + 70% judge dimensions. If any critical assertion fails (`no_errors` or `conversation_completed`), overall is capped at 0.40.

### Regression threshold

A score drop > 0.10 from baseline flags a regression in `--compare` output.

---

## 5. Reporter

### CLI output

Printed after every run:

```
╭──────────────────────────────────────────────────────────────╮
│  Voyager Eval Report — 2026-04-04 01:30:00                   │
│  18 personas · 142 turns · 3m 47s                            │
╰──────────────────────────────────────────────────────────────╯

Archetype          Persona              Overall  Task  Effic  Rel   Tone  Recov  Turns
─────────────────────────────────────────────────────────────────────────────────────────
Budget Backpacker  Solo Bangkok $800      0.82   0.90  0.70  0.80  0.90  0.80    6
Luxury Couple      Bali Honeymoon $10k    0.91   1.00  0.90  0.90  0.90  0.80    5
Edge Case          $200 Budget Tokyo      0.55   0.40  0.60  0.50  0.80  0.50    10
─────────────────────────────────────────────────────────────────────────────────────────
OVERALL                                   0.79

Assertions: 16/18 passed (details_collected: 18/18, no_errors: 16/18)
```

### JSON report

Saved to `eval/reports/YYYY-MM-DD-HHmmss.json`:

```json
{
  "timestamp": "2026-04-04T01:30:00Z",
  "duration_ms": 227000,
  "summary": { "overall": 0.79, "personas": 18, "turns": 142 },
  "personas": [
    {
      "name": "Solo Bangkok $800",
      "archetype": "budget_backpacker",
      "config": { "destination": "Bangkok", "budget": 800 },
      "assertions": { "details_collected": true, "no_errors": true },
      "judge_scores": {
        "task_completion": { "score": 0.9, "justification": "..." },
        "efficiency": { "score": 0.7, "justification": "..." }
      },
      "overall": 0.82,
      "turns": 6,
      "transcript": []
    }
  ]
}
```

### Compare mode

`pnpm eval -- --compare reports/baseline.json` diffs overall and per-archetype scores. Flags regressions > 0.10.

### Claude-readable

JSON includes full transcripts and justifications. Paste a report into Claude and ask "what's the weakest area?" or "why did the edge case persona score low?"

---

## 6. Package Structure

```
eval/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # CLI entry point
│   ├── personas/
│   │   ├── templates.ts            # 6 archetype templates
│   │   └── generator.ts            # generatePersonas()
│   ├── runner/
│   │   ├── conversation.ts         # runConversation()
│   │   └── customer-agent.ts       # Claude call playing the customer
│   ├── scoring/
│   │   ├── assertions.ts           # programmatic checks
│   │   └── judge.ts                # LLM judge with rubric
│   ├── reporter/
│   │   ├── cli.ts                  # CLI table output
│   │   ├── json.ts                 # JSON report writer
│   │   └── compare.ts             # diff two reports
│   └── utils/
│       └── harness.ts              # mock req/res for chat handler
├── reports/                        # generated reports (gitignored)
└── README.md                       # how to run, interpret, feed to Claude
```

### Commands

- `pnpm eval` — full run (~15-18 personas)
- `pnpm eval -- --personas 5` — quick run
- `pnpm eval -- --archetype edge_case` — single archetype
- `pnpm eval -- --compare reports/baseline.json` — regression check

### Dependencies

- `@anthropic-ai/sdk` — customer agent + judge LLM calls
- Server workspace package — chat handler, repos, tools

### Cost per run

~15-18 personas × ~10 turns × 2 API calls per turn + 18 judge calls ≈ ~380 API calls. Roughly $3-8 per full run at Sonnet pricing. A quick 5-persona run is under $2.
