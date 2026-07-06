#!/usr/bin/env tsx

/**
 * Cross-model judge validation runner (audit follow-up).
 *
 * The published 0.79 adversarial pass-rate was measured against a
 * single hardcoded judge model. That measures the grader's self-
 * consistency on one model, not the product's robustness. This
 * script reruns the adversarial eval against multiple judge models
 * and reports the spread.
 *
 * Verdict rule:
 *   spread <= 0.05  -> grader is stable; the headline number stands.
 *   spread >  0.05  -> the number is grader-specific and must be
 *                      reported as a range, not a point.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... pnpm --filter voyager-eval exec \
 *     tsx src/adversarial/crossModelJudge.ts
 *
 * Optional override of the model list:
 *   EVAL_JUDGE_MODELS=claude-haiku-4-5-20251001,claude-sonnet-5,claude-opus-4-8 \
 *     pnpm ... tsx src/adversarial/crossModelJudge.ts
 *
 * Cost note: this triples (or 3x's) the adversarial eval cost
 * because it re-judges every attack with every model. Run on a
 * smaller attack subset first via the standard eval runner's
 * filter mechanism if you want a cheap smoke.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_MODELS = [
  'claude-haiku-4-5-20251001',
  'claude-sonnet-5',
  'claude-opus-4-8',
];

export function getCrossJudgeModels(): string[] {
  const env = process.env.EVAL_JUDGE_MODELS;
  if (!env) return DEFAULT_MODELS;
  return env
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
}

interface RunSummary {
  model: string;
  passRate: number | null;
  exitCode: number | null;
  rawOutputTail: string;
}

function parsePassRate(stdout: string): number | null {
  // The adversarial reporter prints a final line like:
  //   "Overall pass-rate: 0.79 (47/59)"
  // (see eval/src/adversarial/reporter.ts). Parse defensively.
  const match = stdout.match(/pass[- ]?rate[: ]+([0-9.]+)/i);
  if (!match || !match[1]) return null;
  const num = Number(match[1]);
  return Number.isFinite(num) ? num : null;
}

async function runOne(model: string): Promise<RunSummary> {
  console.log(`\n=== Running adversarial eval with judge model: ${model} ===`);
  const result = spawnSync('npx', ['tsx', path.join(__dirname, 'index.ts')], {
    cwd: path.resolve(__dirname, '..', '..'),
    encoding: 'utf-8',
    env: { ...process.env, EVAL_JUDGE_MODEL: model },
    stdio: ['inherit', 'pipe', 'inherit'],
  });
  const stdout = result.stdout ?? '';
  process.stdout.write(stdout);
  return {
    exitCode: result.status,
    model,
    passRate: parsePassRate(stdout),
    rawOutputTail: stdout.slice(-500),
  };
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Fatal: ANTHROPIC_API_KEY is required to run the eval.');
    process.exit(1);
  }

  const models = getCrossJudgeModels();
  console.log(`Cross-model judge validation across ${models.length} models:`);
  models.forEach((m) => console.log(`  - ${m}`));

  const summaries: RunSummary[] = [];
  for (const model of models) {
    summaries.push(await runOne(model));
  }

  console.log('\n=== Cross-model judge spread ===');
  const rates = summaries
    .map((s) => s.passRate)
    .filter((r): r is number => r != null);

  for (const s of summaries) {
    const rate = s.passRate == null ? 'PARSE FAILED' : s.passRate.toFixed(2);
    const exit = s.exitCode == null ? '?' : s.exitCode;
    console.log(`  ${s.model.padEnd(32)} pass-rate=${rate}  exit=${exit}`);
  }

  if (rates.length < 2) {
    console.log(
      '\nCannot compute spread: fewer than 2 successful runs returned a parseable pass-rate.',
    );
    process.exit(1);
  }

  const min = Math.min(...rates);
  const max = Math.max(...rates);
  const spread = max - min;

  console.log(
    `\nMin: ${min.toFixed(2)}, Max: ${max.toFixed(2)}, Spread: ${spread.toFixed(2)}`,
  );

  if (spread > 0.05) {
    console.log(
      `Spread > 0.05: the published pass-rate is grader-specific. Report as a range (${min.toFixed(2)}-${max.toFixed(2)}), not a point.`,
    );
    process.exit(2);
  }

  console.log(
    'Spread <= 0.05: the headline pass-rate is stable across judges.',
  );
}

void main();
