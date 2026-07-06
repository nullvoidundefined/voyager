#!/usr/bin/env node
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import {
  createMockReq,
  createMockRes,
  parseSSEChunks,
} from '../runner/harness.js';
import { getAntagonistResponse } from './antagonist.js';
import { ATTACKS } from './attacks.js';
import { runJudge } from './judge.js';
import {
  diffReports,
  formatDiff,
  printReport,
  rollupByCategory,
  summarize,
  writeReport,
} from './reporter.js';
import { runAttack } from './runner.js';
import type {
  AdversarialReport,
  AdversarialTranscriptEntry,
  AttackResult,
  Severity,
} from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

config({ path: join(__dirname, '..', '..', '..', 'apps', 'server', '.env') });

process.env.NODE_ENV = 'test';
process.env.EVAL_MOCK_SEARCH = 'true';

const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg?.split('=')[1];
}
const categoryFilter = getArg('category');
const attackFilter = getArg('attack');
const severityFilter = getArg('severity') as Severity | undefined;
const compareFile = getArg('compare');
const maxTurnsOverride = getArg('max-turns')
  ? parseInt(getArg('max-turns')!, 10)
  : undefined;

const EVAL_USER_ID = '00000000-0000-0000-0000-e00000000001';

async function main() {
  const startTime = Date.now();
  console.log('Voyager Adversarial Eval');
  console.log('-'.repeat(40));

  // Filter the catalog
  let selected = ATTACKS.slice();
  if (categoryFilter)
    selected = selected.filter((a) => a.category === categoryFilter);
  if (attackFilter) selected = selected.filter((a) => a.id === attackFilter);
  if (severityFilter)
    selected = selected.filter((a) => a.severity === severityFilter);
  if (maxTurnsOverride)
    selected = selected.map((a) => ({ ...a, max_turns: maxTurnsOverride }));

  if (selected.length === 0) {
    console.error('No attacks match the given filters.');
    process.exit(1);
  }
  console.log(`Running ${selected.length} attacks`);

  // Dynamically import chat handler and trip helpers from server build
  const serverDist = join(
    __dirname,
    '..',
    '..',
    '..',
    'apps',
    'server',
    'dist',
  );
  let chatHandler: (req: unknown, res: unknown) => Promise<void>;
  let createTrip: (
    userId: string,
    input: Record<string, unknown>,
  ) => Promise<{ id: string }>;
  let deleteTrip: (tripId: string, userId: string) => Promise<boolean>;
  let resetTokenBudget: (userId: string) => Promise<void>;
  let query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;

  try {
    const chatModule = await import(
      join(serverDist, 'handlers', 'chat', 'chat.js')
    );
    chatHandler = chatModule.chat;
    const tripModule = await import(
      join(serverDist, 'repositories', 'trips', 'trips.js')
    );
    createTrip = tripModule.createTrip;
    deleteTrip = tripModule.deleteTrip;
    const budgetModule = await import(
      join(serverDist, 'services', 'cache', 'tokenBudgetService.js')
    );
    resetTokenBudget = budgetModule.resetTokenBudget;
    const dbModule = await import(join(serverDist, 'database', 'pool.js'));
    query = dbModule.query;
  } catch (err) {
    console.error('Failed to import server modules. Build the server first:');
    console.error('  pnpm --filter voyager-server build');
    console.error('Error:', err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // Ensure eval user exists
  const existing = await query('SELECT id FROM users WHERE id = $1', [
    EVAL_USER_ID,
  ]);
  if (existing.rows.length === 0) {
    await query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4, $5)`,
      [EVAL_USER_ID, 'eval@voyager.test', 'no-login', 'Eval', 'Runner'],
    );
  }

  // Run each attack
  const results: AttackResult[] = [];
  for (let i = 0; i < selected.length; i++) {
    const attack = selected[i]!;
    console.log(
      `\n[${i + 1}/${selected.length}] ${attack.id}: ${attack.title}`,
    );

    let tripId: string | undefined;
    try {
      await resetTokenBudget(EVAL_USER_ID);
      const trip = await createTrip(EVAL_USER_ID, {
        destination: 'Adversarial Eval',
      });
      tripId = trip.id;

      const callAgent = async (
        userMessage: string,
        _history: AdversarialTranscriptEntry[],
      ) => {
        const req = createMockReq(trip.id, EVAL_USER_ID, userMessage);
        const res = createMockRes();
        await chatHandler(req, res);
        if (res.statusCode !== 200 || res.jsonData) {
          return {
            error: `HTTP ${res.statusCode}: ${JSON.stringify(res.jsonData)}`,
            tool_results: [],
            transcript: [
              {
                content: `[HTTP ${res.statusCode}]`,
                role: 'assistant' as const,
              },
            ],
          };
        }
        const events = parseSSEChunks(res.chunks);
        const doneEvent = events.find((e) => e.type === 'done');
        let agentText = '';
        const tool_results: Array<{ tool_name: string; result: unknown }> = [];
        const nodeTypeToTool: Record<string, string> = {
          car_rental_tiles: 'search_car_rentals',
          experience_tiles: 'search_experiences',
          flight_tiles: 'search_flights',
          hotel_tiles: 'search_hotels',
        };
        const tool_calls: string[] = [];
        if (doneEvent?.data?.message) {
          const message = doneEvent.data.message as Record<string, unknown>;
          const nodes = (message.nodes ?? []) as Array<Record<string, unknown>>;
          for (const node of nodes) {
            if (node.type === 'text' && typeof node.content === 'string') {
              agentText += node.content + '\n';
            }
            const toolName = nodeTypeToTool[node.type as string];
            if (toolName) {
              tool_results.push({ result: node, tool_name: toolName });
              tool_calls.push(toolName);
            }
          }
        }
        return {
          tool_results,
          transcript: [
            {
              content: agentText.trim() || '[No text response]',
              role: 'assistant' as const,
              tool_calls,
            },
          ],
        };
      };

      const runOut = await runAttack({
        attack,
        callAgent,
        callAntagonist: getAntagonistResponse,
      });

      const verdict = await runJudge(
        attack,
        runOut.transcript,
        runOut.verdict_pre.must_not_violated,
      );

      results.push({
        antagonist_outcome: runOut.antagonist_outcome,
        attack_id: attack.id,
        category: attack.category,
        error: runOut.error,
        severity: attack.severity,
        transcript: runOut.transcript,
        turns: runOut.turns,
        verdict,
      });
      console.log(
        `  -> ${verdict.passed ? 'PASS' : 'FAIL'} (${runOut.antagonist_outcome})`,
      );
    } catch (err) {
      console.error(
        `  -> ERROR: ${err instanceof Error ? err.message : String(err)}`,
      );
      results.push({
        antagonist_outcome: 'agent_failed',
        attack_id: attack.id,
        category: attack.category,
        error: err instanceof Error ? err.message : String(err),
        severity: attack.severity,
        transcript: [],
        turns: 0,
        verdict: {
          evidence_turns: [],
          must_not_violated: [],
          passed: false,
          rationale: `Run error: ${err instanceof Error ? err.message : String(err)}`,
          refusal_quality: 'n/a',
        },
      });
    } finally {
      if (tripId) await deleteTrip(tripId, EVAL_USER_ID).catch(() => {});
    }
  }

  const report: AdversarialReport = {
    attacks: results,
    by_category: rollupByCategory(results),
    duration_ms: Date.now() - startTime,
    summary: summarize(results),
    timestamp: new Date().toISOString(),
  };

  printReport(report);

  const reportsDir = join(__dirname, '..', '..', 'reports');
  const { jsonPath } = writeReport(report, reportsDir, report.timestamp);
  console.log(`\nReport: ${jsonPath}`);

  if (compareFile) {
    const prevRaw = readFileSync(compareFile, 'utf-8');
    const prev = JSON.parse(prevRaw) as AdversarialReport;
    console.log('\nRegression diff vs baseline:');
    console.log(formatDiff(diffReports(prev, report)));
  }
}

main().catch((err) => {
  console.error('Adversarial eval failed:', err);
  process.exit(1);
});
