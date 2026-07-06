/**
 * Production eval runner. Queries the last N real assistant turns from the
 * messages table, scores each with planJudge, and prints a summary report
 * showing per-dimension averages and flag frequencies.
 *
 * Usage:
 *   DATABASE_URL=... tsx src/scoring/runProductionEval.ts
 *   LIMIT=20 DATABASE_URL=... tsx src/scoring/runProductionEval.ts
 *
 * Reads ANTHROPIC_API_KEY and DATABASE_URL from the environment (or .env).
 * Override the judge model with EVAL_PLAN_JUDGE_MODEL.
 */
import { resolve } from 'node:path';

import { config } from 'dotenv';
import pg from 'pg';

import { computePlanScore, runPlanJudge } from './planJudge.js';
import type {
  PlanJudgeResult,
  PlanTurnInput,
  ToolCallRecord,
  TripContext,
} from './planJudge.js';

config({ path: resolve(process.cwd(), '../apps/server/.env') });

const { Pool } = pg;

const QUERY_LIMIT = parseInt(process.env.LIMIT ?? '25', 10);
const DIMENSION_PRECISION = 10;
const SCORE_PRECISION = 100;
const PERCENT = 100;
const ID_PREVIEW_LENGTH = 8;
const DATE_PART_LENGTH = 10;

interface MessageRow {
  id: string;
  nodes: unknown[];
  tool_calls_json: ToolCallRecord[] | null;
  user_message: string;
  destination: string;
  origin: string | null;
  budget_total: number | null;
  budget_currency: string;
  travelers: number;
  departure_date: string | null;
  return_date: string | null;
  created_at: string;
}

interface ScoredTurn {
  id: string;
  created_at: string;
  input: PlanTurnInput;
  result: PlanJudgeResult;
  score: number;
}

interface FlagTally {
  [flag: string]: number;
}

async function fetchRecentTurns(pool: pg.Pool): Promise<MessageRow[]> {
  const { rows } = await pool.query<MessageRow>(
    `SELECT
       am.id,
       am.nodes,
       am.tool_calls_json,
       am.created_at::text,
       um.content AS user_message,
       t.destination,
       t.origin,
       t.budget_total,
       t.budget_currency,
       t.travelers,
       t.departure_date::text,
       t.return_date::text
     FROM messages am
     JOIN messages um
       ON um.conversation_id = am.conversation_id
      AND um.sequence = am.sequence - 1
      AND um.role = 'user'
     JOIN conversations c ON c.id = am.conversation_id
     JOIN trips t ON t.id = c.trip_id
     WHERE am.role = 'assistant'
       AND am.nodes IS NOT NULL
       AND jsonb_array_length(am.nodes) > 0
     ORDER BY am.created_at DESC
     LIMIT $1`,
    [QUERY_LIMIT],
  );
  return rows;
}

const JUDGE_DIMENSIONS = new Set([
  'budget_adherence',
  'completeness',
  'preference_alignment',
  'response_quality',
  'tool_efficiency',
  'safety_and_flags',
]);

const PLANNING_NODE_TYPES = new Set([
  'flight_tiles',
  'hotel_tiles',
  'car_rental_tiles',
  'experience_tiles',
  'itinerary',
  'plan_card',
  'budget_bar',
]);

const SEARCH_TOOL_NAMES = new Set([
  'search_flights',
  'search_hotels',
  'search_experiences',
  'search_car_rentals',
]);

function isPlanningTurn(row: MessageRow): boolean {
  const hasSearchCall = (row.tool_calls_json ?? []).some((c) =>
    SEARCH_TOOL_NAMES.has(c.tool_name),
  );
  if (hasSearchCall) return true;
  const nodes = row.nodes as Array<{ type?: string }>;
  return nodes.some((n) => n?.type && PLANNING_NODE_TYPES.has(n.type));
}

function buildTurnInput(row: MessageRow): PlanTurnInput {
  const tripContext: TripContext = {
    budget_currency: row.budget_currency,
    budget_total: row.budget_total,
    departure_date: row.departure_date ?? '',
    destination: row.destination,
    origin: row.origin ?? 'unknown',
    return_date: row.return_date ?? null,
    travelers: row.travelers,
  };
  return {
    response_nodes: row.nodes,
    tool_calls: row.tool_calls_json ?? [],
    trip_context: tripContext,
    user_input: row.user_message,
  };
}

