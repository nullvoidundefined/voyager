#!/usr/bin/env node
import 'dotenv/config';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { generatePersonas } from './personas/generator.js';
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
import type { Archetype, EvalReport, PersonaResult } from './types.js';

// Parse CLI args
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg?.split('=')[1];
}

const personaCount = getArg('personas')
  ? parseInt(getArg('personas')!)
  : undefined;
const archetypeFilter = getArg('archetype') as Archetype | undefined;
const compareFile = getArg('compare');

// Enable mock search mode — set env var before importing server modules
process.env.EVAL_MOCK_SEARCH = 'true';

async function main() {
  const startTime = Date.now();

  console.log('');
  console.log('\ud83e\udded Voyager Eval Suite');
  console.log('\u2500'.repeat(40));

  // 1. Generate personas
  const personas = generatePersonas({
    count: personaCount,
    archetype: archetypeFilter,
  });
  console.log(`Generated ${personas.length} personas`);

  // 2. Dynamically import the chat handler from the built server
  // The server must be built first: pnpm --filter agentic-travel-agent-server build
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

  try {
    // Use relative path to server dist
    const serverDist = join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      '..',
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
  } catch (err) {
    console.error('Failed to import server modules. Build the server first:');
    console.error('  pnpm --filter agentic-travel-agent-server build');
    console.error('Error:', err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // Eval user ID — create trips under this ID
  const EVAL_USER_ID = '00000000-0000-0000-0000-000000000000';

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
        transcript: convResult.transcript,
        completed: convResult.completed,
        tool_calls: convResult.tool_calls,
        error: convResult.error,
        persona,
        tripRecord,
      });
      const assertionScore = computeAssertionScore(assertions);

      // Run judge
      console.log('  Judging...');
      const judgeScores = await runJudge(persona, convResult.transcript);
      const judgeScore = computeJudgeScore(judgeScores);

      // Compute overall (30% assertions, 70% judge)
      let overall = assertionScore * 0.3 + judgeScore * 0.7;
      if (isCriticalFailure(assertions)) {
        overall = Math.min(overall, 0.4);
      }
      overall = Math.round(overall * 100) / 100;

      totalTurns += convResult.turns;

      results.push({
        name: persona.name,
        archetype: persona.archetype,
        config: persona,
        assertions,
        assertion_score: assertionScore,
        judge_scores: judgeScores,
        judge_score: judgeScore,
        overall,
        turns: convResult.turns,
        transcript: convResult.transcript,
        error: convResult.error,
      });

      console.log(`  Score: ${overall.toFixed(2)} (${convResult.turns} turns)`);
    } catch (err) {
      console.error(
        `  Error: ${err instanceof Error ? err.message : String(err)}`,
      );
      // Push a failed result
      const defaultJudge = {
        score: 0,
        justification: 'Conversation failed to run',
      };
      results.push({
        name: persona.name,
        archetype: persona.archetype,
        config: persona,
        assertions: {
          details_collected: false,
          search_executed: false,
          no_errors: false,
          response_length: true,
          budget_respected: true,
          format_response_used: false,
          conversation_completed: false,
        },
        assertion_score: 0,
        judge_scores: {
          task_completion: defaultJudge,
          efficiency: defaultJudge,
          relevance: defaultJudge,
          tone: defaultJudge,
          error_recovery: defaultJudge,
        },
        judge_score: 0,
        overall: 0,
        turns: 0,
        transcript: [],
        error: err instanceof Error ? err.message : String(err),
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
            100,
        ) / 100
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
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - startTime,
    summary: {
      overall: overallScore,
      personas: results.length,
      turns: totalTurns,
      assertions_passed: assertionsPassed,
      assertions_total: assertionsTotal,
    },
    personas: results,
  };

  // 5. Output
  printCliReport(report);

  const __dirname = dirname(fileURLToPath(import.meta.url));
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
