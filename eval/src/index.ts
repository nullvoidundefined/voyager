#!/usr/bin/env node
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';

import {
  generatePersonas,
  loadCachedPersonas,
  saveCachedPersonas,
} from './personas/generator.js';
import { printCliReport } from './reporter/cli.js';
import { compareReports } from './reporter/compare.js';
import { writeJsonReport } from './reporter/json.js';
import {
  type ConversationResult,
  runConversation,
} from './runner/conversation.js';
import {
  computeAssertionScore,
  isCriticalFailure,
  runAssertions,
} from './scoring/assertions.js';
import { computeJudgeScore, runJudge } from './scoring/judge.js';
import { resolveServerPoolPath } from './serverPoolPath.js';
import type {
  Archetype,
  EvalReport,
  JudgeScores,
  Persona,
  PersonaResult,
} from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env vars from the server's .env (database URL, API keys)
config({ path: join(__dirname, '..', '..', 'apps', 'server', '.env') });

// Eval-specific overrides
process.env.NODE_ENV = 'test';
process.env.EVAL_MOCK_SEARCH = 'true';

const ARGV_OPTIONS_START = 2;
const DIVIDER_WIDTH = 40;
const ASSERTION_WEIGHT = 0.3;
const JUDGE_WEIGHT = 0.7;
const CRITICAL_FAILURE_SCORE_CAP = 0.4;
const SCORE_PRECISION = 100;
const SCORE_DECIMALS = 2;

// Parse CLI args
const args = process.argv.slice(ARGV_OPTIONS_START);
function getArg(name: string): string | undefined {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg?.split('=')[1];
}

const personaCount = getArg('personas')
  ? parseInt(getArg('personas')!)
  : undefined;
const archetypeFilter = getArg('archetype') as Archetype | undefined;
const compareFile = getArg('compare');