async function scoreAllTurns(rows: MessageRow[]): Promise<ScoredTurn[]> {
  const results: ScoredTurn[] = [];
  for (const row of rows) {
    const input = buildTurnInput(row);
    try {
      const result = await runPlanJudge(input);
      results.push({
        created_at: row.created_at,
        id: row.id,
        input,
        result,
        score: computePlanScore(result),
      });
    } catch (err) {
      console.error(`  skipped ${row.id}: ${String(err)}`);
    }
  }
  return results;
}

function tallyFlags(scored: ScoredTurn[]): FlagTally {
  const tally: FlagTally = {};
  for (const { result } of scored) {
    for (const flag of result.flags) {
      tally[flag] = (tally[flag] ?? 0) + 1;
    }
  }
  return tally;
}

function computeDimensionAverages(
  scored: ScoredTurn[],
): Record<string, number> {
  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const { result } of scored) {
    for (const [dim, val] of Object.entries(result.dimensions)) {
      if (!JUDGE_DIMENSIONS.has(dim)) continue;
      const score =
        typeof val === 'object' && val !== null
          ? (val as { score: number }).score
          : NaN;
      if (Number.isNaN(score)) continue;
      sums[dim] = (sums[dim] ?? 0) + score;
      counts[dim] = (counts[dim] ?? 0) + 1;
    }
  }
  const averages: Record<string, number> = {};
  for (const [dim, total] of Object.entries(sums)) {
    averages[dim] =
      Math.round((total / (counts[dim] ?? 1)) * DIMENSION_PRECISION) /
      DIMENSION_PRECISION;
  }
  return averages;
}

function printReport(
  scored: ScoredTurn[],
  totalFetched: number,
  skippedCount: number,
): void {
  const total = scored.length;
  const validScores = scored
    .map((t) => t.score)
    .filter((s) => !Number.isNaN(s));
  const overallAvg =
    validScores.length > 0
      ? Math.round(
          (validScores.reduce((s, v) => s + v, 0) / validScores.length) *
            SCORE_PRECISION,
        ) / SCORE_PRECISION
      : 0;
  const dimAvgs = computeDimensionAverages(scored);
  const flags = tallyFlags(scored);

  console.info('\n=== Voyager Production Plan Eval ===');
  console.info(
    `Turns: ${totalFetched} fetched, ${skippedCount} clarifying/form skipped, ${total} scored`,
  );
  console.info(`Overall avg (normalized 0-1): ${overallAvg}`);

  console.info('\nDimension averages (1-5 scale):');
  for (const [dim, avg] of Object.entries(dimAvgs)) {
    console.info(`  ${dim}: ${avg}`);
  }

  printFlagFrequencies(flags, total);
  printPerTurnScores(scored);
}

function printFlagFrequencies(flags: FlagTally, total: number): void {
  console.info('\nFlag frequencies:');
  if (Object.keys(flags).length === 0) {
    console.info('  none');
    return;
  }
  for (const [flag, count] of Object.entries(flags).sort(
    (a, b) => b[1] - a[1],
  )) {
    const pct = Math.round((count / total) * PERCENT);
    console.info(`  ${flag}: ${count}/${total} (${pct}%)`);
  }
}

function printPerTurnScores(scored: ScoredTurn[]): void {
  console.info('\nPer-turn scores (newest first):');
  for (const { created_at, id, result, score } of scored) {
    const flagStr =
      result.flags.length > 0 ? ` [${result.flags.join(', ')}]` : '';
    console.info(
      `  ${id.slice(0, ID_PREVIEW_LENGTH)} ${created_at.slice(0, DATE_PART_LENGTH)} score=${score}${flagStr}`,
    );
    console.info(`    ${result.verdict}`);
  }
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.info(`Fetching up to ${QUERY_LIMIT} recent assistant turns...`);
    const rows = await fetchRecentTurns(pool);
    if (rows.length === 0) {
      console.info(
        'No turns found. Check DATABASE_URL and that messages exist.',
      );
      return;
    }
    const planningRows = rows.filter(isPlanningTurn);
    const skippedCount = rows.length - planningRows.length;
    console.info(
      `Found ${rows.length} turns: ${planningRows.length} planning, ${skippedCount} clarifying/form (skipped).`,
    );
    const scored = await scoreAllTurns(planningRows);
    printReport(scored, rows.length, skippedCount);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
