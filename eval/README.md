# Voyager Eval Suite

Automated evaluation system for the Voyager travel agent. Runs synthetic customer personas against the agent, scores conversation quality, and produces reports for benchmarking and regression detection.

## Quick Start

```bash
# Build the server first (eval imports it directly)
pnpm --filter voyager-server build

# Run full evaluation (15-18 personas, ~$3-8 API cost)
pnpm eval

# Quick run (5 personas, ~$2)
pnpm eval -- --personas=5

# Single archetype
pnpm eval -- --archetype=edge_case

# Compare against baseline
pnpm eval -- --compare=eval/reports/2026-04-04-013000.json
```

## How It Works

1. **Persona Generator** creates synthetic customer profiles from 6 archetypes (budget backpacker, luxury couple, family vacation, adventure seeker, business traveler, edge case) with randomized destinations, dates, budgets, and communication styles.

2. **Conversation Runner** plays each persona against the real travel agent by calling the chat handler directly (no HTTP server needed). A separate Claude call acts as the customer, staying in character.

3. **Evaluator** scores each conversation two ways:
   - **Assertions** (30%): programmatic checks — were details collected? searches executed? errors? response length? budget respected?
   - **Judge** (70%): LLM reads the transcript and scores 5 dimensions (task completion, efficiency, relevance, tone, error recovery) from 0.0-1.0

4. **Reporter** prints a CLI table and saves a JSON report for history tracking.

## Interpreting Results

- **Overall > 0.80**: Agent is performing well
- **Overall 0.60-0.80**: Acceptable but room for improvement
- **Overall < 0.60**: Significant issues to address
- **Regression > 0.10 drop**: Something broke — investigate

## Feeding Reports to Claude

The JSON reports are designed to be Claude-readable. Paste a report and ask:

- "What's the weakest dimension across all personas?"
- "Why did the edge case personas score low?"
- "Compare these two reports — what improved and what regressed?"
- "Based on these scores, what prompt changes would you recommend?"

## Archetypes

| Archetype         | Budget      | Tests                                               |
| ----------------- | ----------- | --------------------------------------------------- |
| Budget Backpacker | $500-1500   | Low-budget handling, hostel recommendations         |
| Luxury Couple     | $5000-15000 | Premium suggestions, romantic experiences           |
| Family Vacation   | $3000-8000  | Kid-friendly options, safety awareness              |
| Adventure Seeker  | $2000-6000  | Outdoor activities, unique stays                    |
| Business Traveler | $2000-5000  | Efficiency, minimal back-and-forth                  |
| Edge Case         | varies      | $200 budgets, dangerous destinations, one-way trips |

## Cost

- Full run (15-18 personas): ~$3-8
- Quick run (5 personas): ~$1-2
- Single archetype: ~$1-3

SerpApi calls are mocked during eval runs — no search quota consumed.