async function main() {
  const startTime = Date.now();

  console.log('');
  console.log('\ud83e\udded Voyager Eval Suite');
  console.log('\u2500'.repeat(DIVIDER_WIDTH));

  // 1. Generate personas
  // Check for --regenerate flag
  const shouldRegenerate = args.includes('--regenerate');

  // Load cached personas or generate new ones
  let personas: Persona[];
  const cached = shouldRegenerate ? null : loadCachedPersonas();

  if (cached && !archetypeFilter && !personaCount) {
    personas = cached;
    console.log(`Loaded ${personas.length} cached personas`);
  } else {
    personas = generatePersonas({
      archetype: archetypeFilter,
      count: personaCount,
    });
    // Save to cache (only for full runs without filters)
    if (!archetypeFilter && !personaCount) {
      saveCachedPersonas(personas);
      console.log(`Generated and cached ${personas.length} personas`);
    } else {
      console.log(
        `Generated ${personas.length} personas (not cached — filtered run)`,
      );
    }
  }

  // 2. Dynamically import the chat handler from the built server
  // The server must be built first: pnpm --filter voyager-server build
  let chatHandler: (req: unknown, res: unknown) => Promise<void>;
  let createTrip: (
    userId: string,
    input: Record<string, unknown>,
  ) => Promise<{ id: string }>;
  let deleteTrip: (tripId: string, userId: string) => Promise<boolean>;
  let getTripWithDetails: (
    tripId: string,
    userId: string,
  ) => Promise<Record<string, unknown> | null>;
  let resetTokenBudget: (userId: string) => Promise<void>;

  try {
    // Use relative path to server dist
    const serverDist = join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      '..',
      'apps',
      'server',
      'dist',
    );

    const chatModule = await import(
      join(serverDist, 'handlers', 'chat', 'chat.js')
    );
    chatHandler = chatModule.chat;

    const tripModule = await import(
      join(serverDist, 'repositories', 'trips', 'trips.js')
    );
    createTrip = tripModule.createTrip;
    deleteTrip = tripModule.deleteTrip;
    getTripWithDetails = tripModule.getTripWithDetails;

    const budgetModule = await import(
      join(serverDist, 'services', 'cache', 'tokenBudgetService.js')
    );
    resetTokenBudget = budgetModule.resetTokenBudget;
  } catch (err) {
    console.error('Failed to import server modules. Build the server first:');
    console.error('  pnpm --filter voyager-server build');
    console.error('Error:', err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // Eval user — ensure a test user exists in the database
  const EVAL_USER_ID = '00000000-0000-0000-0000-e00000000001';
  try {
    const dbModule = await import(resolveServerPoolPath());
    const query = dbModule.query as (
      text: string,
      values?: unknown[],
    ) => Promise<{ rows: unknown[] }>;
    const existing = await query('SELECT id FROM users WHERE id = $1', [
      EVAL_USER_ID,
    ]);
    if (existing.rows.length === 0) {
      await query(
        `INSERT INTO users (id, email, password_hash, first_name, last_name)
         VALUES ($1, $2, $3, $4, $5)`,
        [EVAL_USER_ID, 'eval@voyager.test', 'no-login', 'Eval', 'Runner'],
      );
      console.log('Created eval test user');
    }
  } catch (err) {
    console.error('Failed to ensure eval user exists:', err);
    process.exit(1);
  }

  // 3. Run conversations
  const results: PersonaResult[] = [];
  let totalTurns = 0;

  for (let i = 0; i < personas.length; i++) {
    const persona = personas[i]!;
    console.log(
      `\n[${i + 1}/${personas.length}] Running: ${persona.name} (${persona.archetype})`,
    );

    let tripId: string | undefined;

    try {
      // Reset per-user token budget so earlier personas don't block later ones
      await resetTokenBudget(EVAL_USER_ID);

      // Create test trip
      const trip = await createTrip(EVAL_USER_ID, {
        destination: persona.destination,
      });
      tripId = trip.id;

      // Run conversation
      const convResult: ConversationResult = await runConversation(
        persona,
        chatHandler,
        trip.id,
        EVAL_USER_ID,
      );

      // Get final trip state for assertions
      const tripRecord = await getTripWithDetails(trip.id, EVAL_USER_ID);

      // Run assertions
      const assertions = runAssertions({
        completed: convResult.completed,
        error: convResult.error,
        persona,
        tool_calls: convResult.tool_calls,
        tool_results: convResult.tool_results,
        transcript: convResult.transcript,
        tripRecord,
      });
      const assertionScore = computeAssertionScore(assertions);

      // Run judge. A judge failure must never discard the completed (and
      // billed) conversation: keep the transcript and assertions, zero the
      // judge dimensions, and record the error (EVAL-01: this catch-all
      // previously ate two full runs, on a retired judge model and again on
      // a rejected prefill).
      console.log('  Judging...');
      let judgeScores: JudgeScores;
      let judgeError: string | undefined;
      try {
        judgeScores = await runJudge(persona, convResult.transcript);
      } catch (err) {
        judgeError = err instanceof Error ? err.message : String(err);
        console.error(`  Judge failed: ${judgeError}`);
        const failedJudge = {
          justification: `Judge failed: ${judgeError}`,
          score: 0,
        };
        judgeScores = {
          efficiency: failedJudge,
          error_recovery: failedJudge,
          relevance: failedJudge,
          task_completion: failedJudge,
          tone: failedJudge,
        };
      }
      const judgeScore = computeJudgeScore(judgeScores);

      // Compute overall (30% assertions, 70% judge)
      let overall =
        assertionScore * ASSERTION_WEIGHT + judgeScore * JUDGE_WEIGHT;
      if (isCriticalFailure(assertions)) {
        overall = Math.min(overall, CRITICAL_FAILURE_SCORE_CAP);
      }
      overall = Math.round(overall * SCORE_PRECISION) / SCORE_PRECISION;

      totalTurns += convResult.turns;

      results.push({
        archetype: persona.archetype,
        assertion_score: assertionScore,
        assertions,
        config: persona,
        error: judgeError ?? convResult.error,
        judge_score: judgeScore,
        judge_scores: judgeScores,
        name: persona.name,
        overall,
        transcript: convResult.transcript,
        turns: convResult.turns,
      });

      console.log(
        `  Score: ${overall.toFixed(SCORE_DECIMALS)} (${convResult.turns} turns)`,
      );
    } catch (err) {
      console.error(
        `  Error: ${err instanceof Error ? err.message : String(err)}`,
      );
      // Push a failed result
      const defaultJudge = {
        justification: 'Conversation failed to run',
        score: 0,
      };
      results.push({
        archetype: persona.archetype,
        assertion_score: 0,
        assertions: {
          budget_respected: true,
          conversation_completed: false,
          details_collected: false,
          format_response_used: false,
          no_errors: false,
          response_length: true,
          search_executed: false,
          search_results_have_names: true,
          search_results_have_prices: true,
        },
        config: persona,
        error: err instanceof Error ? err.message : String(err),
        judge_score: 0,
        judge_scores: {
          efficiency: defaultJudge,
          error_recovery: defaultJudge,
          relevance: defaultJudge,
          task_completion: defaultJudge,
          tone: defaultJudge,
        },
        name: persona.name,
        overall: 0,
        transcript: [],
        turns: 0,
      });
    } finally {
      // Clean up test trip
      if (tripId) {
        await deleteTrip(tripId, EVAL_USER_ID).catch(() => {});
      }
    }
  }

  // 4. Build report
  const overallScore =
    results.length > 0
      ? Math.round(
          (results.reduce((sum, r) => sum + r.overall, 0) / results.length) *
            SCORE_PRECISION,
        ) / SCORE_PRECISION
      : 0;

  const assertionsPassed = results.reduce(
    (sum, r) => sum + Object.values(r.assertions).filter(Boolean).length,
    0,
  );
  const assertionsTotal = results.reduce(
    (sum, r) => sum + Object.values(r.assertions).length,
    0,
  );

  const report: EvalReport = {
    duration_ms: Date.now() - startTime,
    personas: results,
    summary: {
      assertions_passed: assertionsPassed,
      assertions_total: assertionsTotal,
      overall: overallScore,
      personas: results.length,
      turns: totalTurns,
    },
    timestamp: new Date().toISOString(),
  };

  // 5. Output
  printCliReport(report);

  const reportsDir = join(__dirname, '..', 'reports');
  writeJsonReport(report, reportsDir);

  // 6. Compare if requested
  if (compareFile) {
    compareReports(report, compareFile);
  }
}

main().catch((err) => {
  console.error('Eval failed:', err);
  process.exit(1);
});
