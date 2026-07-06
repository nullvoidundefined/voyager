/**
 * Eval seeder. Creates trips via the Voyager API and sends scripted chat
 * messages, causing the agent loop to run with MOCK_TOOLS=1. The resulting
 * assistant turns are written to the database and scored by runProductionEval.
 *
 * Usage (from monorepo root):
 *   cd apps/server && E2E_MOCK_TOOLS=1 pnpm dev &
 *   cd eval && pnpm seed
 *
 * Environment (resolved against apps/server/.env by default):
 *   SEEDER_BASE_URL   - API base URL (default: http://localhost:3001)
 *   SEEDER_EMAIL      - test user email (default: eval-seeder@voyager.test)
 *   SEEDER_PASSWORD   - test user password (default: Seeder!2026)
 *
 * Two-turn flow per scenario:
 *   Turn 1 (warmup): triggers the plan agent, which returns a plan_card node.
 *   Turn 2+ (scored): sent with planConfirmation=<plan_card from turn 1>, which
 *     sets tracker.plan_confirmed=true and routes to the flight or hotel sub-agent.
 *     These are the turns that runProductionEval scores.
 */
import { resolve } from 'node:path';

import { config } from 'dotenv';

import {
  type PlanCard,
  VoyagerApiClient,
  extractPlanCard,
} from './apiClient.js';
import { SCENARIOS } from './scenarios.js';
import type { TripScenario } from './scenarios.js';

config({ path: resolve(process.cwd(), '../apps/server/.env') });

const MESSAGE_PREVIEW_LENGTH = 60;
const BASE_URL = process.env.SEEDER_BASE_URL ?? 'http://localhost:3001';
const SEEDER_EMAIL = process.env.SEEDER_EMAIL ?? 'eval-seeder@voyager.test';
const SEEDER_PASSWORD = process.env.SEEDER_PASSWORD ?? 'Seeder!2026';

async function fetchPlanCard(
  client: VoyagerApiClient,
  tripId: string,
): Promise<PlanCard | null> {
  const warmup = await client.sendChatMessage(tripId, "Let's start planning.");
  if (!warmup) {
    process.stdout.write('    warmup: agent error\n');
    return null;
  }
  const card = extractPlanCard(warmup);
  process.stdout.write(`    warmup: plan_card ${card ? 'found' : 'missing'}\n`);
  return card;
}

async function runScenario(
  client: VoyagerApiClient,
  scenario: TripScenario,
): Promise<number> {
  process.stdout.write(`  scenario: ${scenario.name}\n`);

  let trip = await client.createTrip(scenario.trip);
  if (scenario.update) {
    trip = await client.updateTrip(trip.id, scenario.update);
  }

  const planCard = await fetchPlanCard(client, trip.id);

  let seededTurns = 0;
  for (const turn of scenario.turns) {
    process.stdout.write(
      `    -> "${turn.message.slice(0, MESSAGE_PREVIEW_LENGTH)}"\n`,
    );
    const result = await client.sendChatMessage(
      trip.id,
      turn.message,
      planCard ?? undefined,
    );
    if (result) {
      const nodes = result.message.nodes as Array<{ type: string }>;
      const types = nodes.map((n) => n.type).join(', ');
      process.stdout.write(`       done. nodes=[${types}]\n`);
      seededTurns++;
    } else {
      process.stdout.write('       agent error -- turn not seeded\n');
    }
  }
  return seededTurns;
}

async function main(): Promise<void> {
  console.info(`Seeder base URL: ${BASE_URL}`);
  console.info(`Seeder user: ${SEEDER_EMAIL}`);
  console.info(`Scenarios: ${SCENARIOS.length}\n`);

  const client = new VoyagerApiClient(BASE_URL);

  console.info('Authenticating...');
  await client.ensureSession(SEEDER_EMAIL, SEEDER_PASSWORD, 'Eval', 'Seeder');
  console.info('Authenticated.\n');

  let totalTurns = 0;
  let failedScenarios = 0;

  for (const scenario of SCENARIOS) {
    try {
      const seeded = await runScenario(client, scenario);
      totalTurns += seeded;
    } catch (err) {
      console.error(`  FAILED: ${scenario.name}: ${String(err)}`);
      failedScenarios++;
    }
  }

  console.info('\nSeeding complete.');
  console.info(
    `  Scenarios: ${SCENARIOS.length - failedScenarios}/${SCENARIOS.length} succeeded`,
  );
  console.info(`  Turns seeded: ${totalTurns} (warmup turns not counted)`);
  console.info('\nRun eval:production to score the new turns:');
  console.info('  pnpm --filter voyager-eval eval:production');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
