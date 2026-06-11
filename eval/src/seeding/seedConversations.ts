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
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';

import { VoyagerApiClient } from './apiClient.js';
import { SCENARIOS } from './scenarios.js';
import type { TripScenario } from './scenarios.js';

config({ path: resolve(process.cwd(), '../apps/server/.env') });

const BASE_URL = process.env.SEEDER_BASE_URL ?? 'http://localhost:3001';
const SEEDER_EMAIL = process.env.SEEDER_EMAIL ?? 'eval-seeder@voyager.test';
const SEEDER_PASSWORD = process.env.SEEDER_PASSWORD ?? 'Seeder!2026';

async function runScenario(
  client: VoyagerApiClient,
  scenario: TripScenario,
): Promise<number> {
  process.stdout.write(`  scenario: ${scenario.name}\n`);

  let trip = await client.createTrip(scenario.trip);
  if (scenario.update) {
    trip = await client.updateTrip(trip.id, scenario.update);
  }

  let seededTurns = 0;
  for (const turn of scenario.turns) {
    process.stdout.write(`    -> "${turn.message.slice(0, 60)}..."\n`);
    const result = await client.sendChatMessage(trip.id, turn.message);
    if (result) {
      const nodeCount = result.message.nodes.length;
      process.stdout.write(`       done. nodes=${nodeCount}\n`);
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

  console.info(`\nSeeding complete.`);
  console.info(
    `  Scenarios: ${SCENARIOS.length - failedScenarios}/${SCENARIOS.length} succeeded`,
  );
  console.info(`  Turns seeded: ${totalTurns}`);
  console.info('\nRun eval:production to score the new turns:');
  console.info('  pnpm --filter voyager-eval eval:production');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
